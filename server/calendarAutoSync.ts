import crypto from "crypto";
import { storage } from "./storage";
import { listCalendarEvents, refreshCalendarToken, registerCalendarWebhook } from "./googleCalendar";
import type { CalendarConnection } from "@shared/schema";

export class CalendarAutoSync {
  private intervalId: NodeJS.Timeout | null = null;
  private isSyncing: boolean = false;
  // OPTIMIZED: Increased interval from 1 hour to 2 hours to reduce resource contention
  // Webhooks handle real-time updates, so this is just a backup sync
  private syncIntervalMs: number = 2 * 60 * 60 * 1000; // 2 hours (was 1 hour)

  constructor(syncIntervalMs?: number) {
    if (syncIntervalMs) {
      this.syncIntervalMs = syncIntervalMs;
    }
  }

  async start() {
    if (this.intervalId) {
      console.log("[Calendar Auto-Sync] Already running");
      return;
    }

    console.log(`[Calendar Auto-Sync] Starting with ${this.syncIntervalMs / 1000}s interval`);
    
    this.intervalId = setInterval(() => {
      this.syncAllCalendars().catch(error => {
        console.error("[Calendar Auto-Sync] Error during sync:", error);
      });
    }, this.syncIntervalMs);

    // Run initial sync after 30 seconds
    setTimeout(() => {
      this.syncAllCalendars().catch(error => {
        console.error("[Calendar Auto-Sync] Error during initial sync:", error);
      });
    }, 30000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Calendar Auto-Sync] Stopped");
    }
  }

  private async syncAllCalendars() {
    if (this.isSyncing) {
      console.log("[Calendar Auto-Sync] Sync already in progress, skipping");
      return;
    }

    this.isSyncing = true;

    try {
      // Get all calendar connections with autoSync enabled
      const connections = await storage.getCalendarConnections();
      const autoSyncConnections = connections.filter(c => c.autoSync && c.isActive);
      
      if (autoSyncConnections.length === 0) {
        console.log("[Calendar Auto-Sync] No connections with auto-sync enabled");
        return;
      }

      console.log(`[Calendar Auto-Sync] Checking ${autoSyncConnections.length} calendars (syncing + webhook renewal)`);

      for (const connection of autoSyncConnections) {
        try {
          // Check if webhook needs renewal (expires within 24 hours)
          if (connection.provider === 'google' && connection.webhookExpiration) {
            const hoursUntilExpiry = (new Date(connection.webhookExpiration).getTime() - Date.now()) / (1000 * 60 * 60);
            
            if (hoursUntilExpiry < 24) {
              console.log(`[Calendar Auto-Sync] Webhook expiring soon for ${connection.email}, renewing...`);
              await this.renewWebhook(connection);
            }
          }

          // Sync calendar events
          await this.syncConnection(connection.id, connection);
        } catch (error) {
          console.error(`[Calendar Auto-Sync] Error syncing connection ${connection.id}:`, error);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async renewWebhook(connection: CalendarConnection) {
    try {
      let accessToken = connection.accessToken!;
      
      // Refresh token if expired
      if (connection.expiresAt && new Date(connection.expiresAt) < new Date() && connection.refreshToken) {
        const newTokens = await refreshCalendarToken(connection.refreshToken);
        accessToken = newTokens.access_token!;
        await storage.updateCalendarConnection(connection.id, {
          accessToken: newTokens.access_token || connection.accessToken,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : connection.expiresAt,
        });
      }

      // Register new webhook with new secret token
      const channelId = `calendar_${connection.id}_${Date.now()}`;
      const webhookToken = crypto.randomBytes(32).toString('hex');
      
      console.log(`[Calendar Auto-Sync] Renewing webhook for ${connection.email}, channel: ${channelId}`);
      
      const webhookData = await registerCalendarWebhook(
        accessToken,
        connection.calendarId || 'primary',
        channelId,
        webhookToken
      );

      // Update connection with new webhook data
      await storage.updateCalendarConnection(connection.id, {
        webhookId: webhookData.channelId,
        webhookResourceId: webhookData.resourceId,
        webhookToken,
        webhookExpiration: webhookData.expiration,
      });

      console.log(`[Calendar Auto-Sync] ✅ Webhook renewed successfully for ${connection.email}`);
      console.log(`[Calendar Auto-Sync] Channel ID: ${webhookData.channelId}, expires ${webhookData.expiration}`);
    } catch (error: any) {
      console.error(`[Calendar Auto-Sync] ❌ Failed to renew webhook for ${connection.email}`);
      console.error("[Calendar Auto-Sync] Webhook renewal error:", {
        message: error.message,
        code: error.code,
        errors: error.errors,
        response: error.response?.data,
      });
    }
  }

  private async syncConnection(connectionId: string, connection: CalendarConnection) {
    try {
      // Calendar sync/import is disabled - we only send events TO calendars, not import FROM them
      console.log(`[Calendar Auto-Sync] Sync skipped for ${connection.email} - import disabled (only sending events to calendar)`);
      return;

      // Check if access token is expired
      let accessToken = connection.accessToken;
      if (connection.expiresAt && new Date(connection.expiresAt) < new Date()) {
        console.log(`[Calendar Auto-Sync] Token expired for ${connection.email}, refreshing...`);
        
        // Refresh the access token
        const newTokens = await refreshCalendarToken(connection.refreshToken);
        accessToken = newTokens.access_token!;
        
        // Update the connection with new tokens
        await storage.updateCalendarConnection(connectionId, {
          accessToken: newTokens.access_token!,
          expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
        });
      }

      // Fetch events for the next 30 days
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(now.getDate() + 30);

      const events = await listCalendarEvents(
        accessToken,
        connection.calendarId || 'primary',
        now,
        futureDate,
        250
      );

      console.log(`[Calendar Auto-Sync] Fetched ${events.length} events for ${connection.email}`);

      // Collect external IDs from Google Calendar
      const googleEventIds = new Set<string>();

      // Upsert each event to the database
      let syncedCount = 0;
      for (const event of events) {
        // Skip events without start time
        if (!event.start?.dateTime && !event.start?.date) {
          continue;
        }

        if (!event.id) {
          continue;
        }

        googleEventIds.add(event.id);

        // Parse event times
        const startTime = event.start.dateTime 
          ? new Date(event.start.dateTime)
          : new Date(event.start.date + 'T00:00:00');
        
        const endTime = event.end?.dateTime
          ? new Date(event.end.dateTime)
          : event.end?.date
          ? new Date(event.end.date + 'T23:59:59')
          : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour

        // Upsert calendar event
        await storage.upsertCalendarEvent({
          connectionId,
          externalId: event.id,
          title: event.summary || 'Untitled Event',
          description: event.description,
          startTime,
          endTime,
          location: event.location,
          attendees: event.attendees ? JSON.parse(JSON.stringify(event.attendees)) : null,
          isAllDay: !event.start.dateTime,
          status: event.status,
        });

        syncedCount++;
      }

      // Delete events that no longer exist in Google Calendar
      // Only delete events within the sync window to avoid removing legitimate events outside the range
      const existingEvents = await storage.getAllCalendarEvents(now, futureDate);
      const eventsToDelete = existingEvents.filter(
        e => e.connectionId === connectionId && !googleEventIds.has(e.externalId)
      );
      
      for (const event of eventsToDelete) {
        await storage.deleteCalendarEvent(event.id);
      }
      
      if (eventsToDelete.length > 0) {
        console.log(`[Calendar Auto-Sync] Deleted ${eventsToDelete.length} removed events for ${connection.email}`);
      }

      // Update last synced timestamp
      await storage.updateCalendarConnection(connectionId, {
        lastSyncedAt: new Date(),
      });

      console.log(`[Calendar Auto-Sync] Synced ${syncedCount} events for ${connection.email}`);
    } catch (error) {
      console.error(`[Calendar Auto-Sync] Error in syncConnection:`, error);
      throw error;
    }
  }

  // Manual sync method that can be called from API
  async syncConnectionNow(connectionId: string) {
    const connection = await storage.getCalendarConnection(connectionId);
    if (!connection) {
      throw new Error("Connection not found");
    }
    await this.syncConnection(connectionId, connection);
  }
}

// Export singleton instance
export const calendarAutoSync = new CalendarAutoSync();

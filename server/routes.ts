import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertConversationSchema, insertNoteSchema, insertAISettingSchema, insertIntegrationConfigSchema, insertPendingReplySchema, insertCalendarConnectionSchema, insertSchedulePreferenceSchema, insertZillowIntegrationSchema, insertZillowListingSchema } from "@shared/schema";
import { getGmailAuthUrl, getGmailTokensFromCode, listMessages, getMessage, sendReply, getGmailUserEmail } from "./gmail";
import { getOutlookAuthUrl, getOutlookTokensFromCode, listOutlookMessages, getOutlookMessage, sendOutlookReply, getUserProfile, refreshOutlookToken } from "./outlook";
import { parseMessengerWebhook, sendMessengerMessage, getMessengerUserProfile } from "./messenger";
import { getCalendarAuthUrl, getCalendarTokensFromCode, listCalendars, listCalendarEvents, refreshCalendarToken } from "./googleCalendar";
import { getAvailabilityContext } from "./calendarAvailability";
import OpenAI from "openai";
import authRouter from "./auth";
import { gmailScanner } from "./gmailScanner";
import { db } from "./db";
import { zillowListings, properties, organizations } from "@shared/schema";
import { eq } from "drizzle-orm";

console.log("🔥🔥🔥 ROUTES.TS LOADED AT:", new Date().toISOString(), "🔥🔥🔥");

// Middleware to check if user is authenticated
function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
}

// Middleware to attach organization context to request
async function attachOrgContext(req: any, res: any, next: any) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Get user to check their preferred organization
    const user = await storage.getUser(req.user.id);
    let membership;
    
    // Use user's preferred org if set
    if (user?.currentOrgId) {
      membership = await storage.getMembership(req.user.id, user.currentOrgId);
    }
    
    // Fallback to first membership if no preference or membership not found
    if (!membership) {
      membership = await storage.getUserOrganization(req.user.id);
    }
    
    if (!membership) {
      return res.status(403).json({ message: "User not assigned to any organization" });
    }
    
    req.orgId = membership.orgId;
    req.role = membership.role;
    next();
  } catch (error) {
    console.error("[Org Context] Error attaching org context:", error);
    res.status(500).json({ message: "Failed to load organization context" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== AUTH ROUTES =====
  app.use('/api/auth', authRouter);

  // ===== ORGANIZATION ROUTES =====
  // Get all organizations the user is a member of
  app.get("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const orgs = await storage.getUserOrganizations(req.user.id);
      res.json(orgs);
    } catch (error) {
      console.error("[Orgs] Failed to fetch organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Get current organization (from user preference or first membership)
  app.get("/api/organizations/current", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      // Check if user has a preferred org
      if (user?.currentOrgId) {
        const membership = await storage.getMembership(req.user.id, user.currentOrgId);
        if (membership) {
          return res.json(membership);
        }
      }
      
      // Fallback to first membership
      const membership = await storage.getUserOrganization(req.user.id);
      if (!membership) {
        return res.status(404).json({ error: "No organization found" });
      }
      
      // Update user's preference to this org
      await storage.updateUser(req.user.id, { currentOrgId: membership.orgId });
      res.json(membership);
    } catch (error) {
      console.error("[Orgs] Failed to fetch current org:", error);
      res.status(500).json({ error: "Failed to fetch current organization" });
    }
  });

  // Create a new organization
  app.post("/api/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const { name } = req.body;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Organization name is required" });
      }

      const org = await storage.createOrganization(name, req.user.id);
      res.json(org);
    } catch (error) {
      console.error("[Orgs] Failed to create organization:", error);
      res.status(500).json({ error: "Failed to create organization" });
    }
  });

  // Switch to a different organization (update user's active org)
  app.post("/api/organizations/switch", isAuthenticated, async (req: any, res) => {
    try {
      const { orgId } = req.body;
      if (!orgId) {
        return res.status(400).json({ error: "Organization ID is required" });
      }

      // Verify user is a member of this org
      const membership = await storage.getMembership(req.user.id, orgId);
      if (!membership) {
        return res.status(403).json({ error: "You are not a member of this organization" });
      }

      // Update user's current organization preference in database
      await storage.updateUser(req.user.id, { currentOrgId: orgId });
      
      res.json(membership);
    } catch (error) {
      console.error("[Orgs] Failed to switch organization:", error);
      res.status(500).json({ error: "Failed to switch organization" });
    }
  });

  // ===== LEAD ROUTES =====
  app.get("/api/leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { status } = req.query;
      const leads = status 
        ? await storage.getLeadsByStatus(status as string, req.orgId)
        : await storage.getAllLeads(req.orgId);
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Sync progress route must come before :id route to avoid matching "sync-progress" as an id
  app.get("/api/leads/sync-progress", isAuthenticated, async (req, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    res.json(syncProgressTracker.getProgress());
  });

  // Cancel sync route
  app.post("/api/leads/cancel-sync", isAuthenticated, async (req, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    syncProgressTracker.cancel();
    res.json({ message: "Sync cancelled" });
  });

  app.get("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const lead = await storage.getLead(req.params.id, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const conversations = await storage.getConversationsByLeadId(lead.id);
      const notes = await storage.getNotesByLeadId(lead.id);
      
      res.json({ ...lead, conversations, notes });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead({ ...validatedData, orgId: req.orgId });
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: "Invalid lead data" });
    }
  });

  app.patch("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const partialSchema = insertLeadSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      
      // Check for duplicate email if email is being updated
      if (validatedData.email) {
        const existingLead = await storage.getLeadByEmail(validatedData.email, req.orgId);
        if (existingLead && existingLead.id !== req.params.id) {
          return res.status(409).json({ error: "A lead with this email already exists" });
        }
      }
      
      const lead = await storage.updateLead(req.params.id, validatedData, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(400).json({ error: "Failed to update lead" });
    }
  });

  // IMPORTANT: Specific routes must come BEFORE parameterized routes
  app.delete("/api/leads/gmail-sourced", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const count = await storage.deleteGmailSourcedLeads(req.orgId);
      res.json({ 
        message: "Gmail-sourced leads deleted", 
        count 
      });
    } catch (error) {
      console.error("[Delete Gmail Leads] Error:", error);
      res.status(500).json({ error: "Failed to delete Gmail-sourced leads" });
    }
  });

  app.delete("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const deleted = await storage.deleteLead(req.params.id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("[Delete Lead] Error:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // ===== PROPERTY ROUTES =====
  app.get("/api/properties", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const properties = await storage.getAllProperties(req.orgId);
      
      // Enhance with lead counts
      const leads = await storage.getAllLeads(req.orgId);
      const propertiesWithStats = properties.map(property => {
        const propertyLeads = leads.filter(lead => lead.propertyId === property.id);
        const activeLeads = propertyLeads.filter(lead => 
          !['approved', 'rejected'].includes(lead.status)
        ).length;
        
        const approvedLeads = propertyLeads.filter(lead => lead.status === 'approved').length;
        const conversionRate = propertyLeads.length > 0 
          ? Math.round((approvedLeads / propertyLeads.length) * 100) 
          : 0;
        
        return {
          ...property,
          activeLeads,
          conversionRate: `${conversionRate}%`,
        };
      });
      
      res.json(propertiesWithStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch properties" });
    }
  });

  app.get("/api/properties/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const property = await storage.getProperty(req.params.id, req.orgId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty({ ...validatedData, orgId: req.orgId });
      res.status(201).json(property);
    } catch (error) {
      res.status(400).json({ error: "Invalid property data" });
    }
  });

  app.patch("/api/properties/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const partialSchema = insertPropertySchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const property = await storage.updateProperty(req.params.id, validatedData, req.orgId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(400).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const deleted = await storage.deleteProperty(req.params.id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  // ===== CONVERSATION ROUTES =====
  app.get("/api/conversations/:leadId", isAuthenticated, async (req, res) => {
    try {
      const conversations = await storage.getConversationsByLeadId(req.params.leadId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      
      // Update lead's lastContactAt
      await storage.updateLead(validatedData.leadId, { lastContactAt: new Date() } as any, req.orgId);
      
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ error: "Invalid conversation data" });
    }
  });

  // Generate AI reply for a specific lead
  app.post("/api/leads/:leadId/ai-reply", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const leadId = req.params.leadId;
      
      // Get lead details
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Get conversations for this lead
      const conversations = await storage.getConversationsByLeadId(leadId);
      
      // Find the most recent incoming message
      const incomingMessage = conversations
        .filter((c: any) => c.type === 'incoming' || c.type === 'received')
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      
      if (!incomingMessage) {
        return res.status(400).json({ error: "No incoming message to reply to" });
      }

      // Get calendar availability context
      const availabilityContext = await getAvailabilityContext();

      // Generate AI reply based on the lead's inquiry
      const replyPrompt = `You are a professional property manager responding to a rental inquiry. 
      
Lead Information:
- Name: ${lead.name}
- Property Interested In: ${lead.propertyName || 'our property'}
- Move-in Date: ${lead.moveInDate || 'Not specified'}
- Their Message: ${incomingMessage.message}

${availabilityContext}

Write a friendly, professional email response that:
1. Thanks them for their interest
2. Confirms receipt of their inquiry
3. Briefly addresses their specific questions or needs
4. If they're asking about viewing/showing times, suggest specific available times based on the calendar above
5. Mentions next steps (viewing, application, etc.)
6. Signs off warmly

Keep it concise (3-4 paragraphs). Write only the email body, no subject line.`;

      const replyCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: replyPrompt }],
        temperature: 0.7,
      });

      const aiReplyContent = replyCompletion.choices[0].message.content || "";

      // Create pending reply for review
      const pendingReply = await storage.createPendingReply({
        leadId: lead.id,
        leadName: lead.name,
        leadEmail: lead.email,
        subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
        content: aiReplyContent,
        originalMessage: incomingMessage.message,
        channel: incomingMessage.channel || 'email',
        status: 'pending',
        threadId: (incomingMessage as any).threadId,
        inReplyTo: incomingMessage.externalId,
        references: incomingMessage.externalId,
      });

      res.status(201).json({ 
        message: "AI reply generated successfully",
        pendingReply 
      });
    } catch (error) {
      console.error("Error generating AI reply:", error);
      res.status(500).json({ error: "Failed to generate AI reply" });
    }
  });

  // ===== NOTE ROUTES =====
  app.get("/api/notes/:leadId", isAuthenticated, async (req, res) => {
    try {
      const notes = await storage.getNotesByLeadId(req.params.leadId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  // ===== AI SETTINGS ROUTES =====
  app.get("/api/ai-settings/:category", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const settings = await storage.getAISettings(req.params.category, req.orgId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI settings" });
    }
  });

  app.post("/api/ai-settings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertAISettingSchema.parse(req.body);
      const setting = await storage.upsertAISetting({ ...validatedData, orgId: req.orgId });
      res.status(201).json(setting);
    } catch (error) {
      res.status(400).json({ error: "Invalid AI setting data" });
    }
  });

  // ===== INTEGRATION CONFIG ROUTES =====
  
  // Middleware to prevent ETag caching
  const noCache = (req: any, res: any, next: any) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.removeHeader('ETag');
    res.set('ETag', undefined);
    next();
  };

  // Get Outlook integration status - MUST be before generic :service route
  app.get("/api/integrations/outlook", isAuthenticated, noCache, attachOrgContext, async (req: any, res) => {
    console.log("🚨🚨🚨 [v2] OUTLOOK STATUS CHECK for org:", req.orgId);
    
    try {
      const config = await storage.getIntegrationConfig("outlook", req.orgId);
      console.log("==> Config found:", config ? "YES" : "NO");
      
      if (!config || !config.isActive) {
        console.log("==> Returning: NOT CONNECTED");
        return res.json({ connected: false, _ts: Date.now() });
      }

      let tokens = config.config as any;
      
      // Try to get profile with current access token
      try {
        console.log("==> Fetching Outlook user profile...");
        const profile = await getUserProfile(tokens.access_token);
        console.log("==> Profile email:", profile.email);
        
        const result = {
          connected: true,
          email: profile.email,
          displayName: profile.displayName,
          id: config.id,
          config: { scope: tokens.scope },
          isActive: config.isActive,
          _ts: Date.now(),
        };
        
        console.log("==> Returning CONNECTED state for:", profile.email);
        return res.json(result);
      } catch (profileError: any) {
        // If 403 Forbidden, token is expired - refresh it
        if (profileError.response?.status === 403 || profileError.response?.status === 401) {
          console.log("==> Access token expired, refreshing...");
          
          try {
            const refreshedTokens = await refreshOutlookToken(tokens.refresh_token);
            console.log("==> Token refreshed successfully");
            
            // Update database with new tokens
            await storage.upsertIntegrationConfig({
              service: "outlook",
              config: refreshedTokens,
              isActive: true,
              orgId: req.orgId,
            });
            
            // Retry profile fetch with new token
            const profile = await getUserProfile(refreshedTokens.access_token);
            console.log("==> Profile fetched with refreshed token:", profile.email);
            
            return res.json({
              connected: true,
              email: profile.email,
              displayName: profile.displayName,
              id: config.id,
              config: { scope: refreshedTokens.scope },
              isActive: config.isActive,
              _ts: Date.now(),
            });
          } catch (refreshError) {
            console.error("==> Token refresh failed:", refreshError);
            return res.json({ connected: false, error: "token_refresh_failed", _ts: Date.now() });
          }
        } else {
          throw profileError;
        }
      }
    } catch (err) {
      console.error("==> ERROR in Outlook status:", err);
      return res.json({ connected: false, _ts: Date.now() });
    }
  });

  // Generic integration config route - catches other services
  app.get("/api/integrations/:service", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const config = await storage.getIntegrationConfig(req.params.service, req.orgId);
      res.json(config || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integration config" });
    }
  });

  app.post("/api/integrations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      const config = await storage.upsertIntegrationConfig({ ...validatedData, orgId: req.orgId });
      res.status(201).json(config);
    } catch (error) {
      res.status(400).json({ error: "Invalid integration config data" });
    }
  });

  // ===== CALENDAR ROUTES =====
  
  // Google Calendar OAuth
  app.get("/api/auth/google-calendar", isAuthenticated, async (req, res) => {
    try {
      const authUrl = getCalendarAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error generating Google Calendar auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/auth/google-calendar/callback", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.query;
      if (!code || typeof code !== 'string') {
        return res.status(400).send("Missing authorization code");
      }

      const tokens = await getCalendarTokensFromCode(code);
      
      // Get calendar list to get primary calendar info
      const calendars = await listCalendars(tokens.access_token!);
      const primaryCalendar = calendars.find(cal => cal.primary) || calendars[0];

      // Store calendar connection
      await storage.createCalendarConnection({
        userId: null, // TODO: Add user session support
        provider: 'google',
        email: primaryCalendar?.id || 'unknown',
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        calendarId: primaryCalendar?.id || 'primary',
        calendarName: primaryCalendar?.summary || 'Google Calendar',
        isActive: true,
      });

      res.redirect('/schedule?connected=google');
    } catch (error) {
      console.error("Error in Google Calendar callback:", error);
      res.status(500).send("Failed to connect Google Calendar");
    }
  });

  // Calendar connections
  app.get("/api/calendar/connections", isAuthenticated, async (req, res) => {
    try {
      const connections = await storage.getCalendarConnections();
      // Don't expose tokens in response
      const safeConnections = connections.map(conn => ({
        id: conn.id,
        provider: conn.provider,
        email: conn.email,
        calendarName: conn.calendarName,
        isActive: conn.isActive,
        createdAt: conn.createdAt,
      }));
      res.json(safeConnections);
    } catch (error) {
      console.error("Error fetching calendar connections:", error);
      res.status(500).json({ error: "Failed to fetch calendar connections" });
    }
  });

  app.delete("/api/calendar/connections/:id", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteCalendarConnection(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar connection:", error);
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  // Sync calendar events
  app.post("/api/calendar/sync/:connectionId", isAuthenticated, async (req, res) => {
    try {
      const connection = await storage.getCalendarConnection(req.params.connectionId);
      if (!connection) {
        return res.status(404).json({ error: "Connection not found" });
      }

      if (connection.provider === 'google') {
        let accessToken = connection.accessToken!;
        
        // Check if token is expired and refresh if needed
        if (connection.expiresAt && connection.expiresAt < new Date()) {
          if (connection.refreshToken) {
            try {
              const newTokens = await refreshCalendarToken(connection.refreshToken);
              accessToken = newTokens.access_token!;
              
              // Update connection with new tokens
              await storage.updateCalendarConnection(connection.id, {
                accessToken: newTokens.access_token || connection.accessToken,
                expiresAt: newTokens.expiry_date ? new Date(newTokens.expiry_date) : connection.expiresAt,
              });
            } catch (refreshError) {
              console.error("Error refreshing token:", refreshError);
              return res.status(401).json({ error: "Token expired and refresh failed. Please reconnect your calendar." });
            }
          } else {
            return res.status(401).json({ error: "Token expired. Please reconnect your calendar." });
          }
        }

        // Sync next 30 days of events
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);

        const events = await listCalendarEvents(
          accessToken,
          connection.calendarId!,
          now,
          futureDate
        );

        let syncedCount = 0;
        for (const event of events) {
          if (!event.id) continue;

          const startTime = event.start?.dateTime || event.start?.date;
          const endTime = event.end?.dateTime || event.end?.date;
          
          if (!startTime || !endTime) continue;

          await storage.upsertCalendarEvent({
            connectionId: connection.id,
            externalId: event.id,
            title: event.summary || 'Untitled Event',
            description: event.description || null,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            location: event.location || null,
            attendees: event.attendees ? event.attendees as any : null,
            isAllDay: !!event.start?.date,
            status: event.status || 'confirmed',
          });
          syncedCount++;
        }

        res.json({ success: true, syncedCount });
      } else {
        res.status(400).json({ error: "Provider not supported for sync yet" });
      }
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ error: "Failed to sync calendar" });
    }
  });

  // Get calendar events (with optional date range)
  app.get("/api/calendar/events", isAuthenticated, async (req, res) => {
    try {
      const { startTime, endTime } = req.query;
      
      const start = startTime ? new Date(startTime as string) : undefined;
      const end = endTime ? new Date(endTime as string) : undefined;

      const events = await storage.getAllCalendarEvents(start, end);
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  // Schedule preferences
  app.get("/api/schedule/preferences", isAuthenticated, async (req, res) => {
    try {
      const preferences = await storage.getSchedulePreferences();
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching schedule preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.post("/api/schedule/preferences", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertSchedulePreferenceSchema.parse(req.body);
      const preference = await storage.createSchedulePreference(validatedData);
      res.status(201).json(preference);
    } catch (error) {
      console.error("Error creating schedule preference:", error);
      res.status(400).json({ error: "Invalid preference data" });
    }
  });

  app.delete("/api/schedule/preferences/:id", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.deleteSchedulePreference(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Preference not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting schedule preference:", error);
      res.status(500).json({ error: "Failed to delete preference" });
    }
  });

  // Get availability (free/busy times)
  app.get("/api/calendar/availability", isAuthenticated, async (req, res) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ error: "Date parameter required" });
      }

      const targetDate = new Date(date);
      const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
      const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

      // Get all events for the day
      const events = await storage.getAllCalendarEvents(dayStart, dayEnd);

      // Get schedule preferences for this day
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[targetDate.getDay()];
      const preferences = await storage.getSchedulePreferences();
      const dayPreference = preferences.find(p => p.dayOfWeek.toLowerCase() === dayOfWeek);

      res.json({
        date,
        events,
        preferredTimes: dayPreference ? {
          startTime: dayPreference.startTime,
          endTime: dayPreference.endTime,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching availability:", error);
      res.status(500).json({ error: "Failed to fetch availability" });
    }
  });

  // ===== ANALYTICS ROUTES =====
  app.get("/api/analytics/stats", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const stats = await storage.getLeadStats(req.orgId);
      
      // Calculate additional metrics
      const allLeads = await storage.getAllLeads(req.orgId);
      const totalLeads = stats.total;
      const approvedLeads = stats.byStatus.approved || 0;
      const conversionRate = totalLeads > 0 ? Math.round((approvedLeads / totalLeads) * 100) : 0;
      
      // Calculate average response time (mock for now)
      const avgResponseTime = "2.3 min";
      
      // Get active properties count
      const properties = await storage.getAllProperties(req.orgId);
      
      res.json({
        totalLeads,
        conversionRate: `${conversionRate}%`,
        avgResponseTime,
        activeProperties: properties.length,
        byStatus: stats.byStatus,
        bySource: stats.bySource,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/trends", isAuthenticated, async (req, res) => {
    try {
      // Mock trend data for now
      const trends = [
        { month: "Jan", leads: 45 },
        { month: "Feb", leads: 52 },
        { month: "Mar", leads: 48 },
        { month: "Apr", leads: 61 },
        { month: "May", leads: 55 },
        { month: "Jun", leads: 67 },
      ];
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trends" });
    }
  });

  // ===== AI ACTIVITY FEED =====
  app.get("/api/ai-activity", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const conversations = await storage.getAllLeads(req.orgId);
      
      // Get recent AI-generated conversations
      const activities = [];
      for (const lead of conversations.slice(0, 5)) {
        const convos = await storage.getConversationsByLeadId(lead.id);
        const aiConvos = convos.filter(c => c.aiGenerated).slice(0, 1);
        
        for (const convo of aiConvos) {
          activities.push({
            id: convo.id,
            type: "response",
            channel: convo.channel,
            leadName: lead.name,
            action: convo.message.substring(0, 100) + "...",
            timestamp: new Date(convo.createdAt).toLocaleString(),
            status: "success",
          });
        }
      }
      
      res.json(activities.slice(0, 4));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI activity" });
    }
  });

  // ===== GMAIL OAUTH ROUTES =====
  app.get("/api/integrations/gmail/auth", isAuthenticated, async (req: any, res) => {
    try {
      // Use the authenticated user's ID for Gmail OAuth
      const userId = req.user.id;
      console.log("[Gmail OAuth] Generating auth URL for user:", userId);
      const authUrl = getGmailAuthUrl(userId);
      console.log("[Gmail OAuth] Generated auth URL:", authUrl);
      const response = { url: authUrl };
      console.log("[Gmail OAuth] Sending response:", response);
      res.json(response);
    } catch (error) {
      console.error("[Gmail OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/integrations/gmail/callback", isAuthenticated, async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code) {
        return res.status(400).send("Authorization code missing");
      }

      // Exchange code for tokens
      const tokens = await getGmailTokensFromCode(code as string);

      // Note: This route needs orgId but Gmail OAuth callback doesn't have attachOrgContext
      // For now, we need to get the user's orgId manually
      const membership = await storage.getUserOrganization(req.user.id);
      if (!membership) {
        return res.redirect("/settings?gmail=error&reason=no_org");
      }
      
      // Store tokens in integrationConfig
      await storage.upsertIntegrationConfig({
        service: "gmail",
        config: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: tokens.expiry_date,
          scope: tokens.scope,
          token_type: tokens.token_type,
        },
        isActive: true,
        orgId: membership.orgId,
      });

      // Redirect back to settings with success message
      res.redirect("/settings?gmail=connected");
    } catch (error) {
      console.error("Gmail OAuth error:", error);
      res.redirect("/settings?gmail=error");
    }
  });

  // ===== GMAIL LEAD SYNC =====
  app.post("/api/leads/sync-from-gmail", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    
    try {
      // Reset tracker at the start to clear any stale state
      syncProgressTracker.reset();
      
      // Start with placeholder count (will update once we know total emails)
      syncProgressTracker.start(0);
      syncProgressTracker.updateStep('Initializing sync...');
      
      // Check for cancellation before starting
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled before start" });
      }
      
      // Get Gmail integration config
      const gmailConfig = await storage.getIntegrationConfig("gmail", req.orgId);
      const tokens = gmailConfig?.config as any;
      if (!gmailConfig || !tokens?.access_token) {
        syncProgressTracker.fail("Gmail not connected");
        return res.status(400).json({ error: "Gmail not connected" });
      }

      syncProgressTracker.addLog('info', '✓ Gmail credentials verified');

      // Get the property manager's Gmail email address to identify outgoing messages
      const propertyManagerEmail = await getGmailUserEmail(tokens);
      syncProgressTracker.addLog('info', `📧 Property manager email: ${propertyManagerEmail}`);

      // Check for cancellation
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled" });
      }

      // Get all properties to match against
      const properties = await storage.getAllProperties(req.orgId);
      syncProgressTracker.addLog('info', `✓ Loaded ${properties.length} properties`);

      // Check for cancellation before fetching emails
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled" });
      }

      // Fetch comprehensive email history (up to 5000 emails)
      syncProgressTracker.addLog('info', '📧 Fetching emails from Gmail...');
      syncProgressTracker.updateStep('Fetching emails from Gmail...');
      const messages = await listMessages(tokens, 5000, () => syncProgressTracker.isCancelled());
      
      // Check if cancelled during fetch
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled during email fetch" });
      }

      // Update total count now that we know how many emails we have (without resetting logs)
      syncProgressTracker.setTotal(messages.length);
      syncProgressTracker.addLog('success', `✓ Fetched ${messages.length} emails`);
      syncProgressTracker.updateStep(`Analyzing ${messages.length} emails with AI...`);
      
      const createdLeads = [];
      const duplicates = [];
      const parseErrors = [];
      const skipped = [];
      const processingLogs = [];
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Track threadId -> leadId mapping to ensure all emails in a thread go to same lead
      const threadLeadMap = new Map<string, string>();

      for (const msg of messages) {
        // Check for cancellation
        if (syncProgressTracker.isCancelled()) {
          syncProgressTracker.addLog('warning', '⚠️ Sync cancelled by user');
          break;
        }

        if (!msg.id) {
          syncProgressTracker.incrementProcessed();
          continue;
        }
        
        syncProgressTracker.incrementProcessed();
        const current = syncProgressTracker.getProgress().processedEmails;
        
        if (current % 10 === 0 || current === 1) {
          syncProgressTracker.updateStep(`Processing email ${current}/${messages.length}...`);
        }

        // Get full message content first to extract sender/subject for logging
        const fullMessage = await getMessage(tokens, msg.id);
        const headers = fullMessage.payload?.headers || [];
        const from = headers.find((h: any) => h.name === "From")?.value || "";
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
        const threadId = fullMessage.threadId;
        
        // Get email body - recursively search for text/plain or text/html in nested parts
        const findBodyPart = (parts: any[], mimeType: string): any => {
          for (const part of parts) {
            if (part.mimeType === mimeType && part.body?.data) {
              return part;
            }
            if (part.parts) {
              const found = findBodyPart(part.parts, mimeType);
              if (found) return found;
            }
          }
          return null;
        };

        let emailBody = "";
        if (fullMessage.payload?.parts) {
          // Prefer text/plain, fallback to text/html
          const textPart = findBodyPart(fullMessage.payload.parts, "text/plain");
          const htmlPart = findBodyPart(fullMessage.payload.parts, "text/html");
          
          if (textPart?.body?.data) {
            emailBody = Buffer.from(textPart.body.data, "base64").toString();
          } else if (htmlPart?.body?.data) {
            // Decode HTML and strip tags for preview
            const htmlContent = Buffer.from(htmlPart.body.data, "base64").toString();
            emailBody = htmlContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        } else if (fullMessage.payload?.body?.data) {
          emailBody = Buffer.from(fullMessage.payload.body.data, "base64").toString();
        }

        const emailPreview = emailBody.substring(0, 150).replace(/\n/g, ' ').trim();

        // Check if this exact message was already processed by externalId (message ID)
        const existingConversation = await storage.getConversationByExternalId(msg.id);
        if (existingConversation) {
          duplicates.push({ messageId: msg.id, reason: "Already processed" });
          syncProgressTracker.addLog('warning', `⏭️  Skipped duplicate: "${subject.substring(0, 50)}..."`);
          processingLogs.push({
            status: "duplicate",
            from,
            subject,
            preview: emailPreview,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        // Check if this is a reply in an existing thread (new message in existing conversation)
        let threadLead = null;
        if (threadId) {
          threadLead = await storage.getLeadByGmailThreadId(threadId, req.orgId);
          
          if (threadLead) {
            // This is a reply to an existing thread - add it as a new conversation
            // Check if the message is from the property manager (outgoing) or the lead (incoming)
            const isFromPropertyManager = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
            const conversationType = isFromPropertyManager ? "outgoing" : "received";
            
            syncProgressTracker.addLog('info', `💬 Thread reply: Adding ${conversationType} message to lead "${threadLead.name}"`);
            
            // Create conversation record for the reply with full email body
            await storage.createConversation({
              leadId: threadLead.id,
              type: conversationType,
              message: emailBody, // Use full email body, not substring
              channel: "email",
              aiGenerated: false,
              externalId: msg.id,
            });
            
            syncProgressTracker.addLog('success', `✅ Added ${conversationType} reply to conversation for ${threadLead.name}`);
            processingLogs.push({
              status: "thread_reply",
              from,
              subject,
              preview: emailPreview,
              leadName: threadLead.name,
              direction: conversationType,
              timestamp: new Date().toISOString(),
            });
            
            // Skip to next message (no need to create new lead)
            continue;
          }
        }

        try {

          // First, use AI to check if this is a real estate rental inquiry
          const filterPrompt = `Analyze this email and determine if it's a real estate rental/property inquiry from a potential tenant.

Consider it a rental inquiry ONLY if:
- Someone is asking about renting/leasing a property
- Expressing interest in viewing/applying for a rental unit
- Asking about rental availability, pricing, or lease terms
- Responding to a rental listing

DO NOT consider these as rental inquiries:
- Newsletters, marketing emails, promotional content
- Property management software/service emails
- Financial services, loans, credit scores
- Job recruiting, social media notifications
- Any automated/system emails
- Sales/purchase inquiries (buying property)

Email From: ${from}
Subject: ${subject}
Body: ${emailBody.substring(0, 1000)}

Respond with ONLY "YES" if this is a rental inquiry, or "NO" if it's not.`;

          const filterCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: filterPrompt }],
            temperature: 0.1,
          });

          const isRentalInquiry = filterCompletion.choices[0].message.content?.trim().toUpperCase() === "YES";
          
          if (!isRentalInquiry) {
            skipped.push({ messageId: msg.id, reason: "Not a rental inquiry" });
            syncProgressTracker.addLog('info', `⏭️  Skipped: "${subject.substring(0, 50)}..." (not rental)`);
            processingLogs.push({
              status: "skipped",
              from,
              subject,
              preview: emailPreview,
              reason: "Not a rental inquiry",
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          // Now extract detailed lead information
          const parsePrompt = `Extract comprehensive lead information from this rental property inquiry email. Return a JSON object with:

REQUIRED FIELDS:
- firstName (string) - first name of the person
- lastName (string) - last name of the person
- email (string) - extract from sender email address

OPTIONAL CONTACT INFO:
- phone (string) - phone number if mentioned
- currentAddress (string) - where they currently live
- location (string) - city/area they want to rent in

RENTAL PREFERENCES:
- propertyName (string) - specific property they're asking about
- message (string) - their main inquiry/questions
- moveInDate (string) - when they want to move in
- budget (string) - their monthly rent budget/range
- bedrooms (number) - number of bedrooms needed
- petPolicy (string) - if they mention pets

PROFILE INFORMATION:
- occupation (string) - their job/profession
- employer (string) - company they work for
- income (string) - annual or monthly income if mentioned
- creditScore (string) - credit score if mentioned
- education (string) - education level/degree if mentioned
- householdSize (number) - number of people moving in
- background (string) - any other relevant background info (smoker/non-smoker, lifestyle, etc)

Email From: ${from}
Subject: ${subject}
Body: ${emailBody}

Return ONLY valid JSON. Leave fields empty string "" or null if not found in the email.`;

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: parsePrompt }],
            temperature: 0.3,
          });

          // Strip markdown code blocks if present
          let rawContent = completion.choices[0].message.content || "{}";
          rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          
          let parsedData;
          try {
            parsedData = JSON.parse(rawContent);
          } catch (parseError) {
            // If JSON parsing fails, use fallback data (common for reply emails)
            syncProgressTracker.addLog('warning', `⚠️  AI parsing failed, using fallback for "${subject.substring(0, 50)}..."`);
            const extractedEmail = from.match(/<(.+)>/)?.[1] || from;
            const nameParts = from.split('<')[0].trim().replace(/"/g, '').split(' ');
            parsedData = {
              firstName: nameParts[0] || 'Unknown',
              lastName: nameParts.slice(1).join(' ') || '',
              email: extractedEmail,
              message: emailBody.substring(0, 500),
              phone: null,
              propertyName: null,
              moveInDate: null,
              budget: null,
              bedrooms: null,
              petPolicy: null,
              currentAddress: null,
              location: null,
              occupation: null,
              employer: null,
              income: null,
              creditScore: null,
              education: null,
              householdSize: null,
              background: null
            };
          }
          
          // Extract email and phone for deduplication
          const leadEmail = (parsedData.email || from.match(/<(.+)>/)?.[1] || from).toLowerCase().trim();
          const leadPhone = parsedData.phone?.trim() || "";

          // First check if this thread already has an associated lead
          let existingLead = null;
          if (threadId && threadLeadMap.has(threadId)) {
            const leadId = threadLeadMap.get(threadId)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `🔗 Thread match: Using existing lead from thread`);
          }
          
          // If not in thread map, check if lead already exists by email or phone
          if (!existingLead) {
            existingLead = await storage.getLeadByEmail(leadEmail, req.orgId);
            if (!existingLead && leadPhone) {
              existingLead = await storage.getLeadByPhone(leadPhone, req.orgId);
            }
          }

          let leadToUse;
          if (existingLead) {
            // Update existing lead with any new information
            leadToUse = existingLead;
            syncProgressTracker.addLog('info', `📋 Found existing lead: ${existingLead.name}`);
            
            // Update lead if we have additional information
            const updates: Partial<any> = {};
            if (parsedData.phone && !existingLead.phone) updates.phone = parsedData.phone;
            if (parsedData.income && !existingLead.income) updates.income = parsedData.income;
            if (parsedData.moveInDate && !existingLead.moveInDate) updates.moveInDate = parsedData.moveInDate;
            if (threadId && !existingLead.gmailThreadId) updates.gmailThreadId = threadId;
            
            // Merge profile data
            if (existingLead.profileData) {
              const existingProfile = existingLead.profileData as any;
              const mergedProfile = {
                ...existingProfile,
                ...(parsedData.currentAddress && !existingProfile.currentAddress && { currentAddress: parsedData.currentAddress }),
                ...(parsedData.location && !existingProfile.location && { location: parsedData.location }),
                ...(parsedData.occupation && !existingProfile.occupation && { occupation: parsedData.occupation }),
                ...(parsedData.employer && !existingProfile.employer && { employer: parsedData.employer }),
                ...(parsedData.creditScore && !existingProfile.creditScore && { creditScore: parsedData.creditScore }),
                ...(parsedData.education && !existingProfile.education && { education: parsedData.education }),
                ...(parsedData.householdSize && !existingProfile.householdSize && { householdSize: parsedData.householdSize }),
                ...(parsedData.background && !existingProfile.background && { background: parsedData.background }),
                ...(parsedData.budget && !existingProfile.budget && { budget: parsedData.budget }),
                ...(parsedData.bedrooms && !existingProfile.bedrooms && { bedrooms: parsedData.bedrooms }),
                ...(parsedData.petPolicy && !existingProfile.petPolicy && { petPolicy: parsedData.petPolicy }),
              };
              updates.profileData = mergedProfile;
            }
            
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates, req.orgId);
              syncProgressTracker.addLog('info', `✏️  Updated lead info for ${existingLead.name}`);
            }
          } else {
            // Match property if mentioned
            let matchedProperty = null;
            if (parsedData.propertyName) {
              matchedProperty = properties.find(p => 
                p.name.toLowerCase().includes(parsedData.propertyName.toLowerCase()) ||
                parsedData.propertyName.toLowerCase().includes(p.name.toLowerCase())
              );
            }

            // Create new lead with comprehensive profile data and gmailThreadId
            leadToUse = await storage.createLead({
              name: `${parsedData.firstName} ${parsedData.lastName}`.trim(),
              email: leadEmail,
              phone: leadPhone,
              propertyId: matchedProperty?.id || properties[0]?.id || null,
              propertyName: matchedProperty?.name || parsedData.propertyName || "Not specified",
              status: "new",
              source: "gmail",
              gmailThreadId: threadId || null,
              income: parsedData.income || null,
              moveInDate: parsedData.moveInDate || null,
              profileData: {
                currentAddress: parsedData.currentAddress || null,
                location: parsedData.location || null,
                occupation: parsedData.occupation || null,
                employer: parsedData.employer || null,
                creditScore: parsedData.creditScore || null,
                education: parsedData.education || null,
                householdSize: parsedData.householdSize || null,
                background: parsedData.background || null,
                budget: parsedData.budget || null,
                bedrooms: parsedData.bedrooms || null,
                petPolicy: parsedData.petPolicy || null,
              },
              orgId: req.orgId,
            });
            syncProgressTracker.addLog('success', `✅ Created new lead: ${leadToUse.name}`);
          }

          // Store threadId -> leadId mapping for future emails in this thread
          if (threadId) {
            threadLeadMap.set(threadId, leadToUse.id);
          }

          // Create conversation record with externalId (linked to the lead)
          await storage.createConversation({
            leadId: leadToUse.id,
            type: "received",
            message: parsedData.message || emailBody.substring(0, 500),
            channel: "email",
            aiGenerated: false,
            externalId: msg.id,
          });

          // Generate AI reply ONLY for testing lead (infinimoji@gmail.com)
          if (leadToUse.email.toLowerCase().includes('infinimoji@gmail.com')) {
            syncProgressTracker.addLog('info', `🤖 Generating AI reply for ${leadToUse.name}...`);
            
            // Get thread ID and message ID for proper email threading
            const threadId = fullMessage.threadId;
            const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;

            // Get calendar availability context
            const availabilityContext = await getAvailabilityContext();

            // Generate AI reply based on the lead's inquiry
            const replyPrompt = `You are a professional property manager responding to a rental inquiry. 
            
Lead Information:
- Name: ${leadToUse.name}
- Property Interested In: ${leadToUse.propertyName}
- Move-in Date: ${parsedData.moveInDate || 'Not specified'}
- Budget: ${parsedData.budget || 'Not specified'}
- Their Message: ${parsedData.message || emailBody.substring(0, 500)}

${availabilityContext}

Write a friendly, professional email response that:
1. Thanks them for their interest
2. Confirms receipt of their inquiry
3. Briefly addresses their specific questions or needs
4. If they're asking about viewing/showing times, suggest specific available times based on the calendar above
5. Mentions next steps (viewing, application, etc.)
6. Signs off warmly

Keep it concise (3-4 paragraphs). Write only the email body, no subject line.`;

            const replyCompletion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: replyPrompt }],
              temperature: 0.7,
            });

            const aiReplyContent = replyCompletion.choices[0].message.content || "";

            // Check if auto-pilot mode is enabled
            const autoPilotSettings = await storage.getAISettings("automation", req.orgId);
            const autoPilotMode = autoPilotSettings.find(s => s.key === "auto_pilot_mode")?.value === "true";

            if (autoPilotMode) {
              // Auto-pilot: Send email immediately
              syncProgressTracker.addLog('info', `✈️ Auto-pilot mode: Sending reply to ${leadToUse.name}...`);
              
              await sendReply(tokens, {
                to: leadToUse.email,
                subject: `Re: ${subject}`,
                body: aiReplyContent,
                threadId: threadId || undefined,
                inReplyTo: messageId || undefined,
                references: messageId || undefined,
              });

              // Record conversation
              await storage.createConversation({
                leadId: leadToUse.id,
                type: 'outgoing',
                channel: 'email',
                message: aiReplyContent,
                aiGenerated: true,
              });

              // Create pending reply marked as sent (for record keeping)
              await storage.createPendingReply({
                leadId: leadToUse.id,
                leadName: leadToUse.name,
                leadEmail: leadToUse.email,
                subject: `Re: ${subject}`,
                content: aiReplyContent,
                originalMessage: emailBody,
                channel: 'email',
                status: 'sent',
                threadId: threadId || undefined,
                inReplyTo: messageId || undefined,
                references: messageId || undefined,
              });

              syncProgressTracker.addLog('success', `✅ AI reply sent automatically to ${leadToUse.name}`);
            } else {
              // Manual approval mode: Create pending reply
              await storage.createPendingReply({
                leadId: leadToUse.id,
                leadName: leadToUse.name,
                leadEmail: leadToUse.email,
                subject: `Re: ${subject}`,
                content: aiReplyContent,
                originalMessage: emailBody,
                channel: 'email',
                status: 'pending',
                threadId: threadId || undefined,
                inReplyTo: messageId || undefined,
                references: messageId || undefined,
              });

              syncProgressTracker.addLog('success', `✅ AI reply generated for ${leadToUse.name} (pending approval)`);
            }
          }

          // Track created/updated leads
          if (!existingLead) {
            createdLeads.push({
              leadId: leadToUse.id,
              name: leadToUse.name,
              email: leadToUse.email,
              subject,
            });
            syncProgressTracker.addLog('success', `✅ Processed: ${leadToUse.name} - "${subject.substring(0, 40)}..."`);
          }

          processingLogs.push({
            status: "success",
            from,
            subject,
            preview: emailPreview,
            leadName: leadToUse.name,
            timestamp: new Date().toISOString(),
          });

        } catch (processingError: any) {
          const errorMsg = processingError.message || String(processingError);
          parseErrors.push({ messageId: msg.id, error: errorMsg });
          syncProgressTracker.addLog('error', `❌ Failed to process: "${subject.substring(0, 40)}..." - ${errorMsg.substring(0, 100)}`);
          console.error(`[Gmail Sync] Error processing email "${subject}":`, processingError);
          processingLogs.push({
            status: "error",
            from,
            subject,
            preview: emailPreview,
            error: errorMsg,
            timestamp: new Date().toISOString(),
          });
          // Continue processing remaining messages
        }
      }

      const summary = {
        created: createdLeads.length,
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: parseErrors.length,
      };

      syncProgressTracker.complete(summary);
      syncProgressTracker.addLog('success', `✅ Sync complete! Created ${summary.created} leads from ${messages.length} emails`);

      // Clear notified threads for synced leads
      const syncedThreadIds = createdLeads
        .map((lead: any) => lead.gmailThreadId)
        .filter(Boolean) as string[];
      
      if (syncedThreadIds.length > 0) {
        await gmailScanner.clearNotifiedThreads(req.orgId, syncedThreadIds);
      }

      // Mark all gmail_new_leads notifications for this org as read
      const gmailNotifications = await storage.getUserNotifications(req.user.id, req.orgId);
      const gmailNewLeadsNotifications = gmailNotifications.filter(n => n.type === 'gmail_new_leads' && !n.read);
      
      for (const notification of gmailNewLeadsNotifications) {
        await storage.markNotificationAsRead(notification.id, req.user.id);
      }

      res.json({
        success: true,
        createdLeads,
        duplicates,
        skipped,
        parseErrors,
        processingLogs,
        total: messages.length,
        summary,
      });

    } catch (error) {
      syncProgressTracker.fail(String(error));
      console.error("Gmail sync error:", error);
      res.status(500).json({ error: "Failed to sync Gmail messages" });
    }
  });

  // ===== OUTLOOK OAUTH ROUTES =====
  app.get("/api/integrations/outlook/auth", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Outlook OAuth] Generating auth URL for user:", userId);
      const authUrl = getOutlookAuthUrl(userId);
      console.log("[Outlook OAuth] Generated auth URL:", authUrl);
      res.json({ url: authUrl });
    } catch (error) {
      console.error("[Outlook OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/integrations/outlook/callback", async (req, res) => {
    try {
      console.log("[Outlook Callback] Received callback with query:", req.query);
      const { code, state: userId, error, error_description } = req.query;
      
      if (error) {
        console.error("[Outlook Callback] OAuth error:", error, error_description);
        return res.redirect("/integrations?outlook=error&reason=" + error);
      }
      
      if (!code) {
        console.error("[Outlook Callback] No authorization code provided");
        return res.status(400).send("Authorization code missing");
      }

      if (!userId) {
        console.error("[Outlook Callback] No user ID in state parameter");
        return res.redirect("/integrations?outlook=error&reason=no_user");
      }

      console.log("[Outlook Callback] Exchanging code for tokens for user:", userId);
      // Exchange code for tokens
      const tokens = await getOutlookTokensFromCode(code as string);
      console.log("[Outlook Callback] Received tokens, scopes:", tokens.scope);

      // Get user's organization
      const membership = await storage.getUserOrganization(userId as string);
      if (!membership) {
        console.error("[Outlook Callback] No organization found for user:", userId);
        return res.redirect("/integrations?outlook=error&reason=no_org");
      }
      
      console.log("[Outlook Callback] Storing tokens for org:", membership.orgId);
      // Store tokens in integrationConfig
      await storage.upsertIntegrationConfig({
        service: "outlook",
        config: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope,
        },
        isActive: true,
        orgId: membership.orgId,
      });

      console.log("[Outlook Callback] Successfully stored Outlook integration");
      // Redirect back to integrations page with success message
      res.redirect("/integrations?outlook=connected");
    } catch (error) {
      console.error("[Outlook Callback] Error:", error);
      res.redirect("/integrations?outlook=error");
    }
  });

  // Disconnect Outlook integration
  app.post("/api/integrations/outlook/disconnect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { deleteLeads } = req.body;
      
      // Deactivate the integration
      const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
      if (outlookConfig) {
        await storage.upsertIntegrationConfig({
          service: "outlook",
          config: outlookConfig.config as any,
          isActive: false,
          orgId: req.orgId,
        });
      }

      // Optionally delete Outlook-sourced leads
      if (deleteLeads) {
        const leads = await storage.getAllLeads(req.orgId);
        const outlookLeads = leads.filter(l => l.source === 'outlook');
        
        for (const lead of outlookLeads) {
          await storage.deleteLead(lead.id, req.orgId);
        }
        
        console.log(`[Outlook] Deleted ${outlookLeads.length} Outlook-sourced leads for org ${req.orgId}`);
      }

      res.json({ success: true, message: "Outlook disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Outlook:", error);
      res.status(500).json({ error: "Failed to disconnect Outlook" });
    }
  });

  // ===== FACEBOOK MESSENGER WEBHOOK =====
  // Webhook verification (GET) - Facebook will call this to verify your webhook
  app.get("/api/integrations/messenger/webhook", async (req: any, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('[Messenger Webhook] Verification request:', { mode, token, challenge: challenge ? 'present' : 'missing' });
    
    // Use a static verify token from environment or default
    // Users must use THIS EXACT TOKEN when setting up webhook in Facebook Developer Console
    const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || 'leaseloopai_messenger_verify_2024';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Messenger Webhook] ✅ Verification successful');
      res.status(200).send(challenge);
    } else {
      console.log('[Messenger Webhook] ❌ Verification failed');
      res.sendStatus(403);
    }
  });

  // Webhook event receiver (POST) - Facebook sends messages here
  app.post("/api/integrations/messenger/webhook", async (req: any, res) => {
    console.log('[Messenger Webhook] Received event:', JSON.stringify(req.body, null, 2));
    
    try {
      const messages = parseMessengerWebhook(req.body);
      
      for (const msg of messages) {
        console.log('[Messenger] Processing message:', msg);
        
        // Get page access token from integration config
        // For now, we'll need to match by recipient ID (page ID)
        const allConfigs = await storage.getAllMessengerIntegrations();
        const config = allConfigs.find((c: any) => c.config?.pageId === msg.recipientId);
        
        if (!config || !config.isActive) {
          console.log('[Messenger] No active config found for page:', msg.recipientId);
          continue;
        }
        
        const pageAccessToken = config.config.pageAccessToken;
        
        // Get or create lead
        let lead = await storage.getLeadByExternalId(`messenger_${msg.senderId}`, config.orgId);
        
        if (!lead) {
          // Get user profile from Messenger
          try {
            const profile = await getMessengerUserProfile(msg.senderId, pageAccessToken);
            
            lead = await storage.createLead({
              name: `${profile.first_name} ${profile.last_name}`.trim() || 'Unknown',
              email: null,
              phone: null,
              source: 'messenger',
              status: 'new',
              externalId: `messenger_${msg.senderId}`,
              metadata: {
                messenger_id: msg.senderId,
                profile_pic: profile.profile_pic
              },
              orgId: config.orgId,
            });
            
            console.log('[Messenger] Created new lead:', lead.id);
          } catch (profileError) {
            console.error('[Messenger] Failed to get profile, creating basic lead:', profileError);
            
            lead = await storage.createLead({
              name: 'Facebook User',
              email: null,
              phone: null,
              source: 'messenger',
              status: 'new',
              externalId: `messenger_${msg.senderId}`,
              metadata: { messenger_id: msg.senderId },
              orgId: config.orgId,
            });
          }
        }
        
        // Store conversation
        await storage.createConversation({
          leadId: lead.id,
          type: 'incoming',
          channel: 'messenger',
          message: msg.text,
          externalId: msg.messageId,
        });
        
        console.log('[Messenger] Stored conversation for lead:', lead.id);
        
        // TODO: Generate AI response if auto-respond enabled
        // For now, just acknowledge receipt
      }
      
      // CRITICAL: Must return 200 within 20 seconds
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('[Messenger Webhook] Error processing event:', error);
      // Still return 200 to prevent Facebook from retrying
      res.status(200).send('EVENT_RECEIVED');
    }
  });

  // Get Messenger integration status
  app.get("/api/integrations/messenger", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const config = await storage.getIntegrationConfig("messenger", req.orgId);
      
      if (!config || !config.isActive) {
        return res.json({ connected: false });
      }
      
      const messengerConfig = config.config as any;
      return res.json({
        connected: true,
        pageName: messengerConfig.pageName,
        pageId: messengerConfig.pageId,
        id: config.id,
        isActive: config.isActive,
      });
    } catch (err) {
      console.error('[Messenger] Error fetching status:', err);
      return res.json({ connected: false });
    }
  });

  // Configure Messenger integration
  app.post("/api/integrations/messenger/configure", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { pageAccessToken, verifyToken, pageName, pageId } = req.body;
      
      if (!pageAccessToken || !verifyToken) {
        return res.status(400).json({ error: 'Page access token and verify token are required' });
      }
      
      await storage.upsertIntegrationConfig({
        service: 'messenger',
        config: {
          pageAccessToken,
          verifyToken,
          pageName: pageName || 'Facebook Page',
          pageId: pageId || 'unknown'
        },
        isActive: true,
        orgId: req.orgId,
      });
      
      res.json({ success: true, message: 'Messenger configured successfully' });
    } catch (error) {
      console.error('[Messenger] Configuration error:', error);
      res.status(500).json({ error: 'Failed to configure Messenger' });
    }
  });

  // Disconnect Messenger integration
  app.post("/api/integrations/messenger/disconnect", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const { deleteLeads } = req.body;
      
      const config = await storage.getIntegrationConfig("messenger", req.orgId);
      if (config) {
        await storage.upsertIntegrationConfig({
          service: "messenger",
          config: config.config as any,
          isActive: false,
          orgId: req.orgId,
        });
      }

      if (deleteLeads) {
        const leads = await storage.getAllLeads(req.orgId);
        const messengerLeads = leads.filter(l => l.source === 'messenger');
        
        for (const lead of messengerLeads) {
          await storage.deleteLead(lead.id, req.orgId);
        }
        
        console.log(`[Messenger] Deleted ${messengerLeads.length} Messenger leads for org ${req.orgId}`);
      }

      res.json({ success: true, message: "Messenger disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Messenger:", error);
      res.status(500).json({ error: "Failed to disconnect Messenger" });
    }
  });

  // ===== OUTLOOK LEAD SYNC =====
  app.post("/api/leads/sync-from-outlook", isAuthenticated, attachOrgContext, async (req: any, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    
    try {
      syncProgressTracker.reset();
      syncProgressTracker.start(0);
      syncProgressTracker.updateStep('Initializing Outlook sync...');
      
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled before start" });
      }
      
      // Get Outlook integration config
      const outlookConfig = await storage.getIntegrationConfig("outlook", req.orgId);
      const tokens = outlookConfig?.config as any;
      if (!outlookConfig || !tokens?.access_token) {
        syncProgressTracker.fail("Outlook not connected");
        return res.status(400).json({ error: "Outlook not connected" });
      }

      syncProgressTracker.addLog('info', '✓ Outlook credentials verified');

      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled" });
      }

      // Get all properties to match against
      const properties = await storage.getAllProperties(req.orgId);
      syncProgressTracker.addLog('info', `✓ Loaded ${properties.length} properties`);

      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled" });
      }

      // Fetch emails from Outlook (up to 500)
      syncProgressTracker.addLog('info', '📧 Fetching emails from Outlook...');
      syncProgressTracker.updateStep('Fetching emails from Outlook...');
      const messages = await listOutlookMessages(tokens.access_token, 500, () => syncProgressTracker.isCancelled());
      
      if (syncProgressTracker.isCancelled()) {
        return res.json({ message: "Sync cancelled during email fetch" });
      }

      syncProgressTracker.setTotal(messages.length);
      syncProgressTracker.addLog('success', `✓ Fetched ${messages.length} emails`);
      syncProgressTracker.updateStep(`Analyzing ${messages.length} emails with AI...`);
      
      const createdLeads = [];
      const duplicates = [];
      const parseErrors = [];
      const skipped = [];
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Track conversationId -> leadId mapping
      const conversationLeadMap = new Map<string, string>();

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        
        if (syncProgressTracker.isCancelled()) {
          syncProgressTracker.addLog('warning', '⚠️ Sync cancelled by user');
          break;
        }

        syncProgressTracker.updateProgress(i + 1);
        syncProgressTracker.addLog('info', `Processing email ${i + 1}/${messages.length}...`);

        try {
          const subject = msg.subject || "";
          const fromEmail = msg.from?.emailAddress?.address || "";
          const fromName = msg.from?.emailAddress?.name || "";
          const conversationId = msg.conversationId;
          
          // Get email body
          const bodyContent = msg.body?.content || "";
          const emailBody = bodyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

          // Skip if no sender email
          if (!fromEmail) {
            syncProgressTracker.addLog('warning', `⚠️ Skipped: no sender email`);
            skipped.push({ reason: 'No sender email', subject });
            continue;
          }

          // Check if this conversation already has a lead
          let leadToUse = null;
          if (conversationId && conversationLeadMap.has(conversationId)) {
            const existingLeadId = conversationLeadMap.get(conversationId);
            leadToUse = await storage.getLead(existingLeadId!, req.orgId);
            
            if (leadToUse) {
              syncProgressTracker.addLog('info', `📎 Email belongs to existing conversation for ${leadToUse.name}`);
              
              // Just create conversation record
              await storage.createConversation({
                leadId: leadToUse.id,
                type: "received",
                message: emailBody.substring(0, 500),
                channel: "email",
                aiGenerated: false,
                externalId: msg.id,
              });
              
              duplicates.push({ email: fromEmail, reason: 'Same conversation thread' });
              continue;
            }
          }

          // AI parsing to determine if it's a rental inquiry
          const aiPrompt = `Analyze this email and determine if it's a rental property inquiry. Extract key information.

Email Subject: ${subject}
From: ${fromName} <${fromEmail}>
Body: ${emailBody.substring(0, 1000)}

Return JSON with:
{
  "isRentalInquiry": boolean,
  "firstName": string,
  "lastName": string,
  "phone": string or null,
  "propertyName": string or null,
  "message": string (brief summary),
  "income": string or null,
  "moveInDate": string or null
}`;

          const aiResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: aiPrompt }],
            response_format: { type: "json_object" },
          });

          const parsedData = JSON.parse(aiResponse.choices[0].message.content || "{}");

          if (!parsedData.isRentalInquiry) {
            syncProgressTracker.addLog('info', `⏭️ Skipped: not a rental inquiry`);
            skipped.push({ reason: 'Not a rental inquiry', subject, email: fromEmail });
            continue;
          }

          // Check for duplicate by email or phone
          const leadEmail = fromEmail.toLowerCase().trim();
          const leadPhone = (parsedData.phone || "").trim();
          
          const existingLead = await storage.getLeadByEmail(leadEmail, req.orgId) || 
                              (leadPhone ? await storage.getLeadByPhone(leadPhone, req.orgId) : null);

          if (existingLead) {
            leadToUse = existingLead;
            syncProgressTracker.addLog('info', `📎 Found existing lead: ${existingLead.name}`);
            duplicates.push({ email: fromEmail, leadId: existingLead.id });
            
            // Update lead if new info available
            const updates: any = {};
            if (parsedData.income && !existingLead.income) updates.income = parsedData.income;
            if (parsedData.moveInDate && !existingLead.moveInDate) updates.moveInDate = parsedData.moveInDate;
            
            if (Object.keys(updates).length > 0) {
              await storage.updateLead(existingLead.id, updates, req.orgId);
              syncProgressTracker.addLog('info', `✏️ Updated lead info for ${existingLead.name}`);
            }
          } else {
            // Match property if mentioned
            let matchedProperty = null;
            if (parsedData.propertyName) {
              matchedProperty = properties.find(p => 
                p.name.toLowerCase().includes(parsedData.propertyName.toLowerCase()) ||
                parsedData.propertyName.toLowerCase().includes(p.name.toLowerCase())
              );
            }

            // Create new lead
            leadToUse = await storage.createLead({
              name: `${parsedData.firstName} ${parsedData.lastName}`.trim(),
              email: leadEmail,
              phone: leadPhone,
              propertyId: matchedProperty?.id || properties[0]?.id || null,
              propertyName: matchedProperty?.name || parsedData.propertyName || "Not specified",
              status: "new",
              source: "outlook",
              income: parsedData.income || null,
              moveInDate: parsedData.moveInDate || null,
              profileData: {},
              orgId: req.orgId,
            });
            syncProgressTracker.addLog('success', `✅ Created new lead: ${leadToUse.name}`);
            createdLeads.push(leadToUse);
          }

          // Store conversationId -> leadId mapping
          if (conversationId) {
            conversationLeadMap.set(conversationId, leadToUse.id);
          }

          // Create conversation record
          await storage.createConversation({
            leadId: leadToUse.id,
            type: "received",
            message: parsedData.message || emailBody.substring(0, 500),
            channel: "email",
            aiGenerated: false,
            externalId: msg.id,
          });

        } catch (error) {
          console.error(`Error processing Outlook message ${i}:`, error);
          syncProgressTracker.addLog('error', `❌ Error processing email: ${error}`);
          parseErrors.push({ index: i, error: String(error) });
        }
      }

      const summary = {
        created: createdLeads.length,
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: parseErrors.length,
      };

      syncProgressTracker.complete(summary);
      syncProgressTracker.addLog('success', `✅ Sync complete! Created ${summary.created} leads from ${messages.length} emails`);

      res.json({
        success: true,
        createdLeads,
        duplicates,
        skipped,
        parseErrors,
        total: messages.length,
        summary,
      });

    } catch (error) {
      syncProgressTracker.fail(String(error));
      console.error("Outlook sync error:", error);
      res.status(500).json({ error: "Failed to sync Outlook messages" });
    }
  });

  // ===== PENDING REPLIES ROUTES =====
  app.get("/api/pending-replies", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const pendingReplies = await storage.getAllPendingReplies(req.orgId);
      res.json(pendingReplies);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pending replies" });
    }
  });

  app.post("/api/pending-replies", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertPendingReplySchema.parse(req.body);
      const reply = await storage.createPendingReply(validatedData);
      res.status(201).json(reply);
    } catch (error) {
      res.status(400).json({ error: "Invalid pending reply data" });
    }
  });

  app.patch("/api/pending-replies/:id/approve", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const reply = await storage.getPendingReply(req.params.id, req.orgId);
      if (!reply) {
        return res.status(404).json({ error: "Pending reply not found" });
      }

      // Get Gmail integration for sending
      const gmailConfig = await storage.getIntegrationConfig("gmail", req.orgId);
      const tokens = gmailConfig?.config as any;

      if (!tokens?.access_token) {
        return res.status(400).json({ error: "Gmail not connected" });
      }

      // Send the email
      if (reply.channel === 'email') {
        await sendReply(tokens, {
          to: reply.leadEmail,
          subject: reply.subject,
          body: reply.content,
          threadId: reply.threadId || undefined,
          inReplyTo: reply.inReplyTo || undefined,
          references: reply.references || undefined,
        });

        // Record conversation
        await storage.createConversation({
          leadId: reply.leadId,
          type: 'outgoing',
          channel: 'email',
          message: reply.content,
          aiGenerated: true,
        });

        // Update reply status
        await storage.updatePendingReplyStatus(req.params.id, 'sent', req.orgId);
        
        res.json({ success: true, message: "Email sent successfully" });
      } else {
        res.status(400).json({ error: "Only email replies supported currently" });
      }
    } catch (error) {
      console.error("Failed to approve reply:", error);
      res.status(500).json({ error: "Failed to send reply" });
    }
  });

  app.delete("/api/pending-replies/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const deleted = await storage.deletePendingReply(req.params.id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Pending reply not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete pending reply" });
    }
  });

  app.post("/api/scan-unanswered-leads", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Find all leads from infinimoji@gmail.com that haven't been replied to
      const allLeads = await storage.getAllLeads(req.orgId);
      const testLeads = allLeads.filter(lead => 
        lead.email.toLowerCase().includes('infinimoji@gmail.com')
      );

      const generatedReplies = [];

      for (const lead of testLeads) {
        // Check if this lead already has an outgoing reply
        const conversations = await storage.getConversationsByLeadId(lead.id);
        const hasOutgoingReply = conversations.some((c: any) => c.type === 'outgoing');
        
        if (hasOutgoingReply) {
          continue; // Skip if already replied
        }

        // Check if there's already a pending reply for this lead
        const pendingReplies = await storage.getAllPendingReplies(req.orgId);
        const hasPendingReply = pendingReplies.some((pr: any) => pr.leadId === lead.id && pr.status === 'pending');
        
        if (hasPendingReply) {
          continue; // Skip if already has pending reply
        }

        // Find the incoming message (check both 'incoming' and 'received' types from Gmail sync)
        const incomingMessage = conversations.find((c: any) => c.type === 'incoming' || c.type === 'received');
        if (!incomingMessage) {
          continue; // Skip if no incoming message
        }

        // Get calendar availability context
        const availabilityContext = await getAvailabilityContext();

        // Generate AI reply based on the lead's inquiry
        const replyPrompt = `You are a professional property manager responding to a rental inquiry. 
        
Lead Information:
- Name: ${lead.name}
- Property Interested In: ${lead.propertyName || 'our property'}
- Move-in Date: ${lead.moveInDate || 'Not specified'}
- Their Message: ${incomingMessage.message}

${availabilityContext}

Write a friendly, professional email response that:
1. Thanks them for their interest
2. Confirms receipt of their inquiry
3. Briefly addresses their specific questions or needs
4. If they're asking about viewing/showing times, suggest specific available times based on the calendar above
5. Mentions next steps (viewing, application, etc.)
6. Signs off warmly

Keep it concise (3-4 paragraphs). Write only the email body, no subject line.`;

        const replyCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: replyPrompt }],
          temperature: 0.7,
        });

        const aiReplyContent = replyCompletion.choices[0].message.content || "";

        // Create pending reply for review
        await storage.createPendingReply({
          leadId: lead.id,
          leadName: lead.name,
          leadEmail: lead.email,
          subject: `Re: Inquiry about ${lead.propertyName || 'our property'}`,
          content: aiReplyContent,
          originalMessage: incomingMessage.message,
          channel: 'email',
          status: 'pending',
        });

        generatedReplies.push({
          leadId: lead.id,
          leadName: lead.name,
        });
      }

      res.json({ 
        success: true, 
        count: generatedReplies.length,
        replies: generatedReplies
      });
    } catch (error) {
      console.error("Error scanning unanswered leads:", error);
      res.status(500).json({ error: "Failed to scan unanswered leads" });
    }
  });

  // ===== NOTIFICATION ROUTES =====
  app.get("/api/notifications", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.user.id, req.orgId);
      res.json(notifications);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const count = await storage.getUnreadNotificationCount(req.user.id, req.orgId);
      res.json({ count });
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.markNotificationAsRead(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const success = await storage.deleteNotification(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete notification:", error);
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // ===== ZILLOW INTEGRATION ROUTES =====
  app.get("/api/integrations/zillow", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const integration = await storage.getZillowIntegration(req.orgId);
      if (!integration) {
        return res.json({ configured: false });
      }
      res.json({
        configured: true,
        id: integration.id,
        isActive: integration.isActive,
        createdAt: integration.createdAt,
        updatedAt: integration.updatedAt,
      });
    } catch (error) {
      console.error("Failed to fetch Zillow integration:", error);
      res.status(500).json({ error: "Failed to fetch Zillow integration" });
    }
  });

  app.post("/api/integrations/zillow", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validationResult = insertZillowIntegrationSchema.safeParse({
        apiKey: req.body.apiKey,
        webhookSecret: req.body.webhookSecret,
        isActive: true,
      });

      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid input", details: validationResult.error.errors });
      }

      const { apiKey, webhookSecret } = validationResult.data;
      const existing = await storage.getZillowIntegration(req.orgId);

      if (existing) {
        const updated = await storage.updateZillowIntegration(req.orgId, {
          apiKey,
          webhookSecret,
          isActive: true,
        });
        return res.json(updated);
      }

      const integration = await storage.createZillowIntegration({
        orgId: req.orgId,
        apiKey,
        webhookSecret,
        isActive: true,
      });
      res.json(integration);
    } catch (error) {
      console.error("Failed to create/update Zillow integration:", error);
      res.status(500).json({ error: "Failed to create/update Zillow integration" });
    }
  });

  app.delete("/api/integrations/zillow", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const success = await storage.deleteZillowIntegration(req.orgId);
      if (!success) {
        return res.status(404).json({ error: "Zillow integration not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete Zillow integration:", error);
      res.status(500).json({ error: "Failed to delete Zillow integration" });
    }
  });

  // ===== ZILLOW LISTINGS ROUTES =====
  app.get("/api/zillow/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const listings = await storage.getZillowListings(req.orgId);
      res.json(listings);
    } catch (error) {
      console.error("Failed to fetch Zillow listings:", error);
      res.status(500).json({ error: "Failed to fetch Zillow listings" });
    }
  });

  app.post("/api/zillow/listings", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validationResult = insertZillowListingSchema.safeParse({
        propertyId: req.body.propertyId,
        zillowListingId: req.body.zillowListingId,
        listingUrl: req.body.listingUrl || null,
        isActive: true,
      });

      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid input", details: validationResult.error.errors });
      }

      const { propertyId, zillowListingId, listingUrl } = validationResult.data;

      // Check if property exists
      const property = await storage.getProperty(propertyId, req.orgId);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }

      // Check if property is already listed
      const existingPropertyListing = await storage.getZillowListingByPropertyId(propertyId, req.orgId);
      if (existingPropertyListing) {
        return res.status(400).json({ error: "Property is already listed on Zillow" });
      }

      // Check if Zillow listing ID is already used
      const existingZillowListing = await storage.getZillowListingByZillowId(zillowListingId, req.orgId);
      if (existingZillowListing) {
        return res.status(400).json({ error: "Zillow listing ID is already in use" });
      }

      const listing = await storage.createZillowListing({
        orgId: req.orgId,
        propertyId,
        zillowListingId,
        listingUrl: listingUrl || null,
        isActive: true,
      });
      res.json(listing);
    } catch (error) {
      console.error("Failed to create Zillow listing:", error);
      res.status(500).json({ error: "Failed to create Zillow listing" });
    }
  });

  app.delete("/api/zillow/listings/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const success = await storage.deleteZillowListing(req.params.id, req.orgId);
      if (!success) {
        return res.status(404).json({ error: "Zillow listing not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete Zillow listing:", error);
      res.status(500).json({ error: "Failed to delete Zillow listing" });
    }
  });

  // ===== ZILLOW WEBHOOK ENDPOINT =====
  app.post("/api/webhooks/zillow", async (req, res) => {
    try {
      const { listingId, name, email, phone, movingDate, message, leadType, webhookSecret } = req.body;

      if (!listingId) {
        return res.status(400).json({ error: "Listing ID is required" });
      }

      // Find the listing and integration
      const listing = await db.select({
        zillowListing: zillowListings,
        property: properties,
        org: organizations,
      })
        .from(zillowListings)
        .innerJoin(properties, eq(zillowListings.propertyId, properties.id))
        .innerJoin(organizations, eq(properties.orgId, organizations.id))
        .where(eq(zillowListings.zillowListingId, listingId))
        .limit(1);

      if (!listing || listing.length === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }

      const { zillowListing, property, org } = listing[0];

      // Validate webhook secret for security
      const integration = await storage.getZillowIntegration(org.id);
      if (!integration || integration.webhookSecret !== webhookSecret) {
        return res.status(401).json({ error: "Unauthorized: Invalid webhook secret" });
      }

      // Normalize contact info for deduplication
      const normalizedEmail = email?.toLowerCase().trim() || '';
      const normalizedPhone = phone?.replace(/\D/g, '') || '';

      // Look for existing lead by email or phone
      let lead;
      if (normalizedEmail) {
        lead = await storage.getLeadByEmail(normalizedEmail, org.id);
      }
      if (!lead && normalizedPhone) {
        lead = await storage.getLeadByPhone(normalizedPhone, org.id);
      }

      if (lead) {
        // Update existing lead
        lead = await storage.updateLead(lead.id, {
          lastContactAt: new Date(),
          moveInDate: movingDate || lead.moveInDate,
          propertyId: property.id,
          propertyName: property.name,
        }, org.id);
      } else {
        // Create new lead
        lead = await storage.createLead({
          orgId: org.id,
          name: name || 'Unknown',
          email: normalizedEmail || 'no-email@zillow.lead',
          phone: normalizedPhone || 'no-phone',
          propertyId: property.id,
          propertyName: property.name,
          status: 'new',
          source: 'zillow',
          aiHandled: false,
          moveInDate: movingDate || null,
        });
      }

      // Record conversation
      const conversationType = leadType === 'tourRequest' ? 'tour_request' : 
                              leadType === 'applicationRequest' ? 'application_request' : 
                              'question';

      await storage.createConversation({
        leadId: lead!.id,
        type: conversationType,
        channel: 'zillow',
        message: message || 'Inquiry from Zillow',
        aiGenerated: false,
        externalId: `zillow_${listingId}_${Date.now()}`,
      });

      res.json({ 
        success: true, 
        leadId: lead!.id,
        message: "Lead processed successfully" 
      });
    } catch (error) {
      console.error("Zillow webhook error:", error);
      res.status(500).json({ error: "Failed to process Zillow lead" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

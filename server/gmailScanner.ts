import { storage } from "./storage";
import { listMessages } from "./gmail";

interface ScanResult {
  newMessageCount: number;
  lastScannedAt: Date;
}

export class GmailScanner {
  private intervalId: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;
  private scanIntervalMs: number = 5 * 60 * 1000; // 5 minutes
  private lastScanByOrg: Map<string, Date> = new Map();
  private notifiedThreadsByOrg: Map<string, Set<string>> = new Map();

  constructor(scanIntervalMs?: number) {
    if (scanIntervalMs) {
      this.scanIntervalMs = scanIntervalMs;
    }
  }

  async start() {
    if (this.intervalId) {
      console.log("[Gmail Scanner] Already running");
      return;
    }

    console.log(`[Gmail Scanner] Starting with ${this.scanIntervalMs / 1000}s interval`);
    
    // Initialize notified threads from existing leads
    await this.initializeNotifiedThreads();
    
    this.intervalId = setInterval(() => {
      this.scanAllOrganizations().catch(error => {
        console.error("[Gmail Scanner] Error during scan:", error);
      });
    }, this.scanIntervalMs);

    // Run initial scan after 10 seconds
    setTimeout(() => {
      this.scanAllOrganizations().catch(error => {
        console.error("[Gmail Scanner] Error during initial scan:", error);
      });
    }, 10000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Gmail Scanner] Stopped");
    }
  }

  private async scanAllOrganizations() {
    if (this.isScanning) {
      console.log("[Gmail Scanner] Scan already in progress, skipping");
      return;
    }

    this.isScanning = true;

    try {
      // Get all Gmail integrations across all organizations
      const gmailConfigs = await storage.getAllGmailIntegrations();
      
      if (gmailConfigs.length === 0) {
        console.log("[Gmail Scanner] No Gmail integrations found");
        return;
      }

      console.log(`[Gmail Scanner] Scanning ${gmailConfigs.length} organizations`);

      for (const config of gmailConfigs) {
        try {
          await this.scanOrganization(config.orgId, config.config as any);
        } catch (error) {
          console.error(`[Gmail Scanner] Error scanning org ${config.orgId}:`, error);
        }
      }
    } finally {
      this.isScanning = false;
    }
  }

  private async scanOrganization(orgId: string, tokens: any) {
    if (!tokens?.access_token) {
      console.log(`[Gmail Scanner] No access token for org ${orgId}`);
      return;
    }

    const now = new Date();
    console.log(`[Gmail Scanner] Scanning org ${orgId}...`);

    try {
      // Get recent messages (last 20) - listMessages already returns threadId
      const messages = await listMessages(tokens, 20);

      if (messages.length === 0) {
        console.log(`[Gmail Scanner] No messages found for org ${orgId}`);
        this.lastScanByOrg.set(orgId, now);
        return;
      }

      // Get existing leads to check which messages are already imported
      const existingLeads = await storage.getAllLeads(orgId);
      const existingThreadIds = new Set(
        existingLeads
          .map(lead => lead.gmailThreadId)
          .filter(Boolean) as string[]
      );

      // Get or initialize the set of notified threads for this org
      if (!this.notifiedThreadsByOrg.has(orgId)) {
        this.notifiedThreadsByOrg.set(orgId, new Set());
      }
      const notifiedThreads = this.notifiedThreadsByOrg.get(orgId)!;

      // Find new threads that haven't been imported or notified about
      const newThreadIds: string[] = [];
      
      for (const msg of messages) {
        const threadId = msg.threadId;
        
        if (threadId && 
            !existingThreadIds.has(threadId) && 
            !notifiedThreads.has(threadId)) {
          newThreadIds.push(threadId);
        }
      }

      console.log(`[Gmail Scanner] Found ${newThreadIds.length} new threads for org ${orgId}`);

      // Only create notification if there are new threads
      if (newThreadIds.length > 0) {
        // Get all users in this organization
        const members = await storage.getOrganizationMembers(orgId);

        for (const member of members) {
          await storage.createNotification({
            userId: member.userId,
            orgId,
            type: "gmail_new_leads",
            title: "New leads detected in Gmail",
            message: `We found ${newThreadIds.length} new lead${newThreadIds.length > 1 ? 's' : ''} in your email. Click to sync them to your CRM.`,
            actionUrl: "/settings?tab=integrations",
            metadata: { newMessageCount: newThreadIds.length, threadIds: newThreadIds },
            read: false,
          });
        }

        // Mark these threads as notified
        newThreadIds.forEach(threadId => notifiedThreads.add(threadId));

        console.log(`[Gmail Scanner] Created notifications for ${members.length} users in org ${orgId}`);
      }

      this.lastScanByOrg.set(orgId, now);
    } catch (error) {
      console.error(`[Gmail Scanner] Error scanning org ${orgId}:`, error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.intervalId !== null,
      isScanning: this.isScanning,
      intervalMs: this.scanIntervalMs,
      lastScans: Array.from(this.lastScanByOrg.entries()).map(([orgId, date]) => ({
        orgId,
        lastScannedAt: date.toISOString(),
      })),
    };
  }

  async clearNotifiedThreads(orgId: string, threadIds: string[]) {
    const notifiedThreads = this.notifiedThreadsByOrg.get(orgId);
    if (notifiedThreads) {
      threadIds.forEach(threadId => notifiedThreads.delete(threadId));
      console.log(`[Gmail Scanner] Cleared ${threadIds.length} notified threads for org ${orgId}`);
    }
  }

  async initializeNotifiedThreads() {
    try {
      const gmailConfigs = await storage.getAllGmailIntegrations();
      
      for (const config of gmailConfigs) {
        const existingLeads = await storage.getAllLeads(config.orgId);
        const existingThreadIds = new Set(
          existingLeads
            .map(lead => lead.gmailThreadId)
            .filter(Boolean) as string[]
        );
        
        this.notifiedThreadsByOrg.set(config.orgId, existingThreadIds);
        console.log(`[Gmail Scanner] Initialized ${existingThreadIds.size} threads for org ${config.orgId}`);
      }
    } catch (error) {
      console.error("[Gmail Scanner] Error initializing notified threads:", error);
    }
  }
}

export const gmailScanner = new GmailScanner();

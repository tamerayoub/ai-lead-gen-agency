import { storage } from "./storage";
import { listMessages } from "./gmail";
import OpenAI from "openai";

interface ScanResult {
  newMessageCount: number;
  lastScannedAt: Date;
}

/**
 * Uses AI to check if an email is a rental inquiry
 * Returns true if it appears to be a rental inquiry, false otherwise
 * Uses the same filtering logic as manual Gmail sync
 */
async function isRentalInquiryAI(from: string, subject: string, body: string): Promise<boolean> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Use the exact same prompt as manual sync (from routes.ts line 1975)
    const filterPrompt = `Analyze this email and determine if it's a real estate rental/property inquiry from a potential tenant.

Consider it a rental inquiry ONLY if:
- Someone is asking about renting/leasing a property
- Expressing interest in viewing/applying for a rental unit
- Asking about rental availability, pricing, or lease terms
- Responding to a rental listing

Do NOT consider it a rental inquiry if:
- It's a marketing/promotional email
- It's about buying/selling property
- It's from a service/software company
- It's a newsletter or notification

Email From: ${from}
Subject: ${subject}
Body: ${body.substring(0, 1000)}

Respond with ONLY "YES" if this is a rental inquiry, or "NO" if it's not.`;

    const filterCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: filterPrompt }],
      temperature: 0.1,
    });

    const isRentalInquiry = filterCompletion.choices[0].message.content?.trim().toUpperCase() === "YES";
    return isRentalInquiry;
  } catch (error) {
    console.error("[Gmail Scanner] AI filtering error:", error);
    // On error, default to importing (fail open to avoid missing real inquiries)
    return true;
  }
}

export class GmailScanner {
  private intervalId: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;
  private scanIntervalMs: number = 1 * 60 * 1000; // 1 minute
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
    const lastScan = this.lastScanByOrg.get(orgId);
    console.log(`[Gmail Scanner] Scanning org ${orgId}... (last scan: ${lastScan?.toISOString() || 'never'})`);

    try {
      const { getGmailClient, getMessage } = await import("./gmail");
      const { cleanEmailBody } = await import("./emailUtils");
      
      // Get the last 50 messages to check for new replies
      // We'll filter out already-processed messages based on message IDs
      const messages = await listMessages(tokens, 50);

      console.log(`[Gmail Scanner] Found ${messages.length} messages`);

      if (messages.length === 0) {
        console.log(`[Gmail Scanner] No new messages for org ${orgId}`);
        this.lastScanByOrg.set(orgId, now);
        return;
      }

      // Get existing leads with their thread IDs
      const existingLeads = await storage.getAllLeads(orgId);
      const leadsByThreadId = new Map(
        existingLeads
          .filter(lead => lead.gmailThreadId)
          .map(lead => [lead.gmailThreadId!, lead])
      );
      
      // Also build a map of email -> lead for multi-thread support
      const leadsByEmail = new Map(
        existingLeads
          .filter(lead => lead.email)
          .map(lead => [lead.email!.toLowerCase().trim(), lead])
      );

      // Get property manager's email to identify outgoing vs incoming
      const gmail = await getGmailClient(tokens);
      const profile = await gmail.users.getProfile({ userId: "me" });
      const propertyManagerEmail = profile.data.emailAddress?.toLowerCase() || "";

      // Track new conversations added
      let newConversationsCount = 0;
      let newThreadsCount = 0;
      const leadsWithNewIncomingMessages = new Set<string>(); // Track leads that got new incoming messages

      // Group messages by thread for efficient processing
      const messagesByThread = new Map<string, any[]>();
      for (const msg of messages) {
        const threadId = msg.threadId;
        if (!threadId) continue;
        
        if (!messagesByThread.has(threadId)) {
          messagesByThread.set(threadId, []);
        }
        messagesByThread.get(threadId)!.push(msg);
      }

      // Process each thread
      for (const [threadId, threadMessages] of messagesByThread.entries()) {
        const existingLead = leadsByThreadId.get(threadId);

        if (existingLead) {
          // Existing thread - check for new messages
          const existingConversations = await storage.getConversationsByLeadId(existingLead.id);
          const existingMessageIds = new Set(
            existingConversations.map(c => c.externalId).filter(Boolean)
          );

          // Check each message in this thread
          for (const msg of threadMessages) {
            if (existingMessageIds.has(msg.id)) {
              continue; // Already imported
            }

            try {
              // Fetch full message details
              const fullMessage = await getMessage(tokens, msg.id);
              const headers = fullMessage.payload?.headers || [];
              const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");
              const from = fromHeader?.value || "";
              const fromEmail = from.match(/<(.+)>/) ?  from.match(/<(.+)>/)![1] : from;

              // Determine if this is incoming or outgoing
              const isOutgoing = fromEmail.toLowerCase() === propertyManagerEmail.toLowerCase();

              // Get message body
              let body = "";
              if (fullMessage.payload?.parts) {
                const textPart = fullMessage.payload.parts.find((p: any) => p.mimeType === "text/plain");
                if (textPart?.body?.data) {
                  body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
                }
              } else if (fullMessage.payload?.body?.data) {
                body = Buffer.from(fullMessage.payload.body.data, "base64").toString("utf-8");
              }

              // Clean email body
              body = cleanEmailBody(body);

              // Get message ID header for threading
              const messageIdHeader = headers.find((h: any) => h.name.toLowerCase() === "message-id");
              const emailMessageId = messageIdHeader?.value || null;

              // Get message date
              const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date");
              const messageDate = dateHeader?.value ? new Date(dateHeader.value) : new Date();

              // Get email subject
              const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
              const emailSubject = subjectHeader?.value || "(No Subject)";

              // Skip outgoing messages - they're already tracked when sent through the CRM
              if (isOutgoing) {
                console.log(`[Gmail Scanner] ⏭️  Skipping outgoing message (already tracked by CRM)`);
                continue;
              }

              // Create conversation entry (incoming messages only)
              await storage.createConversation({
                leadId: existingLead.id,
                type: "received",
                message: body.trim(),
                channel: "email",
                sourceIntegration: "gmail",
                emailSubject,
                externalId: msg.id,
                emailMessageId,
                createdAt: messageDate,
              });

              newConversationsCount++;
              
              // Track leads with new incoming messages for notification purposes
              // Only notify if message was sent AFTER the last scan (prevents notifying about old messages from newly imported leads)
              if (!lastScan || messageDate > lastScan) {
                leadsWithNewIncomingMessages.add(existingLead.id);
                console.log(`[Gmail Scanner] 📬 New message from ${existingLead.email} sent at ${messageDate.toISOString()} (after last scan: ${lastScan?.toISOString() || 'never'})`);
              } else if (lastScan && messageDate <= lastScan) {
                console.log(`[Gmail Scanner] ⏭️  Skipping notification for old message from ${existingLead.email} sent at ${messageDate.toISOString()} (before last scan: ${lastScan.toISOString()})`);
              }
            } catch (error) {
              console.error(`[Gmail Scanner] Error processing message ${msg.id}:`, error);
              // Continue with next message instead of aborting entire scan
            }
          }
        } else {
          // New thread - check if lead exists for this email before creating
          try {
            // Get the first message in the thread to extract lead info
            const firstMsg = threadMessages[0];
            const fullMessage = await getMessage(tokens, firstMsg.id);
            const headers = fullMessage.payload?.headers || [];
            
            // Extract sender information
            const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");
            const from = fromHeader?.value || "";
            const fromEmail = from.match(/<(.+)>/) ?  from.match(/<(.+)>/)![1] : from;
            const fromName = from.replace(/<.+>/, "").trim() || fromEmail.split('@')[0];
            
            // Skip if message is FROM the property manager (outgoing)
            if (fromEmail.toLowerCase() === propertyManagerEmail.toLowerCase()) {
              continue;
            }
            
            // Check if this email belongs to an existing lead (multi-thread support)
            const existingLeadForEmail = leadsByEmail.get(fromEmail.toLowerCase().trim());
            if (existingLeadForEmail) {
              // This is a new thread for an existing lead - add to map and process as existing
              leadsByThreadId.set(threadId, existingLeadForEmail);
              console.log(`[Gmail Scanner] Linking new thread ${threadId} to existing lead ${fromEmail}`);
              
              // Now process all messages in this thread as if it's an existing lead
              const existingConversations = await storage.getConversationsByLeadId(existingLeadForEmail.id);
              const existingMessageIds = new Set(
                existingConversations.map(c => c.externalId).filter(Boolean)
              );

              for (const msg of threadMessages) {
                if (existingMessageIds.has(msg.id)) {
                  continue; // Already imported
                }

                try {
                  const msgFull = await getMessage(tokens, msg.id);
                  const msgHeaders = msgFull.payload?.headers || [];
                  const msgFrom = msgHeaders.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
                  const msgFromEmail = msgFrom.match(/<(.+)>/) ? msgFrom.match(/<(.+)>/)![1] : msgFrom;
                  const isOutgoing = msgFromEmail.toLowerCase() === propertyManagerEmail.toLowerCase();

                  let body = "";
                  if (msgFull.payload?.parts) {
                    const textPart = msgFull.payload.parts.find((p: any) => p.mimeType === "text/plain");
                    if (textPart?.body?.data) {
                      body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
                    }
                  } else if (msgFull.payload?.body?.data) {
                    body = Buffer.from(msgFull.payload.body.data, "base64").toString("utf-8");
                  }

                  body = cleanEmailBody(body);

                  const messageIdHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "message-id");
                  const emailMessageId = messageIdHeader?.value || null;

                  const dateHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "date");
                  const messageDate = dateHeader?.value ? new Date(dateHeader.value) : new Date();

                  const subjectHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "subject");
                  const emailSubject = subjectHeader?.value || "(No Subject)";

                  // Skip outgoing messages - they're already tracked when sent through the CRM
                  if (isOutgoing) {
                    console.log(`[Gmail Scanner] ⏭️  Skipping outgoing message (already tracked by CRM)`);
                    continue;
                  }

                  await storage.createConversation({
                    leadId: existingLeadForEmail.id,
                    type: "received",
                    message: body.trim(),
                    channel: "email",
                    sourceIntegration: "gmail",
                    emailSubject,
                    externalId: msg.id,
                    emailMessageId,
                    createdAt: messageDate,
                  });

                  newConversationsCount++;
                  
                  // Track leads with new incoming messages for notification purposes
                  // Only notify if message was sent AFTER the last scan (prevents notifying about old messages from newly imported leads)
                  if (!lastScan || messageDate > lastScan) {
                    leadsWithNewIncomingMessages.add(existingLeadForEmail.id);
                    console.log(`[Gmail Scanner] 📬 New message from ${existingLeadForEmail.email} (new thread) sent at ${messageDate.toISOString()} (after last scan: ${lastScan?.toISOString() || 'never'})`);
                  } else if (lastScan && messageDate <= lastScan) {
                    console.log(`[Gmail Scanner] ⏭️  Skipping notification for old message from ${existingLeadForEmail.email} (new thread) sent at ${messageDate.toISOString()} (before last scan: ${lastScan.toISOString()})`);
                  }
                } catch (error) {
                  console.error(`[Gmail Scanner] Error processing message ${msg.id}:`, error);
                }
              }
              
              continue; // Skip to next thread
            }
            
            // Extract subject
            const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
            const emailSubject = subjectHeader?.value || "(No Subject)";
            
            // Extract message body
            let body = "";
            if (fullMessage.payload?.parts) {
              const textPart = fullMessage.payload.parts.find((p: any) => p.mimeType === "text/plain");
              if (textPart?.body?.data) {
                body = Buffer.from(textPart.body.data, "base64").toString("utf-8");
              }
            } else if (fullMessage.payload?.body?.data) {
              body = Buffer.from(fullMessage.payload.body.data, "base64").toString("utf-8");
            }
            
            // Clean email body
            body = cleanEmailBody(body);
            
            // Filter: Use AI to check if this is a rental inquiry (same as manual sync)
            const isRentalInquiry = await isRentalInquiryAI(fromEmail, emailSubject, body);
            if (!isRentalInquiry) {
              console.log(`[Gmail Scanner] AI filtered out non-rental email from ${fromEmail} - Subject: "${emailSubject}"`);
              continue;
            }
            
            // Get message date
            const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date");
            const messageDate = dateHeader?.value ? new Date(dateHeader.value) : new Date();
            
            // Get message ID for threading
            const messageIdHeader = headers.find((h: any) => h.name.toLowerCase() === "message-id");
            const emailMessageId = messageIdHeader?.value || null;
            
            // Check if this lead was previously deleted (don't re-import unless new messages)
            const deletedLead = await storage.getDeletedLeadByEmail(fromEmail.toLowerCase().trim(), orgId);
            if (deletedLead) {
              // Lead was manually deleted - only re-import if this message is newer
              if (messageDate <= new Date(deletedLead.lastMessageDate)) {
                console.log(`[Gmail Scanner] Skipping deleted lead ${fromEmail} - no new messages since deletion`);
                continue;
              }
              console.log(`[Gmail Scanner] Re-importing deleted lead ${fromEmail} due to new message`);
            }
            
            // Create new lead (we already checked leadsByEmail map above)
            const newLead = await storage.createLead({
              orgId,
              name: fromName,
              email: fromEmail,
              source: "gmail",
              status: "new",
              gmailThreadId: threadId,
            });
            newThreadsCount++;
            console.log(`[Gmail Scanner] Created new lead for ${fromEmail} (thread: ${threadId})`);
            
            // Immediately cache new lead in both maps to prevent duplicates in same scan
            leadsByEmail.set(fromEmail.toLowerCase().trim(), newLead);
            leadsByThreadId.set(threadId, newLead);
            
            // Import ALL messages in this thread, not just the first one
            const existingMessageIds = new Set<string>();
            
            for (const msg of threadMessages) {
              if (existingMessageIds.has(msg.id)) {
                continue; // Already imported
              }

              try {
                const msgFull = await getMessage(tokens, msg.id);
                const msgHeaders = msgFull.payload?.headers || [];
                const msgFrom = msgHeaders.find((h: any) => h.name.toLowerCase() === "from")?.value || "";
                const msgFromEmail = msgFrom.match(/<(.+)>/) ? msgFrom.match(/<(.+)>/)![1] : msgFrom;
                const isOutgoing = msgFromEmail.toLowerCase() === propertyManagerEmail.toLowerCase();

                let msgBody = "";
                if (msgFull.payload?.parts) {
                  const textPart = msgFull.payload.parts.find((p: any) => p.mimeType === "text/plain");
                  if (textPart?.body?.data) {
                    msgBody = Buffer.from(textPart.body.data, "base64").toString("utf-8");
                  }
                } else if (msgFull.payload?.body?.data) {
                  msgBody = Buffer.from(msgFull.payload.body.data, "base64").toString("utf-8");
                }

                msgBody = cleanEmailBody(msgBody);

                const msgMessageIdHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "message-id");
                const msgEmailMessageId = msgMessageIdHeader?.value || null;

                const msgDateHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "date");
                const msgMessageDate = msgDateHeader?.value ? new Date(msgDateHeader.value) : new Date();
                
                const msgSubjectHeader = msgHeaders.find((h: any) => h.name.toLowerCase() === "subject");
                const msgEmailSubject = msgSubjectHeader?.value || "(No Subject)";

                await storage.createConversation({
                  leadId: newLead.id,
                  type: isOutgoing ? "outgoing" : "received",
                  message: msgBody.trim(),
                  channel: "email",
                  sourceIntegration: "gmail",
                  emailSubject: msgEmailSubject,
                  externalId: msg.id,
                  emailMessageId: msgEmailMessageId,
                  createdAt: msgMessageDate,
                });

                existingMessageIds.add(msg.id);
              } catch (error) {
                console.error(`[Gmail Scanner] Error processing message ${msg.id}:`, error);
              }
            }
          } catch (error) {
            console.error(`[Gmail Scanner] Error creating lead for thread ${threadId}:`, error);
            // Continue with next thread instead of aborting scan
          }
        }
      }

      console.log(`[Gmail Scanner] Imported ${newConversationsCount} new messages from existing threads`);
      console.log(`[Gmail Scanner] Created ${newThreadsCount} new leads from new threads`);

      // CRITICAL: Wait to ensure all database transactions are fully committed AND UI caches are invalidated
      // This prevents race condition where notifications arrive before messages/timestamps appear in UI
      // 2 seconds ensures database writes are complete, query caches are invalidated, and UI has fresh data
      if (newConversationsCount > 0 || newThreadsCount > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Create notifications for unreplied messages
      if (leadsWithNewIncomingMessages.size > 0) {
        // Check which leads are actually unreplied (query AFTER messages are committed)
        const unrepliedLeads = await storage.getLeadsWithUnreadMessages(orgId);
        const unrepliedLeadIds = new Set(unrepliedLeads.map(l => l.id));
        
        // Filter to only leads that both got new messages AND are unreplied
        const leadsToNotify = Array.from(leadsWithNewIncomingMessages).filter(leadId => 
          unrepliedLeadIds.has(leadId)
        );
        
        if (leadsToNotify.length > 0) {
          const members = await storage.getOrganizationMembers(orgId);
          
          // Create a notification for each unreplied lead
          for (const leadId of leadsToNotify) {
            const lead = unrepliedLeads.find(l => l.id === leadId);
            if (!lead) continue;
            
            for (const member of members) {
              await storage.createNotification({
                userId: member.userId,
                orgId,
                leadId, // Add leadId as a column for efficient querying
                type: "new_message",
                title: `New unreplied message from ${lead.name}`,
                message: lead.lastMessage?.substring(0, 100) || "New message received",
                actionUrl: `/leads?selected=${leadId}`,
                metadata: { leadId, unreadCount: lead.unreadCount },
                read: false,
              });
            }
          }
          
          console.log(`[Gmail Scanner] Created ${leadsToNotify.length} unreplied message notifications for ${members.length} users`);
        }
      }

      // Create notification for NEW leads that were auto-created
      if (newThreadsCount > 0) {
        const members = await storage.getOrganizationMembers(orgId);
        for (const member of members) {
          await storage.createNotification({
            userId: member.userId,
            orgId,
            type: "info",
            title: "New leads automatically imported",
            message: `${newThreadsCount} new lead${newThreadsCount > 1 ? 's' : ''} ${newThreadsCount > 1 ? 'were' : 'was'} automatically imported from Gmail.`,
            actionUrl: "/leads",
            read: false,
          });
        }

        console.log(`[Gmail Scanner] Created notifications for ${members.length} users`);
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

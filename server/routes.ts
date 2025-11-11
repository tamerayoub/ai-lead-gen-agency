import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertConversationSchema, insertNoteSchema, insertAISettingSchema, insertIntegrationConfigSchema, insertPendingReplySchema, insertCalendarConnectionSchema, insertSchedulePreferenceSchema, insertZillowIntegrationSchema, insertZillowListingSchema, insertDemoRequestSchema, insertAppointmentSchema, type User } from "@shared/schema";
import { getGmailAuthUrl, getGmailTokensFromCode, listMessages, getMessage, sendReply, getGmailUserEmail } from "./gmail";
import { getOutlookAuthUrl, getOutlookTokensFromCode, listOutlookMessages, getOutlookMessage, sendOutlookReply, getUserProfile, refreshOutlookToken } from "./outlook";
import { parseMessengerWebhook, sendMessengerMessage, getMessengerUserProfile } from "./messenger";
import { getFacebookAuthUrl, getFacebookTokensFromCode, getFacebookPages, getLongLivedPageAccessToken, subscribePage } from "./facebook";
import { getCalendarAuthUrl, getCalendarTokensFromCode, listCalendars, listCalendarEvents, refreshCalendarToken } from "./googleCalendar";
import { getAvailabilityContext } from "./calendarAvailability";
import { cleanEmailBody, cleanEmailSubject } from "./emailUtils";
import { normalizeEmailSubject } from "@shared/emailUtils";
import OpenAI from "openai";
import authRouter from "./auth";
import { gmailScanner } from "./gmailScanner";
import { db } from "./db";
import { zillowListings, properties, organizations, conversations, onboardingIntakes } from "@shared/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";

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

  // Get leads with unread messages
  app.get("/api/leads/unread", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const leadsWithUnread = await storage.getLeadsWithUnreadMessages(req.orgId);
      res.json(leadsWithUnread);
    } catch (error) {
      console.error("[Leads] Failed to fetch leads with unread messages:", error);
      res.status(500).json({ error: "Failed to fetch leads with unread messages" });
    }
  });

  app.get("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const lead = await storage.getLead(req.params.id, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      const conversations = await storage.getConversationsByLeadId(lead.id);
      const notes = await storage.getNotesByLeadId(lead.id);
      
      // Map createdAt to timestamp for frontend compatibility
      // Note: createdAt is already in ISO UTC format from the database query
      const conversationsWithTimestamp = conversations.map(c => ({
        ...c,
        timestamp: c.createdAt
      }));
      
      const notesWithTimestamp = notes.map(n => ({
        ...n,
        timestamp: new Date(n.createdAt).toISOString()
      }));
      
      res.json({ ...lead, conversations: conversationsWithTimestamp, notes: notesWithTimestamp });
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
      const { leadIds } = req.body;
      let count: number;
      
      // ONLY delete specific lead IDs if provided, never delete all Gmail leads
      // This prevents accidental deletion of all leads when disconnecting
      if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
        count = await storage.deleteLeadsByIds(leadIds);
        console.log(`[Delete Gmail Leads] Deleted ${count} specific leads from current sync session`);
      } else {
        count = 0;
        console.log("[Delete Gmail Leads] No lead IDs provided, skipping deletion");
      }
      
      res.json({ 
        message: leadIds?.length > 0 ? "Gmail-sourced leads deleted" : "No leads to delete", 
        count 
      });
    } catch (error) {
      console.error("[Delete Gmail Leads] Error:", error);
      res.status(500).json({ error: "Failed to delete Gmail-sourced leads" });
    }
  });

  app.delete("/api/leads/:id", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      // Get lead details before deleting
      const lead = await storage.getLead(req.params.id, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Get most recent conversation date to track when we last saw messages
      const conversations = await storage.getConversationsByLeadId(lead.id);
      const lastMessageDate = conversations.length > 0
        ? new Date(Math.max(...conversations.map(c => new Date(c.createdAt).getTime())))
        : new Date();

      // Track deleted lead to prevent auto-reimport by scanner
      await storage.createDeletedLead({
        orgId: req.orgId,
        email: lead.email || null,
        phone: lead.phone || null,
        gmailThreadId: lead.gmailThreadId || null,
        outlookConversationId: null,
        lastMessageDate,
      });

      // Now delete the lead
      const deleted = await storage.deleteLead(req.params.id, req.orgId);
      if (!deleted) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      console.log(`[Delete Lead] Tracked deleted lead ${lead.email} to prevent auto-reimport`);
      res.status(204).send();
    } catch (error) {
      console.error("[Delete Lead] Error:", error);
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // Send a manual reply to a lead
  app.post("/api/leads/:id/reply", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const leadId = req.params.id;
      const { message } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ error: "Message is required" });
      }

      // Get lead details
      const lead = await storage.getLead(leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      // Get all conversations to build proper threading
      const conversations = await storage.getConversationsByLeadId(leadId);

      // Determine channel based on lead source
      const channel = lead.source === 'gmail' || lead.source === 'outlook' ? 'email' : 
                     lead.source === 'twilio' ? 'sms' : 'email';

      // Send the reply based on channel
      if (channel === 'email') {
        // Check for Gmail integration
        const gmailConfig = await storage.getIntegrationConfig('gmail', req.orgId);
        if (gmailConfig?.isConnected && lead.gmailThreadId) {
          // Build threading headers from conversations
          const messageIds = conversations
            .filter((c: any) => c.emailMessageId)
            .map((c: any) => c.emailMessageId);
          
          const inReplyTo = messageIds.length > 0 ? messageIds[messageIds.length - 1] : undefined;
          const references = messageIds.join(' ');

          // Send via Gmail
          await sendReply(gmailConfig.tokens, {
            to: lead.email,
            subject: lead.subject || `Re: Inquiry about ${lead.propertyName || 'property'}`,
            body: message.trim(),
            threadId: lead.gmailThreadId,
            inReplyTo,
            references: references || undefined
          });

          console.log(`[Send Reply] Sent Gmail reply to ${lead.email}`);
        } else {
          // Check for Outlook integration
          const outlookConfig = await storage.getIntegrationConfig('outlook', req.orgId);
          if (outlookConfig?.isConnected && lead.outlookConversationId) {
            // Get the original message ID
            const originalMessage = conversations.find((c: any) => c.externalId);
            if (!originalMessage?.externalId) {
              return res.status(400).json({ 
                error: "Cannot find original message to reply to" 
              });
            }

            // Send via Outlook
            await sendOutlookReply(
              outlookConfig.tokens.access_token,
              originalMessage.externalId,
              message.trim(),
              { name: lead.name, email: lead.email }
            );

            console.log(`[Send Reply] Sent Outlook reply to ${lead.email}`);
          } else {
            return res.status(400).json({ 
              error: "No email integration configured for this lead" 
            });
          }
        }
      } else if (channel === 'sms') {
        // Send via Twilio SMS
        const twilioConfig = await storage.getIntegrationConfig('twilio', req.orgId);
        if (!twilioConfig?.isConnected) {
          return res.status(400).json({ error: "Twilio integration not configured" });
        }
        // TODO: Implement Twilio SMS sending
        return res.status(501).json({ error: "SMS sending not yet implemented" });
      }

      // Store the conversation
      await storage.createConversation({
        leadId: lead.id,
        type: 'outgoing',
        channel,
        message: message.trim(),
        subject: lead.subject || `Re: Inquiry about ${lead.propertyName || 'property'}`,
      });

      // Update lead's last contact time
      await storage.updateLead(leadId, { 
        lastContactAt: new Date().toISOString() 
      }, req.orgId);

      // Mark all notifications for this lead as read since the user has replied
      const markedCount = await storage.markAllLeadNotificationsAsRead(leadId, req.orgId);
      console.log(`[Send Reply] Marked ${markedCount} notifications as read for lead ${leadId}`);

      res.json({ success: true, message: "Reply sent successfully" });
    } catch (error) {
      console.error("[Send Reply] Error:", error);
      res.status(500).json({ error: "Failed to send reply" });
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
      console.log('[Create Conversation] Request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertConversationSchema.parse(req.body);
      console.log('[Create Conversation] Validated data:', JSON.stringify(validatedData, null, 2));
      
      // Get lead details to send email
      const lead = await storage.getLead(validatedData.leadId, req.orgId);
      if (!lead) {
        console.error('[Create Conversation] Lead not found:', validatedData.leadId, 'orgId:', req.orgId);
        return res.status(404).json({ error: "Lead not found" });
      }
      
      let emailSendStatus: { sent: boolean; error?: string } = { sent: false };
      
      // For email conversations, ensure metadata is always set (even if sending fails)
      if (validatedData.channel === "email") {
        const integrationToUse = validatedData.sourceIntegration || 'gmail';
        const emailSubject = validatedData.emailSubject || `Message from ${req.user.name || 'Property Manager'}`;
        validatedData.emailSubject = emailSubject;
        validatedData.sourceIntegration = integrationToUse;
      }
      
      // If channel is email and type is outgoing, send actual email
      if (validatedData.channel === "email" && (validatedData.type === "outgoing" || validatedData.type === "sent") && lead.email) {
        try {
          // Use the integration specified in the request (default to gmail)
          const integrationToUse = validatedData.sourceIntegration || 'gmail';
          
          console.log(`[Send Email] Attempting to send email via ${integrationToUse} to ${lead.email}`);
          console.log(`[Send Email] Lead has email: ${lead.email}`);
          console.log(`[Send Email] Message type: ${validatedData.type}`);
          console.log(`[Send Email] Looking up integration with service="${integrationToUse}" and orgId="${req.orgId}"`);
          
          // Get the specified integration
          const integration = await storage.getIntegrationConfig(integrationToUse, req.orgId);
          
          console.log(`[Send Email] Integration lookup result:`, integration ? 'FOUND' : 'NOT FOUND');
          if (integration) {
            console.log(`[Send Email] Integration ID: ${integration.id}, has access_token:`, !!integration.config?.access_token);
          }
          
          if (!integration) {
            console.error('[Send Email] Integration not found for service:', integrationToUse, 'orgId:', req.orgId);
            emailSendStatus = { sent: false, error: `${integrationToUse} integration not configured` };
            (validatedData as any).deliveryStatus = 'failed';
            (validatedData as any).deliveryError = emailSendStatus.error;
          } else if (!integration.config?.access_token) {
            console.error('[Send Email] No access_token found for integration:', integrationToUse);
            emailSendStatus = { sent: false, error: `${integrationToUse} is not connected` };
            (validatedData as any).deliveryStatus = 'failed';
            (validatedData as any).deliveryError = emailSendStatus.error;
          } else {
            // Use the email subject from the request, or generate a default
            const emailSubject = validatedData.emailSubject || `Message from ${req.user.name || 'Property Manager'}`;
            
            // Fetch conversation history to build proper email threading headers
            // Note: By design, each lead maps to exactly ONE email thread per integration
            // The import logic ensures this by creating new leads for new threads
            const conversationHistory = await storage.getConversationsByLeadId(lead.id);
            
            // Filter to only emails from the SAME integration (Gmail, Outlook, etc.)
            // This ensures we're looking at conversations from the correct email account
            let threadEmails = conversationHistory
              .filter(c => 
                c.channel === 'email' && 
                c.sourceIntegration === integrationToUse
              )
              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Chronological order
            
            // Check if this subject matches any existing conversation subjects
            // If it does, the user is replying to an existing thread
            // If it doesn't, they're starting a new conversation
            // IMPORTANT: Normalize subjects to strip "Re:", "Fwd:" prefixes
            // This ensures "Hi" and "Re: Hi" are treated as the same thread
            const normalizedRequestSubject = normalizeEmailSubject(emailSubject);
            const existingNormalizedSubjects = new Set(
              threadEmails
                .filter(c => c.emailSubject)
                .map(c => normalizeEmailSubject(c.emailSubject!))
            );
            const isNewSubject = !existingNormalizedSubjects.has(normalizedRequestSubject);
            
            console.log('[Send Email] Thread detection:', {
              requestedSubject: emailSubject,
              normalizedRequestSubject,
              existingNormalizedSubjects: Array.from(existingNormalizedSubjects),
              isNewSubject,
              totalConversations: threadEmails.length
            });
            
            // Backfill missing Message-IDs on-demand
            for (const conv of threadEmails) {
              if (!conv.emailMessageId && conv.externalId) {
                try {
                  console.log('[Send Email] Fetching missing Message-ID for conversation', conv.id);
                  const gmailMessage = await getMessage(integration.config, conv.externalId);
                  const headers = gmailMessage.payload?.headers || [];
                  const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
                  
                  if (messageId) {
                    // Update the conversation with the Message-ID
                    await db
                      .update(conversations)
                      .set({ emailMessageId: messageId })
                      .where(eq(conversations.id, conv.id));
                    conv.emailMessageId = messageId; // Update in-memory too
                    console.log('[Send Email] Backfilled Message-ID:', messageId);
                  }
                } catch (error: any) {
                  console.error('[Send Email] Failed to backfill Message-ID:', error.message);
                }
              }
            }
            
            // Filter to only emails with Message-IDs (after backfill)
            threadEmails = threadEmails.filter(c => c.emailMessageId);
            
            // Determine if we should use threading:
            // 1. If subject doesn't match any existing conversation subjects, start a new thread
            // 2. If subject matches an existing one, ALWAYS use the lead's gmailThreadId
            //    (even if there's no recent incoming message - the thread ID itself is enough)
            
            let threadId: string | undefined;
            let inReplyTo: string | undefined;
            let references: string | undefined;
            
            if (!isNewSubject && lead.gmailThreadId) {
              // User selected "Reply to existing thread" - use the lead's Gmail thread ID
              threadId = lead.gmailThreadId;
              
              // Get messages from the same normalized subject for References/In-Reply-To headers
              // This ensures we include all messages regardless of Re:/Fwd: prefixes
              const sameSubjectEmails = threadEmails.filter(c => 
                c.emailSubject && normalizeEmailSubject(c.emailSubject) === normalizedRequestSubject
              );
              const lastIncomingMessage = sameSubjectEmails
                .filter(c => c.type === 'received')
                .reverse()[0]; // Last received message with the same normalized subject
              
              // Include In-Reply-To and References if we have a recent incoming message
              if (lastIncomingMessage) {
                const emailMessageIds = sameSubjectEmails.map(c => c.emailMessageId).filter(Boolean) as string[];
                inReplyTo = lastIncomingMessage.emailMessageId;
                references = emailMessageIds.length > 0 ? emailMessageIds.join(' ') : undefined;
              }
              
              console.log('[Send Email] Replying to existing thread:', {
                threadId,
                inReplyTo: inReplyTo || '(none - no recent incoming)',
                referencesCount: references ? references.split(' ').length : 0,
                subject: emailSubject
              });
            } else {
              // Start a new thread
              const reason = isNewSubject ? 'new subject' : 'no gmailThreadId on lead';
              console.log(`[Send Email] Starting new thread (${reason})`);
            }
            
            // Send email using Gmail API
            console.log('[Send Email] Sending email...');
            const sentEmailResponse = await sendReply(integration.config, {
              to: lead.email,
              subject: emailSubject,
              body: validatedData.message,
              threadId,
              inReplyTo,
              references,
            });
            
            console.log('[Send Email] Email sent successfully');
            emailSendStatus = { sent: true };
            (validatedData as any).deliveryStatus = 'sent';
            
            // Extract and store the sent message's Message-ID for future threading
            if (sentEmailResponse && sentEmailResponse.id) {
              try {
                const sentMessage = await getMessage(integration.config, sentEmailResponse.id);
                const sentHeaders = sentMessage.payload?.headers || [];
                const sentMessageId = sentHeaders.find((h: any) => h.name === "Message-ID")?.value;
                if (sentMessageId) {
                  (validatedData as any).emailMessageId = sentMessageId;
                  console.log('[Send Email] Captured outgoing Message-ID for threading:', sentMessageId);
                }
                
                // If we started a new thread (threadId was undefined), capture the new threadId Gmail assigned
                if (!threadId && sentEmailResponse.threadId) {
                  console.log('[Send Email] New thread created by Gmail. Updating lead threadId from', lead.gmailThreadId, 'to', sentEmailResponse.threadId);
                  await storage.updateLead(lead.id, { gmailThreadId: sentEmailResponse.threadId } as any, req.orgId);
                  console.log('[Send Email] Lead gmailThreadId updated successfully');
                }
              } catch (error) {
                console.error('[Send Email] Failed to capture sent Message-ID:', error);
              }
            }
          }
        } catch (emailError: any) {
          console.error('[Send Email] Failed to send email:', emailError);
          emailSendStatus = { sent: false, error: emailError.message || 'Failed to send email' };
          (validatedData as any).deliveryStatus = 'failed';
          (validatedData as any).deliveryError = emailSendStatus.error;
        }
      }
      
      const conversation = await storage.createConversation(validatedData);
      
      // Update lead's lastContactAt
      await storage.updateLead(validatedData.leadId, { lastContactAt: new Date() } as any, req.orgId);
      
      // If this is an outgoing message, mark all notifications for this lead as read
      if (validatedData.type === 'outgoing' || validatedData.type === 'sent') {
        const markedCount = await storage.markAllLeadNotificationsAsRead(validatedData.leadId, req.orgId);
        console.log(`[Send Message] Marked ${markedCount} notifications as read for lead ${validatedData.leadId}`);
      }
      
      res.status(201).json({ 
        ...conversation, 
        emailStatus: emailSendStatus 
      });
    } catch (error: any) {
      console.error('[Create Conversation] Error:', error);
      
      // If it's a Zod validation error, show the actual validation errors
      if (error.errors && Array.isArray(error.errors)) {
        return res.status(400).json({ 
          error: "Invalid conversation data", 
          details: error.errors 
        });
      }
      
      res.status(400).json({ error: error.message || "Invalid conversation data" });
    }
  });

  // Retry sending a failed email
  app.post("/api/conversations/:conversationId/retry", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId;
      
      // Get all conversations for the org to find this specific one
      // (we don't have a getConversationById method in storage interface)
      const allConversations = await db.select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      if (!allConversations || allConversations.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const conv = allConversations[0];
      
      // Only retry failed email messages
      if (conv.channel !== 'email' || conv.deliveryStatus !== 'failed') {
        return res.status(400).json({ error: "Only failed email messages can be retried" });
      }
      
      // Get lead details
      const lead = await storage.getLead(conv.leadId, req.orgId);
      if (!lead || !lead.email) {
        return res.status(404).json({ error: "Lead not found or has no email" });
      }
      
      let emailSendStatus: { sent: boolean; error?: string } = { sent: false };
      
      try {
        const integrationToUse = conv.sourceIntegration || 'gmail';
        
        console.log(`[Retry Email] Attempting to resend email via ${integrationToUse} to ${lead.email}`);
        
        const integration = await storage.getIntegrationConfig(integrationToUse, req.orgId);
        
        if (!integration) {
          emailSendStatus = { sent: false, error: `${integrationToUse} integration not configured` };
        } else if (!integration.config?.access_token) {
          emailSendStatus = { sent: false, error: `${integrationToUse} is not connected` };
        } else {
          const emailSubject = conv.emailSubject || `Message from ${req.user.name || 'Property Manager'}`;
          
          // Fetch conversation history to build proper email threading headers
          // Note: By design, each lead maps to exactly ONE Gmail thread (lead.gmailThreadId)
          // The import logic ensures this by creating new leads for new threads
          const conversationHistory = await storage.getConversationsByLeadId(lead.id);
          
          // Filter to only Gmail emails (conversations for this lead are already from the same thread)
          // We filter by sourceIntegration to ensure we're only looking at Gmail messages
          let threadEmails = conversationHistory
            .filter(c => 
              c.channel === 'email' && 
              c.sourceIntegration === 'gmail'
            )
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); // Chronological order
          
          // Check if this subject matches any existing conversation subjects
          const existingSubjects = new Set(
            threadEmails
              .filter(c => c.emailSubject)
              .map(c => c.emailSubject)
          );
          const isNewSubject = !existingSubjects.has(emailSubject);
          
          // Backfill missing Message-IDs on-demand
          for (const conv of threadEmails) {
            if (!conv.emailMessageId && conv.externalId) {
              try {
                console.log('[Retry Email] Fetching missing Message-ID for conversation', conv.id);
                const gmailMessage = await getMessage(integration.config, conv.externalId);
                const headers = gmailMessage.payload?.headers || [];
                const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
                
                if (messageId) {
                  // Update the conversation with the Message-ID
                  await db
                    .update(conversations)
                    .set({ emailMessageId: messageId })
                    .where(eq(conversations.id, conv.id));
                  conv.emailMessageId = messageId; // Update in-memory too
                  console.log('[Retry Email] Backfilled Message-ID:', messageId);
                }
              } catch (error: any) {
                console.error('[Retry Email] Failed to backfill Message-ID:', error.message);
              }
            }
          }
          
          // Filter to only emails with Message-IDs (after backfill)
          threadEmails = threadEmails.filter(c => c.emailMessageId);
          
          // Determine if we should use threading:
          // 1. If subject doesn't match any existing conversation subjects, start a new thread
          // 2. If subject matches an existing one, thread if there's a recent incoming message WITH THE SAME SUBJECT
          
          // IMPORTANT: Only look at emails with the SAME subject when replying to an existing conversation
          // This prevents us from using Message-IDs from a different thread
          const sameSubjectEmails = !isNewSubject 
            ? threadEmails.filter(c => c.emailSubject === emailSubject)
            : [];
          
          const lastIncomingMessage = sameSubjectEmails
            .filter(c => c.type === 'received')
            .reverse()[0]; // Last received message with the same subject
          
          const shouldUseThreading = !isNewSubject && !!lastIncomingMessage;
          
          let threadId: string | undefined;
          let inReplyTo: string | undefined;
          let references: string | undefined;
          
          if (shouldUseThreading) {
            // This is a reply to an existing conversation - use threading
            // IMPORTANT: Only use Message-IDs from emails with the SAME subject for proper threading
            const emailMessageIds = sameSubjectEmails.map(c => c.emailMessageId).filter(Boolean) as string[];
            threadId = lead.gmailThreadId || undefined;
            inReplyTo = lastIncomingMessage.emailMessageId;
            references = emailMessageIds.length > 0 ? emailMessageIds.join(' ') : undefined;
            
            console.log('[Retry Email] Replying to existing thread:', {
              threadId,
              inReplyTo,
              referencesCount: emailMessageIds.length,
              subject: emailSubject
            });
          } else {
            // Start a new thread (either new subject or no recent incoming)
            const reason = isNewSubject ? 'new subject' : 'no recent incoming messages';
            console.log(`[Retry Email] Starting new thread (${reason})`);
          }
          
          console.log('[Retry Email] Sending email...');
          const sentEmailResponse = await sendReply(integration.config, {
            to: lead.email,
            subject: emailSubject,
            body: conv.message,
            threadId,
            inReplyTo,
            references,
          });
          
          console.log('[Retry Email] Email sent successfully');
          emailSendStatus = { sent: true };
          
          // Extract and store the sent message's Message-ID for future threading
          if (sentEmailResponse && sentEmailResponse.id) {
            try {
              const sentMessage = await getMessage(integration.config, sentEmailResponse.id);
              const sentHeaders = sentMessage.payload?.headers || [];
              const sentMessageId = sentHeaders.find((h: any) => h.name === "Message-ID")?.value;
              if (sentMessageId) {
                // Update the conversation with the sent Message-ID
                await db
                  .update(conversations)
                  .set({ emailMessageId: sentMessageId })
                  .where(eq(conversations.id, conversationId));
                console.log('[Retry Email] Captured outgoing Message-ID for threading:', sentMessageId);
              }
              
              // If we started a new thread (threadId was undefined), capture the new threadId Gmail assigned
              if (!threadId && sentEmailResponse.threadId) {
                console.log('[Retry Email] New thread created by Gmail. Updating lead threadId from', lead.gmailThreadId, 'to', sentEmailResponse.threadId);
                await storage.updateLead(lead.id, { gmailThreadId: sentEmailResponse.threadId } as any, req.orgId);
                console.log('[Retry Email] Lead gmailThreadId updated successfully');
              }
            } catch (error) {
              console.error('[Retry Email] Failed to capture sent Message-ID:', error);
            }
          }
          
          // Update conversation status
          await db
            .update(conversations)
            .set({ 
              deliveryStatus: 'sent',
              deliveryError: null
            })
            .where(eq(conversations.id, conversationId));
        }
      } catch (emailError: any) {
        console.error('[Retry Email] Failed to send email:', emailError);
        emailSendStatus = { sent: false, error: emailError.message || 'Failed to send email' };
        
        // Update error message
        await db
          .update(conversations)
          .set({ 
            deliveryError: emailSendStatus.error
          })
          .where(eq(conversations.id, conversationId));
      }
      
      res.json({ 
        success: emailSendStatus.sent,
        error: emailSendStatus.error 
      });
    } catch (error) {
      console.error('[Retry Email] Error:', error);
      res.status(500).json({ error: "Failed to retry email" });
    }
  });

  // Delete a conversation message
  app.delete("/api/conversations/:conversationId", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const conversationId = req.params.conversationId;
      
      // Get the conversation to verify it belongs to this org
      const allConversations = await db.select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      if (!allConversations || allConversations.length === 0) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      
      const conv = allConversations[0];
      
      // Verify the lead belongs to this org
      const lead = await storage.getLead(conv.leadId, req.orgId);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      
      // Delete the conversation
      await db.delete(conversations).where(eq(conversations.id, conversationId));
      
      console.log(`[Delete Conversation] Deleted conversation ${conversationId} from lead ${conv.leadId}`);
      
      res.json({ success: true });
    } catch (error) {
      console.error('[Delete Conversation] Error:', error);
      res.status(500).json({ error: "Failed to delete conversation" });
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

      // Get user information
      const user = req.user;
      const userName = user?.name || user?.email?.split('@')[0] || 'Property Manager';
      const userEmail = user?.email || '';
      
      // Get organization information
      const organization = await storage.getOrganization(req.orgId);
      const orgName = organization?.name || 'Our Property Management';

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

Your Information (use this to sign the email):
- Your Name: ${userName}
- Company/Organization: ${orgName}
${userEmail ? `- Email: ${userEmail}` : ''}

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
6. Signs off warmly with YOUR REAL NAME (${userName}) and company/organization (${orgName})

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:
- Sign the email with the EXACT name: "${userName}" - NO PLACEHOLDERS
- Use the EXACT organization name: "${orgName}" - NO PLACEHOLDERS
- DO NOT use bracketed placeholders like [Your Name], [Company], [Your Contact Information], etc.
- The signature should look professional, for example:
  "Best regards,
  ${userName}
  ${orgName}${userEmail ? `\n${userEmail}` : ''}"

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
      
      if (!config) {
        return res.json(null);
      }

      // Filter out sensitive tokens/credentials before sending to frontend
      const safeConfig = {
        id: config.id,
        service: config.service,
        isActive: config.isActive,
        updatedAt: config.updatedAt,
        // Only include non-sensitive metadata from config
        metadata: {} as any
      };

      // Add service-specific safe metadata
      const fullConfig = config.config as any;
      if (config.service === 'gmail' || config.service === 'outlook') {
        safeConfig.metadata.email = fullConfig.email || 'connected';
        safeConfig.metadata.connected = true;
      } else if (config.service === 'messenger') {
        safeConfig.metadata.pageName = fullConfig.pageName;
        safeConfig.metadata.pageId = fullConfig.pageId;
        safeConfig.metadata.pageCategory = fullConfig.pageCategory;
        safeConfig.metadata.connected = true;
        safeConfig.metadata.connectedViaOAuth = fullConfig.connectedViaOAuth || false;
      } else if (config.service === 'twilio') {
        safeConfig.metadata.phoneNumber = fullConfig.phoneNumber;
        safeConfig.metadata.connected = true;
      }

      res.json(safeConfig);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integration config" });
    }
  });

  // Clear Gmail sync progress without touching OAuth tokens
  app.post("/api/integrations/gmail/clear-sync-progress", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const config = await storage.getIntegrationConfig("gmail", req.orgId);
      
      if (!config) {
        return res.status(404).json({ error: "Gmail integration not found" });
      }

      // Preserve all existing config but clear only sync progress fields
      const updatedConfig = {
        ...config.config,
        lastHistoryId: null,
        pageToken: null,
      };

      await storage.upsertIntegrationConfig({
        service: "gmail",
        config: updatedConfig,
        isActive: config.isActive,
        orgId: req.orgId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[Clear Gmail Sync Progress] Error:", error);
      res.status(500).json({ error: "Failed to clear sync progress" });
    }
  });

  app.post("/api/integrations", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      
      // Fetch existing config to preserve OAuth tokens if config is empty
      const existing = await storage.getIntegrationConfig(validatedData.service, req.orgId);
      
      let finalConfig = validatedData.config;
      
      // If config is empty object and we have existing config, preserve the existing one
      if (Object.keys(validatedData.config || {}).length === 0 && existing) {
        finalConfig = existing.config;
      }
      
      const config = await storage.upsertIntegrationConfig({ 
        ...validatedData, 
        config: finalConfig,
        orgId: req.orgId 
      });
      res.status(201).json(config);
    } catch (error) {
      console.error("[Update Integration] Error:", error);
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
        return res.redirect("/integrations?gmail=error&reason=no_org");
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

      // Redirect back to integrations page with success message
      res.redirect("/integrations?gmail=connected");
    } catch (error) {
      console.error("Gmail OAuth error:", error);
      res.redirect("/integrations?gmail=error");
    }
  });

  // ===== FACEBOOK OAUTH ROUTES =====
  app.get("/api/integrations/facebook/auth", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("[Facebook OAuth] Generating auth URL for user:", userId);
      const authUrl = getFacebookAuthUrl(userId);
      console.log("[Facebook OAuth] Generated auth URL:", authUrl);
      res.json({ url: authUrl });
    } catch (error: any) {
      console.error("[Facebook OAuth] Failed to generate auth URL:", error);
      res.status(500).json({ error: error.message || "Failed to generate auth URL" });
    }
  });

  app.get("/api/integrations/facebook/callback", isAuthenticated, async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code) {
        return res.redirect("/settings?facebook=error&reason=no_code");
      }

      // Validate state parameter for CSRF protection
      if (!userId || userId !== req.user.id) {
        console.error("[Facebook OAuth] State validation failed - potential CSRF attack");
        return res.redirect("/settings?facebook=error&reason=invalid_state");
      }

      console.log("[Facebook OAuth] Callback received, state validated, exchanging code for token");

      // Exchange code for user access token
      const tokens = await getFacebookTokensFromCode(code as string);
      
      // Get user's organization
      const membership = await storage.getUserOrganization(req.user.id);
      if (!membership) {
        return res.redirect("/settings?facebook=error&reason=no_org");
      }

      console.log("[Facebook OAuth] Fetching user's Facebook pages...");
      
      // Get user's Facebook pages
      const pages = await getFacebookPages(tokens.access_token);
      
      if (pages.length === 0) {
        console.log("[Facebook OAuth] No pages found for user");
        return res.redirect("/settings?facebook=error&reason=no_pages");
      }

      console.log(`[Facebook OAuth] Found ${pages.length} pages`);

      // For now, use the first page (in future, let user select)
      const selectedPage = pages[0];
      
      // Page access tokens from the /me/accounts endpoint are already long-lived
      // but we can exchange them again to ensure they're long-lived
      let pageAccessToken = selectedPage.access_token;
      
      try {
        const longLivedToken = await getLongLivedPageAccessToken(pageAccessToken);
        pageAccessToken = longLivedToken.access_token;
        console.log("[Facebook OAuth] Exchanged for long-lived page access token");
      } catch (error) {
        console.log("[Facebook OAuth] Page token already long-lived or exchange failed, using existing token");
      }

      // Subscribe the page to webhook events
      try {
        await subscribePage(selectedPage.id, pageAccessToken);
        console.log("[Facebook OAuth] Page subscribed to webhooks");
      } catch (error) {
        console.error("[Facebook OAuth] Failed to subscribe page to webhooks:", error);
        // Continue anyway - admin can manually subscribe in Facebook Developer Console
      }

      // Store the page access token in integration config
      await storage.upsertIntegrationConfig({
        service: "messenger",
        config: {
          pageAccessToken: pageAccessToken,
          pageId: selectedPage.id,
          pageName: selectedPage.name,
          pageCategory: selectedPage.category,
          verifyToken: process.env.MESSENGER_VERIFY_TOKEN || 'leaseloopai_messenger_verify_2024',
          connectedViaOAuth: true
        },
        isActive: true,
        orgId: membership.orgId,
      });

      console.log("[Facebook OAuth] Successfully configured Messenger integration");
      res.redirect("/settings?facebook=connected");
    } catch (error: any) {
      console.error("[Facebook OAuth] Error:", error);
      res.redirect(`/settings?facebook=error&reason=${encodeURIComponent(error.message || 'unknown')}`);
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
      
      // Note: We don't return early on cancellation - let it complete with current state
      
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

      // Note: We don't return early on cancellation - let it complete with current state

      // Get all properties to match against
      const properties = await storage.getAllProperties(req.orgId);
      syncProgressTracker.addLog('info', `✓ Loaded ${properties.length} properties`);

      // Note: We don't return early on cancellation - let it complete with current state

      // Fetch comprehensive email history (up to 5000 emails)
      syncProgressTracker.addLog('info', '📧 Fetching emails from Gmail...');
      syncProgressTracker.updateStep('Fetching emails from Gmail...');
      const messages = await listMessages(tokens, 5000, () => syncProgressTracker.isCancelled());
      
      // Note: We don't return early on cancellation - let it complete with current state

      // Update total count now that we know how many emails we have (without resetting logs)
      syncProgressTracker.setTotal(messages.length);
      syncProgressTracker.addLog('success', `✓ Fetched ${messages.length} emails`);
      
      // Check if sync was cancelled during fetch and notify user
      if (syncProgressTracker.isCancelled()) {
        syncProgressTracker.addLog('warning', `⚠️ Sync cancelled - processing ${messages.length} fetched emails before stopping...`);
      }
      
      syncProgressTracker.updateStep(`Analyzing ${messages.length} emails with AI...`);
      
      const createdLeads = [];
      const duplicates = [];
      const parseErrors = [];
      const skipped = [];
      const processingLogs = [];
      const leadsWithNewMessages = new Set<string>(); // Track leads that got new messages (new or existing)
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      // Track threadId -> leadId mapping to ensure all emails in a thread go to same lead
      const threadLeadMap = new Map<string, string>();
      
      // Track email -> leadId mapping to prevent duplicate leads from same email across different threads
      const emailLeadMap = new Map<string, string>();
      
      // Track processed message IDs in this session to prevent duplicates within the same batch
      const processedMessageIds = new Set<string>();

      for (const msg of messages) {
        // Check if sync was cancelled by user
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
        const to = headers.find((h: any) => h.name === "To")?.value || "";
        const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
        const threadId = fullMessage.threadId;
        
        // Get the actual email timestamp (Gmail's internalDate is milliseconds since epoch)
        const emailTimestamp = fullMessage.internalDate 
          ? new Date(parseInt(fullMessage.internalDate))
          : new Date();
        
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

        // Check if we already processed this message in this sync session
        if (processedMessageIds.has(msg.id)) {
          duplicates.push({ messageId: msg.id, reason: "Already processed in this session" });
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

        // Mark this message as being processed immediately to prevent duplicates within this batch
        processedMessageIds.add(msg.id);

        // Check if this exact message was already processed in database by externalId (message ID)
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
            
            console.log(`[Gmail Sender Check] From: "${from}" | Property Manager: "${propertyManagerEmail}" | Match: ${isFromPropertyManager} | Type: ${conversationType}`);
            syncProgressTracker.addLog('info', `💬 Thread reply: Adding ${conversationType} message to lead "${threadLead.name}" (From: ${from.substring(0, 30)}...)`);
            
            // Store the raw email body as-is (including metadata)
            console.log('[Gmail] Raw email body length:', emailBody.length);
            console.log('[Gmail] Body preview:', emailBody.substring(0, 100));
            
            // Extract Message-ID header for email threading
            const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
            
            // Create conversation record with raw email body
            await storage.createConversation({
              leadId: threadLead.id,
              type: conversationType,
              message: emailBody,
              channel: "email",
              aiGenerated: false,
              externalId: msg.id,
              emailMessageId: messageId,
              emailSubject: cleanEmailSubject(subject),
              sourceIntegration: "gmail",
              createdAt: emailTimestamp,
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
- phone (string) - phone number ONLY if explicitly mentioned in the email body. DO NOT generate or infer phone numbers. If no phone is mentioned, set to null.
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
            
            // Determine if this is an outgoing email (from property manager) for fallback
            const isFromPropertyManagerFallback = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
            const emailSource = isFromPropertyManagerFallback ? to : from;
            
            const extractedEmail = emailSource.match(/<(.+)>/)?.[1] || emailSource;
            const nameParts = emailSource.split('<')[0].trim().replace(/"/g, '').split(' ');
            const fallbackCleanedBody = cleanEmailBody(emailBody);
            parsedData = {
              firstName: nameParts[0] || 'Unknown',
              lastName: nameParts.slice(1).join(' ') || '',
              email: extractedEmail,
              message: fallbackCleanedBody.substring(0, 500),
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
          
          // Determine if this is an outgoing email (from property manager)
          const isFromPropertyManager = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
          
          // Extract lead email: use "To" for outgoing emails, "From" for incoming
          let leadEmail;
          if (isFromPropertyManager) {
            // Outgoing email - the lead is the recipient
            leadEmail = (to.match(/<(.+)>/)?.[1] || to).toLowerCase().trim();
          } else {
            // Incoming email - the lead is the sender
            leadEmail = (parsedData.email || from.match(/<(.+)>/)?.[1] || from).toLowerCase().trim();
          }
          
          const leadPhone = parsedData.phone?.trim() || "";

          // First check if this thread already has an associated lead
          let existingLead = null;
          if (threadId && threadLeadMap.has(threadId)) {
            const leadId = threadLeadMap.get(threadId)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `🔗 Thread match: Using existing lead from thread`);
          }
          
          // If not in thread map, check if we've already seen this email in this sync session
          if (!existingLead && emailLeadMap.has(leadEmail)) {
            const leadId = emailLeadMap.get(leadEmail)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `📧 Email match: Using existing lead from earlier in sync`);
          }
          
          // If not in session maps, check if lead already exists in database by email or phone
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
            syncProgressTracker.addCreatedLeadId(leadToUse.id); // Track this lead for current sync
          }

          // Store threadId -> leadId mapping for future emails in this thread
          if (threadId) {
            threadLeadMap.set(threadId, leadToUse.id);
          }
          
          // Store email -> leadId mapping to prevent duplicate leads from same email
          if (leadEmail) {
            emailLeadMap.set(leadEmail, leadToUse.id);
          }

          // Store the raw email body as-is (including metadata)
          console.log('[Gmail Initial] Raw body length:', emailBody.length);
          console.log('[Gmail Initial] Body preview:', emailBody.substring(0, 100));
          
          // Detect if the initial message is from the property manager (outgoing) or lead (received)
          const initialIsFromPM = from.toLowerCase().includes(propertyManagerEmail.toLowerCase());
          const initialMessageType = initialIsFromPM ? "outgoing" : "received";
          console.log(`[Gmail Initial Sender] From: "${from}" | Property Manager: "${propertyManagerEmail}" | Match: ${initialIsFromPM} | Type: ${initialMessageType}`);
          
          // Extract Message-ID header for email threading
          const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
          
          // Create conversation record with raw email body
          await storage.createConversation({
            leadId: leadToUse.id,
            type: initialMessageType,
            message: emailBody,
            channel: "email",
            aiGenerated: false,
            externalId: msg.id,
            emailMessageId: messageId,
            emailSubject: cleanEmailSubject(subject),
            sourceIntegration: "gmail",
            createdAt: emailTimestamp,
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
                subject: subject,
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
                subject: subject,
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
                subject: subject,
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
          } else {
            syncProgressTracker.addLog('success', `✅ Added message to existing lead: ${leadToUse.name} - "${subject.substring(0, 40)}..."`);
          }
          
          // Track all leads that got new messages (both new and existing)
          leadsWithNewMessages.add(leadToUse.id);

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

      // Log the raw counts before computing summary
      console.log(`[Gmail Sync Summary] createdLeads.length: ${createdLeads.length}`);
      console.log(`[Gmail Sync Summary] leadsWithNewMessages.size: ${leadsWithNewMessages.size}`);
      console.log(`[Gmail Sync Summary] createdLeads:`, createdLeads.map(l => ({ name: l.name, email: l.email })));
      console.log(`[Gmail Sync Summary] leadsWithNewMessages IDs:`, Array.from(leadsWithNewMessages));

      const summary = {
        created: createdLeads.length,
        updated: leadsWithNewMessages.size - createdLeads.length, // Leads that got new messages but weren't newly created
        total: leadsWithNewMessages.size, // Total leads affected (new + updated)
        duplicates: duplicates.length,
        skipped: skipped.length,
        errors: parseErrors.length,
      };

      console.log(`[Gmail Sync Summary] Final summary:`, summary);

      syncProgressTracker.complete(summary);
      syncProgressTracker.addLog('success', `✅ Sync complete! ${summary.total} leads imported (${summary.created} new, ${summary.updated} updated) from ${messages.length} emails`);

      // Clear notified threads for ALL synced leads (both new and updated)
      const syncedLeadIds = Array.from(leadsWithNewMessages);
      const syncedThreadIds: string[] = [];
      
      for (const leadId of syncedLeadIds) {
        const lead = await storage.getLead(leadId, req.orgId);
        if (lead?.gmailThreadId) {
          syncedThreadIds.push(lead.gmailThreadId);
        }
      }
      
      if (syncedThreadIds.length > 0) {
        await gmailScanner.clearNotifiedThreads(req.orgId, syncedThreadIds);
      }

      // Mark all gmail_new_leads notifications for this org as read
      const gmailNotifications = await storage.getUserNotifications(req.user.id, req.orgId);
      const gmailNewLeadsNotifications = gmailNotifications.filter(n => n.type === 'gmail_new_leads' && !n.read);
      
      for (const notification of gmailNewLeadsNotifications) {
        await storage.markNotificationAsRead(notification.id, req.user.id);
      }

      const responseData = {
        success: true,
        createdLeads,
        duplicates,
        skipped,
        parseErrors,
        processingLogs,
        total: messages.length,
        summary,
        isCancelled: syncProgressTracker.isCancelled(),
      };
      
      console.log('[Gmail Sync Response] Sending response:', {
        isCancelled: responseData.isCancelled,
        summary: responseData.summary,
        total: responseData.total,
      });
      
      res.json(responseData);

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
      
      // Track email -> leadId mapping to prevent duplicate leads from same email across different conversations
      const emailLeadMap = new Map<string, string>();
      
      // Track processed message IDs in this session to prevent duplicates within the same batch
      const processedMessageIds = new Set<string>();

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

          // Check if we already processed this message in this sync session
          if (processedMessageIds.has(msg.id)) {
            duplicates.push({ email: fromEmail, reason: "Already processed in this session" });
            syncProgressTracker.addLog('warning', `⏭️ Skipped duplicate: "${subject.substring(0, 50)}..."`);
            continue;
          }

          // Mark this message as being processed immediately to prevent duplicates within this batch
          processedMessageIds.add(msg.id);

          // Check if this exact message was already processed in database by externalId
          const existingConversation = await storage.getConversationByExternalId(msg.id);
          if (existingConversation) {
            duplicates.push({ email: fromEmail, reason: "Already processed" });
            syncProgressTracker.addLog('warning', `⏭️ Skipped duplicate: "${subject.substring(0, 50)}..."`);
            continue;
          }

          // Check if this conversation already has a lead
          let leadToUse = null;
          if (conversationId && conversationLeadMap.has(conversationId)) {
            const existingLeadId = conversationLeadMap.get(conversationId);
            leadToUse = await storage.getLead(existingLeadId!, req.orgId);
            
            if (leadToUse) {
              syncProgressTracker.addLog('info', `📎 Email belongs to existing conversation for ${leadToUse.name}`);
              
              // Clean the email body before storing
              const cleanedConvoBody = cleanEmailBody(emailBody);
              
              // Just create conversation record
              await storage.createConversation({
                leadId: leadToUse.id,
                type: "received",
                message: cleanedConvoBody.substring(0, 500),
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
          
          // First check if we've already seen this email in this sync session
          let existingLead = null;
          if (emailLeadMap.has(leadEmail)) {
            const leadId = emailLeadMap.get(leadEmail)!;
            existingLead = await storage.getLead(leadId, req.orgId);
            syncProgressTracker.addLog('info', `📧 Email match: Using existing lead from earlier in sync`);
          }
          
          // If not in session map, check database by email or phone
          if (!existingLead) {
            existingLead = await storage.getLeadByEmail(leadEmail, req.orgId) || 
                            (leadPhone ? await storage.getLeadByPhone(leadPhone, req.orgId) : null);
          }

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
            syncProgressTracker.addCreatedLeadId(leadToUse.id); // Track this lead for current sync
            createdLeads.push(leadToUse);
          }

          // Store conversationId -> leadId mapping
          if (conversationId) {
            conversationLeadMap.set(conversationId, leadToUse.id);
          }
          
          // Store email -> leadId mapping to prevent duplicate leads from same email
          if (leadEmail) {
            emailLeadMap.set(leadEmail, leadToUse.id);
          }

          // Clean the email body to remove quoted content and fix line breaks
          const cleanedOutlookBody = cleanEmailBody(emailBody);
          
          // Create conversation record
          await storage.createConversation({
            leadId: leadToUse.id,
            type: "received",
            message: parsedData.message || cleanedOutlookBody,
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
        total: createdLeads.length, // Total leads affected
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
        isCancelled: syncProgressTracker.isCancelled(),
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
  // Backfill Message-IDs for existing conversations
  app.post("/api/conversations/backfill-message-ids", isAuthenticated, attachOrgContext, async (req: any, res) => {
    try {
      console.log('[Backfill] Starting Message-ID backfill for org:', req.orgId);
      
      // Get Gmail integration
      const integration = await storage.getIntegrationConfig('gmail', req.orgId);
      if (!integration || !integration.config?.access_token) {
        return res.status(400).json({ error: "Gmail not connected" });
      }
      
      // Get all conversations without Message-IDs that have externalId (Gmail message ID)
      const conversationsToBackfill = await db.select()
        .from(conversations)
        .where(
          and(
            isNull(conversations.emailMessageId),
            isNotNull(conversations.externalId),
            eq(conversations.channel, 'email')
          )
        )
        .limit(100); // Process in batches
      
      console.log('[Backfill] Found', conversationsToBackfill.length, 'conversations to backfill');
      
      let updated = 0;
      let failed = 0;
      
      for (const conv of conversationsToBackfill) {
        try {
          // Fetch the original Gmail message
          const gmailMessage = await getMessage(integration.config, conv.externalId!);
          const headers = gmailMessage.payload?.headers || [];
          const messageId = headers.find((h: any) => h.name === "Message-ID")?.value;
          
          if (messageId) {
            // Update the conversation with the Message-ID
            await db
              .update(conversations)
              .set({ emailMessageId: messageId })
              .where(eq(conversations.id, conv.id));
            updated++;
            console.log('[Backfill] Updated conversation', conv.id, 'with Message-ID:', messageId);
          } else {
            console.log('[Backfill] No Message-ID found for conversation', conv.id);
            failed++;
          }
        } catch (error: any) {
          console.error('[Backfill] Failed to process conversation', conv.id, ':', error.message);
          failed++;
        }
      }
      
      console.log('[Backfill] Complete:', updated, 'updated,', failed, 'failed');
      res.json({ updated, failed, total: conversationsToBackfill.length });
    } catch (error) {
      console.error('[Backfill] Error:', error);
      res.status(500).json({ error: "Failed to backfill Message-IDs" });
    }
  });

  // ===== DEMO REQUEST ROUTES (PUBLIC) =====
  // Create a new demo request (no authentication required)
  app.post("/api/demo-requests", async (req, res) => {
    try {
      const validatedData = insertDemoRequestSchema.parse(req.body);
      const demoRequest = await storage.createDemoRequest(validatedData);
      
      // Automatically create/update sales prospect from this demo request
      try {
        await storage.upsertProspectFromDemo(demoRequest);
        console.log("[Demo Request] Created/updated sales prospect for:", demoRequest.email);
      } catch (prospectError: any) {
        console.error("[Demo Request] Failed to create sales prospect:", prospectError.message);
        // Don't fail the demo request if prospect creation fails
      }
      
      res.status(201).json(demoRequest);
    } catch (error: any) {
      console.error("[Demo Request] Error creating demo request:", error);
      res.status(400).json({ 
        message: "Failed to submit demo request", 
        error: error.message 
      });
    }
  });

  // Get all demo requests (admin only - would need auth)
  app.get("/api/demo-requests", isAuthenticated, async (req, res) => {
    try {
      const requests = await storage.getAllDemoRequests();
      res.json(requests);
    } catch (error) {
      console.error("[Demo Request] Error fetching demo requests:", error);
      res.status(500).json({ message: "Failed to fetch demo requests" });
    }
  });

  // ===== APPOINTMENT ROUTES =====
  // Get available time slots for a date (public)
  app.get("/api/appointments/availability", async (req, res) => {
    try {
      const { date } = req.query;
      
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "Date parameter is required (YYYY-MM-DD format)" });
      }

      // Define business hours (9 AM to 5 PM) and slot duration (30 minutes)
      const businessHours = {
        start: 9, // 9 AM
        end: 17,  // 5 PM
        slotDuration: 30, // minutes
      };

      // Generate all possible time slots
      const allSlots: string[] = [];
      for (let hour = businessHours.start; hour < businessHours.end; hour++) {
        for (let minute = 0; minute < 60; minute += businessHours.slotDuration) {
          const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          allSlots.push(timeString);
        }
      }

      // Get existing appointments for this date
      const existingAppointments = await storage.getAppointmentsByDate(date);
      const bookedSlots = new Set(existingAppointments.map(apt => apt.appointmentTime));

      // Filter out booked slots and past times if date is today
      const now = new Date();
      const requestedDate = new Date(date);
      const isToday = requestedDate.toDateString() === now.toDateString();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const availableSlots = allSlots.filter(slot => {
        if (bookedSlots.has(slot)) return false;
        
        if (isToday) {
          const [hour, minute] = slot.split(':').map(Number);
          const slotTime = hour * 60 + minute;
          const currentTime = currentHour * 60 + currentMinute;
          return slotTime > currentTime + 60; // At least 1 hour from now
        }
        
        return true;
      });

      res.json({ 
        date, 
        availableSlots, 
        bookedCount: bookedSlots.size,
        totalSlots: allSlots.length 
      });
    } catch (error: any) {
      console.error("[Appointments] Error fetching availability:", error);
      res.status(500).json({ message: "Failed to fetch availability" });
    }
  });

  // Create a new appointment (public - no authentication required)
  app.post("/api/appointments", async (req, res) => {
    try {
      const validatedData = insertAppointmentSchema.parse(req.body);
      
      // Check if the time slot is still available
      const existingAppointments = await storage.getAppointmentsByDate(validatedData.appointmentDate);
      const isSlotTaken = existingAppointments.some(apt => 
        apt.appointmentTime === validatedData.appointmentTime && 
        apt.status === 'scheduled'
      );

      if (isSlotTaken) {
        return res.status(409).json({ 
          message: "This time slot is no longer available. Please select a different time." 
        });
      }

      const appointment = await storage.createAppointment(validatedData);
      console.log("[Appointments] Created appointment:", appointment.id);
      
      // Send confirmation emails
      try {
        const { sendAppointmentConfirmation } = await import("./email");
        await sendAppointmentConfirmation(appointment);
        console.log("[Appointments] Confirmation emails sent");
      } catch (emailError) {
        console.error("[Appointments] Error sending confirmation emails:", emailError);
        // Don't fail the appointment creation if email fails
      }
      
      res.status(201).json(appointment);
    } catch (error: any) {
      console.error("[Appointments] Error creating appointment:", error);
      res.status(400).json({ 
        message: "Failed to create appointment", 
        error: error.message 
      });
    }
  });

  // Get all appointments (admin only)
  app.get("/api/appointments", isAuthenticated, async (req, res) => {
    try {
      const appointments = await storage.getAllAppointments();
      res.json(appointments);
    } catch (error) {
      console.error("[Appointments] Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  // Update appointment status (admin only)
  app.patch("/api/appointments/:id/status", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['scheduled', 'completed', 'cancelled', 'no-show'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const updated = await storage.updateAppointmentStatus(id, status);
      
      if (!updated) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("[Appointments] Error updating appointment status:", error);
      res.status(500).json({ message: "Failed to update appointment status" });
    }
  });

  // ===== ONBOARDING INTAKE ROUTES =====
  // Create or update onboarding intake (public - no auth required)
  app.post("/api/onboarding", async (req, res) => {
    try {
      const { sessionToken, ...intakeData } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({ message: "Session token is required" });
      }

      // Check if intake already exists
      const existingIntake = await storage.getOnboardingIntake(sessionToken);
      
      if (existingIntake) {
        // Update existing intake
        const updated = await storage.updateOnboardingIntake(sessionToken, intakeData);
        return res.json(updated);
      } else {
        // Create new intake
        const intake = await storage.createOnboardingIntake({
          sessionToken,
          ...intakeData,
        });
        return res.status(201).json(intake);
      }
    } catch (error: any) {
      console.error("[Onboarding] Error saving onboarding intake:", error);
      res.status(400).json({ 
        message: "Failed to save onboarding data", 
        error: error.message 
      });
    }
  });

  // Get onboarding intake by session token (public)
  app.get("/api/onboarding/:sessionToken", async (req, res) => {
    try {
      const { sessionToken } = req.params;
      const intake = await storage.getOnboardingIntake(sessionToken);
      
      if (!intake) {
        return res.status(404).json({ message: "Onboarding intake not found" });
      }
      
      res.json(intake);
    } catch (error) {
      console.error("[Onboarding] Error fetching onboarding intake:", error);
      res.status(500).json({ message: "Failed to fetch onboarding data" });
    }
  });

  // Mark onboarding as completed (public)
  app.patch("/api/onboarding/:sessionToken/complete", async (req, res) => {
    try {
      const { sessionToken } = req.params;
      // Update status to completed and manually set completedAt timestamp
      const intake = await storage.getOnboardingIntake(sessionToken);
      if (!intake) {
        return res.status(404).json({ message: "Onboarding intake not found" });
      }

      // Use raw DB update to set completedAt
      const result = await db
        .update(onboardingIntakes)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(onboardingIntakes.sessionToken, sessionToken))
        .returning();
      
      // Automatically create/update sales prospect from this onboarding intake
      const completedIntake = result[0];
      if (completedIntake) {
        try {
          await storage.upsertProspectFromOnboarding(completedIntake);
          console.log("[Onboarding] Created/updated sales prospect for intake:", completedIntake.id);
        } catch (prospectError: any) {
          console.error("[Onboarding] Failed to create sales prospect:", prospectError.message);
          // Don't fail the completion if prospect creation fails
        }
      }
      
      res.json(result[0]);
    } catch (error) {
      console.error("[Onboarding] Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Get all onboarding intakes (admin only)
  app.get("/api/onboarding-intakes", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const intakes = await storage.getAllOnboardingIntakes();
      res.json(intakes);
    } catch (error) {
      console.error("[Onboarding] Error fetching onboarding intakes:", error);
      res.status(500).json({ message: "Failed to fetch onboarding intakes" });
    }
  });

  // Get all sales prospects (admin only)
  app.get("/api/sales-prospects", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const prospects = await storage.getAllSalesProspects();
      res.json(prospects);
    } catch (error) {
      console.error("[Sales] Error fetching sales prospects:", error);
      res.status(500).json({ message: "Failed to fetch sales prospects" });
    }
  });

  // Update prospect pipeline stage (admin only)
  app.patch("/api/sales-prospects/:id/stage", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const { stage } = req.body;

      if (!stage) {
        return res.status(400).json({ message: "Stage is required" });
      }

      const validStages = ['discovery', 'evaluation', 'probing', 'offer', 'sale', 'onboard'];
      if (!validStages.includes(stage)) {
        return res.status(400).json({ message: "Invalid stage" });
      }

      const prospect = await storage.updateProspectStage(id, stage);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      res.json(prospect);
    } catch (error) {
      console.error("[Sales] Error updating prospect stage:", error);
      res.status(500).json({ message: "Failed to update prospect stage" });
    }
  });

  // Update prospect details (admin only) - must come after specific routes like /stage
  app.patch("/api/sales-prospects/:id", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      const updateData: Partial<InsertSalesProspect> = {};

      // Only allow updating specific fields
      if (req.body.notes !== undefined) {
        updateData.notes = req.body.notes;
      }
      if (req.body.primaryName !== undefined) {
        updateData.primaryName = req.body.primaryName;
      }
      if (req.body.phone !== undefined) {
        updateData.phone = req.body.phone;
      }
      if (req.body.units !== undefined) {
        updateData.units = req.body.units;
      }

      const prospect = await storage.updateSalesProspect(id, updateData);
      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      res.json(prospect);
    } catch (error) {
      console.error("[Sales] Error updating prospect:", error);
      res.status(500).json({ message: "Failed to update prospect" });
    }
  });

  // Resync all prospects from demo requests and onboarding intakes (admin only)
  app.post("/api/sales-prospects/resync", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      console.log("[Sales] Starting prospect resync...");
      const count = await storage.resyncAllProspects();
      console.log("[Sales] Resync completed successfully:", count, "prospects");
      res.json({ message: `Resynced ${count} prospects`, count });
    } catch (error: any) {
      console.error("[Sales] Error resyncing prospects:", error);
      console.error("[Sales] Error stack:", error.stack);
      console.error("[Sales] Error message:", error.message);
      res.status(500).json({ message: "Failed to resync prospects", error: error.message });
    }
  });

  // ===== ADMIN ANALYTICS ROUTES =====
  // Get platform-wide analytics (admin only)
  app.get("/api/admin/analytics", isAuthenticated, async (req, res) => {
    try {
      // Only allow admin users
      const user = req.user as User;
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const analytics = await storage.getAdminAnalytics();
      res.json(analytics);
    } catch (error: any) {
      console.error("[Admin Analytics] Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics", error: error.message });
    }
  });

  return httpServer;
}

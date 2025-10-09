import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertConversationSchema, insertNoteSchema, insertAISettingSchema, insertIntegrationConfigSchema } from "@shared/schema";
import { getGmailAuthUrl, getGmailTokensFromCode, listMessages, getMessage } from "./gmail";
import OpenAI from "openai";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // ===== LEAD ROUTES =====
  app.get("/api/leads", async (req, res) => {
    try {
      const { status } = req.query;
      const leads = status 
        ? await storage.getLeadsByStatus(status as string)
        : await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  // Sync progress route must come before :id route to avoid matching "sync-progress" as an id
  app.get("/api/leads/sync-progress", async (req, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    res.json(syncProgressTracker.getProgress());
  });

  app.get("/api/leads/:id", async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
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

  app.post("/api/leads", async (req, res) => {
    try {
      const validatedData = insertLeadSchema.parse(req.body);
      const lead = await storage.createLead(validatedData);
      res.status(201).json(lead);
    } catch (error) {
      res.status(400).json({ error: "Invalid lead data" });
    }
  });

  app.patch("/api/leads/:id", async (req, res) => {
    try {
      const partialSchema = insertLeadSchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const lead = await storage.updateLead(req.params.id, validatedData);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(400).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/leads/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteLead(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // ===== PROPERTY ROUTES =====
  app.get("/api/properties", async (req, res) => {
    try {
      const properties = await storage.getAllProperties();
      
      // Enhance with lead counts
      const leads = await storage.getAllLeads();
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

  app.get("/api/properties/:id", async (req, res) => {
    try {
      const property = await storage.getProperty(req.params.id);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch property" });
    }
  });

  app.post("/api/properties", async (req, res) => {
    try {
      const validatedData = insertPropertySchema.parse(req.body);
      const property = await storage.createProperty(validatedData);
      res.status(201).json(property);
    } catch (error) {
      res.status(400).json({ error: "Invalid property data" });
    }
  });

  app.patch("/api/properties/:id", async (req, res) => {
    try {
      const partialSchema = insertPropertySchema.partial();
      const validatedData = partialSchema.parse(req.body);
      const property = await storage.updateProperty(req.params.id, validatedData);
      if (!property) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.json(property);
    } catch (error) {
      res.status(400).json({ error: "Failed to update property" });
    }
  });

  app.delete("/api/properties/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteProperty(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Property not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete property" });
    }
  });

  // ===== CONVERSATION ROUTES =====
  app.get("/api/conversations/:leadId", async (req, res) => {
    try {
      const conversations = await storage.getConversationsByLeadId(req.params.leadId);
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const validatedData = insertConversationSchema.parse(req.body);
      const conversation = await storage.createConversation(validatedData);
      
      // Update lead's lastContactAt
      await storage.updateLead(validatedData.leadId, { lastContactAt: new Date() } as any);
      
      res.status(201).json(conversation);
    } catch (error) {
      res.status(400).json({ error: "Invalid conversation data" });
    }
  });

  // ===== NOTE ROUTES =====
  app.get("/api/notes/:leadId", async (req, res) => {
    try {
      const notes = await storage.getNotesByLeadId(req.params.leadId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const validatedData = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(validatedData);
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ error: "Invalid note data" });
    }
  });

  // ===== AI SETTINGS ROUTES =====
  app.get("/api/ai-settings/:category", async (req, res) => {
    try {
      const settings = await storage.getAISettings(req.params.category);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch AI settings" });
    }
  });

  app.post("/api/ai-settings", async (req, res) => {
    try {
      const validatedData = insertAISettingSchema.parse(req.body);
      const setting = await storage.upsertAISetting(validatedData);
      res.status(201).json(setting);
    } catch (error) {
      res.status(400).json({ error: "Invalid AI setting data" });
    }
  });

  // ===== INTEGRATION CONFIG ROUTES =====
  app.get("/api/integrations/:service", async (req, res) => {
    try {
      const config = await storage.getIntegrationConfig(req.params.service);
      res.json(config || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch integration config" });
    }
  });

  app.post("/api/integrations", async (req, res) => {
    try {
      const validatedData = insertIntegrationConfigSchema.parse(req.body);
      const config = await storage.upsertIntegrationConfig(validatedData);
      res.status(201).json(config);
    } catch (error) {
      res.status(400).json({ error: "Invalid integration config data" });
    }
  });

  // ===== ANALYTICS ROUTES =====
  app.get("/api/analytics/stats", async (req, res) => {
    try {
      const stats = await storage.getLeadStats();
      
      // Calculate additional metrics
      const allLeads = await storage.getAllLeads();
      const totalLeads = stats.total;
      const approvedLeads = stats.byStatus.approved || 0;
      const conversionRate = totalLeads > 0 ? Math.round((approvedLeads / totalLeads) * 100) : 0;
      
      // Calculate average response time (mock for now)
      const avgResponseTime = "2.3 min";
      
      // Get active properties count
      const properties = await storage.getAllProperties();
      
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

  app.get("/api/analytics/trends", async (req, res) => {
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
  app.get("/api/ai-activity", async (req, res) => {
    try {
      const conversations = await storage.getAllLeads();
      
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
  app.get("/api/auth/google", async (req, res) => {
    try {
      // In production, you'd get the actual user ID from session
      // For now, using a placeholder
      const userId = req.query.userId as string || "default-user";
      const authUrl = getGmailAuthUrl(userId);
      res.json({ url: authUrl });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate auth URL" });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state: userId } = req.query;
      
      if (!code) {
        return res.status(400).send("Authorization code missing");
      }

      // Exchange code for tokens
      const tokens = await getGmailTokensFromCode(code as string);

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
      });

      // Redirect back to settings with success message
      res.redirect("/settings?gmail=connected");
    } catch (error) {
      console.error("Gmail OAuth error:", error);
      res.redirect("/settings?gmail=error");
    }
  });

  // ===== GMAIL LEAD SYNC =====
  app.post("/api/leads/sync-from-gmail", async (req, res) => {
    const { syncProgressTracker } = await import("./syncProgress");
    
    try {
      // Reset tracker at the start to clear any stale state
      syncProgressTracker.reset();
      
      // Start with placeholder count (will update once we know total emails)
      syncProgressTracker.start(0);
      syncProgressTracker.updateStep('Initializing sync...');
      
      // Get Gmail integration config
      const gmailConfig = await storage.getIntegrationConfig("gmail");
      const tokens = gmailConfig?.config as any;
      if (!gmailConfig || !tokens?.access_token) {
        syncProgressTracker.fail("Gmail not connected");
        return res.status(400).json({ error: "Gmail not connected" });
      }

      syncProgressTracker.addLog('info', '✓ Gmail credentials verified');

      // Get all properties to match against
      const properties = await storage.getAllProperties();
      syncProgressTracker.addLog('info', `✓ Loaded ${properties.length} properties`);

      // Fetch comprehensive email history (up to 5000 emails)
      syncProgressTracker.addLog('info', '📧 Fetching emails from Gmail...');
      syncProgressTracker.updateStep('Fetching emails from Gmail...');
      const messages = await listMessages(tokens, 5000);
      
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

      for (const msg of messages) {
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

        // Check if already processed by externalId
        const existing = await storage.getConversationByExternalId(msg.id);
        if (existing) {
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
          
          const parsedData = JSON.parse(rawContent);
          
          // Match property if mentioned
          let matchedProperty = null;
          if (parsedData.propertyName) {
            matchedProperty = properties.find(p => 
              p.name.toLowerCase().includes(parsedData.propertyName.toLowerCase()) ||
              parsedData.propertyName.toLowerCase().includes(p.name.toLowerCase())
            );
          }

          // Create lead with comprehensive profile data
          const newLead = await storage.createLead({
            name: `${parsedData.firstName} ${parsedData.lastName}`.trim(),
            email: parsedData.email || from.match(/<(.+)>/)?.[1] || from,
            phone: parsedData.phone || "",
            propertyId: matchedProperty?.id || properties[0]?.id || "",
            propertyName: matchedProperty?.name || parsedData.propertyName || "Not specified",
            status: "new",
            source: "email",
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
          });

          // Create conversation record with externalId
          await storage.createConversation({
            leadId: newLead.id,
            type: "received",
            message: parsedData.message || emailBody.substring(0, 500),
            channel: "email",
            aiGenerated: false,
            externalId: msg.id,
          });

          createdLeads.push({
            leadId: newLead.id,
            name: newLead.name,
            email: newLead.email,
            subject,
          });
          
          syncProgressTracker.addLog('success', `✅ Created lead: ${newLead.name} - "${subject.substring(0, 40)}..."`);

          processingLogs.push({
            status: "success",
            from,
            subject,
            preview: emailPreview,
            leadName: newLead.name,
            timestamp: new Date().toISOString(),
          });

        } catch (parseError) {
          parseErrors.push({ messageId: msg.id, error: String(parseError) });
          syncProgressTracker.addLog('error', `❌ Failed to parse: "${subject.substring(0, 40)}..."`);
          processingLogs.push({
            status: "error",
            from,
            subject,
            preview: emailPreview,
            error: String(parseError),
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

  const httpServer = createServer(app);
  return httpServer;
}

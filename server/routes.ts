import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertLeadSchema, insertPropertySchema, insertConversationSchema, insertNoteSchema, insertAISettingSchema, insertIntegrationConfigSchema } from "@shared/schema";
import { getGmailAuthUrl, getGmailTokensFromCode } from "./gmail";

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

  const httpServer = createServer(app);
  return httpServer;
}

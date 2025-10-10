import { db } from "./db";
import { 
  users, properties, leads, conversations, notes, aiSettings, integrationConfig, pendingReplies,
  type User, type InsertUser,
  type Property, type InsertProperty,
  type Lead, type InsertLead,
  type Conversation, type InsertConversation,
  type Note, type InsertNote,
  type AISetting, type InsertAISetting,
  type IntegrationConfig, type InsertIntegrationConfig,
  type PendingReply, type InsertPendingReply
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;

  // Property operations
  getAllProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property | undefined>;
  deleteProperty(id: string): Promise<boolean>;

  // Lead operations
  getAllLeads(): Promise<Lead[]>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;

  // Conversation operations
  getConversationsByLeadId(leadId: string): Promise<Conversation[]>;
  getConversationByExternalId(externalId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;

  // Note operations
  getNotesByLeadId(leadId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  // AI Settings operations
  getAISettings(category: string): Promise<AISetting[]>;
  upsertAISetting(setting: InsertAISetting): Promise<AISetting>;

  // Integration Config operations
  getIntegrationConfig(service: string): Promise<IntegrationConfig | undefined>;
  upsertIntegrationConfig(config: InsertIntegrationConfig): Promise<IntegrationConfig>;

  // Pending Reply operations
  getAllPendingReplies(): Promise<PendingReply[]>;
  getPendingReply(id: string): Promise<PendingReply | undefined>;
  createPendingReply(reply: InsertPendingReply): Promise<PendingReply>;
  updatePendingReplyStatus(id: string, status: string): Promise<PendingReply | undefined>;
  deletePendingReply(id: string): Promise<boolean>;

  // Analytics
  getLeadStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(userData).where(eq(users.id, id)).returning();
    return result[0];
  }

  // Property operations
  async getAllProperties(): Promise<Property[]> {
    return db.select().from(properties).orderBy(desc(properties.createdAt));
  }

  async getProperty(id: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    return result[0];
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const result = await db.insert(properties).values(property).returning();
    return result[0];
  }

  async updateProperty(id: string, propertyData: Partial<InsertProperty>): Promise<Property | undefined> {
    const result = await db.update(properties).set(propertyData).where(eq(properties.id, id)).returning();
    return result[0];
  }

  async deleteProperty(id: string): Promise<boolean> {
    const result = await db.delete(properties).where(eq(properties.id, id)).returning();
    return result.length > 0;
  }

  // Lead operations
  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads).orderBy(desc(leads.lastContactAt));
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.status, status)).orderBy(desc(leads.lastContactAt));
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return result[0];
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const result = await db.insert(leads).values(lead).returning();
    return result[0];
  }

  async updateLead(id: string, leadData: Partial<InsertLead>): Promise<Lead | undefined> {
    const result = await db.update(leads).set(leadData).where(eq(leads.id, id)).returning();
    return result[0];
  }

  async deleteLead(id: string): Promise<boolean> {
    // Delete related conversations and notes first
    await db.delete(conversations).where(eq(conversations.leadId, id));
    await db.delete(notes).where(eq(notes.leadId, id));
    
    const result = await db.delete(leads).where(eq(leads.id, id)).returning();
    return result.length > 0;
  }

  // Conversation operations
  async getConversationsByLeadId(leadId: string): Promise<Conversation[]> {
    return db.select().from(conversations).where(eq(conversations.leadId, leadId)).orderBy(conversations.createdAt);
  }

  async getConversationByExternalId(externalId: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.externalId, externalId)).limit(1);
    return result[0];
  }

  async createConversation(conversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(conversation).returning();
    return result[0];
  }

  // Note operations
  async getNotesByLeadId(leadId: string): Promise<Note[]> {
    return db.select().from(notes).where(eq(notes.leadId, leadId)).orderBy(desc(notes.createdAt));
  }

  async createNote(note: InsertNote): Promise<Note> {
    const result = await db.insert(notes).values(note).returning();
    return result[0];
  }

  // AI Settings operations
  async getAISettings(category: string): Promise<AISetting[]> {
    return db.select().from(aiSettings).where(eq(aiSettings.category, category));
  }

  async upsertAISetting(setting: InsertAISetting): Promise<AISetting> {
    const existing = await db.select().from(aiSettings)
      .where(and(eq(aiSettings.category, setting.category), eq(aiSettings.key, setting.key)))
      .limit(1);

    if (existing.length > 0) {
      const result = await db.update(aiSettings)
        .set({ value: setting.value, updatedAt: new Date() })
        .where(eq(aiSettings.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(aiSettings).values(setting).returning();
      return result[0];
    }
  }

  // Integration Config operations
  async getIntegrationConfig(service: string): Promise<IntegrationConfig | undefined> {
    const result = await db.select().from(integrationConfig).where(eq(integrationConfig.service, service)).limit(1);
    return result[0];
  }

  async upsertIntegrationConfig(config: InsertIntegrationConfig): Promise<IntegrationConfig> {
    const existing = await db.select().from(integrationConfig)
      .where(eq(integrationConfig.service, config.service))
      .limit(1);

    if (existing.length > 0) {
      const result = await db.update(integrationConfig)
        .set({ config: config.config, isActive: config.isActive, updatedAt: new Date() })
        .where(eq(integrationConfig.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(integrationConfig).values(config).returning();
      return result[0];
    }
  }

  // Pending Reply operations
  async getAllPendingReplies(): Promise<PendingReply[]> {
    return db.select().from(pendingReplies).orderBy(desc(pendingReplies.createdAt));
  }

  async getPendingReply(id: string): Promise<PendingReply | undefined> {
    const result = await db.select().from(pendingReplies).where(eq(pendingReplies.id, id)).limit(1);
    return result[0];
  }

  async createPendingReply(reply: InsertPendingReply): Promise<PendingReply> {
    const result = await db.insert(pendingReplies).values(reply).returning();
    return result[0];
  }

  async updatePendingReplyStatus(id: string, status: string): Promise<PendingReply | undefined> {
    const updates: any = { status };
    if (status === 'approved' || status === 'sent') {
      updates.approvedAt = new Date();
    }
    const result = await db.update(pendingReplies).set(updates).where(eq(pendingReplies.id, id)).returning();
    return result[0];
  }

  async deletePendingReply(id: string): Promise<boolean> {
    const result = await db.delete(pendingReplies).where(eq(pendingReplies.id, id)).returning();
    return result.length > 0;
  }

  // Analytics
  async getLeadStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const allLeads = await db.select().from(leads);
    
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    
    allLeads.forEach((lead: Lead) => {
      byStatus[lead.status] = (byStatus[lead.status] || 0) + 1;
      bySource[lead.source] = (bySource[lead.source] || 0) + 1;
    });

    return {
      total: allLeads.length,
      byStatus,
      bySource,
    };
  }
}

export const storage = new DatabaseStorage();

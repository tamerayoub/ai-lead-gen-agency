import { db } from "./db";
import { 
  users, properties, leads, conversations, notes, aiSettings, integrationConfig, pendingReplies,
  calendarConnections, calendarEvents, schedulePreferences, memberships, organizations,
  type User, type InsertUser, type UpsertUser,
  type Property, type InsertProperty,
  type Lead, type InsertLead,
  type Conversation, type InsertConversation,
  type Note, type InsertNote,
  type AISetting, type InsertAISetting,
  type IntegrationConfig, type InsertIntegrationConfig,
  type PendingReply, type InsertPendingReply,
  type CalendarConnection, type InsertCalendarConnection,
  type CalendarEvent, type InsertCalendarEvent,
  type SchedulePreference, type InsertSchedulePreference
} from "@shared/schema";
import { eq, desc, and, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  // (blueprint:javascript_log_in_with_replit) Mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;

  // Organization & Membership operations
  getUserOrganization(userId: string): Promise<{ orgId: string; role: string } | undefined>;
  getUserOrganizations(userId: string): Promise<Array<{ orgId: string; orgName: string; role: string }>>;
  getMembership(userId: string, orgId: string): Promise<{ orgId: string; role: string } | undefined>;
  createOrganization(name: string, ownerId: string): Promise<{ id: string; name: string }>;

  // Property operations
  getAllProperties(orgId: string): Promise<Property[]>;
  getProperty(id: string, orgId: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty & { orgId: string }): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>, orgId: string): Promise<Property | undefined>;
  deleteProperty(id: string, orgId: string): Promise<boolean>;

  // Lead operations
  getAllLeads(orgId: string): Promise<Lead[]>;
  getLeadsByStatus(status: string, orgId: string): Promise<Lead[]>;
  getLead(id: string, orgId: string): Promise<Lead | undefined>;
  getLeadByEmail(email: string, orgId: string): Promise<Lead | undefined>;
  getLeadByPhone(phone: string, orgId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead & { orgId: string }): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>, orgId: string): Promise<Lead | undefined>;
  deleteLead(id: string, orgId: string): Promise<boolean>;

  // Conversation operations
  getConversationsByLeadId(leadId: string): Promise<Conversation[]>;
  getConversationByExternalId(externalId: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;

  // Note operations
  getNotesByLeadId(leadId: string): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;

  // AI Settings operations
  getAISettings(category: string, orgId: string): Promise<AISetting[]>;
  upsertAISetting(setting: InsertAISetting & { orgId: string }): Promise<AISetting>;

  // Integration Config operations
  getIntegrationConfig(service: string, orgId: string): Promise<IntegrationConfig | undefined>;
  upsertIntegrationConfig(config: InsertIntegrationConfig & { orgId: string }): Promise<IntegrationConfig>;

  // Pending Reply operations
  getAllPendingReplies(orgId: string): Promise<PendingReply[]>;
  getPendingReply(id: string, orgId: string): Promise<PendingReply | undefined>;
  createPendingReply(reply: InsertPendingReply): Promise<PendingReply>;
  updatePendingReplyStatus(id: string, status: string, orgId: string): Promise<PendingReply | undefined>;
  deletePendingReply(id: string, orgId: string): Promise<boolean>;

  // Calendar Connection operations
  getCalendarConnections(userId?: string): Promise<CalendarConnection[]>;
  getCalendarConnection(id: string): Promise<CalendarConnection | undefined>;
  getCalendarConnectionByProvider(userId: string, provider: string): Promise<CalendarConnection | undefined>;
  createCalendarConnection(connection: InsertCalendarConnection): Promise<CalendarConnection>;
  updateCalendarConnection(id: string, connection: Partial<InsertCalendarConnection>): Promise<CalendarConnection | undefined>;
  deleteCalendarConnection(id: string): Promise<boolean>;

  // Calendar Event operations
  getCalendarEvents(connectionId: string, startTime?: Date, endTime?: Date): Promise<CalendarEvent[]>;
  getAllCalendarEvents(startTime?: Date, endTime?: Date): Promise<CalendarEvent[]>;
  getCalendarEventByExternalId(connectionId: string, externalId: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  upsertCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;
  deleteEventsByConnection(connectionId: string): Promise<boolean>;

  // Schedule Preference operations
  getSchedulePreferences(userId?: string): Promise<SchedulePreference[]>;
  createSchedulePreference(preference: InsertSchedulePreference): Promise<SchedulePreference>;
  updateSchedulePreference(id: string, preference: Partial<InsertSchedulePreference>): Promise<SchedulePreference | undefined>;
  deleteSchedulePreference(id: string): Promise<boolean>;

  // Analytics
  getLeadStats(orgId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  // (blueprint:javascript_log_in_with_replit) Mandatory for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
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

  // Organization & Membership operations
  async getUserOrganization(userId: string): Promise<{ orgId: string; role: string } | undefined> {
    const result = await db.select({
      orgId: memberships.orgId,
      role: memberships.role,
    }).from(memberships).where(eq(memberships.userId, userId)).limit(1);
    return result[0];
  }

  async getUserOrganizations(userId: string): Promise<Array<{ orgId: string; orgName: string; role: string }>> {
    const result = await db.select({
      orgId: memberships.orgId,
      orgName: organizations.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId));
    return result;
  }

  async getMembership(userId: string, orgId: string): Promise<{ orgId: string; role: string } | undefined> {
    const result = await db.select({
      orgId: memberships.orgId,
      role: memberships.role,
    }).from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, orgId)))
    .limit(1);
    return result[0];
  }

  async createOrganization(name: string, ownerId: string): Promise<{ id: string; name: string }> {
    // Create organization
    const orgResult = await db.insert(organizations).values({ name }).returning();
    const org = orgResult[0];

    // Create owner membership
    await db.insert(memberships).values({
      userId: ownerId,
      orgId: org.id,
      role: "owner",
    });

    return { id: org.id, name: org.name };
  }

  // Property operations
  async getAllProperties(orgId: string): Promise<Property[]> {
    return db.select().from(properties).where(eq(properties.orgId, orgId)).orderBy(desc(properties.createdAt));
  }

  async getProperty(id: string, orgId: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(and(eq(properties.id, id), eq(properties.orgId, orgId))).limit(1);
    return result[0];
  }

  async createProperty(property: InsertProperty & { orgId: string }): Promise<Property> {
    const result = await db.insert(properties).values(property).returning();
    return result[0];
  }

  async updateProperty(id: string, propertyData: Partial<InsertProperty>, orgId: string): Promise<Property | undefined> {
    const result = await db.update(properties).set(propertyData).where(and(eq(properties.id, id), eq(properties.orgId, orgId))).returning();
    return result[0];
  }

  async deleteProperty(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(properties).where(and(eq(properties.id, id), eq(properties.orgId, orgId))).returning();
    return result.length > 0;
  }

  // Lead operations
  async getAllLeads(orgId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.orgId, orgId)).orderBy(desc(leads.lastContactAt));
  }

  async getLeadsByStatus(status: string, orgId: string): Promise<Lead[]> {
    return db.select().from(leads).where(and(eq(leads.status, status), eq(leads.orgId, orgId))).orderBy(desc(leads.lastContactAt));
  }

  async getLead(id: string, orgId: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.id, id), eq(leads.orgId, orgId))).limit(1);
    return result[0];
  }

  async getLeadByEmail(email: string, orgId: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.email, email), eq(leads.orgId, orgId))).limit(1);
    return result[0];
  }

  async getLeadByPhone(phone: string, orgId: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.phone, phone), eq(leads.orgId, orgId))).limit(1);
    return result[0];
  }

  async createLead(lead: InsertLead & { orgId: string }): Promise<Lead> {
    const result = await db.insert(leads).values(lead).returning();
    return result[0];
  }

  async updateLead(id: string, leadData: Partial<InsertLead>, orgId: string): Promise<Lead | undefined> {
    const result = await db.update(leads).set(leadData).where(and(eq(leads.id, id), eq(leads.orgId, orgId))).returning();
    return result[0];
  }

  async deleteLead(id: string, orgId: string): Promise<boolean> {
    // Delete related conversations and notes first
    await db.delete(conversations).where(eq(conversations.leadId, id));
    await db.delete(notes).where(eq(notes.leadId, id));
    
    const result = await db.delete(leads).where(and(eq(leads.id, id), eq(leads.orgId, orgId))).returning();
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
  async getAISettings(category: string, orgId: string): Promise<AISetting[]> {
    return db.select().from(aiSettings).where(and(eq(aiSettings.category, category), eq(aiSettings.orgId, orgId)));
  }

  async upsertAISetting(setting: InsertAISetting & { orgId: string }): Promise<AISetting> {
    const existing = await db.select().from(aiSettings)
      .where(and(
        eq(aiSettings.category, setting.category),
        eq(aiSettings.key, setting.key),
        eq(aiSettings.orgId, setting.orgId)
      ))
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
  async getIntegrationConfig(service: string, orgId: string): Promise<IntegrationConfig | undefined> {
    const result = await db.select().from(integrationConfig).where(and(eq(integrationConfig.service, service), eq(integrationConfig.orgId, orgId))).limit(1);
    return result[0];
  }

  async upsertIntegrationConfig(config: InsertIntegrationConfig & { orgId: string }): Promise<IntegrationConfig> {
    const existing = await db.select().from(integrationConfig)
      .where(and(eq(integrationConfig.service, config.service), eq(integrationConfig.orgId, config.orgId)))
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

  // Pending Reply operations (tenant-scoped through lead relationship)
  async getAllPendingReplies(orgId: string): Promise<PendingReply[]> {
    return db.select({ 
      id: pendingReplies.id,
      leadId: pendingReplies.leadId,
      leadName: pendingReplies.leadName,
      leadEmail: pendingReplies.leadEmail,
      subject: pendingReplies.subject,
      content: pendingReplies.content,
      originalMessage: pendingReplies.originalMessage,
      channel: pendingReplies.channel,
      status: pendingReplies.status,
      threadId: pendingReplies.threadId,
      inReplyTo: pendingReplies.inReplyTo,
      references: pendingReplies.references,
      createdAt: pendingReplies.createdAt,
      approvedAt: pendingReplies.approvedAt,
    })
      .from(pendingReplies)
      .innerJoin(leads, eq(pendingReplies.leadId, leads.id))
      .where(eq(leads.orgId, orgId))
      .orderBy(desc(pendingReplies.createdAt));
  }

  async getPendingReply(id: string, orgId: string): Promise<PendingReply | undefined> {
    const result = await db.select({
      id: pendingReplies.id,
      leadId: pendingReplies.leadId,
      leadName: pendingReplies.leadName,
      leadEmail: pendingReplies.leadEmail,
      subject: pendingReplies.subject,
      content: pendingReplies.content,
      originalMessage: pendingReplies.originalMessage,
      channel: pendingReplies.channel,
      status: pendingReplies.status,
      threadId: pendingReplies.threadId,
      inReplyTo: pendingReplies.inReplyTo,
      references: pendingReplies.references,
      createdAt: pendingReplies.createdAt,
      approvedAt: pendingReplies.approvedAt,
    })
      .from(pendingReplies)
      .innerJoin(leads, eq(pendingReplies.leadId, leads.id))
      .where(and(eq(pendingReplies.id, id), eq(leads.orgId, orgId)))
      .limit(1);
    return result[0];
  }

  async createPendingReply(reply: InsertPendingReply): Promise<PendingReply> {
    const result = await db.insert(pendingReplies).values(reply).returning();
    return result[0];
  }

  async updatePendingReplyStatus(id: string, status: string, orgId: string): Promise<PendingReply | undefined> {
    const updates: any = { status };
    if (status === 'approved' || status === 'sent') {
      updates.approvedAt = new Date();
    }
    const result = await db.update(pendingReplies)
      .set(updates)
      .from(leads)
      .where(and(
        eq(pendingReplies.id, id),
        eq(pendingReplies.leadId, leads.id),
        eq(leads.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async deletePendingReply(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(pendingReplies)
      .where(and(
        eq(pendingReplies.id, id),
        sql`${pendingReplies.leadId} IN (SELECT id FROM ${leads} WHERE ${leads.orgId} = ${orgId})`
      ))
      .returning();
    return result.length > 0;
  }

  // Calendar Connection operations
  async getCalendarConnections(userId?: string): Promise<CalendarConnection[]> {
    if (userId) {
      return db.select().from(calendarConnections)
        .where(eq(calendarConnections.userId, userId))
        .orderBy(desc(calendarConnections.createdAt));
    }
    return db.select().from(calendarConnections).orderBy(desc(calendarConnections.createdAt));
  }

  async getCalendarConnection(id: string): Promise<CalendarConnection | undefined> {
    const result = await db.select().from(calendarConnections).where(eq(calendarConnections.id, id)).limit(1);
    return result[0];
  }

  async getCalendarConnectionByProvider(userId: string, provider: string): Promise<CalendarConnection | undefined> {
    const result = await db.select().from(calendarConnections)
      .where(and(eq(calendarConnections.userId, userId), eq(calendarConnections.provider, provider)))
      .limit(1);
    return result[0];
  }

  async createCalendarConnection(connection: InsertCalendarConnection): Promise<CalendarConnection> {
    const result = await db.insert(calendarConnections).values(connection).returning();
    return result[0];
  }

  async updateCalendarConnection(id: string, connectionData: Partial<InsertCalendarConnection>): Promise<CalendarConnection | undefined> {
    const result = await db.update(calendarConnections)
      .set({ ...connectionData, updatedAt: new Date() })
      .where(eq(calendarConnections.id, id))
      .returning();
    return result[0];
  }

  async deleteCalendarConnection(id: string): Promise<boolean> {
    const result = await db.delete(calendarConnections).where(eq(calendarConnections.id, id)).returning();
    return result.length > 0;
  }

  // Calendar Event operations
  async getCalendarEvents(connectionId: string, startTime?: Date, endTime?: Date): Promise<CalendarEvent[]> {
    const conditions = [eq(calendarEvents.connectionId, connectionId)];
    
    if (startTime && endTime) {
      if (startTime.getTime() === endTime.getTime()) {
        // Point-in-time query: find events that contain this specific moment
        conditions.push(sql`${calendarEvents.startTime} <= ${startTime}`);
        conditions.push(sql`${calendarEvents.endTime} >= ${startTime}`);
      } else {
        // Range query: find events that overlap the range
        // Event overlaps if: event.start < rangeEnd AND event.end > rangeStart
        conditions.push(sql`${calendarEvents.startTime} < ${endTime}`);
        conditions.push(sql`${calendarEvents.endTime} > ${startTime}`);
      }
    } else if (startTime) {
      // Start bound only: find events that end after startTime
      conditions.push(sql`${calendarEvents.endTime} > ${startTime}`);
    } else if (endTime) {
      // End bound only: find events that start before endTime
      conditions.push(sql`${calendarEvents.startTime} < ${endTime}`);
    }
    
    return db.select().from(calendarEvents)
      .where(and(...conditions))
      .orderBy(calendarEvents.startTime);
  }

  async getAllCalendarEvents(startTime?: Date, endTime?: Date): Promise<CalendarEvent[]> {
    const conditions: any[] = [];
    
    if (startTime && endTime) {
      if (startTime.getTime() === endTime.getTime()) {
        // Point-in-time query: find events that contain this specific moment
        conditions.push(sql`${calendarEvents.startTime} <= ${startTime}`);
        conditions.push(sql`${calendarEvents.endTime} >= ${startTime}`);
      } else {
        // Range query: find events that overlap the range
        // Event overlaps if: event.start < rangeEnd AND event.end > rangeStart
        conditions.push(sql`${calendarEvents.startTime} < ${endTime}`);
        conditions.push(sql`${calendarEvents.endTime} > ${startTime}`);
      }
    } else if (startTime) {
      // Start bound only: find events that end after startTime
      conditions.push(sql`${calendarEvents.endTime} > ${startTime}`);
    } else if (endTime) {
      // End bound only: find events that start before endTime
      conditions.push(sql`${calendarEvents.startTime} < ${endTime}`);
    }
    
    if (conditions.length > 0) {
      return db.select().from(calendarEvents)
        .where(and(...conditions))
        .orderBy(calendarEvents.startTime);
    }
    
    return db.select().from(calendarEvents).orderBy(calendarEvents.startTime);
  }

  async getCalendarEventByExternalId(connectionId: string, externalId: string): Promise<CalendarEvent | undefined> {
    const result = await db.select().from(calendarEvents)
      .where(and(
        eq(calendarEvents.connectionId, connectionId),
        eq(calendarEvents.externalId, externalId)
      ))
      .limit(1);
    return result[0];
  }

  async createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const result = await db.insert(calendarEvents).values(event).returning();
    return result[0];
  }

  async upsertCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent> {
    const existing = await this.getCalendarEventByExternalId(event.connectionId, event.externalId);
    
    if (existing) {
      const result = await db.update(calendarEvents)
        .set({ ...event, updatedAt: new Date() })
        .where(eq(calendarEvents.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(calendarEvents).values(event).returning();
      return result[0];
    }
  }

  async updateCalendarEvent(id: string, eventData: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const result = await db.update(calendarEvents)
      .set({ ...eventData, updatedAt: new Date() })
      .where(eq(calendarEvents.id, id))
      .returning();
    return result[0];
  }

  async deleteCalendarEvent(id: string): Promise<boolean> {
    const result = await db.delete(calendarEvents).where(eq(calendarEvents.id, id)).returning();
    return result.length > 0;
  }

  async deleteEventsByConnection(connectionId: string): Promise<boolean> {
    const result = await db.delete(calendarEvents).where(eq(calendarEvents.connectionId, connectionId)).returning();
    return result.length > 0;
  }

  // Schedule Preference operations
  async getSchedulePreferences(userId?: string): Promise<SchedulePreference[]> {
    if (userId) {
      return db.select().from(schedulePreferences)
        .where(and(eq(schedulePreferences.userId, userId), eq(schedulePreferences.isActive, true)))
        .orderBy(schedulePreferences.createdAt);
    }
    return db.select().from(schedulePreferences)
      .where(eq(schedulePreferences.isActive, true))
      .orderBy(schedulePreferences.createdAt);
  }

  async createSchedulePreference(preference: InsertSchedulePreference): Promise<SchedulePreference> {
    const result = await db.insert(schedulePreferences).values(preference).returning();
    return result[0];
  }

  async updateSchedulePreference(id: string, preferenceData: Partial<InsertSchedulePreference>): Promise<SchedulePreference | undefined> {
    const result = await db.update(schedulePreferences)
      .set(preferenceData)
      .where(eq(schedulePreferences.id, id))
      .returning();
    return result[0];
  }

  async deleteSchedulePreference(id: string): Promise<boolean> {
    const result = await db.delete(schedulePreferences).where(eq(schedulePreferences.id, id)).returning();
    return result.length > 0;
  }

  // Analytics
  async getLeadStats(orgId: string): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const allLeads = await db.select().from(leads).where(eq(leads.orgId, orgId));
    
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

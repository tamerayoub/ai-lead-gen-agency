import { db } from "./db";
import { 
  users, properties, leads, conversations, notes, aiSettings, integrationConfig, pendingReplies,
  calendarConnections, calendarEvents, schedulePreferences, memberships, organizations, notifications,
  zillowIntegrations, zillowListings,
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
  type SchedulePreference, type InsertSchedulePreference,
  type Notification, type InsertNotification,
  type ZillowIntegration, type InsertZillowIntegration,
  type ZillowListing, type InsertZillowListing
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
  getLeadByExternalId(externalId: string, orgId: string): Promise<Lead | undefined>;
  getLeadByGmailThreadId(threadId: string, orgId: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead & { orgId: string }): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>, orgId: string): Promise<Lead | undefined>;
  deleteLead(id: string, orgId: string): Promise<boolean>;
  deleteGmailSourcedLeads(orgId: string): Promise<number>;

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

  // Notification operations
  getUserNotifications(userId: string, orgId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string, orgId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<boolean>;
  deleteNotification(id: string, userId: string): Promise<boolean>;

  // Integration Config operations
  getIntegrationConfig(service: string, orgId: string): Promise<IntegrationConfig | undefined>;
  upsertIntegrationConfig(config: InsertIntegrationConfig & { orgId: string }): Promise<IntegrationConfig>;
  getAllGmailIntegrations(): Promise<Array<{ orgId: string; config: any }>>;
  getAllOutlookIntegrations(): Promise<Array<{ orgId: string; config: any; isActive: boolean }>>;
  getAllMessengerIntegrations(): Promise<Array<{ orgId: string; config: any; isActive: boolean }>>;
  getOrganizationMembers(orgId: string): Promise<Array<{ userId: string }>>;

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

  // Zillow Integration operations
  getZillowIntegration(orgId: string): Promise<ZillowIntegration | undefined>;
  createZillowIntegration(integration: InsertZillowIntegration & { orgId: string }): Promise<ZillowIntegration>;
  updateZillowIntegration(orgId: string, integration: Partial<InsertZillowIntegration>): Promise<ZillowIntegration | undefined>;
  deleteZillowIntegration(orgId: string): Promise<boolean>;

  // Zillow Listing operations
  getZillowListings(orgId: string): Promise<ZillowListing[]>;
  getZillowListing(id: string, orgId: string): Promise<ZillowListing | undefined>;
  getZillowListingByPropertyId(propertyId: string, orgId: string): Promise<ZillowListing | undefined>;
  getZillowListingByZillowId(zillowListingId: string, orgId: string): Promise<ZillowListing | undefined>;
  createZillowListing(listing: InsertZillowListing & { orgId: string }): Promise<ZillowListing>;
  updateZillowListing(id: string, listing: Partial<InsertZillowListing>, orgId: string): Promise<ZillowListing | undefined>;
  deleteZillowListing(id: string, orgId: string): Promise<boolean>;
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

  async getLeadByExternalId(externalId: string, orgId: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.externalId, externalId), eq(leads.orgId, orgId))).limit(1);
    return result[0];
  }

  async getLeadByGmailThreadId(threadId: string, orgId: string): Promise<Lead | undefined> {
    const result = await db.select().from(leads).where(and(eq(leads.gmailThreadId, threadId), eq(leads.orgId, orgId))).limit(1);
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
    // Delete related data first (conversations, notes, pending replies)
    await db.delete(conversations).where(eq(conversations.leadId, id));
    await db.delete(notes).where(eq(notes.leadId, id));
    await db.delete(pendingReplies).where(eq(pendingReplies.leadId, id));
    
    const result = await db.delete(leads).where(and(eq(leads.id, id), eq(leads.orgId, orgId))).returning();
    return result.length > 0;
  }

  async deleteGmailSourcedLeads(orgId: string): Promise<number> {
    // Get all Gmail-sourced leads for this organization
    const gmailLeads = await db.select().from(leads).where(
      and(
        eq(leads.orgId, orgId),
        eq(leads.source, 'gmail')
      )
    );
    
    const leadIds = gmailLeads.map(lead => lead.id);
    
    if (leadIds.length === 0) {
      return 0;
    }
    
    // Delete related conversations, notes, and pending replies
    for (const leadId of leadIds) {
      await db.delete(conversations).where(eq(conversations.leadId, leadId));
      await db.delete(notes).where(eq(notes.leadId, leadId));
      await db.delete(pendingReplies).where(eq(pendingReplies.leadId, leadId));
    }
    
    // Delete the leads
    const result = await db.delete(leads).where(
      and(
        eq(leads.orgId, orgId),
        eq(leads.source, 'gmail')
      )
    ).returning();
    
    return result.length;
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

  // Notification operations
  async getUserNotifications(userId: string, orgId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.orgId, orgId)))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string, orgId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.orgId, orgId),
        eq(notifications.read, false)
      ));
    return result[0]?.count || 0;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string, userId: string): Promise<boolean> {
    const result = await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result.length > 0;
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

  async getAllGmailIntegrations(): Promise<Array<{ orgId: string; config: any }>> {
    const configs = await db.select()
      .from(integrationConfig)
      .where(and(eq(integrationConfig.service, "gmail"), eq(integrationConfig.isActive, true)));
    return configs.map(c => ({ orgId: c.orgId, config: c.config }));
  }

  async getAllOutlookIntegrations(): Promise<Array<{ orgId: string; config: any; isActive: boolean }>> {
    const configs = await db.select()
      .from(integrationConfig)
      .where(and(eq(integrationConfig.service, "outlook"), eq(integrationConfig.isActive, true)));
    return configs.map(c => ({ orgId: c.orgId, config: c.config, isActive: c.isActive }));
  }

  async getAllMessengerIntegrations(): Promise<Array<{ orgId: string; config: any; isActive: boolean }>> {
    const configs = await db.select()
      .from(integrationConfig)
      .where(and(eq(integrationConfig.service, "messenger"), eq(integrationConfig.isActive, true)));
    return configs.map(c => ({ orgId: c.orgId, config: c.config, isActive: c.isActive }));
  }

  async getOrganizationMembers(orgId: string): Promise<Array<{ userId: string }>> {
    const members = await db.select({ userId: memberships.userId })
      .from(memberships)
      .where(eq(memberships.orgId, orgId));
    return members;
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

  // Zillow Integration operations
  async getZillowIntegration(orgId: string): Promise<ZillowIntegration | undefined> {
    const result = await db.select().from(zillowIntegrations)
      .where(eq(zillowIntegrations.orgId, orgId))
      .limit(1);
    return result[0];
  }

  async createZillowIntegration(integration: InsertZillowIntegration & { orgId: string }): Promise<ZillowIntegration> {
    const result = await db.insert(zillowIntegrations).values(integration).returning();
    return result[0];
  }

  async updateZillowIntegration(orgId: string, integrationData: Partial<InsertZillowIntegration>): Promise<ZillowIntegration | undefined> {
    const result = await db.update(zillowIntegrations)
      .set({ ...integrationData, updatedAt: new Date() })
      .where(eq(zillowIntegrations.orgId, orgId))
      .returning();
    return result[0];
  }

  async deleteZillowIntegration(orgId: string): Promise<boolean> {
    const result = await db.delete(zillowIntegrations).where(eq(zillowIntegrations.orgId, orgId)).returning();
    return result.length > 0;
  }

  // Zillow Listing operations
  async getZillowListings(orgId: string): Promise<ZillowListing[]> {
    return db.select().from(zillowListings)
      .where(eq(zillowListings.orgId, orgId))
      .orderBy(desc(zillowListings.createdAt));
  }

  async getZillowListing(id: string, orgId: string): Promise<ZillowListing | undefined> {
    const result = await db.select().from(zillowListings)
      .where(and(eq(zillowListings.id, id), eq(zillowListings.orgId, orgId)))
      .limit(1);
    return result[0];
  }

  async getZillowListingByPropertyId(propertyId: string, orgId: string): Promise<ZillowListing | undefined> {
    const result = await db.select().from(zillowListings)
      .where(and(
        eq(zillowListings.propertyId, propertyId),
        eq(zillowListings.orgId, orgId)
      ))
      .limit(1);
    return result[0];
  }

  async getZillowListingByZillowId(zillowListingId: string, orgId: string): Promise<ZillowListing | undefined> {
    const result = await db.select().from(zillowListings)
      .where(and(
        eq(zillowListings.zillowListingId, zillowListingId),
        eq(zillowListings.orgId, orgId)
      ))
      .limit(1);
    return result[0];
  }

  async createZillowListing(listing: InsertZillowListing & { orgId: string }): Promise<ZillowListing> {
    const result = await db.insert(zillowListings).values(listing).returning();
    return result[0];
  }

  async updateZillowListing(id: string, listingData: Partial<InsertZillowListing>, orgId: string): Promise<ZillowListing | undefined> {
    const result = await db.update(zillowListings)
      .set({ ...listingData, updatedAt: new Date() })
      .where(and(eq(zillowListings.id, id), eq(zillowListings.orgId, orgId)))
      .returning();
    return result[0];
  }

  async deleteZillowListing(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(zillowListings)
      .where(and(eq(zillowListings.id, id), eq(zillowListings.orgId, orgId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();

import { db } from "./db";
import { 
  users, properties, leads, conversations, notes, aiSettings, integrationConfig, pendingReplies,
  calendarConnections, calendarEvents, schedulePreferences, memberships, organizations, notifications,
  zillowIntegrations, zillowListings, deletedLeads, demoRequests, appointments, onboardingIntakes,
  salesProspects, prospectSources,
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
  type ZillowListing, type InsertZillowListing,
  type DeletedLead, type InsertDeletedLead,
  type DemoRequest, type InsertDemoRequest,
  type Appointment, type InsertAppointment,
  type OnboardingIntake, type InsertOnboardingIntake,
  type SalesProspect, type InsertSalesProspect,
  type ProspectSource, type InsertProspectSource
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
  getOrganization(orgId: string): Promise<Organization | undefined>;
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
  getLeadsWithUnreadMessages(orgId: string): Promise<Array<Lead & { unreadCount: number }>>;
  createLead(lead: InsertLead & { orgId: string }): Promise<Lead>;
  updateLead(id: string, lead: Partial<InsertLead>, orgId: string): Promise<Lead | undefined>;
  deleteLead(id: string, orgId: string): Promise<boolean>;
  deleteGmailSourcedLeads(orgId: string): Promise<number>;
  deleteLeadsByIds(leadIds: string[]): Promise<number>;

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
  markAllLeadNotificationsAsRead(leadId: string, orgId: string): Promise<number>;
  deleteNotification(id: string, userId: string): Promise<boolean>;

  // Deleted Lead operations (track manually deleted leads to prevent auto-reimport)
  getDeletedLeadByEmail(email: string, orgId: string): Promise<DeletedLead | undefined>;
  getDeletedLeadByGmailThread(threadId: string, orgId: string): Promise<DeletedLead | undefined>;
  createDeletedLead(deletedLead: InsertDeletedLead): Promise<DeletedLead>;

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

  // Demo Request operations
  getAllDemoRequests(): Promise<DemoRequest[]>;
  createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest>;

  // Appointment operations
  getAllAppointments(): Promise<Appointment[]>;
  getAppointmentsByDate(date: string): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: string, status: string): Promise<Appointment | undefined>;

  // Onboarding Intake operations
  getOnboardingIntake(sessionToken: string): Promise<OnboardingIntake | undefined>;
  getAllOnboardingIntakes(): Promise<OnboardingIntake[]>;
  getCompletedOnboardingIntakes(): Promise<OnboardingIntake[]>;
  createOnboardingIntake(intake: InsertOnboardingIntake): Promise<OnboardingIntake>;
  updateOnboardingIntake(sessionToken: string, intake: Partial<InsertOnboardingIntake>): Promise<OnboardingIntake | undefined>;
  linkOnboardingIntakeToUser(sessionToken: string, userId: string): Promise<OnboardingIntake | undefined>;

  // Sales Prospect operations
  getAllSalesProspects(): Promise<Array<SalesProspect & { sources: ProspectSource[] }>>;
  getSalesProspect(id: string): Promise<SalesProspect | undefined>;
  getSalesProspectByEmail(email: string): Promise<SalesProspect | undefined>;
  createSalesProspect(prospect: InsertSalesProspect): Promise<SalesProspect>;
  updateSalesProspect(id: string, prospect: Partial<InsertSalesProspect>): Promise<SalesProspect | undefined>;
  updateProspectStage(id: string, stage: string): Promise<SalesProspect | undefined>;
  upsertProspectFromDemo(demoRequest: DemoRequest): Promise<SalesProspect>;
  upsertProspectFromOnboarding(intake: OnboardingIntake): Promise<SalesProspect | null>;
  createProspectSource(source: InsertProspectSource): Promise<ProspectSource>;
  getProspectSources(prospectId: string): Promise<ProspectSource[]>;
  resyncAllProspects(): Promise<number>;
  
  // Admin analytics
  getAdminAnalytics(): Promise<{
    totalSignups: number;
    totalDemoRequests: number;
    totalOnboardingSubmissions: number;
    totalOrganizations: number;
    totalProspects: number;
    conversionRate: string;
    prospectsByStage: { stage: string; count: number }[];
    signupTrend: { month: string; signups: number }[];
    demoRequestTrend: { month: string; requests: number }[];
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
  async getOrganization(orgId: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    return result[0];
  }

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

  async getLeadsWithUnreadMessages(orgId: string): Promise<Array<Lead & { unreadCount: number; lastMessage: string; lastMessageAt: string }>> {
    // Use a single efficient query to get leads with their latest conversation
    const result = await db.execute(sql`
      WITH latest_received_messages AS (
        SELECT DISTINCT ON (c.lead_id)
          c.lead_id,
          c.type,
          c.message,
          c.created_at
        FROM conversations c
        INNER JOIN leads l ON c.lead_id = l.id
        WHERE l.org_id = ${orgId}
          AND c.type = 'received'
        ORDER BY c.lead_id, c.created_at DESC
      ),
      unread_counts AS (
        SELECT 
          c.lead_id,
          COUNT(*) as unread_count
        FROM conversations c
        INNER JOIN leads l ON c.lead_id = l.id
        WHERE l.org_id = ${orgId}
          AND c.type = 'received'
          AND c.created_at > COALESCE((
            SELECT MAX(c2.created_at)
            FROM conversations c2
            WHERE c2.lead_id = c.lead_id
              AND c2.type = 'outgoing'
          ), '1970-01-01'::timestamp)
        GROUP BY c.lead_id
      )
      SELECT 
        l.*,
        COALESCE(uc.unread_count, 0)::int as unread_count,
        lrm.message as last_message,
        to_char(lrm.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_message_at
      FROM leads l
      INNER JOIN latest_received_messages lrm ON l.id = lrm.lead_id
      LEFT JOIN unread_counts uc ON l.id = uc.lead_id
      WHERE l.org_id = ${orgId}
        AND COALESCE(uc.unread_count, 0) > 0
      ORDER BY lrm.created_at DESC
    `);
    
    // Manually map snake_case database columns to camelCase for API
    return result.rows.map((row: any) => ({
      ...row,
      unreadCount: row.unread_count,
      lastMessage: row.last_message,
      lastMessageAt: row.last_message_at,
      // Remove snake_case versions
      unread_count: undefined,
      last_message: undefined,
      last_message_at: undefined,
    })) as Array<Lead & { unreadCount: number; lastMessage: string; lastMessageAt: string }>;
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

  async deleteLeadsByIds(leadIds: string[]): Promise<number> {
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
      sql`id = ANY(ARRAY[${sql.join(leadIds.map(id => sql`${id}`), sql`, `)}])`
    ).returning();
    
    return result.length;
  }

  // Conversation operations
  async getConversationsByLeadId(leadId: string): Promise<Conversation[]> {
    // Use raw SQL to properly format timestamps with UTC timezone
    const result = await db.execute(sql`
      SELECT 
        id,
        lead_id,
        type,
        channel,
        message,
        ai_generated,
        external_id,
        gmail_message_id,
        email_message_id,
        email_subject,
        source_integration,
        delivery_status,
        delivery_error,
        to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
      FROM conversations
      WHERE lead_id = ${leadId}
      ORDER BY created_at ASC
    `);
    
    // Map snake_case to camelCase
    return result.rows.map((row: any) => ({
      id: row.id,
      leadId: row.lead_id,
      type: row.type,
      channel: row.channel,
      message: row.message,
      aiGenerated: row.ai_generated,
      externalId: row.external_id,
      gmailMessageId: row.gmail_message_id,
      emailMessageId: row.email_message_id,
      emailSubject: row.email_subject,
      sourceIntegration: row.source_integration,
      deliveryStatus: row.delivery_status,
      deliveryError: row.delivery_error,
      createdAt: row.created_at,
    })) as Conversation[];
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

  async markAllLeadNotificationsAsRead(leadId: string, orgId: string): Promise<number> {
    const result = await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.leadId, leadId), eq(notifications.orgId, orgId)))
      .returning();
    return result.length;
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Deleted Lead operations (track manually deleted leads to prevent auto-reimport)
  async getDeletedLeadByEmail(email: string, orgId: string): Promise<DeletedLead | undefined> {
    const result = await db.select().from(deletedLeads)
      .where(and(eq(deletedLeads.email, email), eq(deletedLeads.orgId, orgId)))
      .orderBy(desc(deletedLeads.deletedAt))
      .limit(1);
    return result[0];
  }

  async getDeletedLeadByGmailThread(threadId: string, orgId: string): Promise<DeletedLead | undefined> {
    const result = await db.select().from(deletedLeads)
      .where(and(eq(deletedLeads.gmailThreadId, threadId), eq(deletedLeads.orgId, orgId)))
      .orderBy(desc(deletedLeads.deletedAt))
      .limit(1);
    return result[0];
  }

  async createDeletedLead(deletedLead: InsertDeletedLead): Promise<DeletedLead> {
    const result = await db.insert(deletedLeads).values(deletedLead).returning();
    return result[0];
  }

  // Integration Config operations
  async getIntegrationConfig(service: string, orgId: string): Promise<IntegrationConfig | undefined> {
    const result = await db.select().from(integrationConfig).where(and(eq(integrationConfig.service, service), eq(integrationConfig.orgId, orgId))).limit(1);
    return result[0];
  }

  async getIntegrationByOrgAndService(orgId: string, service: string): Promise<IntegrationConfig | undefined> {
    return this.getIntegrationConfig(service, orgId);
  }

  async updateIntegrationLastSync(orgId: string, service: string, lastSyncTimestamp: Date): Promise<void> {
    const existing = await this.getIntegrationConfig(service, orgId);
    if (existing) {
      const updatedConfig = {
        ...existing.config,
        lastSyncTimestamp: lastSyncTimestamp.toISOString()
      };
      await db.update(integrationConfig)
        .set({ config: updatedConfig, updatedAt: new Date() })
        .where(eq(integrationConfig.id, existing.id));
    }
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

  // Demo Request operations
  async getAllDemoRequests(): Promise<DemoRequest[]> {
    return await db.select().from(demoRequests).orderBy(desc(demoRequests.createdAt));
  }

  async createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest> {
    const result = await db.insert(demoRequests).values(request).returning();
    return result[0];
  }

  // Appointment operations
  async getAllAppointments(): Promise<Appointment[]> {
    return await db.select().from(appointments).orderBy(desc(appointments.createdAt));
  }

  async getAppointmentsByDate(date: string): Promise<Appointment[]> {
    return await db.select().from(appointments)
      .where(eq(appointments.appointmentDate, date))
      .orderBy(appointments.appointmentTime);
  }

  async getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]> {
    return await db.select().from(appointments)
      .where(and(
        gte(appointments.appointmentDate, startDate),
        lte(appointments.appointmentDate, endDate)
      ))
      .orderBy(appointments.appointmentDate, appointments.appointmentTime);
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const result = await db.insert(appointments).values(appointment).returning();
    return result[0];
  }

  async updateAppointmentStatus(id: string, status: string): Promise<Appointment | undefined> {
    const result = await db.update(appointments)
      .set({ status })
      .where(eq(appointments.id, id))
      .returning();
    return result[0];
  }

  // Onboarding Intake operations
  async getOnboardingIntake(sessionToken: string): Promise<OnboardingIntake | undefined> {
    const result = await db.select().from(onboardingIntakes)
      .where(eq(onboardingIntakes.sessionToken, sessionToken))
      .limit(1);
    return result[0];
  }

  async getAllOnboardingIntakes(): Promise<OnboardingIntake[]> {
    // Join with users table to get email for linked intakes
    const result = await db.execute(sql`
      SELECT 
        oi.*,
        u.email as user_email
      FROM onboarding_intakes oi
      LEFT JOIN users u ON oi.linked_user_id = u.id
      ORDER BY oi.created_at DESC
    `);
    
    // Map snake_case to camelCase
    return result.rows.map((row: any) => ({
      id: row.id,
      sessionToken: row.session_token,
      status: row.status,
      unitsOwned: row.units_owned,
      currentLeaseHandling: row.current_lease_handling,
      leaseHandlingToolName: row.lease_handling_tool_name,
      portfolioLocation: row.portfolio_location,
      teamSize: row.team_size,
      phoneNumber: row.phone_number,
      fullName: row.full_name,
      wantsDemo: row.wants_demo,
      linkedUserId: row.linked_user_id,
      createdAt: row.created_at,
      completedAt: row.completed_at,
      linkedAt: row.linked_at,
      userEmail: row.user_email,
    })) as OnboardingIntake[];
  }

  async getCompletedOnboardingIntakes(): Promise<OnboardingIntake[]> {
    return await db.select().from(onboardingIntakes)
      .where(eq(onboardingIntakes.status, 'completed'))
      .orderBy(desc(onboardingIntakes.completedAt));
  }

  async createOnboardingIntake(intake: InsertOnboardingIntake): Promise<OnboardingIntake> {
    const result = await db.insert(onboardingIntakes).values(intake).returning();
    return result[0];
  }

  async updateOnboardingIntake(sessionToken: string, intakeData: Partial<InsertOnboardingIntake>): Promise<OnboardingIntake | undefined> {
    const result = await db.update(onboardingIntakes)
      .set(intakeData)
      .where(eq(onboardingIntakes.sessionToken, sessionToken))
      .returning();
    return result[0];
  }

  async linkOnboardingIntakeToUser(sessionToken: string, userId: string): Promise<OnboardingIntake | undefined> {
    // Get the onboarding intake data first
    const intake = await this.getOnboardingIntake(sessionToken);
    if (!intake) {
      return undefined;
    }

    // Link the intake to the user
    const result = await db.update(onboardingIntakes)
      .set({
        linkedUserId: userId,
        status: 'linked',
        linkedAt: new Date(),
      })
      .where(eq(onboardingIntakes.sessionToken, sessionToken))
      .returning();
    
    // If user wants a demo, create a demo request automatically
    if (intake.wantsDemo && intake.fullName && intake.unitsOwned && intake.portfolioLocation) {
      try {
        const user = await this.getUser(userId);
        if (user?.email) {
          // Split full name into first and last name
          const nameParts = intake.fullName.trim().split(' ');
          const firstName = nameParts[0] || 'Unknown';
          const lastName = nameParts.slice(1).join(' ') || 'Unknown';

          await this.createDemoRequest({
            firstName,
            lastName,
            email: user.email,
            phone: intake.phoneNumber || "Not provided", // Use placeholder if phone not collected
            countryCode: "+1", // Default to US, could be enhanced
            unitsUnderManagement: intake.unitsOwned,
            managedOrOwned: "owned", // Based on onboarding question "How many units do you own?"
            hqLocation: intake.portfolioLocation,
            agreeTerms: true,
            agreeMarketing: false,
            isCurrentCustomer: false,
          });
          console.log(`[Onboarding] Auto-created demo request for user ${user.email} from onboarding`);
        }
      } catch (error) {
        console.error("[Onboarding] Failed to create demo request:", error);
        // Don't fail the linking if demo request creation fails
      }
    }

    return result[0];
  }

  // Sales Prospect operations
  async getAllSalesProspects(): Promise<Array<SalesProspect & { sources: ProspectSource[] }>> {
    const prospects = await db.select().from(salesProspects).orderBy(desc(salesProspects.lastInteractionAt));
    
    // For each prospect, fetch their sources
    const prospectsWithSources = await Promise.all(
      prospects.map(async (prospect) => {
        const sources = await this.getProspectSources(prospect.id);
        return { ...prospect, sources };
      })
    );
    
    return prospectsWithSources;
  }

  async getSalesProspect(id: string): Promise<SalesProspect | undefined> {
    const result = await db.select().from(salesProspects).where(eq(salesProspects.id, id)).limit(1);
    return result[0];
  }

  async getSalesProspectByEmail(email: string): Promise<SalesProspect | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await db.select().from(salesProspects)
      .where(eq(salesProspects.email, normalizedEmail))
      .limit(1);
    return result[0];
  }

  async createSalesProspect(prospect: InsertSalesProspect): Promise<SalesProspect> {
    const result = await db.insert(salesProspects).values({
      ...prospect,
      email: prospect.email.trim().toLowerCase(), // Normalize email
    }).returning();
    return result[0];
  }

  async updateSalesProspect(id: string, prospectData: Partial<InsertSalesProspect>): Promise<SalesProspect | undefined> {
    const result = await db.update(salesProspects)
      .set({ ...prospectData, updatedAt: new Date() })
      .where(eq(salesProspects.id, id))
      .returning();
    return result[0];
  }

  async updateProspectStage(id: string, stage: string): Promise<SalesProspect | undefined> {
    const result = await db.update(salesProspects)
      .set({ pipelineStage: stage, updatedAt: new Date() })
      .where(eq(salesProspects.id, id))
      .returning();
    return result[0];
  }

  async upsertProspectFromDemo(demoRequest: DemoRequest): Promise<SalesProspect> {
    const normalizedEmail = demoRequest.email.trim().toLowerCase();
    
    // Check if prospect already exists
    let prospect = await this.getSalesProspectByEmail(normalizedEmail);
    
    if (prospect) {
      // Update existing prospect with latest data
      const updates: Partial<InsertSalesProspect> = {
        lastInteractionAt: new Date(),
      };
      
      // Update fields if they weren't set before
      if (!prospect.primaryName && demoRequest.firstName && demoRequest.lastName) {
        updates.primaryName = `${demoRequest.firstName} ${demoRequest.lastName}`;
      }
      if (!prospect.phone && demoRequest.phone) {
        updates.phone = demoRequest.phone;
      }
      if (!prospect.units && demoRequest.unitsUnderManagement) {
        updates.units = demoRequest.unitsUnderManagement;
      }
      
      // Update source summary
      const sources = await this.getProspectSources(prospect.id);
      const hasDemo = sources.some(s => s.sourceType === 'demo');
      if (!hasDemo) {
        updates.sourceSummary = sources.length > 0 ? `Demo + Onboarding` : 'Demo';
      }
      
      prospect = await this.updateSalesProspect(prospect.id, updates) || prospect;
      
      // Create source link if it doesn't exist
      const existingSource = sources.find(s => s.sourceId === demoRequest.id);
      if (!existingSource) {
        await this.createProspectSource({
          prospectId: prospect.id,
          sourceType: 'demo',
          sourceId: demoRequest.id,
        });
      }
    } else {
      // Create new prospect
      prospect = await this.createSalesProspect({
        email: normalizedEmail,
        primaryName: `${demoRequest.firstName} ${demoRequest.lastName}`,
        phone: demoRequest.phone,
        units: demoRequest.unitsUnderManagement,
        sourceSummary: 'Demo',
        pipelineStage: 'discovery', // Discovery stage for demo requests
        lastInteractionAt: new Date(),
      });
      
      // Create source link
      await this.createProspectSource({
        prospectId: prospect.id,
        sourceType: 'demo',
        sourceId: demoRequest.id,
      });
    }
    
    return prospect;
  }

  async upsertProspectFromOnboarding(intake: OnboardingIntake): Promise<SalesProspect | null> {
    // Get email from linked user
    let email: string | null = null;
    if (intake.linkedUserId) {
      const user = await this.getUser(intake.linkedUserId);
      if (user?.email) {
        email = user.email;
      }
    }
    
    // Skip if no email available (intake not linked to a user yet)
    if (!email) {
      console.log('[Sales] Skipping onboarding intake', intake.id, '- no email available');
      return null;
    }
    
    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if prospect already exists
    let prospect = await this.getSalesProspectByEmail(normalizedEmail);
    
    if (prospect) {
      // Update existing prospect with latest data
      const updates: Partial<InsertSalesProspect> = {
        lastInteractionAt: new Date(),
      };
      
      // Update fields if they weren't set before
      if (!prospect.primaryName && intake.fullName) {
        updates.primaryName = intake.fullName;
      }
      if (!prospect.phone && intake.phoneNumber) {
        updates.phone = intake.phoneNumber;
      }
      if (!prospect.units && intake.unitsOwned) {
        updates.units = intake.unitsOwned;
      }
      
      // Update source summary
      const sources = await this.getProspectSources(prospect.id);
      const hasOnboarding = sources.some(s => s.sourceType === 'onboarding');
      if (!hasOnboarding) {
        updates.sourceSummary = sources.length > 0 ? `Demo + Onboarding` : 'Onboarding';
      }
      
      prospect = await this.updateSalesProspect(prospect.id, updates) || prospect;
      
      // Create source link if it doesn't exist
      const existingSource = sources.find(s => s.sourceId === intake.id);
      if (!existingSource) {
        await this.createProspectSource({
          prospectId: prospect.id,
          sourceType: 'onboarding',
          sourceId: intake.id,
        });
      }
    } else {
      // Create new prospect
      prospect = await this.createSalesProspect({
        email: normalizedEmail,
        primaryName: intake.fullName || 'Unknown',
        phone: intake.phoneNumber || undefined,
        units: intake.unitsOwned || undefined,
        sourceSummary: 'Onboarding',
        pipelineStage: intake.wantsDemo ? 'discovery' : 'evaluation', // Discovery if wants demo, otherwise evaluation
        lastInteractionAt: new Date(),
      });
      
      // Create source link
      await this.createProspectSource({
        prospectId: prospect.id,
        sourceType: 'onboarding',
        sourceId: intake.id,
      });
    }
    
    return prospect;
  }

  async createProspectSource(source: InsertProspectSource): Promise<ProspectSource> {
    const result = await db.insert(prospectSources).values(source).returning();
    return result[0];
  }

  async getProspectSources(prospectId: string): Promise<ProspectSource[]> {
    return await db.select().from(prospectSources)
      .where(eq(prospectSources.prospectId, prospectId))
      .orderBy(desc(prospectSources.createdAt));
  }

  async resyncAllProspects(): Promise<number> {
    let count = 0;
    
    console.log('[Sales] Starting resync of all prospects...');
    
    // Sync all demo requests
    const demos = await this.getAllDemoRequests();
    console.log(`[Sales] Found ${demos.length} demo requests to sync`);
    
    for (const demo of demos) {
      try {
        await this.upsertProspectFromDemo(demo);
        count++;
        console.log(`[Sales] Synced demo request: ${demo.email}`);
      } catch (error: any) {
        console.error(`[Sales] Failed to sync demo request ${demo.id}:`, error.message);
        throw error; // Re-throw to fail the entire operation
      }
    }
    
    // Sync all onboarding intakes (only completed or linked)
    const intakes = await this.getAllOnboardingIntakes();
    console.log(`[Sales] Found ${intakes.length} onboarding intakes (filtering for completed/linked)`);
    
    for (const intake of intakes) {
      if (intake.status === 'completed' || intake.status === 'linked') {
        try {
          const result = await this.upsertProspectFromOnboarding(intake);
          if (result) {
            count++;
            console.log(`[Sales] Synced onboarding intake: ${intake.id}`);
          } else {
            console.log(`[Sales] Skipped onboarding intake ${intake.id} (no email available)`);
          }
        } catch (error: any) {
          console.error(`[Sales] Failed to sync onboarding intake ${intake.id}:`, error.message);
          throw error; // Re-throw to fail the entire operation
        }
      }
    }
    
    console.log(`[Sales] Resync complete: ${count} prospects created/updated`);
    return count;
  }

  async getAdminAnalytics() {
    // Get total counts
    const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const [demoCount] = await db.select({ count: sql<number>`count(*)::int` }).from(demoRequests);
    const [onboardingCount] = await db.select({ count: sql<number>`count(*)::int` }).from(onboardingIntakes);
    const [orgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(organizations);
    const [prospectCount] = await db.select({ count: sql<number>`count(*)::int` }).from(salesProspects);

    // Get prospects by stage
    const prospectsByStage = await db
      .select({
        stage: salesProspects.pipelineStage,
        count: sql<number>`count(*)::int`
      })
      .from(salesProspects)
      .groupBy(salesProspects.pipelineStage)
      .orderBy(salesProspects.pipelineStage);

    // Calculate conversion rate (prospects in "sale" or "onboard" stage / total prospects)
    const [convertedCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesProspects)
      .where(sql`${salesProspects.pipelineStage} IN ('sale', 'onboard')`);

    const totalProspects = prospectCount.count || 1; // Avoid division by zero
    const converted = convertedCount.count || 0;
    const conversionRate = `${Math.round((converted / totalProspects) * 100)}%`;

    // Get signup trend for last 6 months
    const signupTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${users.createdAt}, 'Mon')`,
        signups: sql<number>`count(*)::int`
      })
      .from(users)
      .where(sql`${users.createdAt} >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`TO_CHAR(${users.createdAt}, 'Mon'), DATE_TRUNC('month', ${users.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${users.createdAt})`);

    // Get demo request trend for last 6 months
    const demoRequestTrend = await db
      .select({
        month: sql<string>`TO_CHAR(${demoRequests.createdAt}, 'Mon')`,
        requests: sql<number>`count(*)::int`
      })
      .from(demoRequests)
      .where(sql`${demoRequests.createdAt} >= NOW() - INTERVAL '6 months'`)
      .groupBy(sql`TO_CHAR(${demoRequests.createdAt}, 'Mon'), DATE_TRUNC('month', ${demoRequests.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${demoRequests.createdAt})`);

    return {
      totalSignups: userCount.count || 0,
      totalDemoRequests: demoCount.count || 0,
      totalOnboardingSubmissions: onboardingCount.count || 0,
      totalOrganizations: orgCount.count || 0,
      totalProspects: prospectCount.count || 0,
      conversionRate,
      prospectsByStage: prospectsByStage.map(p => ({
        stage: p.stage || 'unknown',
        count: p.count || 0
      })),
      signupTrend: signupTrend.map(s => ({
        month: s.month || '',
        signups: s.signups || 0
      })),
      demoRequestTrend: demoRequestTrend.map(d => ({
        month: d.month || '',
        requests: d.requests || 0
      }))
    };
  }
}

export const storage = new DatabaseStorage();

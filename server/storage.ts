import { db } from "./db";
import { 
  users, properties, leads, conversations, notes, aiSettings, integrationConfig, pendingReplies,
  calendarConnections, calendarEvents, schedulePreferences, memberships, organizations, notifications,
  zillowIntegrations, zillowListings, deletedLeads, demoRequests, appointments, onboardingIntakes,
  salesProspects, prospectSources, showings, invitations, auditLogs, propertyAssignments,
  propertySchedulingSettings, propertyUnits, listings, qualificationTemplates, leadQualifications, qualificationSettings,
  pendingSubscriptions,
  type User, type InsertUser, type UpsertUser,
  type Property, type InsertProperty,
  type PropertyUnit, type InsertPropertyUnit,
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
  type ProspectSource, type InsertProspectSource,
  type Showing, type InsertShowing,
  type Invitation, type InsertInvitation,
  type AuditLog, type InsertAuditLog,
  type Membership, type InsertMembership,
  type PropertySchedulingSettings, type InsertPropertySchedulingSettings,
  type AssignedMember,
  type Listing, type InsertListing,
  type QualificationTemplate, type InsertQualificationTemplate,
  type LeadQualification, type InsertLeadQualification,
  type QualificationSettings, type InsertQualificationSettings,
  type Organization
} from "@shared/schema";
import { eq, desc, asc, and, or, sql, gte, lte, inArray, isNotNull, isNull } from "drizzle-orm";

export interface IStorage {
  // User operations
  // (blueprint:javascript_log_in_with_replit) Mandatory for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  updateProfile(userId: string, profile: { firstName: string; lastName: string; phone: string; profileImageUrl?: string }): Promise<User | undefined>;
  deleteUserAccount(userId: string): Promise<boolean>;
  getUsersByOrg(orgId: string): Promise<User[]>;
  getOrgMembersWithProfiles(orgId: string): Promise<Array<User & { role: string; membershipStatus: string }>>;

  // Organization & Membership operations
  getOrganization(orgId: string): Promise<Organization | undefined>;
  updateOrganization(orgId: string, updates: Partial<Organization>): Promise<Organization | undefined>;
  getUserOrganization(userId: string): Promise<{ orgId: string; role: string } | undefined>;
  getUserOrganizations(userId: string): Promise<Array<{ orgId: string; orgName: string; role: string; profileImage?: string | null; deletedAt?: string | null }>>;
  getMembership(userId: string, orgId: string): Promise<{ orgId: string; role: string } | undefined>;
  createOrganization(name: string, ownerId: string): Promise<{ id: string; name: string }>;
  deleteOrganization(orgId: string, userId: string): Promise<boolean>;
  permanentlyDeleteOrganization(orgId: string, userId: string): Promise<boolean>;
  restoreOrganization(orgId: string, userId: string): Promise<boolean>;
  cleanupDeletedOrganizations(): Promise<number>;

  // Property operations
  getAllProperties(orgId: string): Promise<Property[]>;
  getPropertiesWithListedUnits(orgId: string, options?: { includeAll?: boolean }): Promise<Array<Property & { listedUnits: PropertyUnit[]; bookingEnabled?: boolean }>>;
  getProperty(id: string, orgId: string): Promise<Property | undefined>;
  getPropertyPublic(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty & { orgId: string }): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>, orgId: string): Promise<Property | undefined>;
  updatePropertyDisplayOrder(id: string, displayOrder: number, orgId: string): Promise<Property | undefined>;
  deleteProperty(id: string, orgId: string): Promise<boolean>;

  // Property Unit operations
  getAllUnitsByProperty(propertyId: string, orgId: string): Promise<PropertyUnit[]>;
  getPropertyUnit(id: string, orgId: string): Promise<PropertyUnit | undefined>;
  getPropertyUnitPublic(id: string): Promise<(PropertyUnit & { property: Property }) | undefined>;
  createPropertyUnit(unit: InsertPropertyUnit): Promise<PropertyUnit>;
  updatePropertyUnit(id: string, unit: Partial<InsertPropertyUnit>, orgId: string): Promise<PropertyUnit | undefined>;
  updatePropertyUnitDisplayOrder(id: string, displayOrder: number, orgId: string): Promise<PropertyUnit | undefined>;
  deletePropertyUnit(id: string, orgId: string): Promise<boolean>;

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

  // Pending Reply operations
  getAllPendingReplies(orgId: string): Promise<PendingReply[]>;
  getPendingReply(id: string, orgId: string): Promise<PendingReply | undefined>;
  createPendingReply(reply: InsertPendingReply): Promise<PendingReply>;
  updatePendingReplyStatus(id: string, status: string, orgId: string): Promise<PendingReply | undefined>;
  deletePendingReply(id: string, orgId: string): Promise<boolean>;

  // Calendar Connection operations
  getCalendarConnections(userId?: string): Promise<CalendarConnection[]>;
  getCalendarConnectionsWithUsers(orgId: string): Promise<Array<CalendarConnection & { userName?: string }>>;
  getCalendarConnection(id: string): Promise<CalendarConnection | undefined>;
  getCalendarConnectionByProvider(userId: string, provider: string): Promise<CalendarConnection | undefined>;
  createCalendarConnection(connection: InsertCalendarConnection): Promise<CalendarConnection>;
  updateCalendarConnection(id: string, connection: Partial<InsertCalendarConnection>): Promise<CalendarConnection | undefined>;
  deleteCalendarConnection(id: string): Promise<boolean>;

  // Calendar Event operations
  getCalendarEvents(connectionId: string, startTime?: Date, endTime?: Date): Promise<CalendarEvent[]>;
  getAllCalendarEvents(orgId: string, startTime?: Date, endTime?: Date, memberId?: string): Promise<CalendarEvent[]>;
  getCalendarEventByExternalId(connectionId: string, externalId: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  upsertCalendarEvent(event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string): Promise<boolean>;
  deleteEventsByConnection(connectionId: string): Promise<boolean>;

  // Schedule Preference operations
  getSchedulePreferences(userId?: string, propertyId?: string): Promise<SchedulePreference[]>;
  getSchedulePreferencesForUsers(userIds: string[], propertyId?: string): Promise<SchedulePreference[]>;
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
  getDemoRequestByEmail(email: string): Promise<DemoRequest | undefined>;
  createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest>;
  updateDemoRequest(id: string, request: Partial<InsertDemoRequest>): Promise<DemoRequest | undefined>;

  // Appointment operations
  getAllAppointments(): Promise<Appointment[]>;
  getAppointmentsByDate(date: string): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: string, endDate: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: string, status: string): Promise<Appointment | undefined>;

  // Showing operations
  getAllShowings(orgId: string): Promise<Showing[]>;
  getShowing(id: string, orgId: string): Promise<Showing | undefined>;
  getShowingsByProperty(propertyId: string, orgId: string): Promise<Showing[]>;
  getShowingsByLead(leadId: string, orgId: string): Promise<Showing[]>;
  getShowingsByDateRange(startDate: string, endDate: string, orgId: string): Promise<Showing[]>;
  getAISuggestedShowings(orgId: string): Promise<Showing[]>;
  createShowing(showing: InsertShowing & { orgId: string }): Promise<Showing>;
  updateShowing(id: string, showing: Partial<InsertShowing>, orgId: string): Promise<Showing | undefined>;
  deleteShowing(id: string, orgId: string): Promise<boolean>;

  // Property Scheduling Settings operations
  getPropertySchedulingSettings(propertyId: string, orgId: string): Promise<PropertySchedulingSettings | undefined>;
  getAllPropertySchedulingSettings(orgId: string): Promise<PropertySchedulingSettings[]>;
  createPropertySchedulingSettings(settings: InsertPropertySchedulingSettings & { orgId: string }): Promise<PropertySchedulingSettings>;
  updatePropertySchedulingSettings(propertyId: string, settings: Partial<InsertPropertySchedulingSettings>, orgId: string): Promise<PropertySchedulingSettings | undefined>;
  deletePropertySchedulingSettings(propertyId: string, orgId: string): Promise<boolean>;

  // Unit Scheduling Settings operations
  getUnitSchedulingSettings(unitId: string, orgId: string): Promise<{ 
    bookingEnabled: boolean; 
    customEventName: string | null; 
    customEventDescription: string | null; 
    customAssignedMembers: AssignedMember[] | null;
    customPreferredTimes: any | null;
    customBookingMode: string | null;
    customEventDuration: number | null;
    customBufferTime: number | null;
    customLeadTime: number | null;
    customReminderSettings: any | null;
  } | undefined>;
  updateUnitSchedulingSettings(unitId: string, settings: { 
    bookingEnabled?: boolean; 
    customEventName?: string | null; 
    customEventDescription?: string | null; 
    customAssignedMembers?: AssignedMember[] | null;
    customPreferredTimes?: any | null;
    customBookingMode?: string | null;
    customEventDuration?: number | null;
    customBufferTime?: number | null;
    customLeadTime?: number | null;
    customReminderSettings?: any | null;
  }, orgId: string): Promise<PropertyUnit | undefined>;
  deleteUnitSchedulingSettings(unitId: string, orgId: string): Promise<boolean>;
  applyPropertySettingsToUnits(propertyId: string, settings: {
    eventName?: string;
    bookingMode?: "one_to_one" | "group";
    eventDuration?: number;
    bufferTime?: number;
    leadTime?: number;
    eventDescription?: string;
    assignedMembers?: AssignedMember[];
    reminderSettings?: any;
  }, orgId: string, unitIds?: string[]): Promise<number>;
  togglePropertyBooking(propertyId: string, enabled: boolean, orgId: string): Promise<PropertySchedulingSettings | undefined>;
  getPropertyWithBookingEnabledUnits(propertyId: string): Promise<(Property & { units: PropertyUnit[] }) | undefined>;

  // Onboarding Intake operations
  getOnboardingIntake(sessionToken: string): Promise<OnboardingIntake | undefined>;
  getAllOnboardingIntakes(): Promise<OnboardingIntake[]>;
  getCompletedOnboardingIntakes(): Promise<OnboardingIntake[]>;
  createOnboardingIntake(intake: InsertOnboardingIntake): Promise<OnboardingIntake>;
  updateOnboardingIntake(sessionToken: string, intake: Partial<InsertOnboardingIntake>): Promise<OnboardingIntake | undefined>;
  linkOnboardingIntakeToUser(sessionToken: string, userId: string): Promise<OnboardingIntake | undefined>;
  ensureOrganizationFromOnboarding(userId: string): Promise<void>;

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

  // RBAC: Invitation operations
  getInvitations(orgId: string): Promise<Invitation[]>;
  getInvitation(id: string, orgId: string): Promise<Invitation | undefined>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  createInvitation(invitation: InsertInvitation & { orgId: string }): Promise<Invitation>;
  acceptInvitation(token: string, userId: string): Promise<Membership | null>;
  revokeInvitation(id: string, orgId: string): Promise<boolean>;
  cleanupExpiredInvitations(orgId: string): Promise<number>;

  // RBAC: Property Assignment operations
  getPropertyAssignments(userId: string): Promise<PropertyAssignment[]>;
  getPropertyAssignmentsByProperty(propertyId: string): Promise<PropertyAssignment[]>;
  createPropertyAssignment(assignment: InsertPropertyAssignment): Promise<PropertyAssignment>;
  deletePropertyAssignment(userId: string, propertyId: string): Promise<boolean>;
  isUserAssignedToProperty(userId: string, propertyId: string): Promise<boolean>;

  // RBAC: Membership operations (extended)
  getMembershipFull(userId: string, orgId: string): Promise<Membership | undefined>;
  getOrganizationMembers(orgId: string): Promise<Array<Membership & { user: User & { fullName?: string; avatarUrl?: string } }>>;
  updateMembershipRole(userId: string, orgId: string, role: string): Promise<Membership | undefined>;
  updateMembershipStatus(userId: string, orgId: string, status: string): Promise<Membership | undefined>;
  deleteMembership(userId: string, orgId: string): Promise<boolean>;

  // RBAC: Audit Log operations
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(orgId: string, filters?: { userId?: string; action?: string; resource?: string; startDate?: Date; endDate?: Date }): Promise<AuditLog[]>;

  // ==========================================
  // PRE-QUALIFICATION SYSTEM
  // ==========================================

  // Listing operations
  getAllListings(orgId: string): Promise<Listing[]>;
  getListingsByProperty(propertyId: string, orgId: string): Promise<Listing[]>;
  getListing(id: string, orgId: string): Promise<Listing | undefined>;
  getListingByUnit(unitId: string, orgId: string): Promise<Listing | undefined>;
  getListingByUnitPublic(unitId: string): Promise<Listing | undefined>;
  createListing(listing: InsertListing): Promise<Listing>;
  updateListing(id: string, listing: Partial<InsertListing>, orgId: string): Promise<Listing | undefined>;
  deleteListing(id: string, orgId: string): Promise<boolean>;

  // Qualification Template operations
  getQualificationTemplates(orgId: string): Promise<QualificationTemplate[]>;
  getOrgQualificationTemplate(orgId: string): Promise<QualificationTemplate | undefined>;
  getPropertyQualificationTemplate(propertyId: string, orgId: string): Promise<QualificationTemplate | undefined>;
  getListingQualificationTemplate(listingId: string, orgId: string): Promise<QualificationTemplate | undefined>;
  getEffectiveQualificationTemplate(unitId: string, orgId: string): Promise<QualificationTemplate | undefined>;
  createQualificationTemplate(template: InsertQualificationTemplate): Promise<QualificationTemplate>;
  updateQualificationTemplate(id: string, template: Partial<InsertQualificationTemplate>, orgId: string): Promise<QualificationTemplate | undefined>;
  deleteQualificationTemplate(id: string, orgId: string): Promise<boolean>;

  // Lead Qualification operations
  getLeadQualifications(leadId: string, orgId: string): Promise<LeadQualification[]>;
  getLatestLeadQualification(leadId: string, listingId: string, orgId: string): Promise<LeadQualification | undefined>;
  createLeadQualification(qualification: InsertLeadQualification): Promise<LeadQualification>;
  getLeadQualificationHistory(leadId: string, orgId: string): Promise<LeadQualification[]>;

  // Qualification Settings operations (criteria/standards, not questions)
  getOrgQualificationSettings(orgId: string): Promise<QualificationSettings | undefined>;
  getPropertyQualificationSettings(propertyId: string, orgId: string): Promise<QualificationSettings | undefined>;
  getAllPropertyQualificationSettings(orgId: string): Promise<QualificationSettings[]>;
  upsertOrgQualificationSettings(orgId: string, settings: InsertQualificationSettings): Promise<QualificationSettings>;
  upsertPropertyQualificationSettings(propertyId: string, orgId: string, settings: InsertQualificationSettings): Promise<QualificationSettings>;
  deletePropertyQualificationSettings(propertyId: string, orgId: string): Promise<boolean>;
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

  async getUsersByOrg(orgId: string): Promise<User[]> {
    const result = await db
      .select()
      .from(users)
      .innerJoin(memberships, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, orgId))
      .orderBy(desc(sql`CASE WHEN ${memberships.role} = 'owner' THEN 1 WHEN ${memberships.role} = 'manager' THEN 2 ELSE 3 END`));
    
    // Extract just the user objects from the join result
    return result.map(row => row.users);
  }

  async updateProfile(userId: string, profile: { firstName: string; lastName: string; phone: string; profileImageUrl?: string }): Promise<User | undefined> {
    const result = await db.update(users).set({
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      profileImageUrl: profile.profileImageUrl,
      profileCompleted: true,
      updatedAt: new Date(),
    }).where(eq(users.id, userId)).returning();
    return result[0];
  }

  async getOrgMembersWithProfiles(orgId: string): Promise<Array<User & { role: string; membershipStatus: string }>> {
    const result = await db
      .select({
        user: users,
        role: memberships.role,
        membershipStatus: memberships.status,
      })
      .from(users)
      .innerJoin(memberships, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.orgId, orgId),
          eq(memberships.status, 'active')
        )
      )
      .orderBy(users.firstName, users.lastName);
    
    return result.map(row => ({
      ...row.user,
      role: row.role,
      membershipStatus: row.membershipStatus,
    }));
  }

  // Organization & Membership operations
  async getOrganization(orgId: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    return result[0];
  }

  async updateOrganization(orgId: string, updates: Partial<Organization>): Promise<Organization | undefined> {
    // Build update clause with only fields that are provided
    const setClause: Record<string, any> = {
      updatedAt: new Date(),
    };
    
    // Only include fields that are actually being updated (not undefined)
    if (updates.name !== undefined) setClause.name = updates.name;
    if (updates.email !== undefined) setClause.email = updates.email;
    if (updates.address !== undefined) setClause.address = updates.address;
    if (updates.phone !== undefined) setClause.phone = updates.phone;
    if (updates.profileImage !== undefined) setClause.profileImage = updates.profileImage;
    
    // Explicitly exclude logo - it doesn't exist in the database
    delete setClause.logo;
    
    console.log("[Storage] updateOrganization: Updating with keys:", Object.keys(setClause));
    
    try {
      // Update with all provided fields
      const result = await db
        .update(organizations)
        .set(setClause)
        .where(eq(organizations.id, orgId))
        .returning();
      return result[0];
    } catch (error: any) {
      console.error("[Storage] updateOrganization error:", error);
      throw error;
    }
  }

  async getUserOrganization(userId: string): Promise<{ orgId: string; role: string } | undefined> {
    const result = await db.select({
      orgId: memberships.orgId,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(and(
      eq(memberships.userId, userId),
      isNull(organizations.deletedAt) // Exclude deleted organizations
    ))
    .limit(1);
    return result[0];
  }

  async getUserOrganizations(userId: string): Promise<Array<{ orgId: string; orgName: string; role: string; profileImage?: string | null; deletedAt?: string | null }>> {
    try {
      const result = await db.select({
        orgId: memberships.orgId,
        orgName: organizations.name,
        role: memberships.role,
        profileImage: organizations.profileImage,
        deletedAt: organizations.deletedAt,
      })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.orgId, organizations.id))
      .where(eq(memberships.userId, userId));
      // Include both active and deleted organizations
      return result.map(org => ({
        ...org,
        deletedAt: org.deletedAt ? org.deletedAt.toISOString() : null,
      }));
    } catch (error: any) {
      // If profileImage column doesn't exist yet, fall back to query without it
      if (error.message && error.message.includes('profile_image')) {
        console.warn("[Storage] profile_image column not found, falling back to query without it");
        const result = await db.select({
          orgId: memberships.orgId,
          orgName: organizations.name,
          role: memberships.role,
          deletedAt: organizations.deletedAt,
        })
        .from(memberships)
        .innerJoin(organizations, eq(memberships.orgId, organizations.id))
        .where(eq(memberships.userId, userId));
        // Include both active and deleted organizations
        return result.map(org => ({
          ...org,
          profileImage: null,
          deletedAt: org.deletedAt ? org.deletedAt.toISOString() : null,
        }));
      }
      throw error;
    }
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

  async getMembershipFull(userId: string, orgId: string) {
    const result = await db.select().from(memberships)
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

  async deleteOrganization(orgId: string, userId: string): Promise<boolean> {
    // Verify user is owner of this organization
    const membership = await this.getMembership(userId, orgId);
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only organization owners can delete organizations');
    }

    // Get organization to check for Stripe subscription
    const org = await this.getOrganization(orgId);
    if (!org) {
      return false;
    }

    // Schedule Stripe subscription cancellation at end of billing period if it exists
    // Subscription will remain active until period end, but reactivation won't restore it
    if (org.stripeSubscriptionId) {
      try {
        console.log(`[Storage] [Delete Org] Processing subscription cancellation for org ${orgId}, subscription ${org.stripeSubscriptionId}`);
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        
        // Get current subscription to check its status
        const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
        console.log(`[Storage] [Delete Org] Current subscription status:`, {
          id: subscription.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_end: subscription.current_period_end,
          current_period_end_date: new Date(subscription.current_period_end * 1000).toISOString(),
        });
        
        // Only schedule cancellation if subscription is active and not already set to cancel
        if (subscription.status === 'active' && !subscription.cancel_at_period_end) {
          // Schedule cancellation at end of billing period (subscription stays active until then)
          const updatedSubscription = await stripe.subscriptions.update(org.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
          console.log(`[Storage] ✅ Scheduled Stripe subscription ${org.stripeSubscriptionId} to cancel at end of billing period for org ${orgId}`);
          console.log(`[Storage] [Delete Org] Updated subscription:`, {
            id: updatedSubscription.id,
            cancel_at_period_end: updatedSubscription.cancel_at_period_end,
            current_period_end: updatedSubscription.current_period_end,
            current_period_end_date: updatedSubscription.current_period_end ? new Date(updatedSubscription.current_period_end * 1000).toISOString() : 'N/A',
          });
          
          // Update subscriptionCurrentPeriodEnd in database if we have it from Stripe
          if (updatedSubscription.current_period_end && typeof updatedSubscription.current_period_end === 'number') {
            const periodEndDate = new Date(updatedSubscription.current_period_end * 1000);
            await db.update(organizations)
              .set({
                subscriptionCurrentPeriodEnd: periodEndDate,
              })
              .where(eq(organizations.id, orgId));
            console.log(`[Storage] ✅ Updated subscriptionCurrentPeriodEnd in DB to ${periodEndDate.toISOString()}`);
          }
        } else if (subscription.cancel_at_period_end) {
          console.log(`[Storage] ℹ️ Stripe subscription ${org.stripeSubscriptionId} already scheduled to cancel at period end`);
          
          // Update subscriptionCurrentPeriodEnd in database if missing and we have it from Stripe
          if (!org.subscriptionCurrentPeriodEnd && subscription.current_period_end && typeof subscription.current_period_end === 'number') {
            const periodEndDate = new Date(subscription.current_period_end * 1000);
            await db.update(organizations)
              .set({
                subscriptionCurrentPeriodEnd: periodEndDate,
              })
              .where(eq(organizations.id, orgId));
            console.log(`[Storage] ✅ Updated missing subscriptionCurrentPeriodEnd in DB to ${periodEndDate.toISOString()}`);
          }
        } else {
          console.log(`[Storage] ℹ️ Stripe subscription ${org.stripeSubscriptionId} is not active (status: ${subscription.status}), skipping cancellation scheduling`);
        }
      } catch (stripeError: any) {
        console.error(`[Storage] ⚠️ Failed to schedule Stripe subscription cancellation:`, stripeError);
        // Continue with deletion even if Stripe update fails
        if (stripeError.code !== 'resource_missing') {
          console.error(`[Storage] Stripe subscription cancellation scheduling error:`, {
            code: stripeError.code,
            message: stripeError.message,
          });
        }
      }
    } else {
      console.log(`[Storage] [Delete Org] No stripeSubscriptionId found for org ${orgId}`);
    }

    // Clean up user's currentOrgId if it points to this org
    await db.update(users)
      .set({ currentOrgId: null })
      .where(eq(users.currentOrgId, orgId));

    // Clean up pending subscriptions linkedOrgId if it points to this org
    await db.update(pendingSubscriptions)
      .set({ linkedOrgId: null })
      .where(eq(pendingSubscriptions.linkedOrgId, orgId));

    // Soft delete: Set deletedAt timestamp (30 days grace period before permanent deletion)
    // Subscription is scheduled to cancel at period end, but reactivation won't restore it
    const deletedAt = new Date();
    const result = await db.update(organizations)
      .set({
        deletedAt: deletedAt,
        // Mark as cancelled - subscription will remain active until period end
        // Webhook will handle the final cancellation when period ends
        foundingPartnerStatus: 'cancelled',
        subscriptionCancelledAt: new Date(), // Mark as cancelled (scheduled for period end)
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    console.log(`[Storage] ✅ Soft deleted organization ${orgId} (deletedAt: ${deletedAt.toISOString()})`);
    return result.length > 0;
  }

  async permanentlyDeleteOrganization(orgId: string, userId: string, skipOwnershipCheck: boolean = false): Promise<boolean> {
    console.log(`[Storage] [Permanent Delete] ===== STARTING PERMANENT DELETE =====`);
    console.log(`[Storage] [Permanent Delete] OrgId: ${orgId}, UserId: ${userId}, SkipOwnershipCheck: ${skipOwnershipCheck}`);
    
    // Verify user is owner of this organization (unless skipOwnershipCheck is true, e.g., when last member leaves)
    if (!skipOwnershipCheck) {
      const membership = await this.getMembership(userId, orgId);
      if (!membership || membership.role !== 'owner') {
        console.error(`[Storage] [Permanent Delete] ❌ User ${userId} is not owner of org ${orgId}`);
        throw new Error('Only organization owners can permanently delete organizations');
      }
      console.log(`[Storage] [Permanent Delete] ✅ Ownership verified`);
    } else {
      console.log(`[Storage] [Permanent Delete] ⚠️ Skipping ownership check`);
    }

    // Get organization to check for Stripe subscription
    const org = await this.getOrganization(orgId);
    if (!org) {
      console.error(`[Storage] [Permanent Delete] ❌ Organization ${orgId} not found`);
      return false;
    }
    console.log(`[Storage] [Permanent Delete] Organization found: ${org.name} (${orgId})`);

    // Check for any remaining memberships
    const remainingMemberships = await this.getOrganizationMembers(orgId);
    console.log(`[Storage] [Permanent Delete] Remaining memberships: ${remainingMemberships.length}`, remainingMemberships.map(m => ({ userId: m.userId, role: m.role })));
    if (remainingMemberships.length > 0) {
      console.error(`[Storage] [Permanent Delete] ❌ WARNING: ${remainingMemberships.length} membership(s) still exist! Deleting anyway...`);
    }

    // Cancel Stripe subscription immediately if it exists
    if (org.stripeSubscriptionId) {
      try {
        console.log(`[Storage] [Permanent Delete] Cancelling Stripe subscription ${org.stripeSubscriptionId} for org ${orgId}`);
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        
        // Cancel subscription immediately (not at period end)
        await stripe.subscriptions.cancel(org.stripeSubscriptionId);
        console.log(`[Storage] [Permanent Delete] ✅ Cancelled Stripe subscription ${org.stripeSubscriptionId} for org ${orgId}`);
      } catch (stripeError: any) {
        // Subscription may already be cancelled, continue
        if (stripeError.code !== 'resource_missing') {
          console.error(`[Storage] [Permanent Delete] Error cancelling subscription:`, stripeError);
        } else {
          console.log(`[Storage] [Permanent Delete] Subscription ${org.stripeSubscriptionId} already cancelled or missing`);
        }
      }
    } else {
      console.log(`[Storage] [Permanent Delete] No Stripe subscription to cancel`);
    }

    // Clean up user's currentOrgId if it points to this org
    console.log(`[Storage] [Permanent Delete] Cleaning up currentOrgId references for all users`);
    const usersUpdated = await db.update(users)
      .set({ currentOrgId: null })
      .where(eq(users.currentOrgId, orgId));
    console.log(`[Storage] [Permanent Delete] Updated users with currentOrgId=${orgId}: ${usersUpdated.rowCount || 0} row(s)`);

    // Clean up pending subscriptions linkedOrgId if it points to this org
    console.log(`[Storage] [Permanent Delete] Cleaning up pending subscriptions linkedOrgId`);
    const pendingSubsUpdated = await db.update(pendingSubscriptions)
      .set({ linkedOrgId: null })
      .where(eq(pendingSubscriptions.linkedOrgId, orgId));
    console.log(`[Storage] [Permanent Delete] Updated pending subscriptions: ${pendingSubsUpdated.rowCount || 0} row(s)`);

    // Delete audit logs for this organization (they don't have cascade delete)
    console.log(`[Storage] [Permanent Delete] Deleting audit logs for organization ${orgId}`);
    try {
      const auditLogsDeleted = await db.delete(auditLogs)
        .where(eq(auditLogs.orgId, orgId));
      console.log(`[Storage] [Permanent Delete] Deleted audit logs: ${auditLogsDeleted.rowCount || 0} row(s)`);
    } catch (auditError: any) {
      console.error(`[Storage] [Permanent Delete] Error deleting audit logs:`, auditError);
      // Continue anyway - might not have any audit logs
    }

    // Permanently delete the organization (cascade will handle related data)
    // This will automatically delete all related records due to onDelete: 'cascade' in schema
    console.log(`[Storage] [Permanent Delete] Deleting organization from database...`);
    try {
      const result = await db.delete(organizations)
        .where(eq(organizations.id, orgId))
        .returning();
      
      console.log(`[Storage] [Permanent Delete] Delete query returned ${result.length} row(s)`);
      if (result.length > 0) {
        console.log(`[Storage] [Permanent Delete] ✅ Permanently deleted organization ${orgId} (${org.name})`);
      } else {
        console.error(`[Storage] [Permanent Delete] ❌ Delete query returned 0 rows - organization may not exist`);
      }
      
      // Verify deletion immediately
      const verifyOrg = await this.getOrganization(orgId);
      if (verifyOrg) {
        console.error(`[Storage] [Permanent Delete] ❌ CRITICAL: Organization ${orgId} still exists after delete query!`);
        return false;
      } else {
        console.log(`[Storage] [Permanent Delete] ✅ Verified: Organization ${orgId} successfully deleted`);
      }
      
      console.log(`[Storage] [Permanent Delete] ===== END PERMANENT DELETE =====`);
      return result.length > 0;
    } catch (deleteError: any) {
      console.error(`[Storage] [Permanent Delete] ❌ Exception during delete query:`, deleteError);
      console.error(`[Storage] [Permanent Delete] Error message:`, deleteError.message);
      console.error(`[Storage] [Permanent Delete] Error code:`, deleteError.code);
      console.error(`[Storage] [Permanent Delete] Error detail:`, deleteError.detail);
      console.error(`[Storage] [Permanent Delete] Error stack:`, deleteError.stack);
      throw deleteError;
    }
  }

  async restoreOrganization(orgId: string, userId: string): Promise<boolean> {
    // Verify user is owner of this organization
    const membership = await this.getMembership(userId, orgId);
    if (!membership || membership.role !== 'owner') {
      throw new Error('Only organization owners can restore organizations');
    }

    // Check if organization is within 30-day grace period
    const org = await this.getOrganization(orgId);
    if (!org || !org.deletedAt) {
      return false; // Organization not deleted or doesn't exist
    }

    const daysSinceDeletion = (Date.now() - org.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDeletion > 30) {
      throw new Error('Organization cannot be restored after 30 days');
    }

    // Restore the organization by clearing deletedAt
    // If subscription is still active (within billing period), restore membership status
    // If subscription has been cancelled, don't restore it
    let updates: any = {
      deletedAt: null,
      updatedAt: new Date(),
    };

    // Check if subscription is still active (scheduled to cancel but not yet cancelled)
    if (org.stripeSubscriptionId) {
      try {
        const { getUncachableStripeClient } = await import("./stripeClient");
        const stripe = await getUncachableStripeClient();
        
        const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
        
        // If subscription is still active (even if scheduled to cancel at period end), restore membership
        if (subscription.status === 'active' || subscription.status === 'trialing') {
          // Subscription is still active - restore membership status
          updates.foundingPartnerStatus = 'active';
          updates.subscriptionCancelledAt = subscription.cancel_at_period_end ? new Date() : null;
          updates.subscriptionCurrentPeriodEnd = subscription.current_period_end 
            ? new Date(subscription.current_period_end * 1000) 
            : org.subscriptionCurrentPeriodEnd;
          console.log(`[Storage] ✅ Restored organization ${orgId} with active subscription (scheduled to cancel: ${subscription.cancel_at_period_end})`);
        } else {
          // Subscription has been cancelled - don't restore membership
          console.log(`[Storage] ✅ Restored organization ${orgId} but subscription is ${subscription.status} - membership not restored`);
        }
      } catch (stripeError: any) {
        console.error(`[Storage] ⚠️ Failed to check subscription status during restore:`, stripeError);
        // If we can't check, don't restore membership status (safer to leave it cancelled)
        console.log(`[Storage] Keeping organization ${orgId} membership as cancelled due to subscription check error`);
      }
    } else {
      // No subscription - don't restore membership
      console.log(`[Storage] ✅ Restored organization ${orgId} but no subscription found - membership not restored`);
    }

    const result = await db.update(organizations)
      .set(updates)
      .where(eq(organizations.id, orgId))
      .returning();

    console.log(`[Storage] ✅ Restored organization ${orgId}`);
    return result.length > 0;
  }

  // Permanently delete organizations that have been soft-deleted for more than 30 days
  async cleanupDeletedOrganizations(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    console.log(`[Storage] [Cleanup] Starting cleanup of organizations deleted before ${thirtyDaysAgo.toISOString()}`);
    
    // Find organizations that were deleted more than 30 days ago
    const orgsToDelete = await db.select()
      .from(organizations)
      .where(and(
        isNotNull(organizations.deletedAt),
        lte(organizations.deletedAt, thirtyDaysAgo)
      ));
    
    console.log(`[Storage] [Cleanup] Found ${orgsToDelete.length} organizations to permanently delete`);
    
    let deletedCount = 0;
    for (const org of orgsToDelete) {
      try {
        // Cancel Stripe subscription if it still exists
        if (org.stripeSubscriptionId) {
          try {
            const { getUncachableStripeClient } = await import("./stripeClient");
            const stripe = await getUncachableStripeClient();
            await stripe.subscriptions.cancel(org.stripeSubscriptionId);
            console.log(`[Storage] [Cleanup] Cancelled Stripe subscription ${org.stripeSubscriptionId} for org ${org.id}`);
          } catch (stripeError: any) {
            // Subscription may already be cancelled, continue
            if (stripeError.code !== 'resource_missing') {
              console.error(`[Storage] [Cleanup] Error cancelling subscription:`, stripeError);
            }
          }
        }
        
        // Permanently delete the organization (cascade will handle related data)
        await db.delete(organizations)
          .where(eq(organizations.id, org.id));
        
        deletedCount++;
        console.log(`[Storage] [Cleanup] ✅ Permanently deleted organization ${org.id} (${org.name})`);
      } catch (error) {
        console.error(`[Storage] [Cleanup] ❌ Failed to delete organization ${org.id}:`, error);
      }
    }
    
    console.log(`[Storage] [Cleanup] ✅ Cleanup complete: ${deletedCount} organizations permanently deleted`);
    return deletedCount;
  }

  // Property operations
  async getAllProperties(orgId: string): Promise<Property[]> {
    return db.select().from(properties).where(eq(properties.orgId, orgId)).orderBy(desc(properties.createdAt));
  }

  async getPropertiesWithListedUnits(orgId: string, options?: { includeAll?: boolean }): Promise<Array<Property & { listedUnits: PropertyUnit[]; bookingEnabled?: boolean }>> {
    const includeAll = options?.includeAll ?? false;
    
    // Get all properties for this org, ordered by displayOrder then createdAt
    const allProperties = await db.select().from(properties)
      .where(eq(properties.orgId, orgId))
      .orderBy(asc(properties.displayOrder), desc(properties.createdAt));
    
    // Get all units for these properties
    // Show all units that have booking types (either manually created or auto-created from isListed=true)
    const propertiesWithUnits = await Promise.all(
      allProperties.map(async (property) => {
        const units = await db.select().from(propertyUnits)
          .where(eq(propertyUnits.propertyId, property.id))
          .orderBy(asc(propertyUnits.displayOrder), asc(propertyUnits.unitNumber));
        
        // Get property scheduling settings to include bookingEnabled
        const settings = await db.select().from(propertySchedulingSettings)
          .where(eq(propertySchedulingSettings.propertyId, property.id))
          .limit(1);
        
        // Helper function to replace variables in event name/description
        const replaceVariables = (text: string | null | undefined, unit: any, property: any): string => {
          if (!text) return text || '';
          
          // Format property amenities as comma-separated list
          const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
            ? property.amenities.join(', ')
            : '';
          
          // Format property address (address is a single field in the schema)
          const propertyAddressStr = property.address || '';
          
          // Format unit rent with currency
          const unitRentStr = unit.monthlyRent 
            ? `$${parseFloat(unit.monthlyRent).toLocaleString()}/mo`
            : '';
          
          // Format security deposit with currency
          const securityDepositStr = unit.deposit
            ? `$${parseFloat(unit.deposit).toLocaleString()}`
            : '';
          
          // Define safe replacement mapping with all available variables
          const variables: Record<string, string> = {
            '{unit_number}': unit.unitNumber || '',
            '{bedrooms}': unit.bedrooms?.toString() || '',
            '{bathrooms}': unit.bathrooms || '',
            '{unit_rent}': unitRentStr,
            '{security_deposit}': securityDepositStr,
            '{property_amenities}': propertyAmenitiesStr,
            '{property_address}': propertyAddressStr,
            '{property_name}': property.name || ''
          };
          
          // Replace each variable
          let result = text;
          for (const [placeholder, value] of Object.entries(variables)) {
            // Escape regex special characters in placeholder for safe replacement
            const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
          }
          
          return result;
        };

        // Enrich each unit with booking type information
        // Only show units that have booking enabled (either manually created or auto-created via isListed=true)
        const enrichedUnits = units
          .filter((unit) => {
            // Show units that have bookingEnabled=true OR have custom booking settings
            // This includes both manually created booking types and auto-created ones from isListed=true
            return unit.bookingEnabled === true || 
                   unit.customEventName !== null || 
                   unit.customBookingMode !== null ||
                   unit.customEventDuration !== null;
          })
          .map((unit) => {
            // If booking type was explicitly deleted, don't show any booking type
            if (unit.bookingTypeDeleted) {
              return {
                ...unit,
                bookingTypeName: null,
                bookingTypeMode: null,
              };
            }
            
            // Otherwise, show custom booking type OR inherit from property
            const rawBookingTypeName = unit.customEventName || settings[0]?.eventName || null;
            // Replace variables in booking type name for display
            const bookingTypeName = rawBookingTypeName ? replaceVariables(rawBookingTypeName, unit, property) : null;
            const bookingTypeMode = unit.customBookingMode || settings[0]?.bookingMode || null;
            const bookingTypeEventDuration = unit.customEventDuration !== null && unit.customEventDuration !== undefined 
              ? unit.customEventDuration 
              : settings[0]?.eventDuration || null;
            
            return {
              ...unit,
              bookingTypeName,
              bookingTypeMode,
              bookingTypeEventDuration,
            };
          });
        
        return {
          ...property,
          listedUnits: enrichedUnits, // Renamed from listedUnits but keeping name for API compatibility
          bookingEnabled: settings[0]?.bookingEnabled,
          hasSchedulingSettings: settings.length > 0
        };
      })
    );
    
    if (includeAll) {
      // For booking type creation: return all properties with units
      return propertiesWithUnits.filter(p => p.listedUnits.length > 0);
    } else {
      // For scheduling page: only properties with booking types configured
      return propertiesWithUnits.filter(p => p.listedUnits.length > 0 && p.hasSchedulingSettings);
    }
  }

  async getProperty(id: string, orgId: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(and(eq(properties.id, id), eq(properties.orgId, orgId))).limit(1);
    return result[0];
  }

  async getPropertyPublic(id: string): Promise<Property | undefined> {
    const result = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
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

  async updatePropertyDisplayOrder(id: string, displayOrder: number, orgId: string): Promise<Property | undefined> {
    const result = await db.update(properties)
      .set({ displayOrder })
      .where(and(eq(properties.id, id), eq(properties.orgId, orgId)))
      .returning();
    return result[0];
  }

  async deleteProperty(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(properties).where(and(eq(properties.id, id), eq(properties.orgId, orgId))).returning();
    return result.length > 0;
  }

  // Property Unit operations
  async getAllUnitsByProperty(propertyId: string, orgId: string): Promise<PropertyUnit[]> {
    return db.select().from(propertyUnits)
      .where(and(eq(propertyUnits.propertyId, propertyId), eq(propertyUnits.orgId, orgId)))
      .orderBy(propertyUnits.unitNumber);
  }

  async getPropertyUnit(id: string, orgId: string): Promise<PropertyUnit | undefined> {
    console.log("[Storage] getPropertyUnit called:", { id, orgId });
    // First check if unit exists at all (without orgId check)
    const unitExists = await db.select().from(propertyUnits)
      .where(eq(propertyUnits.id, id))
      .limit(1);
    
    if (unitExists.length === 0) {
      console.error("[Storage] Unit does not exist in database:", { id });
      return undefined;
    }
    
    const unit = unitExists[0];
    if (unit.orgId !== orgId) {
      console.error("[Storage] Unit exists but orgId mismatch:", { 
        id, 
        unitOrgId: unit.orgId, 
        requestedOrgId: orgId 
      });
      return undefined;
    }
    
    console.log("[Storage] Unit found and orgId matches:", { id, orgId, unitNumber: unit.unitNumber });
    return unit;
  }

  async getPropertyUnitPublic(id: string): Promise<(PropertyUnit & { property: Property }) | undefined> {
    console.log("[Storage] getPropertyUnitPublic called with unitId:", id);
    
    // Get the unit first
    const unitResult = await db.select().from(propertyUnits)
      .where(eq(propertyUnits.id, id))
      .limit(1);
    
    if (!unitResult[0]) {
      console.log("[Storage] Unit not found:", id);
      return undefined;
    }
    
    const unit = unitResult[0];
    console.log("[Storage] Unit found:", unit.unitNumber, "propertyId:", unit.propertyId);
    
    // Get the property details
    const propertyResult = await db.select().from(properties)
      .where(eq(properties.id, unit.propertyId))
      .limit(1);
    
    if (!propertyResult[0]) {
      console.error("[Storage] Property not found for unit:", unit.id, "propertyId:", unit.propertyId);
      return undefined;
    }
    
    console.log("[Storage] Property found:", propertyResult[0].name);
    
    return {
      ...unit,
      property: propertyResult[0]
    };
  }

  async createPropertyUnit(unit: InsertPropertyUnit): Promise<PropertyUnit> {
    console.log("[Storage] Creating property unit with data:", unit);
    console.log("[Storage] Inserting into propertyUnits table (NOT properties table)");
    const result = await db.insert(propertyUnits).values(unit).returning();
    console.log("[Storage] Unit created successfully:", result[0]);
    console.log("[Storage] Created unit has propertyId:", result[0].propertyId, "unitNumber:", result[0].unitNumber);
    return result[0];
  }

  async updatePropertyUnit(id: string, unitData: Partial<InsertPropertyUnit>, orgId: string): Promise<PropertyUnit | undefined> {
    const result = await db.update(propertyUnits)
      .set({ ...unitData, updatedAt: new Date() })
      .where(and(eq(propertyUnits.id, id), eq(propertyUnits.orgId, orgId)))
      .returning();
    return result[0];
  }

  async updatePropertyUnitDisplayOrder(id: string, displayOrder: number, orgId: string): Promise<PropertyUnit | undefined> {
    console.log("[Storage] updatePropertyUnitDisplayOrder called:", { id, displayOrder, orgId });
    
    // First verify the unit exists and belongs to the org
    const existingUnit = await db.select().from(propertyUnits)
      .where(and(eq(propertyUnits.id, id), eq(propertyUnits.orgId, orgId)))
      .limit(1);
    
    if (existingUnit.length === 0) {
      console.error("[Storage] Unit not found or doesn't belong to org:", { id, orgId });
      return undefined;
    }
    
    console.log("[Storage] Unit found, current displayOrder:", existingUnit[0].displayOrder);
    
    const result = await db.update(propertyUnits)
      .set({ displayOrder, updatedAt: new Date() })
      .where(and(eq(propertyUnits.id, id), eq(propertyUnits.orgId, orgId)))
      .returning();
    
    console.log("[Storage] updatePropertyUnitDisplayOrder result:", { 
      id, 
      rowsAffected: result.length, 
      updatedUnit: result[0] ? { id: result[0].id, displayOrder: result[0].displayOrder } : null 
    });
    
    if (result.length === 0) {
      console.error("[Storage] Update query matched 0 rows:", { id, orgId });
      return undefined;
    }
    
    return result[0];
  }

  async deletePropertyUnit(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(propertyUnits)
      .where(and(eq(propertyUnits.id, id), eq(propertyUnits.orgId, orgId)))
      .returning();
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

  async getCalendarConnectionsWithUsers(orgId: string): Promise<Array<CalendarConnection & { userName?: string }>> {
    const result = await db
      .select({
        connection: calendarConnections,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(calendarConnections)
      .innerJoin(users, eq(calendarConnections.userId, users.id))
      .innerJoin(memberships, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.orgId, orgId),
          eq(memberships.status, 'active')
        )
      )
      .orderBy(desc(calendarConnections.createdAt));
    
    return result.map(row => ({
      ...row.connection,
      userName: row.firstName && row.lastName 
        ? `${row.firstName} ${row.lastName}` 
        : row.connection.email,
    }));
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

  async getAllCalendarEvents(orgId: string, startTime?: Date, endTime?: Date, memberId?: string): Promise<CalendarEvent[]> {
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
    
    // Always scope by organization via memberships
    // Join: calendar_events -> calendar_connections -> users -> memberships
    const baseConditions: any[] = [
      eq(memberships.orgId, orgId),
      eq(memberships.status, 'active')
    ];
    
    // If memberId is provided, additionally filter by the specific user
    if (memberId) {
      baseConditions.push(eq(calendarConnections.userId, memberId));
    }
    
    // Combine org/member conditions with time conditions
    // Always spread both arrays to ensure time filters are applied
    const allConditions = [...baseConditions, ...conditions];
    
    return db.select({
      id: calendarEvents.id,
      connectionId: calendarEvents.connectionId,
      externalId: calendarEvents.externalId,
      title: calendarEvents.title,
      description: calendarEvents.description,
      startTime: calendarEvents.startTime,
      endTime: calendarEvents.endTime,
      location: calendarEvents.location,
      attendees: calendarEvents.attendees,
      isAllDay: calendarEvents.isAllDay,
      status: calendarEvents.status,
      createdAt: calendarEvents.createdAt,
      updatedAt: calendarEvents.updatedAt,
      // Include user and provider information for color coding and source display
      userId: calendarConnections.userId,
      provider: calendarConnections.provider,
    })
      .from(calendarEvents)
      .innerJoin(calendarConnections, eq(calendarEvents.connectionId, calendarConnections.id))
      .innerJoin(users, eq(calendarConnections.userId, users.id))
      .innerJoin(memberships, eq(users.id, memberships.userId))
      .where(and(...allConditions))
      .orderBy(calendarEvents.startTime);
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
  async getSchedulePreferences(userId?: string, propertyId?: string): Promise<SchedulePreference[]> {
    const conditions = [eq(schedulePreferences.isActive, true)];
    
    if (userId) {
      conditions.push(eq(schedulePreferences.userId, userId));
    }
    if (propertyId) {
      conditions.push(eq(schedulePreferences.propertyId, propertyId));
    }
    
    return db.select().from(schedulePreferences)
      .where(and(...conditions))
      .orderBy(schedulePreferences.createdAt);
  }

  /**
   * Get schedule preferences for users at a specific level (property or unit)
   * 
   * REBUILT FROM SCRATCH - Clean inheritance model:
   * - If unitId provided: Returns unit-level preferences ONLY (unitId = provided unitId)
   * - If propertyId provided (no unitId): Returns property-level preferences ONLY (propertyId = provided, unitId IS NULL)
   * - If neither provided: Returns user-level preferences (both NULL)
   * 
   * This ensures clear separation between property-level and unit-level preferences.
   */
  async getSchedulePreferencesForUsers(userIds: string[], propertyId?: string, unitId?: string): Promise<SchedulePreference[]> {
    if (userIds.length === 0) {
      console.log("[Storage] getSchedulePreferencesForUsers: No userIds provided, returning empty array");
      return [];
    }
    
    // Build base conditions: user must be in the list and preferences must be active
    const conditions = [
      sql`${schedulePreferences.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`,
      eq(schedulePreferences.isActive, true)
    ];
    
    // Determine which level of preferences to fetch
    if (unitId) {
      // UNIT-LEVEL: Get preferences specifically for this unit
      // This is used when a unit has custom assigned members
      conditions.push(eq(schedulePreferences.unitId, unitId));
      conditions.push(eq(schedulePreferences.propertyId, propertyId || ''));
      console.log("[Storage] getSchedulePreferencesForUsers: Fetching UNIT-LEVEL preferences", { userIds, propertyId, unitId });
    } else if (propertyId) {
      // PROPERTY-LEVEL: Get preferences for this property (no unitId)
      // This is used when units inherit from property
      conditions.push(eq(schedulePreferences.propertyId, propertyId));
      conditions.push(sql`${schedulePreferences.unitId} IS NULL`);
      console.log("[Storage] getSchedulePreferencesForUsers: Fetching PROPERTY-LEVEL preferences", { userIds, propertyId });
    } else {
      // USER-LEVEL: Get global user preferences (no propertyId, no unitId)
      conditions.push(sql`${schedulePreferences.propertyId} IS NULL`);
      conditions.push(sql`${schedulePreferences.unitId} IS NULL`);
      console.log("[Storage] getSchedulePreferencesForUsers: Fetching USER-LEVEL preferences", { userIds });
    }
    
    const result = await db.select().from(schedulePreferences)
      .where(and(...conditions))
      .orderBy(schedulePreferences.userId, schedulePreferences.dayOfWeek, schedulePreferences.createdAt);
    
    console.log("[Storage] getSchedulePreferencesForUsers RESULT:", {
      userIds,
      propertyId: propertyId || 'null',
      unitId: unitId || 'null',
      level: unitId ? 'unit-level' : propertyId ? 'property-level' : 'user-level',
      found: result.length,
      preferences: result.map(p => ({ 
        id: p.id,
        userId: p.userId, 
        dayOfWeek: p.dayOfWeek, 
        startTime: p.startTime,
        endTime: p.endTime,
        propertyId: p.propertyId, 
        unitId: p.unitId 
      }))
    });
    
    return result;
  }

  async createSchedulePreference(preference: InsertSchedulePreference): Promise<SchedulePreference> {
    console.log("[Storage] createSchedulePreference input:", JSON.stringify(preference));
    const result = await db.insert(schedulePreferences).values(preference).returning();
    console.log("[Storage] createSchedulePreference result:", JSON.stringify({ id: result[0]?.id, unitId: result[0]?.unitId }));
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

  async getDemoRequestByEmail(email: string): Promise<DemoRequest | undefined> {
    const result = await db.select().from(demoRequests)
      .where(eq(demoRequests.email, email))
      .orderBy(desc(demoRequests.createdAt))
      .limit(1);
    return result[0];
  }

  async createDemoRequest(request: InsertDemoRequest): Promise<DemoRequest> {
    const result = await db.insert(demoRequests).values(request).returning();
    return result[0];
  }

  async updateDemoRequest(id: string, request: Partial<InsertDemoRequest>): Promise<DemoRequest | undefined> {
    const result = await db.update(demoRequests)
      .set(request)
      .where(eq(demoRequests.id, id))
      .returning();
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

  // Showing operations
  async getAllShowings(orgId: string): Promise<Showing[]> {
    return await db.select().from(showings)
      .where(eq(showings.orgId, orgId))
      .orderBy(desc(showings.scheduledDate), desc(showings.scheduledTime));
  }

  async getShowing(id: string, orgId: string): Promise<Showing | undefined> {
    const result = await db.select().from(showings)
      .where(and(eq(showings.id, id), eq(showings.orgId, orgId)))
      .limit(1);
    return result[0];
  }

  async getShowingsByProperty(propertyId: string, orgId: string): Promise<Showing[]> {
    return await db.select().from(showings)
      .where(and(eq(showings.propertyId, propertyId), eq(showings.orgId, orgId)))
      .orderBy(desc(showings.scheduledDate), desc(showings.scheduledTime));
  }

  async getShowingsByLead(leadId: string, orgId: string): Promise<Showing[]> {
    return await db.select().from(showings)
      .where(and(eq(showings.leadId, leadId), eq(showings.orgId, orgId)))
      .orderBy(desc(showings.scheduledDate), desc(showings.scheduledTime));
  }

  async getShowingsByDateRange(startDate: string, endDate: string, orgId: string): Promise<Showing[]> {
    return await db.select().from(showings)
      .where(and(
        eq(showings.orgId, orgId),
        gte(showings.scheduledDate, startDate),
        lte(showings.scheduledDate, endDate)
      ))
      .orderBy(showings.scheduledDate, showings.scheduledTime);
  }

  async getAISuggestedShowings(orgId: string): Promise<Showing[]> {
    return await db.select().from(showings)
      .where(and(
        eq(showings.orgId, orgId),
        eq(showings.status, 'ai_suggested')
      ))
      .orderBy(showings.scheduledDate, showings.scheduledTime);
  }

  async createShowing(showing: InsertShowing & { orgId: string }): Promise<Showing> {
    const result = await db.insert(showings).values(showing).returning();
    return result[0];
  }

  async updateShowing(id: string, showingData: Partial<InsertShowing>, orgId: string): Promise<Showing | undefined> {
    const result = await db.update(showings)
      .set({ ...showingData, updatedAt: new Date() })
      .where(and(eq(showings.id, id), eq(showings.orgId, orgId)))
      .returning();
    return result[0];
  }

  async deleteShowing(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(showings)
      .where(and(eq(showings.id, id), eq(showings.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  // Property Scheduling Settings operations
  async getPropertySchedulingSettings(propertyId: string, orgId: string): Promise<PropertySchedulingSettings | undefined> {
    const result = await db.select().from(propertySchedulingSettings)
      .where(and(
        eq(propertySchedulingSettings.propertyId, propertyId),
        eq(propertySchedulingSettings.orgId, orgId)
      ))
      .limit(1);
    return result[0];
  }

  async getAllPropertySchedulingSettings(orgId: string): Promise<PropertySchedulingSettings[]> {
    return await db.select().from(propertySchedulingSettings)
      .where(eq(propertySchedulingSettings.orgId, orgId));
  }

  async createPropertySchedulingSettings(settings: InsertPropertySchedulingSettings & { orgId: string }): Promise<PropertySchedulingSettings> {
    const result = await db.insert(propertySchedulingSettings).values(settings).returning();
    return result[0];
  }

  async updatePropertySchedulingSettings(propertyId: string, settingsData: Partial<InsertPropertySchedulingSettings>, orgId: string): Promise<PropertySchedulingSettings | undefined> {
    // Asymmetric cascade: Only cascade when DISABLING property booking
    if (settingsData.bookingEnabled !== undefined) {
      const existing = await this.getPropertySchedulingSettings(propertyId, orgId);
      if (existing) {
        const wasEnabled = existing.bookingEnabled ?? true;
        const willBeEnabled = settingsData.bookingEnabled;
        
        // Only cascade when changing from enabled to disabled
        // When disabling: all listed units disabled (units cannot accept bookings when property is off)
        // When enabling: units remain at their individual settings (must be manually enabled)
        if (wasEnabled && !willBeEnabled) {
          await db.update(propertyUnits)
            .set({ bookingEnabled: false, updatedAt: new Date() })
            .where(and(
              eq(propertyUnits.propertyId, propertyId),
              eq(propertyUnits.orgId, orgId),
              eq(propertyUnits.isListed, true) // Only cascade to listed units
            ));
        }
      }
    }
    
    const result = await db.update(propertySchedulingSettings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(and(
        eq(propertySchedulingSettings.propertyId, propertyId),
        eq(propertySchedulingSettings.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async deletePropertySchedulingSettings(propertyId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(propertySchedulingSettings)
      .where(and(
        eq(propertySchedulingSettings.propertyId, propertyId),
        eq(propertySchedulingSettings.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Unit Scheduling Settings operations
  async getUnitSchedulingSettings(unitId: string, orgId: string): Promise<{ 
    bookingEnabled: boolean; 
    customEventName: string | null; 
    customEventDescription: string | null; 
    customAssignedMembers: any | null;
    customPreferredTimes: any | null;
    customBookingMode: string | null;
    customEventDuration: number | null;
    customBufferTime: number | null;
    customLeadTime: number | null;
    customReminderSettings: any | null;
  } | undefined> {
    const result = await db.select({
      bookingEnabled: propertyUnits.bookingEnabled,
      customEventName: propertyUnits.customEventName,
      customEventDescription: propertyUnits.customEventDescription,
      customAssignedMembers: propertyUnits.customAssignedMembers,
      customPreferredTimes: propertyUnits.customPreferredTimes,
      customBookingMode: propertyUnits.customBookingMode,
      customEventDuration: propertyUnits.customEventDuration,
      customBufferTime: propertyUnits.customBufferTime,
      customLeadTime: propertyUnits.customLeadTime,
      customReminderSettings: propertyUnits.customReminderSettings,
    }).from(propertyUnits)
      .where(and(
        eq(propertyUnits.id, unitId),
        eq(propertyUnits.orgId, orgId)
      ))
      .limit(1);
    return result[0];
  }

  async updateUnitSchedulingSettings(unitId: string, settings: { 
    bookingEnabled?: boolean; 
    customEventName?: string | null; 
    customEventDescription?: string | null; 
    customAssignedMembers?: any | null;
    customPreferredTimes?: any | null;
    customBookingMode?: string | null;
    customEventDuration?: number | null;
    customBufferTime?: number | null;
    customLeadTime?: number | null;
    customReminderSettings?: any | null;
  }, orgId: string): Promise<PropertyUnit | undefined> {
    // Fetch current unit to compute final state after update
    const currentUnit = await this.getUnitSchedulingSettings(unitId, orgId);
    if (!currentUnit) {
      throw new Error("Unit not found");
    }
    
    // Compute final state: what will be in DB after applying this update
    // For each field: if provided in settings (even if null), use it; otherwise keep current value
    const finalEventName = 'customEventName' in settings ? settings.customEventName : currentUnit.customEventName;
    const finalEventDescription = 'customEventDescription' in settings ? settings.customEventDescription : currentUnit.customEventDescription;
    const finalAssignedMembers = 'customAssignedMembers' in settings ? settings.customAssignedMembers : currentUnit.customAssignedMembers;
    const finalPreferredTimes = 'customPreferredTimes' in settings ? settings.customPreferredTimes : currentUnit.customPreferredTimes;
    const finalBookingMode = 'customBookingMode' in settings ? settings.customBookingMode : (currentUnit as any).customBookingMode;
    const finalEventDuration = 'customEventDuration' in settings ? settings.customEventDuration : (currentUnit as any).customEventDuration;
    const finalBufferTime = 'customBufferTime' in settings ? settings.customBufferTime : (currentUnit as any).customBufferTime;
    const finalLeadTime = 'customLeadTime' in settings ? settings.customLeadTime : (currentUnit as any).customLeadTime;
    const finalReminderSettings = 'customReminderSettings' in settings ? settings.customReminderSettings : (currentUnit as any).customReminderSettings;
    
    // Check if ANY custom settings will exist in final state (not null)
    const hasCustomSettings = 
      finalEventName !== null ||
      finalEventDescription !== null ||
      finalAssignedMembers !== null ||
      finalPreferredTimes !== null ||
      finalBookingMode !== null ||
      finalEventDuration !== null ||
      finalBufferTime !== null ||
      finalLeadTime !== null ||
      finalReminderSettings !== null;
    
    const result = await db.update(propertyUnits)
      .set({ 
        ...settings, 
        hasCustomBookingType: hasCustomSettings,
        bookingTypeDeleted: false, // Reset deletion flag when updating settings
        updatedAt: new Date() 
      })
      .where(and(
        eq(propertyUnits.id, unitId),
        eq(propertyUnits.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async deleteUnitSchedulingSettings(unitId: string, orgId: string): Promise<boolean> {
    // Clear custom scheduling settings and mark as explicitly deleted
    const result = await db.update(propertyUnits)
      .set({
        hasCustomBookingType: false,
        bookingTypeDeleted: true, // Mark as explicitly deleted to prevent inheritance
        customEventName: null,
        customEventDescription: null,
        customAssignedMembers: null,
        customPreferredTimes: null,
        updatedAt: new Date()
      })
      .where(and(
        eq(propertyUnits.id, unitId),
        eq(propertyUnits.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  async applyPropertySettingsToUnits(propertyId: string, settings: {
    eventName?: string;
    bookingMode?: "one_to_one" | "group";
    eventDuration?: number;
    bufferTime?: number;
    leadTime?: number;
    eventDescription?: string;
    assignedMembers?: AssignedMember[];
    reminderSettings?: any;
    enableBooking?: boolean; // Optional: enable booking when applying settings (for creation flow)
  }, orgId: string, unitIds?: string[]): Promise<number> {
    // When applying property-level settings to units, we need to CLEAR the specific custom unit-level settings
    // that are being applied, so that units inherit from the property-level settings instead of having their own overrides
    
    // First, verify that only the fields we want to apply are present in settings
    // This is a safety check to ensure we don't accidentally clear fields that shouldn't be cleared
    const allowedKeys = ['eventName', 'bookingMode', 'eventDuration', 'bufferTime', 'leadTime', 
                        'eventDescription', 'assignedMembers', 'reminderSettings', 'enableBooking'];
    const settingsKeys = Object.keys(settings);
    const hasOnlyAllowedKeys = settingsKeys.every(key => allowedKeys.includes(key));
    if (!hasOnlyAllowedKeys) {
      throw new Error(`Invalid settings keys: ${settingsKeys.filter(k => !allowedKeys.includes(k)).join(', ')}`);
    }
    
    const updateData: any = {};
    
    // Clear only the custom unit-level settings that correspond to the property-level settings being applied
    // This ensures units inherit the property-level values instead of using their custom overrides
    // IMPORTANT: Only add to updateData if the key exists AND has a non-undefined value
    // This ensures we only clear fields that are explicitly being applied
    if ('eventName' in settings && settings.eventName !== undefined) {
      updateData.customEventName = null; // Clear custom event name - unit will use property-level
    }
    if ('eventDescription' in settings && settings.eventDescription !== undefined) {
      updateData.customEventDescription = null; // Clear custom event description - unit will use property-level
    }
    if ('assignedMembers' in settings && settings.assignedMembers !== undefined) {
      updateData.customAssignedMembers = null; // Clear custom assigned members - unit will use property-level
    }
    if ('bookingMode' in settings && settings.bookingMode !== undefined) {
      updateData.customBookingMode = null; // Clear custom booking mode - unit will use property-level
    }
    if ('eventDuration' in settings && settings.eventDuration !== undefined) {
      updateData.customEventDuration = null; // Clear custom event duration - unit will use property-level
    }
    if ('bufferTime' in settings && settings.bufferTime !== undefined) {
      updateData.customBufferTime = null; // Clear custom buffer time - unit will use property-level
    }
    if ('leadTime' in settings && settings.leadTime !== undefined) {
      updateData.customLeadTime = null; // Clear custom lead time - unit will use property-level
    }
    if ('reminderSettings' in settings && settings.reminderSettings !== undefined) {
      updateData.customReminderSettings = null; // Clear custom reminder settings - unit will use property-level
    }
    
    // Debug logging to verify only intended fields are being cleared
    console.log('[applyPropertySettingsToUnits] Settings received:', Object.keys(settings));
    console.log('[applyPropertySettingsToUnits] Fields to clear:', Object.keys(updateData));
    
    if (Object.keys(updateData).length > 0) {
      updateData.bookingTypeDeleted = false; // Clear any previous deletion flag
    }
    
    // If enableBooking is explicitly set, set booking enabled state
    if ('enableBooking' in settings && settings.enableBooking !== undefined) {
      updateData.bookingEnabled = settings.enableBooking;
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      return 0;
    }

    updateData.updatedAt = new Date();

    // Build where clause: always filter by propertyId and orgId
    const whereConditions = [
      eq(propertyUnits.propertyId, propertyId),
      eq(propertyUnits.orgId, orgId)
    ];

    // If specific unitIds provided, filter to those units only
    if (unitIds && unitIds.length > 0) {
      whereConditions.push(inArray(propertyUnits.id, unitIds));
    }

    // We need to recalculate hasCustomBookingType after clearing fields
    // First, get all units that will be updated to check their current custom fields
    const unitsToUpdate = await db.select({
      id: propertyUnits.id,
      customEventName: propertyUnits.customEventName,
      customEventDescription: propertyUnits.customEventDescription,
      customAssignedMembers: propertyUnits.customAssignedMembers,
      customPreferredTimes: propertyUnits.customPreferredTimes,
      customBookingMode: propertyUnits.customBookingMode,
      customEventDuration: propertyUnits.customEventDuration,
      customBufferTime: propertyUnits.customBufferTime,
      customLeadTime: propertyUnits.customLeadTime,
      customReminderSettings: propertyUnits.customReminderSettings,
    })
      .from(propertyUnits)
      .where(and(...whereConditions));

    // Update each unit individually so we can recalculate hasCustomBookingType correctly
    let updatedCount = 0;
    for (const unit of unitsToUpdate) {
      // Compute what the custom fields will be after the update
      // Only clear fields that are explicitly in the settings object
      const finalCustomEventName = settings.eventName !== undefined ? null : unit.customEventName;
      const finalCustomEventDescription = settings.eventDescription !== undefined ? null : unit.customEventDescription;
      const finalCustomAssignedMembers = settings.assignedMembers !== undefined ? null : unit.customAssignedMembers;
      const finalCustomBookingMode = settings.bookingMode !== undefined ? null : unit.customBookingMode;
      const finalCustomEventDuration = settings.eventDuration !== undefined ? null : unit.customEventDuration;
      const finalCustomBufferTime = settings.bufferTime !== undefined ? null : unit.customBufferTime;
      const finalCustomLeadTime = settings.leadTime !== undefined ? null : unit.customLeadTime;
      const finalCustomReminderSettings = settings.reminderSettings !== undefined ? null : unit.customReminderSettings;
      
      // Check if any custom settings will remain after clearing the selected ones
      const hasCustomSettings = 
        finalCustomEventName !== null ||
        finalCustomEventDescription !== null ||
        finalCustomAssignedMembers !== null ||
        (unit.customPreferredTimes as any) !== null ||
        finalCustomBookingMode !== null ||
        finalCustomEventDuration !== null ||
        finalCustomBufferTime !== null ||
        finalCustomLeadTime !== null ||
        finalCustomReminderSettings !== null;
      
      // Build the update data for this specific unit
      // IMPORTANT: Only include fields that are explicitly being cleared (in updateData)
      // Do NOT include any other fields - they should remain unchanged
      const unitUpdateData: any = {};
      
      // Only copy fields that are EXPLICITLY in updateData (i.e., fields being cleared)
      // Use 'in' operator to check if key exists, not just if value is undefined
      if ('customEventName' in updateData) {
        unitUpdateData.customEventName = null;
      }
      if ('customEventDescription' in updateData) {
        unitUpdateData.customEventDescription = null;
      }
      if ('customAssignedMembers' in updateData) {
        unitUpdateData.customAssignedMembers = null;
      }
      if ('customBookingMode' in updateData) {
        unitUpdateData.customBookingMode = null;
      }
      if ('customEventDuration' in updateData) {
        unitUpdateData.customEventDuration = null;
      }
      if ('customBufferTime' in updateData) {
        unitUpdateData.customBufferTime = null;
      }
      if ('customLeadTime' in updateData) {
        unitUpdateData.customLeadTime = null;
      }
      if ('customReminderSettings' in updateData) {
        unitUpdateData.customReminderSettings = null;
      }
      
      // Debug logging to verify what's being updated
      const fieldsBeingCleared = Object.keys(unitUpdateData).filter(k => k.startsWith('custom'));
      console.log(`[applyPropertySettingsToUnits] Unit ${unit.id}: Clearing fields:`, fieldsBeingCleared);
      console.log(`[applyPropertySettingsToUnits] Unit ${unit.id}: updateData keys:`, Object.keys(updateData));
      
      // Always update these flags
      unitUpdateData.hasCustomBookingType = hasCustomSettings;
      unitUpdateData.bookingTypeDeleted = false;
      unitUpdateData.updatedAt = new Date();
      
      // Only include bookingEnabled if it's being set
      if (updateData.bookingEnabled !== undefined) {
        unitUpdateData.bookingEnabled = updateData.bookingEnabled;
      }
      
      await db.update(propertyUnits)
        .set(unitUpdateData)
        .where(eq(propertyUnits.id, unit.id));
      
      updatedCount++;
    }
    
    return updatedCount;
  }

  async togglePropertyBooking(propertyId: string, enabled: boolean, orgId: string): Promise<PropertySchedulingSettings | undefined> {
    // Update property-level booking toggle
    const result = await db.update(propertySchedulingSettings)
      .set({ bookingEnabled: enabled, updatedAt: new Date() })
      .where(and(
        eq(propertySchedulingSettings.propertyId, propertyId),
        eq(propertySchedulingSettings.orgId, orgId)
      ))
      .returning();
    
    // Cascade to all units with booking types: enable/disable all unit bookings when property booking is toggled
    // When enabling: all units with booking types are enabled
    // When disabling: all units with booking types are disabled (units cannot accept bookings when property is off)
    // Update all units that either:
    // 1. Are listed (isListed = true), OR
    // 2. Have custom booking settings (hasCustomBookingType = true), OR
    // 3. Have a custom event name (customEventName is not null)
    // This ensures we catch all units that are part of the booking system
    const updatedUnits = await db.update(propertyUnits)
      .set({ bookingEnabled: enabled, updatedAt: new Date() })
      .where(and(
        eq(propertyUnits.propertyId, propertyId),
        eq(propertyUnits.orgId, orgId),
        or(
          eq(propertyUnits.isListed, true),
          eq(propertyUnits.hasCustomBookingType, true),
          isNotNull(propertyUnits.customEventName)
        )
      ))
      .returning();
    
    console.log(`[Storage] togglePropertyBooking: Updated ${updatedUnits.length} units for property ${propertyId}, bookingEnabled=${enabled}`);
    if (updatedUnits.length > 0) {
      console.log(`[Storage] togglePropertyBooking: Updated unit IDs:`, updatedUnits.map(u => u.id));
    }
    
    return result[0];
  }

  async getPropertyWithBookingEnabledUnits(propertyId: string): Promise<(Property & { units: PropertyUnit[] }) | undefined> {
    // Get property (no org scoping for public access)
    const propertyResult = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!propertyResult[0]) {
      return undefined;
    }
    const property = propertyResult[0];

    // Get property scheduling settings to check property-level booking toggle
    const settingsResult = await db.select().from(propertySchedulingSettings)
      .where(eq(propertySchedulingSettings.propertyId, propertyId))
      .limit(1);
    
    // If property booking is disabled, return empty units
    if (settingsResult[0] && !settingsResult[0].bookingEnabled) {
      return {
        ...property,
        units: []
      };
    }

    // Get all units for this property that have booking enabled (bookingEnabled = true)
    // Note: isListed is not required - if booking is enabled, the unit should be available
    const units = await db.select().from(propertyUnits)
      .where(and(
        eq(propertyUnits.propertyId, propertyId),
        eq(propertyUnits.bookingEnabled, true)
      ));

    return {
      ...property,
      units
    };
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
    
    // Automatically create organization if user doesn't have one and organization name is provided
    try {
      const userOrg = await this.getUserOrganization(userId);
      if (!userOrg && intake.organizationName) {
        const org = await this.createOrganization(intake.organizationName.trim(), userId);
        console.log(`[Onboarding] Auto-created organization "${org.name}" (${org.id}) for user ${userId} from onboarding`);
        
        // Update user's currentOrgId to the newly created organization
        await this.updateUser(userId, { currentOrgId: org.id });
        console.log(`[Onboarding] Set currentOrgId to ${org.id} for user ${userId}`);
      }
    } catch (error) {
      console.error("[Onboarding] Failed to create organization:", error);
      // Don't fail the linking if organization creation fails
    }
    
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

  // Ensure user has organization from their linked onboarding intake (if they have one but no org)
  async ensureOrganizationFromOnboarding(userId: string): Promise<void> {
    try {
      // Check if user already has an organization
      const userOrg = await this.getUserOrganization(userId);
      if (userOrg) {
        return; // User already has an org, nothing to do
      }

      // Find any linked onboarding intake for this user
      const allIntakes = await this.getAllOnboardingIntakes();
      const linkedIntake = allIntakes.find(
        intake => intake.linkedUserId === userId && (intake.status === 'completed' || intake.status === 'linked')
      );

      if (linkedIntake && linkedIntake.organizationName) {
        // Create organization from onboarding data
        const org = await this.createOrganization(linkedIntake.organizationName.trim(), userId);
        console.log(`[Onboarding] Auto-created organization "${org.name}" (${org.id}) for user ${userId} from existing onboarding intake`);
        
        // Update user's currentOrgId
        await this.updateUser(userId, { currentOrgId: org.id });
        console.log(`[Onboarding] Set currentOrgId to ${org.id} for user ${userId}`);
      }
    } catch (error) {
      console.error("[Onboarding] Error ensuring organization from onboarding:", error);
      // Don't throw - this is a best-effort operation
    }
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

  // RBAC: Invitation operations
  async getInvitations(orgId: string): Promise<Invitation[]> {
    return db.select().from(invitations)
      .where(eq(invitations.orgId, orgId))
      .orderBy(invitations.createdAt);
  }

  async getInvitation(id: string, orgId: string): Promise<Invitation | undefined> {
    const result = await db.select().from(invitations)
      .where(and(eq(invitations.id, id), eq(invitations.orgId, orgId)))
      .limit(1);
    return result[0];
  }

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const result = await db.select().from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);
    return result[0];
  }

  async createInvitation(invitation: InsertInvitation & { orgId: string }): Promise<Invitation> {
    const result = await db.insert(invitations).values(invitation).returning();
    return result[0];
  }

  async acceptInvitation(token: string, userId: string): Promise<Membership | null> {
    try {
      // Get invitation
      const invitation = await this.getInvitationByToken(token);
      if (!invitation || invitation.status !== 'pending') {
        return null;
      }

      // Check if not expired
      if (new Date() > new Date(invitation.expiresAt)) {
        await db.update(invitations)
          .set({ status: 'expired' })
          .where(eq(invitations.id, invitation.id));
        return null;
      }

      // Create or update membership
      const existingMembership = await db.select().from(memberships)
        .where(and(
          eq(memberships.userId, userId),
          eq(memberships.orgId, invitation.orgId)
        ))
        .limit(1);

      let membership;
      if (existingMembership.length > 0) {
        // Update existing membership
        const updated = await db.update(memberships)
          .set({
            role: invitation.role,
            status: 'active',
            updatedAt: new Date()
          })
          .where(eq(memberships.id, existingMembership[0].id))
          .returning();
        membership = updated[0];
      } else {
        // Create new membership
        const created = await db.insert(memberships).values({
          userId,
          orgId: invitation.orgId,
          role: invitation.role,
          status: 'active',
        }).returning();
        membership = created[0];
      }

      // Mark invitation as accepted
      await db.update(invitations)
        .set({ status: 'accepted', acceptedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      // Switch user's current organization to the newly joined one
      await db.update(users)
        .set({ currentOrgId: invitation.orgId })
        .where(eq(users.id, userId));

      return membership;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      return null;
    }
  }

  async revokeInvitation(id: string, orgId: string): Promise<boolean> {
    const result = await db.update(invitations)
      .set({ status: 'revoked' })
      .where(and(eq(invitations.id, id), eq(invitations.orgId, orgId)))
      .returning();
    return result.length > 0;
  }

  async cleanupExpiredInvitations(orgId: string): Promise<number> {
    const result = await db.update(invitations)
      .set({ status: 'expired' })
      .where(and(
        eq(invitations.orgId, orgId),
        eq(invitations.status, 'pending'),
        sql`${invitations.expiresAt} < NOW()`
      ))
      .returning();
    return result.length;
  }

  // RBAC: Property Assignment operations
  async getPropertyAssignments(userId: string): Promise<PropertyAssignment[]> {
    return db.select().from(propertyAssignments)
      .where(eq(propertyAssignments.userId, userId));
  }

  async getPropertyAssignmentsByProperty(propertyId: string): Promise<PropertyAssignment[]> {
    return db.select().from(propertyAssignments)
      .where(eq(propertyAssignments.propertyId, propertyId));
  }

  async createPropertyAssignment(assignment: InsertPropertyAssignment): Promise<PropertyAssignment> {
    const result = await db.insert(propertyAssignments).values(assignment).returning();
    return result[0];
  }

  async deletePropertyAssignment(userId: string, propertyId: string): Promise<boolean> {
    const result = await db.delete(propertyAssignments)
      .where(and(
        eq(propertyAssignments.userId, userId),
        eq(propertyAssignments.propertyId, propertyId)
      ))
      .returning();
    return result.length > 0;
  }

  async isUserAssignedToProperty(userId: string, propertyId: string): Promise<boolean> {
    const result = await db.select().from(propertyAssignments)
      .where(and(
        eq(propertyAssignments.userId, userId),
        eq(propertyAssignments.propertyId, propertyId)
      ))
      .limit(1);
    return result.length > 0;
  }

  // RBAC: Membership operations (extended)
  // Note: getMembershipFull is already defined earlier in the class

  async getOrganizationMembers(orgId: string): Promise<Array<Membership & { user: User & { fullName?: string; avatarUrl?: string } }>> {
    const result = await db
      .select({
        membership: memberships,
        user: users
      })
      .from(memberships)
      .leftJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.orgId, orgId));
    
    return result.map(r => {
      const user = r.user!;
      // Compute fullName from firstName and lastName
      const fullName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}`.trim()
        : user.firstName || user.lastName || undefined;
      
      return {
        ...r.membership,
        user: {
          ...user,
          fullName,
          avatarUrl: user.profileImageUrl // Map profileImageUrl to avatarUrl for frontend consistency
        }
      };
    });
  }

  async updateMembershipRole(userId: string, orgId: string, role: string): Promise<Membership | undefined> {
    const result = await db.update(memberships)
      .set({ role, updatedAt: new Date() })
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async updateMembershipStatus(userId: string, orgId: string, status: string): Promise<Membership | undefined> {
    const result = await db.update(memberships)
      .set({ status, updatedAt: new Date() })
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async deleteMembership(userId: string, orgId: string): Promise<boolean> {
    // Delete property assignments first (cascading cleanup)
    await db.delete(propertyAssignments)
      .where(and(
        eq(propertyAssignments.userId, userId),
        eq(propertyAssignments.orgId, orgId)
      ));

    // Delete the membership
    const result = await db.delete(memberships)
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  async deleteUserAccount(userId: string): Promise<boolean> {
    try {
      // Get all memberships for this user to log audit trails and handle org ownership
      const userMemberships = await db.select()
        .from(memberships)
        .where(eq(memberships.userId, userId));

      // Delete all property assignments for this user across all organizations
      await db.delete(propertyAssignments)
        .where(eq(propertyAssignments.userId, userId));

      // Delete all memberships for this user
      await db.delete(memberships)
        .where(eq(memberships.userId, userId));

      // Delete all notifications for this user
      await db.delete(notifications)
        .where(eq(notifications.userId, userId));

      // Delete all invitations sent by this user (as inviter)
      // Note: Using invitedBy field (invitations.invitedBy references users.id)
      await db.delete(invitations)
        .where(eq(invitations.invitedBy, userId));

      // Delete the user record
      const result = await db.delete(users)
        .where(eq(users.id, userId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`[Storage] Error deleting user account ${userId}:`, error);
      throw error;
    }
  }

  // RBAC: Audit Log operations
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(
    orgId: string,
    filters?: {
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs).where(eq(auditLogs.orgId, orgId));

    const conditions: any[] = [eq(auditLogs.orgId, orgId)];

    if (filters?.userId) {
      conditions.push(eq(auditLogs.userId, filters.userId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.resource) {
      conditions.push(eq(auditLogs.resource, filters.resource));
    }
    if (filters?.startDate) {
      conditions.push(sql`${auditLogs.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${auditLogs.createdAt} <= ${filters.endDate}`);
    }

    return db.select().from(auditLogs)
      .where(and(...conditions))
      .orderBy(auditLogs.createdAt)
      .limit(1000); // Limit to prevent huge queries
  }

  // ==========================================
  // PRE-QUALIFICATION SYSTEM IMPLEMENTATIONS
  // ==========================================

  // Listing operations
  async getAllListings(orgId: string): Promise<Listing[]> {
    return db.select().from(listings)
      .where(eq(listings.orgId, orgId))
      .orderBy(desc(listings.createdAt));
  }

  async getListingsByProperty(propertyId: string, orgId: string): Promise<Listing[]> {
    return db.select().from(listings)
      .where(and(
        eq(listings.propertyId, propertyId),
        eq(listings.orgId, orgId)
      ))
      .orderBy(desc(listings.createdAt));
  }

  async getListing(id: string, orgId: string): Promise<Listing | undefined> {
    const result = await db.select().from(listings)
      .where(and(
        eq(listings.id, id),
        eq(listings.orgId, orgId)
      ))
      .limit(1);
    return result[0];
  }

  async getListingByUnit(unitId: string, orgId: string): Promise<Listing | undefined> {
    const result = await db.select().from(listings)
      .where(and(
        eq(listings.unitId, unitId),
        eq(listings.orgId, orgId)
      ))
      .limit(1);
    return result[0];
  }

  async getListingByUnitPublic(unitId: string): Promise<Listing | undefined> {
    const result = await db.select().from(listings)
      .where(and(
        eq(listings.unitId, unitId),
        eq(listings.status, 'active')
      ))
      .limit(1);
    return result[0];
  }

  async createListing(listing: InsertListing): Promise<Listing> {
    const result = await db.insert(listings).values({
      ...listing,
      publishedAt: new Date(),
    }).returning();
    return result[0];
  }

  async updateListing(id: string, listing: Partial<InsertListing>, orgId: string): Promise<Listing | undefined> {
    const result = await db.update(listings)
      .set({
        ...listing,
        updatedAt: new Date(),
      })
      .where(and(
        eq(listings.id, id),
        eq(listings.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async deleteListing(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(listings)
      .where(and(
        eq(listings.id, id),
        eq(listings.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Qualification Template operations
  async getQualificationTemplates(orgId: string): Promise<QualificationTemplate[]> {
    return db.select().from(qualificationTemplates)
      .where(eq(qualificationTemplates.orgId, orgId))
      .orderBy(desc(qualificationTemplates.createdAt));
  }

  async getOrgQualificationTemplate(orgId: string): Promise<QualificationTemplate | undefined> {
    const result = await db.select().from(qualificationTemplates)
      .where(and(
        eq(qualificationTemplates.orgId, orgId),
        sql`${qualificationTemplates.propertyId} IS NULL`,
        sql`${qualificationTemplates.listingId} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getPropertyQualificationTemplate(propertyId: string, orgId: string): Promise<QualificationTemplate | undefined> {
    const result = await db.select().from(qualificationTemplates)
      .where(and(
        eq(qualificationTemplates.orgId, orgId),
        eq(qualificationTemplates.propertyId, propertyId),
        sql`${qualificationTemplates.listingId} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getListingQualificationTemplate(listingId: string, orgId: string): Promise<QualificationTemplate | undefined> {
    const result = await db.select().from(qualificationTemplates)
      .where(and(
        eq(qualificationTemplates.orgId, orgId),
        eq(qualificationTemplates.listingId, listingId)
      ))
      .limit(1);
    return result[0];
  }

  async getEffectiveQualificationTemplate(unitId: string, orgId: string): Promise<QualificationTemplate | undefined> {
    const unit = await this.getPropertyUnit(unitId, orgId);
    if (!unit) return undefined;

    const listing = await this.getListingByUnit(unitId, orgId);
    
    if (listing) {
      if (!listing.preQualifyInheritFromProperty) {
        const listingTemplate = await this.getListingQualificationTemplate(listing.id, orgId);
        if (listingTemplate) return listingTemplate;
      }
    }

    const propertyTemplate = await this.getPropertyQualificationTemplate(unit.propertyId, orgId);
    if (propertyTemplate) return propertyTemplate;

    return this.getOrgQualificationTemplate(orgId);
  }

  async createQualificationTemplate(template: InsertQualificationTemplate): Promise<QualificationTemplate> {
    const result = await db.insert(qualificationTemplates).values(template).returning();
    return result[0];
  }

  async updateQualificationTemplate(id: string, template: Partial<InsertQualificationTemplate>, orgId: string): Promise<QualificationTemplate | undefined> {
    const result = await db.update(qualificationTemplates)
      .set({
        ...template,
        updatedAt: new Date(),
        version: sql`${qualificationTemplates.version} + 1`,
      })
      .where(and(
        eq(qualificationTemplates.id, id),
        eq(qualificationTemplates.orgId, orgId)
      ))
      .returning();
    return result[0];
  }

  async deleteQualificationTemplate(id: string, orgId: string): Promise<boolean> {
    const result = await db.delete(qualificationTemplates)
      .where(and(
        eq(qualificationTemplates.id, id),
        eq(qualificationTemplates.orgId, orgId)
      ))
      .returning();
    return result.length > 0;
  }

  // Lead Qualification operations
  async getLeadQualifications(leadId: string, orgId: string): Promise<LeadQualification[]> {
    return db.select().from(leadQualifications)
      .where(and(
        eq(leadQualifications.leadId, leadId),
        eq(leadQualifications.orgId, orgId)
      ))
      .orderBy(desc(leadQualifications.submittedAt));
  }

  async getLatestLeadQualification(leadId: string, listingId: string, orgId: string): Promise<LeadQualification | undefined> {
    const result = await db.select().from(leadQualifications)
      .where(and(
        eq(leadQualifications.leadId, leadId),
        eq(leadQualifications.listingId, listingId),
        eq(leadQualifications.orgId, orgId)
      ))
      .orderBy(desc(leadQualifications.submittedAt))
      .limit(1);
    return result[0];
  }

  async createLeadQualification(qualification: InsertLeadQualification): Promise<LeadQualification> {
    const result = await db.insert(leadQualifications).values(qualification).returning();
    return result[0];
  }

  async getLeadQualificationHistory(leadId: string, orgId: string): Promise<LeadQualification[]> {
    return db.select().from(leadQualifications)
      .where(and(
        eq(leadQualifications.leadId, leadId),
        eq(leadQualifications.orgId, orgId)
      ))
      .orderBy(desc(leadQualifications.submittedAt));
  }

  // Qualification Settings operations
  async getOrgQualificationSettings(orgId: string): Promise<QualificationSettings | undefined> {
    const result = await db.select().from(qualificationSettings)
      .where(and(
        eq(qualificationSettings.orgId, orgId),
        sql`${qualificationSettings.propertyId} IS NULL`
      ))
      .limit(1);
    return result[0];
  }

  async getPropertyQualificationSettings(propertyId: string, orgId: string): Promise<QualificationSettings | undefined> {
    const result = await db.select().from(qualificationSettings)
      .where(and(
        eq(qualificationSettings.orgId, orgId),
        eq(qualificationSettings.propertyId, propertyId)
      ))
      .limit(1);
    return result[0];
  }

  async getAllPropertyQualificationSettings(orgId: string): Promise<QualificationSettings[]> {
    return db.select().from(qualificationSettings)
      .where(and(
        eq(qualificationSettings.orgId, orgId),
        isNotNull(qualificationSettings.propertyId)
      ));
  }

  async upsertOrgQualificationSettings(orgId: string, settings: InsertQualificationSettings): Promise<QualificationSettings> {
    const existing = await this.getOrgQualificationSettings(orgId);
    
    if (existing) {
      const result = await db.update(qualificationSettings)
        .set({
          qualifications: settings.qualifications,
          updatedAt: new Date(),
        })
        .where(eq(qualificationSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(qualificationSettings).values({
        ...settings,
        orgId,
        propertyId: null,
      }).returning();
      return result[0];
    }
  }

  async upsertPropertyQualificationSettings(propertyId: string, orgId: string, settings: InsertQualificationSettings): Promise<QualificationSettings> {
    const existing = await this.getPropertyQualificationSettings(propertyId, orgId);
    
    if (existing) {
      const result = await db.update(qualificationSettings)
        .set({
          qualifications: settings.qualifications,
          updatedAt: new Date(),
        })
        .where(eq(qualificationSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(qualificationSettings).values({
        ...settings,
        orgId,
        propertyId,
      }).returning();
      return result[0];
    }
  }

  async deletePropertyQualificationSettings(propertyId: string, orgId: string): Promise<boolean> {
    const result = await db.delete(qualificationSettings)
      .where(and(
        eq(qualificationSettings.orgId, orgId),
        eq(qualificationSettings.propertyId, propertyId)
      ))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();

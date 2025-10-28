import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
// (blueprint:javascript_log_in_with_replit) This table is mandatory for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Multi-tenant: Organizations table
export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// User storage table
// Updated to support multiple OAuth providers (Google, Facebook, Microsoft, Apple) and email/password auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique().notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  company: text("company"),
  phone: text("phone"),
  // Auth provider fields
  provider: text("provider").notNull().default("email"), // 'google', 'facebook', 'microsoft', 'apple', 'email'
  providerId: text("provider_id"), // OAuth provider's user ID (null for email/password)
  passwordHash: text("password_hash"), // Only for email/password auth (null for OAuth)
  // Multi-tenant: Current active organization
  currentOrgId: varchar("current_org_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Multi-tenant: User-to-Organization memberships
export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").notNull().default("member"), // 'owner', 'admin', 'member'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserOrg: sql`UNIQUE (user_id, org_id)`,
}));

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  units: integer("units").notNull(),
  occupancy: integer("occupancy").notNull(),
  monthlyRevenue: text("monthly_revenue").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  propertyId: varchar("property_id").references(() => properties.id),
  propertyName: text("property_name"),
  status: text("status").notNull().default("new"),
  source: text("source").notNull(),
  aiHandled: boolean("ai_handled").default(false),
  income: text("income"),
  moveInDate: text("move_in_date"),
  qualificationScore: integer("qualification_score"),
  profileData: jsonb("profile_data"),
  gmailThreadId: text("gmail_thread_id"),
  externalId: text("external_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastContactAt: timestamp("last_contact_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  type: text("type").notNull(),
  channel: text("channel").notNull(),
  message: text("message").notNull(),
  aiGenerated: boolean("ai_generated").default(false),
  externalId: text("external_id"),
  gmailMessageId: text("gmail_message_id"), // Gmail message ID for deduplication
  emailMessageId: text("email_message_id"), // RFC 822 Message-ID header for email threading
  emailSubject: text("email_subject"),
  sourceIntegration: text("source_integration"),
  deliveryStatus: text("delivery_status"), // 'sent', 'failed', 'pending', null for non-email
  deliveryError: text("delivery_error"), // Error message if failed
  createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  content: text("content").notNull(),
  aiGenerated: boolean("ai_generated").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const integrationConfig = pgTable("integration_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }),
  service: text("service").notNull(),
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrgService: sql`UNIQUE (org_id, service)`,
}));

export const pendingReplies = pgTable("pending_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  leadName: text("lead_name").notNull(),
  leadEmail: text("lead_email").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  originalMessage: text("original_message"),
  channel: text("channel").notNull(), // 'email', 'sms', 'phone'
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'rejected', 'sent'
  threadId: text("thread_id"),
  inReplyTo: text("in_reply_to"),
  references: text("references"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Schema for email/password registration
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

// Schema for email/password login
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  lastContactAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
}).extend({
  createdAt: z.date().optional(), // Allow custom timestamp for email syncs
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
});

export const insertAISettingSchema = createInsertSchema(aiSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertIntegrationConfigSchema = createInsertSchema(integrationConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertPendingReplySchema = createInsertSchema(pendingReplies).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
});

export const calendarConnections = pgTable("calendar_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  provider: text("provider").notNull(), // 'google', 'outlook', 'icloud'
  email: text("email").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  calendarId: text("calendar_id"), // External calendar ID
  calendarName: text("calendar_name"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  connectionId: varchar("connection_id").references(() => calendarConnections.id, { onDelete: 'cascade' }).notNull(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  attendees: jsonb("attendees"),
  isAllDay: boolean("is_all_day").default(false),
  status: text("status"), // 'confirmed', 'tentative', 'cancelled'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueConnectionEvent: sql`UNIQUE (connection_id, external_id)`,
}));

export const schedulePreferences = pgTable("schedule_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  dayOfWeek: text("day_of_week").notNull(), // 'monday', 'tuesday', etc.
  startTime: text("start_time").notNull(), // '09:00'
  endTime: text("end_time").notNull(), // '17:00'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }), // Optional: for lead-specific notifications
  type: text("type").notNull(), // 'gmail_leads_found', 'lead_status_changed', etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  actionUrl: text("action_url"), // Where to navigate when clicked
  metadata: jsonb("metadata"), // Extra data like count of leads found
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track deleted leads to prevent auto-reimport by scanner unless new messages arrive
export const deletedLeads = pgTable("deleted_leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: text("email"),
  phone: text("phone"),
  gmailThreadId: text("gmail_thread_id"),
  outlookConversationId: text("outlook_conversation_id"),
  // Track the most recent message date when lead was deleted
  // Scanner will only re-import if new messages are AFTER this date
  lastMessageDate: timestamp("last_message_date").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
}, (table) => ({
  emailOrgIndex: index("deleted_leads_email_org_idx").on(table.orgId, table.email),
  threadOrgIndex: index("deleted_leads_thread_org_idx").on(table.orgId, table.gmailThreadId),
}));

export const zillowIntegrations = pgTable("zillow_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  apiKey: text("api_key").notNull(),
  webhookSecret: text("webhook_secret").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueOrg: sql`UNIQUE (org_id)`,
}));

export const zillowListings = pgTable("zillow_listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  zillowListingId: text("zillow_listing_id").notNull(),
  listingUrl: text("listing_url"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProperty: sql`UNIQUE (property_id)`,
  uniqueZillowListing: sql`UNIQUE (org_id, zillow_listing_id)`,
}));

export const insertCalendarConnectionSchema = createInsertSchema(calendarConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSchedulePreferenceSchema = createInsertSchema(schedulePreferences).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertDeletedLeadSchema = createInsertSchema(deletedLeads).omit({
  id: true,
  deletedAt: true,
});

export const insertZillowIntegrationSchema = createInsertSchema(zillowIntegrations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertZillowListingSchema = createInsertSchema(zillowListings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
// (blueprint:javascript_log_in_with_replit) UpsertUser type for Replit Auth
export type UpsertUser = typeof users.$inferInsert;

export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof properties.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;

export type InsertAISetting = z.infer<typeof insertAISettingSchema>;
export type AISetting = typeof aiSettings.$inferSelect;

export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;
export type IntegrationConfig = typeof integrationConfig.$inferSelect;

export type InsertPendingReply = z.infer<typeof insertPendingReplySchema>;
export type PendingReply = typeof pendingReplies.$inferSelect;

export type InsertCalendarConnection = z.infer<typeof insertCalendarConnectionSchema>;
export type CalendarConnection = typeof calendarConnections.$inferSelect;

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export type InsertSchedulePreference = z.infer<typeof insertSchedulePreferenceSchema>;
export type SchedulePreference = typeof schedulePreferences.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertDeletedLead = z.infer<typeof insertDeletedLeadSchema>;
export type DeletedLead = typeof deletedLeads.$inferSelect;

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof memberships.$inferSelect;

export type InsertZillowIntegration = z.infer<typeof insertZillowIntegrationSchema>;
export type ZillowIntegration = typeof zillowIntegrations.$inferSelect;

export type InsertZillowListing = z.infer<typeof insertZillowListingSchema>;
export type ZillowListing = typeof zillowListings.$inferSelect;

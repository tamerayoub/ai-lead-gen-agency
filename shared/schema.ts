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
  profileImage: text("profile_image"),
  email: text("email"),
  address: text("address"),
  phone: text("phone"),
  // Pre-qualification settings (global default for org)
  preQualifyEnabled: boolean("pre_qualify_enabled").default(false).notNull(), // Master toggle for pre-qualification
  // Founding Partner membership fields
  foundingPartnerStatus: text("founding_partner_status").default("none").notNull(), // 'none', 'active', 'cancelled', 'past_due', 'expired'
  stripeCustomerId: text("stripe_customer_id"), // Stripe customer ID for this org
  stripeSubscriptionId: text("stripe_subscription_id"), // Stripe subscription ID
  subscriptionCurrentPeriodEnd: timestamp("subscription_current_period_end"), // When current billing period ends
  subscriptionCancelledAt: timestamp("subscription_cancelled_at"), // When user requested cancellation (null if not cancelled)
  deletedAt: timestamp("deleted_at"), // When organization was deleted (soft delete - 30 days grace period)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pending subscriptions for webhooks that fire before org creation
// Used when user purchases membership before creating their organization during onboarding
export const pendingSubscriptions = pgTable("pending_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  userEmail: text("user_email").notNull(), // Email used for Stripe purchase
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull(),
  stripeSessionId: text("stripe_session_id"), // Checkout session ID for reference
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  status: text("status").notNull().default("pending"), // 'pending', 'linked', 'expired'
  linkedOrgId: varchar("linked_org_id").references(() => organizations.id), // Set when linked to an org
  linkedAt: timestamp("linked_at"), // When subscription was linked to org
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pending_sub_email").on(table.userEmail),
  index("idx_pending_sub_user").on(table.userId),
  index("idx_pending_sub_status").on(table.status),
]);

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
  // Profile completion tracking
  profileCompleted: boolean("profile_completed").default(false).notNull(),
  // Auth provider fields
  provider: text("provider").notNull().default("email"), // 'google', 'facebook', 'microsoft', 'apple', 'email'
  providerId: text("provider_id"), // OAuth provider's user ID (null for email/password)
  passwordHash: text("password_hash"), // Only for email/password auth (null for OAuth)
  // Platform admin flag (for accessing admin panel)
  isAdmin: boolean("is_admin").default(false).notNull(),
  // Terms and email subscription tracking
  termsAccepted: boolean("terms_accepted").default(false).notNull(), // Whether user accepted terms and conditions
  emailSubscription: boolean("email_subscription").default(false).notNull(), // Whether user subscribed to marketing emails
  // Multi-tenant: Current active organization
  currentOrgId: varchar("current_org_id").references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Multi-tenant: User-to-Organization memberships with RBAC
export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").notNull().default("leasing_agent"), // 'admin', 'property_manager', 'leasing_agent', 'owner_portal'
  status: text("status").notNull().default("active"), // 'active', 'pending', 'suspended'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserOrg: sql`UNIQUE (user_id, org_id)`,
}));

// Invitations for new organization members
export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  role: text("role").notNull(), // Role to assign when invitation is accepted
  token: text("token").unique().notNull(), // Hashed invitation token (SHA-256)
  status: text("status").notNull().default("pending"), // 'pending', 'accepted', 'expired', 'revoked'
  invitedBy: varchar("invited_by").references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_invitation_org").on(table.orgId),
  index("idx_invitation_email").on(table.email),
]);

// Property assignments for Property Managers and Leasing Agents
export const propertyAssignments = pgTable("property_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  assignedBy: varchar("assigned_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUserProperty: sql`UNIQUE (user_id, property_id)`,
}));

// Audit logs for RBAC-controlled actions
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  orgId: varchar("org_id").references(() => organizations.id).notNull(), // Made non-null for better filtering
  userRole: text("user_role"), // Role at time of action
  action: text("action").notNull(), // e.g., 'create_lead', 'update_property', 'send_message'
  resource: text("resource").notNull(), // e.g., 'leads', 'properties', 'conversations'
  resourceId: varchar("resource_id"), // ID of the affected resource
  allowed: boolean("allowed").notNull(), // Whether the action was allowed or denied
  statusCode: integer("status_code"), // HTTP status code (200, 403, 500, etc.)
  requestId: text("request_id"), // For correlating related actions
  details: jsonb("details"), // Additional context (payload deltas, error messages, etc.)
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_org_created").on(table.orgId, table.createdAt),
  index("idx_audit_user").on(table.userId),
  index("idx_audit_action").on(table.action),
]);

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  units: integer("units").notNull(),
  occupancy: integer("occupancy").notNull(),
  monthlyRevenue: text("monthly_revenue").notNull(),
  timezone: text("timezone").default('America/Chicago').notNull(), // IANA timezone (e.g., 'America/New_York', 'America/Los_Angeles')
  coverPhoto: text("cover_photo"), // URL to cover photo
  gallery: text("gallery").array(), // Array of image URLs
  description: text("description"), // Property description/marketing text
  amenities: text("amenities").array(), // Array of amenities (e.g., ["washer/dryer", "balcony", "parking"])
  displayOrder: integer("display_order").default(0).notNull(), // Display order for scheduling page (lower = first)
  // Pre-qualification settings (property portfolio level - inherits from org if null)
  preQualifyEnabled: boolean("pre_qualify_enabled"), // null = inherit from org, true/false = override
  preQualifyInheritFromOrg: boolean("pre_qualify_inherit_from_org").default(true).notNull(), // If true, inherit qualifications from org
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Property Units - individual units within a property
export const propertyUnits = pgTable("property_units", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  // Unit identification
  unitNumber: text("unit_number").notNull(), // e.g., "101", "A", "1" for single-family
  // Unit details
  bedrooms: integer("bedrooms").notNull(),
  bathrooms: text("bathrooms").notNull(), // e.g., "1.5", "2"
  squareFeet: integer("square_feet"),
  // Lease & financial
  monthlyRent: text("monthly_rent"),
  deposit: text("deposit"),
  leaseStartDate: text("lease_start_date"),
  leaseEndDate: text("lease_end_date"),
  // Status
  status: text("status").notNull().default("not_occupied"), // 'occupied' or 'not_occupied'
  isListed: boolean("is_listed").default(false).notNull(), // Whether unit is actively listed for bookings
  // Listing details
  description: text("description"), // Marketing description
  amenities: text("amenities").array(), // e.g., ["washer/dryer", "balcony", "parking"]
  coverPhoto: text("cover_photo"), // URL to cover photo
  photos: text("photos").array(), // Photo URLs (gallery)
  customEventDescription: text("custom_event_description"), // Override property-level event description for this unit
  // Scheduling settings (inherit from property-level if null)
  bookingEnabled: boolean("booking_enabled").default(true).notNull(), // Whether booking is enabled for this unit
  hasCustomBookingType: boolean("has_custom_booking_type").default(false).notNull(), // Tracks if unit has custom booking settings (vs inheriting from property)
  bookingTypeDeleted: boolean("booking_type_deleted").default(false).notNull(), // Tracks if unit booking type was explicitly deleted (prevents inheritance)
  customEventName: text("custom_event_name"), // Custom event name for this unit (overrides property-level)
  customAssignedMembers: jsonb("custom_assigned_members"), // Custom assigned members for this unit (overrides property-level)
  customPreferredTimes: jsonb("custom_preferred_times"), // Custom preferred time slots for this unit (overrides property-level)
  customBookingMode: text("custom_booking_mode"), // Custom booking mode for this unit (overrides property-level): 'one_to_one' or 'group'
  customEventDuration: integer("custom_event_duration"), // Custom event duration for this unit (overrides property-level) in minutes
  customBufferTime: integer("custom_buffer_time"), // Custom buffer time for this unit (overrides property-level) in minutes
  customLeadTime: integer("custom_lead_time"), // Custom lead time for this unit (overrides property-level) in minutes
  customReminderSettings: jsonb("custom_reminder_settings"), // Custom reminder settings for this unit (overrides property-level)
  // Pre-qualification settings for unit-level booking events (linked to listing if exists, otherwise inherits from property)
  preQualifyEnabled: boolean("pre_qualify_enabled"), // null = inherit from listing/property, true/false = override
  // Booking type tracking - which listing auto-created this booking type (null = manually created)
  createdFromListingId: varchar("created_from_listing_id"), // ID of the listing that auto-created this booking type
  // Metadata
  notes: text("notes"),
  displayOrder: integer("display_order").default(0).notNull(), // Display order within property (lower = first)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_unit_property").on(table.propertyId),
  index("idx_unit_status").on(table.status),
  index("idx_unit_listed").on(table.isListed),
]);

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
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
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

// Schema for profile updates (first/last name, phone, profile image)
export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(1, "Phone number is required"),
  profileImageUrl: z.string().url().optional().or(z.literal("")),
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

// Schema for email/password registration
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  agreeTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms of Use to create an account",
  }),
  agreeMarketing: z.boolean().refine((val) => val === true, {
    message: "You must agree to receive marketing communications to create an account",
  }),
});

// Schema for email/password login
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Schema for assigned members with priority
export const assignedMemberSchema = z.object({
  userId: z.string(),
  priority: z.number().int().min(1).default(1), // 1 = highest priority, higher numbers = lower priority
});

export type AssignedMember = z.infer<typeof assignedMemberSchema>;

export const insertPropertySchema = createInsertSchema(properties).omit({
  id: true,
  createdAt: true,
});

export const insertPropertyUnitSchema = createInsertSchema(propertyUnits).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  customAssignedMembers: z.array(assignedMemberSchema).nullable().optional(),
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
  autoSync: boolean("auto_sync").default(false), // Auto-sync calendar events
  lastSyncedAt: timestamp("last_synced_at"), // Track last sync time
  webhookId: text("webhook_id"), // Google Calendar watch channel ID
  webhookResourceId: text("webhook_resource_id"), // Google Calendar watch resource ID
  webhookToken: text("webhook_token"), // Secret token for webhook validation
  webhookExpiration: timestamp("webhook_expiration"), // When webhook expires
  syncToken: text("sync_token"), // Google Calendar sync token for incremental updates
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
  propertyId: varchar("property_id").references(() => properties.id),
  unitId: varchar("unit_id").references(() => propertyUnits.id), // Nullable: null = property-level, set = unit-level
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

// Property showings table - for scheduling property viewings with leads
export const showings = pgTable("showings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  unitId: varchar("unit_id").references(() => propertyUnits.id, { onDelete: 'set null' }), // Unit this showing is for (null for property-level bookings)
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  scheduledDate: text("scheduled_date").notNull(), // YYYY-MM-DD format
  scheduledTime: text("scheduled_time").notNull(), // HH:MM format (e.g., "14:00")
  durationMinutes: integer("duration_minutes").default(30).notNull(),
  showingType: text("showing_type").notNull().default("in_person"), // 'in_person', 'virtual', 'open_house'
  status: text("status").notNull().default("pending"), // 'pending', 'ai_suggested', 'approved', 'confirmed', 'completed', 'cancelled', 'no_show'
  agentId: varchar("agent_id").references(() => users.id),
  assignedTo: varchar("assigned_to").references(() => users.id), // Team member assigned to/scheduled this showing
  attendees: jsonb("attendees"), // Array of attendee objects {name, email, phone}
  location: text("location"), // Specific location details (e.g., "Meet at front entrance")
  accessMethod: text("access_method"), // 'lockbox', 'agent_present', 'owner_present'
  lockboxCode: text("lockbox_code"),
  specialInstructions: text("special_instructions"),
  aiScheduled: boolean("ai_scheduled").default(false), // Whether AI automatically scheduled this
  aiSuggestionScore: integer("ai_suggestion_score"), // AI confidence score (0-100) for suggested showings
  aiSuggestionReason: text("ai_suggestion_reason"), // Why AI suggested this time slot
  routeOptimizationData: jsonb("route_optimization_data"), // {previousShowingId, nextShowingId, distanceFromPrevious, travelTimeMinutes, optimizationScore}
  conflictFlags: jsonb("conflict_flags"), // Array of detected conflicts: [{type: 'overlap'|'travel_time'|'outside_hours', severity: 'warning'|'error', message}]
  reminderSent: boolean("reminder_sent").default(false),
  remindersSent: jsonb("reminders_sent").default([]), // Array of reminder times (in minutes) that have been sent
  feedbackNotes: text("feedback_notes"), // Post-showing feedback
  leadScore: integer("lead_score"), // Lead qualification score after showing
  interestLevel: text("interest_level"), // 'very_interested', 'interested', 'somewhat_interested', 'not_interested'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Composite indexes for multi-tenant queries with orgId
  orgDateIndex: index("showings_org_date_idx").on(table.orgId, table.scheduledDate),
  orgPropertyIndex: index("showings_org_property_idx").on(table.orgId, table.propertyId),
  orgLeadIndex: index("showings_org_lead_idx").on(table.orgId, table.leadId),
  orgStatusIndex: index("showings_org_status_idx").on(table.orgId, table.status),
  // Unique constraint to prevent double-booking same property/time slot
  uniquePropertyTimeSlot: sql`UNIQUE (org_id, property_id, scheduled_date, scheduled_time)`,
}));

// Property scheduling settings - controls how public bookings work for each property
export const propertySchedulingSettings = pgTable("property_scheduling_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  eventName: text("event_name").default("Property Showing").notNull(), // Name of the event type
  bookingMode: text("booking_mode").default("one_to_one").notNull(), // 'one_to_one' or 'group'
  eventDuration: integer("event_duration").default(30).notNull(), // Duration in minutes: 15, 30, 45, 60
  bufferTime: integer("buffer_time").default(15).notNull(), // Buffer between showings in minutes
  leadTime: integer("lead_time").default(120).notNull(), // Minimum lead time in minutes (e.g., 120 = 2 hours)
  assignedMembers: jsonb("assigned_members").default([]).notNull(), // Array of {userId: string, priority: number} objects (1=highest priority)
  eventDescription: text("event_description"), // General event description with variables like {unit_number}
  bookingEnabled: boolean("booking_enabled").default(true).notNull(), // Property-level booking toggle (cascades to all units)
  reminderSettings: jsonb("reminder_settings"), // Reminder configuration: {enabled, time, timeUnit, message, email, text}
  // Pre-qualification settings for property-level booking events (linked to property portfolio settings)
  preQualifyEnabled: boolean("pre_qualify_enabled"), // null = inherit from property portfolio, true/false = override
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueProperty: sql`UNIQUE (property_id)`,
}));

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

export const insertShowingSchema = createInsertSchema(showings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPropertySchedulingSettingsSchema = createInsertSchema(propertySchedulingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  assignedMembers: z.array(assignedMemberSchema).default([]),
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

export type InsertPropertyUnit = z.infer<typeof insertPropertyUnitSchema>;
export type PropertyUnit = typeof propertyUnits.$inferSelect;

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

export type InsertShowing = z.infer<typeof insertShowingSchema>;
export type Showing = typeof showings.$inferSelect;

export type InsertPropertySchedulingSettings = z.infer<typeof insertPropertySchedulingSettingsSchema>;
export type PropertySchedulingSettings = typeof propertySchedulingSettings.$inferSelect;

export type InsertDeletedLead = z.infer<typeof insertDeletedLeadSchema>;
export type DeletedLead = typeof deletedLeads.$inferSelect;

// Demo Requests table - for capturing demo booking leads
export const demoRequests = pgTable("demo_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isCurrentCustomer: boolean("is_current_customer").default(false),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  countryCode: text("country_code").notNull().default("+962"),
  company: text("company"),
  unitsUnderManagement: text("units_under_management").notNull(),
  managedOrOwned: text("managed_or_owned").notNull(),
  hqLocation: text("hq_location").notNull(),
  currentTools: text("current_tools"),
  agreeTerms: boolean("agree_terms").notNull().default(true),
  agreeMarketing: boolean("agree_marketing").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDemoRequestSchema = createInsertSchema(demoRequests).omit({
  id: true,
  createdAt: true,
}).extend({
  currentTools: z.string().max(200, "Please limit to 200 characters").optional(),
});

export type InsertDemoRequest = z.infer<typeof insertDemoRequestSchema>;
export type DemoRequest = typeof demoRequests.$inferSelect;

// Appointments table - for calendar bookings
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  appointmentDate: text("appointment_date").notNull(), // YYYY-MM-DD format
  appointmentTime: text("appointment_time").notNull(), // HH:MM format (e.g., "14:00")
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  unitsUnderManagement: text("units_under_management"),
  teamSize: text("team_size"),
  currentTools: text("current_tools"),
  notes: text("notes"), // Optional notes from the prospect
  status: text("status").notNull().default("scheduled"), // 'scheduled', 'completed', 'cancelled', 'no-show'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
}).extend({
  currentTools: z.string().max(200, "Please limit to 200 characters").optional(),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

// Onboarding Intakes table - for capturing pre-signup questionnaire responses
export const onboardingIntakes = pgTable("onboarding_intakes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionToken: text("session_token").notNull().unique(),
  status: text("status").notNull().default("draft"), // 'draft', 'completed', 'linked'
  
  // Questionnaire fields
  unitsOwned: text("units_owned"), // "How many units do you manage or own?"
  currentLeaseHandling: text("current_lease_handling"), // "How are you handling leases right now?"
  leaseHandlingToolName: text("lease_handling_tool_name"), // Name of the specific tool they're using
  portfolioLocation: text("portfolio_location"), // "Where is your portfolio?"
  teamSize: text("team_size"), // "What's your team size?"
  phoneNumber: text("phone_number"), // "What is your phone number for verification?"
  fullName: text("full_name"), // "What is your name?"
  organizationName: text("organization_name"), // "What is your organization name?"
  wantsDemo: boolean("wants_demo").default(false), // "Would you like to book a demo?"
  
  // Linking to user account after signup
  linkedUserId: varchar("linked_user_id").references(() => users.id, { onDelete: 'set null' }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  linkedAt: timestamp("linked_at"),
});

export const insertOnboardingIntakeSchema = createInsertSchema(onboardingIntakes).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  linkedAt: true,
});

export type InsertOnboardingIntake = z.infer<typeof insertOnboardingIntakeSchema>;
export type OnboardingIntake = typeof onboardingIntakes.$inferSelect & {
  userEmail?: string; // Joined from users table
};

// Sales Prospects table - unified view of leads from demo requests and onboarding
export const salesProspects = pgTable("sales_prospects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(), // Normalized email (lowercase, trimmed)
  primaryName: text("primary_name"), // Best available name from sources
  phone: text("phone"), // Best available phone from sources
  units: text("units"), // Units under management
  sourceSummary: text("source_summary"), // Brief description of sources (e.g., "Demo + Onboarding")
  pipelineStage: text("pipeline_stage").notNull().default("discovery"), // discovery, evaluation, probing, offer, sale, onboard
  notes: text("notes"), // Internal notes about the prospect
  lastInteractionAt: timestamp("last_interaction_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Prospect Sources - links demo requests and onboarding intakes to prospects
export const prospectSources = pgTable("prospect_sources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  prospectId: varchar("prospect_id").notNull().references(() => salesProspects.id, { onDelete: 'cascade' }),
  sourceType: text("source_type").notNull(), // 'demo' or 'onboarding'
  sourceId: varchar("source_id").notNull(), // ID from demo_requests or onboarding_intakes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSalesProspectSchema = createInsertSchema(salesProspects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProspectSourceSchema = createInsertSchema(prospectSources).omit({
  id: true,
  createdAt: true,
});

export type InsertSalesProspect = z.infer<typeof insertSalesProspectSchema>;
export type SalesProspect = typeof salesProspects.$inferSelect;

export type InsertProspectSource = z.infer<typeof insertProspectSourceSchema>;
export type ProspectSource = typeof prospectSources.$inferSelect;

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertPropertyAssignmentSchema = createInsertSchema(propertyAssignments).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof memberships.$inferSelect;

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

export type InsertPropertyAssignment = z.infer<typeof insertPropertyAssignmentSchema>;
export type PropertyAssignment = typeof propertyAssignments.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertZillowIntegration = z.infer<typeof insertZillowIntegrationSchema>;
export type ZillowIntegration = typeof zillowIntegrations.$inferSelect;

export type InsertZillowListing = z.infer<typeof insertZillowListingSchema>;
export type ZillowListing = typeof zillowListings.$inferSelect;

// ==========================================
// PRE-QUALIFICATION SYSTEM
// ==========================================

// Listings table - represents units that are actively listed for rent
// Each listing can have its own pre-qualification settings that override property-level settings
export const listings = pgTable("listings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  unitId: varchar("unit_id").references(() => propertyUnits.id, { onDelete: 'cascade' }).notNull(),
  // Listing details
  title: text("title"), // Optional custom listing title
  description: text("description"), // Marketing description for the listing
  monthlyRent: text("monthly_rent"), // Listed rent (may differ from unit's base rent)
  deposit: text("deposit"), // Listed deposit
  availableDate: text("available_date"), // When unit is available (YYYY-MM-DD)
  // Pre-qualification settings
  preQualifyEnabled: boolean("pre_qualify_enabled").default(false).notNull(), // Master toggle for this listing
  preQualifyInheritFromProperty: boolean("pre_qualify_inherit_from_property").default(true).notNull(), // If true, inherit qualifications from property
  // Booking settings
  acceptBookings: boolean("accept_bookings").default(true).notNull(), // Whether this listing accepts bookings
  // Status
  status: text("status").notNull().default("active"), // 'active', 'paused', 'leased', 'expired'
  publishedAt: timestamp("published_at"), // When listing was first published
  expiresAt: timestamp("expires_at"), // Optional expiration date
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  uniqueUnitListing: sql`UNIQUE (unit_id)`, // One active listing per unit
  orgIdx: index("listings_org_idx").on(table.orgId),
  propertyIdx: index("listings_property_idx").on(table.propertyId),
  statusIdx: index("listings_status_idx").on(table.status),
}));

// Qualification question schema for JSONB storage
export const qualificationQuestionSchema = z.object({
  id: z.string(), // Unique ID for this question
  type: z.enum(["text", "number", "boolean", "select", "multiselect"]), // Question type
  question: z.string(), // The question text
  required: z.boolean().default(true), // Whether this question is required
  isDealBreaker: z.boolean().default(false), // If true, wrong answer = instant denial
  options: z.array(z.string()).optional(), // For select/multiselect types
  validation: z.object({
    min: z.number().optional(), // For number type: minimum value
    max: z.number().optional(), // For number type: maximum value
    expectedAnswer: z.union([z.string(), z.number(), z.boolean()]).optional(), // Expected answer for deal-breaker check
    failMessage: z.string().optional(), // Message to show when answer doesn't qualify
  }).optional(),
  // Scoring system
  points: z.number().default(0).optional(), // Points awarded if answer qualifies (for scoring)
  weight: z.number().default(1).optional(), // Weight multiplier for this question's points
  scoringRules: z.object({
    // For number type: scoring based on ranges
    ranges: z.array(z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      points: z.number(),
    })).optional(),
    // For select/multiselect: points per option
    optionPoints: z.record(z.string(), z.number()).optional(),
  }).optional(),
  order: z.number().default(0), // Display order
  enabled: z.boolean().default(true), // Whether this question is currently active
});

export type QualificationQuestion = z.infer<typeof qualificationQuestionSchema>;

// Qualification templates - stores the set of pre-qualification questions at each level
// Inheritance: org (global) -> property -> listing
export const qualificationTemplates = pgTable("qualification_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  // Scope: exactly one of these should be set. If none, it's org-level (global default)
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  listingId: varchar("listing_id").references(() => listings.id, { onDelete: 'cascade' }),
  // Template settings
  name: text("name"), // Optional name for this template (e.g., "Standard Qualification")
  questions: jsonb("questions").notNull().default([]), // Array of QualificationQuestion objects
  // Behavior settings
  allMustPass: boolean("all_must_pass").default(true).notNull(), // If true, all deal-breakers must pass; if false, only configured deal-breakers
  showResultsImmediately: boolean("show_results_immediately").default(true).notNull(), // Show pass/fail immediately vs "we'll review"
  allowRetry: boolean("allow_retry").default(true).notNull(), // Allow leads to retry if they fail
  retryDelayMinutes: integer("retry_delay_minutes").default(0), // How long before retry is allowed (0 = immediate)
  // Customization
  introMessage: text("intro_message"), // Message shown before the form
  successMessage: text("success_message"), // Message shown on qualification success
  failureMessage: text("failure_message"), // Message shown on qualification failure
  // Metadata
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(), // For tracking template changes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("qualification_templates_org_idx").on(table.orgId),
  propertyIdx: index("qualification_templates_property_idx").on(table.propertyId),
  listingIdx: index("qualification_templates_listing_idx").on(table.listingId),
}));

// Lead qualification responses - stores each lead's qualification submission with timestamps
// This builds the lead's profile over time as qualifications can change
export const leadQualifications = pgTable("lead_qualifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  leadId: varchar("lead_id").references(() => leads.id, { onDelete: 'cascade' }).notNull(),
  // Context of this qualification
  templateId: varchar("template_id").references(() => qualificationTemplates.id, { onDelete: 'set null' }),
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'set null' }),
  unitId: varchar("unit_id").references(() => propertyUnits.id, { onDelete: 'set null' }),
  listingId: varchar("listing_id").references(() => listings.id, { onDelete: 'set null' }),
  // Submission data
  answers: jsonb("answers").notNull(), // {questionId: answer} mapping
  // Result
  passed: boolean("passed").notNull(), // Whether lead passed qualification
  score: integer("score"), // Optional score (percentage of qualifying answers)
  failedQuestions: jsonb("failed_questions"), // Array of question IDs that failed
  // Metadata
  ipAddress: text("ip_address"), // For fraud prevention
  userAgent: text("user_agent"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => ({
  leadIdx: index("lead_qualifications_lead_idx").on(table.leadId),
  orgIdx: index("lead_qualifications_org_idx").on(table.orgId),
  propertyIdx: index("lead_qualifications_property_idx").on(table.propertyId),
  listingIdx: index("lead_qualifications_listing_idx").on(table.listingId),
  submittedIdx: index("lead_qualifications_submitted_idx").on(table.submittedAt),
}));

// Insert schemas
export const insertListingSchema = createInsertSchema(listings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
});

export const insertQualificationTemplateSchema = createInsertSchema(qualificationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  questions: z.array(qualificationQuestionSchema).default([]),
});

export const insertLeadQualificationSchema = createInsertSchema(leadQualifications).omit({
  id: true,
  submittedAt: true,
});

// Types
export type InsertListing = z.infer<typeof insertListingSchema>;
export type Listing = typeof listings.$inferSelect;

export type InsertQualificationTemplate = z.infer<typeof insertQualificationTemplateSchema>;
export type QualificationTemplate = typeof qualificationTemplates.$inferSelect;

export type InsertLeadQualification = z.infer<typeof insertLeadQualificationSchema>;
export type LeadQualification = typeof leadQualifications.$inferSelect;

// Qualification criteria settings - stores organization and property-level qualification standards
// This is separate from qualification templates (which are for questions)
// This defines the actual criteria/standards (e.g., income must be 3x rent, credit score >= 650)
export const qualificationSettings = pgTable("qualification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  // Scope: if propertyId is null, it's org-level; otherwise it's property-level
  propertyId: varchar("property_id").references(() => properties.id, { onDelete: 'cascade' }),
  // Qualification criteria as JSONB
  qualifications: jsonb("qualifications").notNull().default([]), // Array of QualificationCriteria objects
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  orgIdx: index("qualification_settings_org_idx").on(table.orgId),
  propertyIdx: index("qualification_settings_property_idx").on(table.propertyId),
  // Ensure one org-level setting per org and one property-level setting per property
  uniqueOrgSetting: sql`UNIQUE (org_id) WHERE property_id IS NULL`,
  uniquePropertySetting: sql`UNIQUE (property_id) WHERE property_id IS NOT NULL`,
}));

export const insertQualificationSettingsSchema = createInsertSchema(qualificationSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertQualificationSettings = z.infer<typeof insertQualificationSettingsSchema>;
export type QualificationSettings = typeof qualificationSettings.$inferSelect;

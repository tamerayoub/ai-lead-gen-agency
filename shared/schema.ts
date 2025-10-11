import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
  company: text("company"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const properties = pgTable("properties", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address").notNull(),
  units: integer("units").notNull(),
  occupancy: integer("occupancy").notNull(),
  monthlyRevenue: text("monthly_revenue").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  propertyId: varchar("property_id").references(() => properties.id),
  propertyName: text("property_name").notNull(),
  status: text("status").notNull().default("new"),
  source: text("source").notNull(),
  aiHandled: boolean("ai_handled").default(false),
  income: text("income"),
  moveInDate: text("move_in_date"),
  qualificationScore: integer("qualification_score"),
  profileData: jsonb("profile_data"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const integrationConfig = pgTable("integration_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  service: text("service").notNull().unique(),
  config: jsonb("config").notNull(),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  createdAt: true,
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

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

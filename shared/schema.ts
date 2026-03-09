import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
});

export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  forkedFromId: varchar("forked_from_id"),
});

export const modules = pgTable("modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  ownerId: varchar("owner_id").notNull().references(() => users.id),
  isPublic: boolean("is_public").notNull().default(false),
  categoryLabels: text("category_labels").array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const moduleItems = pgTable("module_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moduleId: varchar("module_id").notNull().references(() => modules.id, { onDelete: "cascade" }),
  noteId: varchar("note_id").notNull().references(() => notes.id, { onDelete: "cascade" }),
  orderIndex: integer("order_index").notNull().default(0),
});

export const savedItems = pgTable("saved_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  noteId: varchar("note_id"),
  moduleId: varchar("module_id"),
  savedAt: timestamp("saved_at").notNull().defaultNow(),
});

export const collaborators = pgTable("collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").references(() => notes.id, { onDelete: "cascade" }),
  moduleId: varchar("module_id").references(() => modules.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  displayName: true,
});

export const insertNoteSchema = createInsertSchema(notes).pick({
  title: true,
  content: true,
  isPublic: true,
});

export const insertModuleSchema = createInsertSchema(modules).pick({
  title: true,
  description: true,
  isPublic: true,
  categoryLabels: true,
});

export const insertModuleItemSchema = createInsertSchema(moduleItems).pick({
  moduleId: true,
  noteId: true,
  orderIndex: true,
});

export const insertSavedItemSchema = createInsertSchema(savedItems).pick({
  noteId: true,
  moduleId: true,
});

export const insertCollaboratorSchema = createInsertSchema(collaborators).pick({
  noteId: true,
  moduleId: true,
  userId: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertModule = z.infer<typeof insertModuleSchema>;
export type Module = typeof modules.$inferSelect;
export type ModuleItem = typeof moduleItems.$inferSelect;
export type InsertModuleItem = z.infer<typeof insertModuleItemSchema>;
export type SavedItem = typeof savedItems.$inferSelect;
export type InsertSavedItem = z.infer<typeof insertSavedItemSchema>;
export type Collaborator = typeof collaborators.$inferSelect;
export type InsertCollaborator = z.infer<typeof insertCollaboratorSchema>;

import { eq, and, or, ilike, desc, sql, ne } from "drizzle-orm";
import { db } from "./db";
import {
  users, notes, modules, moduleItems, savedItems, collaborators,
  type User, type InsertUser, type Note, type InsertNote,
  type Module, type InsertModule, type ModuleItem, type InsertModuleItem,
  type SavedItem, type InsertSavedItem, type Collaborator, type InsertCollaborator,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser & { password: string }): Promise<User>;

  createNote(ownerId: string, note: InsertNote): Promise<Note>;
  getNote(id: string): Promise<Note | undefined>;
  getUserNotes(userId: string): Promise<Note[]>;
  updateNote(id: string, ownerId: string, data: Partial<InsertNote>): Promise<Note | undefined>;
  deleteNote(id: string, ownerId: string): Promise<boolean>;
  forkNote(noteId: string, userId: string): Promise<Note>;
  getPublicNotes(): Promise<(Note & { owner: { displayName: string; username: string } })[]>;

  createModule(ownerId: string, data: InsertModule): Promise<Module>;
  getModule(id: string, requesterId?: string): Promise<any>;
  getUserModules(userId: string): Promise<Module[]>;
  updateModule(id: string, ownerId: string, data: Partial<InsertModule>): Promise<Module | undefined>;
  deleteModule(id: string, ownerId: string): Promise<boolean>;
  getPublicModules(): Promise<any[]>;

  addModuleItem(moduleId: string, noteId: string): Promise<ModuleItem>;
  removeModuleItem(moduleId: string, noteId: string): Promise<boolean>;

  getSavedItems(userId: string): Promise<any[]>;
  saveItem(userId: string, data: InsertSavedItem): Promise<SavedItem>;
  removeSavedItem(id: string, userId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(data: InsertUser & { password: string }): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async createNote(ownerId: string, data: InsertNote): Promise<Note> {
    const [note] = await db.insert(notes).values({
      ...data,
      ownerId,
    }).returning();
    return note;
  }

  async getNote(id: string): Promise<Note | undefined> {
    const [note] = await db.select().from(notes).where(eq(notes.id, id));
    return note;
  }

  async getUserNotes(userId: string): Promise<Note[]> {
    return db.select().from(notes).where(eq(notes.ownerId, userId)).orderBy(desc(notes.updatedAt));
  }

  async updateNote(id: string, ownerId: string, data: Partial<InsertNote>): Promise<Note | undefined> {
    const [note] = await db.update(notes)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.ownerId, ownerId)))
      .returning();
    return note;
  }

  async deleteNote(id: string, ownerId: string): Promise<boolean> {
    const result = await db.delete(notes).where(and(eq(notes.id, id), eq(notes.ownerId, ownerId))).returning();
    return result.length > 0;
  }

  async forkNote(noteId: string, userId: string): Promise<Note> {
    const original = await this.getNote(noteId);
    if (!original) throw new Error("Note not found");
    const [forked] = await db.insert(notes).values({
      title: `${original.title} (Fork)`,
      content: original.content,
      ownerId: userId,
      isPublic: false,
      forkedFromId: original.id,
    }).returning();
    return forked;
  }

  async getPublicNotes(): Promise<(Note & { owner: { displayName: string; username: string } })[]> {
    const result = await db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        ownerId: notes.ownerId,
        isPublic: notes.isPublic,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        forkedFromId: notes.forkedFromId,
        ownerDisplayName: users.displayName,
        ownerUsername: users.username,
      })
      .from(notes)
      .innerJoin(users, eq(notes.ownerId, users.id))
      .where(eq(notes.isPublic, true))
      .orderBy(desc(notes.updatedAt));

    return result.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      ownerId: r.ownerId,
      isPublic: r.isPublic,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      forkedFromId: r.forkedFromId,
      owner: { displayName: r.ownerDisplayName, username: r.ownerUsername },
    }));
  }

  async createModule(ownerId: string, data: InsertModule): Promise<Module> {
    const [mod] = await db.insert(modules).values({
      ...data,
      ownerId,
    }).returning();
    return mod;
  }

  async getModule(id: string, requesterId?: string): Promise<any> {
    const [mod] = await db.select().from(modules).where(eq(modules.id, id));
    if (!mod) return undefined;

    const owner = await this.getUser(mod.ownerId);
    const items = await db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        ownerId: notes.ownerId,
        isPublic: notes.isPublic,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
        forkedFromId: notes.forkedFromId,
        orderIndex: moduleItems.orderIndex,
      })
      .from(moduleItems)
      .innerJoin(notes, eq(moduleItems.noteId, notes.id))
      .where(eq(moduleItems.moduleId, id))
      .orderBy(moduleItems.orderIndex);

    return {
      ...mod,
      notes: items,
      owner: owner ? { displayName: owner.displayName, username: owner.username } : null,
    };
  }

  async getUserModules(userId: string): Promise<Module[]> {
    return db.select().from(modules).where(eq(modules.ownerId, userId)).orderBy(desc(modules.updatedAt));
  }

  async updateModule(id: string, ownerId: string, data: Partial<InsertModule>): Promise<Module | undefined> {
    const [mod] = await db.update(modules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(modules.id, id), eq(modules.ownerId, ownerId)))
      .returning();
    return mod;
  }

  async deleteModule(id: string, ownerId: string): Promise<boolean> {
    const result = await db.delete(modules).where(and(eq(modules.id, id), eq(modules.ownerId, ownerId))).returning();
    return result.length > 0;
  }

  async getPublicModules(): Promise<any[]> {
    const result = await db
      .select({
        id: modules.id,
        title: modules.title,
        description: modules.description,
        ownerId: modules.ownerId,
        isPublic: modules.isPublic,
        categoryLabels: modules.categoryLabels,
        createdAt: modules.createdAt,
        updatedAt: modules.updatedAt,
        ownerDisplayName: users.displayName,
        ownerUsername: users.username,
      })
      .from(modules)
      .innerJoin(users, eq(modules.ownerId, users.id))
      .where(eq(modules.isPublic, true))
      .orderBy(desc(modules.updatedAt));

    const modulesWithCounts = await Promise.all(
      result.map(async (r) => {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(moduleItems)
          .where(eq(moduleItems.moduleId, r.id));

        return {
          id: r.id,
          title: r.title,
          description: r.description,
          ownerId: r.ownerId,
          isPublic: r.isPublic,
          categoryLabels: r.categoryLabels,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          owner: { displayName: r.ownerDisplayName, username: r.ownerUsername },
          noteCount: countResult?.count || 0,
        };
      })
    );

    return modulesWithCounts;
  }

  async addModuleItem(moduleId: string, noteId: string): Promise<ModuleItem> {
    const [maxOrder] = await db
      .select({ max: sql<number>`coalesce(max(order_index), -1)::int` })
      .from(moduleItems)
      .where(eq(moduleItems.moduleId, moduleId));

    const [item] = await db.insert(moduleItems).values({
      moduleId,
      noteId,
      orderIndex: (maxOrder?.max ?? -1) + 1,
    }).returning();
    return item;
  }

  async removeModuleItem(moduleId: string, noteId: string): Promise<boolean> {
    const result = await db.delete(moduleItems)
      .where(and(eq(moduleItems.moduleId, moduleId), eq(moduleItems.noteId, noteId)))
      .returning();
    return result.length > 0;
  }

  async getSavedItems(userId: string): Promise<any[]> {
    const items = await db.select().from(savedItems)
      .where(eq(savedItems.userId, userId))
      .orderBy(desc(savedItems.savedAt));

    const result = await Promise.all(
      items.map(async (item) => {
        let note = null;
        let module = null;

        if (item.noteId) {
          const [n] = await db
            .select({
              id: notes.id,
              title: notes.title,
              content: notes.content,
              ownerId: notes.ownerId,
              isPublic: notes.isPublic,
              createdAt: notes.createdAt,
              updatedAt: notes.updatedAt,
              forkedFromId: notes.forkedFromId,
              ownerDisplayName: users.displayName,
            })
            .from(notes)
            .innerJoin(users, eq(notes.ownerId, users.id))
            .where(eq(notes.id, item.noteId));
          if (n) {
            note = {
              id: n.id,
              title: n.title,
              content: n.content,
              ownerId: n.ownerId,
              isPublic: n.isPublic,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
              forkedFromId: n.forkedFromId,
              owner: { displayName: n.ownerDisplayName },
            };
          }
        }

        if (item.moduleId) {
          const [m] = await db
            .select({
              id: modules.id,
              title: modules.title,
              description: modules.description,
              ownerId: modules.ownerId,
              isPublic: modules.isPublic,
              categoryLabels: modules.categoryLabels,
              createdAt: modules.createdAt,
              updatedAt: modules.updatedAt,
              ownerDisplayName: users.displayName,
            })
            .from(modules)
            .innerJoin(users, eq(modules.ownerId, users.id))
            .where(eq(modules.id, item.moduleId));
          if (m) {
            module = {
              ...m,
              owner: { displayName: m.ownerDisplayName },
            };
          }
        }

        return { ...item, note, module };
      })
    );

    return result;
  }

  async saveItem(userId: string, data: InsertSavedItem): Promise<SavedItem> {
    const [item] = await db.insert(savedItems).values({
      ...data,
      userId,
    }).returning();
    return item;
  }

  async removeSavedItem(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(savedItems)
      .where(and(eq(savedItems.id, id), eq(savedItems.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();

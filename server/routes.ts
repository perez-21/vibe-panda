import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth } from "./auth";
import { storage } from "./storage";
import { insertNoteSchema, insertModuleSchema, moduleItems, modules } from "@shared/schema";
import { z } from "zod";
import TurndownService from "turndown";
import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";
import { notifyNoteShared, notifyModuleShared, notifyNoteEdited, notifyCommentAdded, notifyCommentReply } from "./notifications";

const turndown = new TurndownService();

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== "string" || displayName.trim().length < 2) {
        return res.status(400).json({ message: "Display name must be at least 2 characters" });
      }
      const updated = await storage.updateUser(req.user!.id, { displayName: displayName.trim() });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/auth/avatar", requireAuth, async (req, res) => {
    try {
      const { avatar } = req.body;
      if (!avatar || typeof avatar !== "string") {
        return res.status(400).json({ message: "Avatar data URI is required" });
      }
      if (!avatar.startsWith("data:image/")) {
        return res.status(400).json({ message: "Invalid image format" });
      }
      const maxSize = 2 * 1024 * 1024;
      if (avatar.length > maxSize) {
        return res.status(400).json({ message: "Image is too large. Maximum size is 2MB." });
      }
      const updated = await storage.updateUser(req.user!.id, { avatar });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { password, ...safeUser } = updated;
      res.json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/notes", requireAuth, async (req, res) => {
    const notes = await storage.getUserNotes(req.user!.id);
    res.json(notes);
  });

  app.post("/api/notes", requireAuth, async (req, res) => {
    try {
      const data = insertNoteSchema.parse(req.body);
      const note = await storage.createNote(req.user!.id, data);
      res.status(201).json(note);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid data" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/notes/:id", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isOwner = note.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(req.params.id, undefined, req.user!.id) : null;

    if (!isOwner && !note.isPublic && !collabRole) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json({ ...note, isOwner, collaboratorRole: collabRole });
  });

  app.patch("/api/notes/:id", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isOwner = note.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(req.params.id, undefined, req.user!.id) : null;

    if (!isOwner && collabRole !== "editor") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { title, content, isPublic, commentPositions } = req.body as {
      title?: string;
      content?: string;
      isPublic?: boolean;
      commentPositions?: { threadId: string; fromPos: number; toPos: number }[];
    };
    const updated = await storage.updateNote(req.params.id, note.ownerId, { title, content, isPublic });
    if (!updated) return res.status(404).json({ message: "Update failed" });
    if (Array.isArray(commentPositions) && commentPositions.length > 0) {
      await storage.updateCommentThreadPositions(req.params.id, commentPositions);
    }
    if (content !== undefined) {
      notifyNoteEdited(req.user!.id, req.user!.displayName, note.id, note.title, note.ownerId).catch((e) => console.error("[notifications] note_edited:", e));
    }
    res.json(updated);
  });

  app.delete("/api/notes/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteNote(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ message: "Note not found or access denied" });
    res.json({ message: "Deleted" });
  });

  app.post("/api/notes/:id/fork", requireAuth, async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });
      if (!note.isPublic && note.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Cannot fork private note" });
      }
      const forked = await storage.forkNote(req.params.id, req.user!.id);
      res.status(201).json(forked);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/notes/:id/export", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isOwner = note.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(req.params.id, undefined, req.user!.id) : null;

    if (!isOwner && !note.isPublic && !collabRole) {
      return res.status(403).json({ message: "Access denied" });
    }

    const format = (req.query.format as string) || "txt";
    const safeTitle = note.title.replace(/[^a-zA-Z0-9_\-\s]/g, "").replace(/\s+/g, "_");

    if (format === "md") {
      const markdown = turndown.turndown(note.content || "");
      const fullContent = `# ${note.title}\n\n${markdown}`;
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.md"`);
      return res.send(fullContent);
    }

    if (format === "txt") {
      const plainText = `${note.title}\n${"=".repeat(note.title.length)}\n\n${stripHtml(note.content || "")}`;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.txt"`);
      return res.send(plainText);
    }

    if (format === "pdf") {
      const htmlDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body { font-family: Georgia, serif; max-width: 700px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
        h1 { border-bottom: 2px solid #333; padding-bottom: 8px; }
        h2, h3 { margin-top: 24px; }
        code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
        pre { background: #f4f4f4; padding: 16px; border-radius: 6px; overflow-x: auto; }
        blockquote { border-left: 4px solid #ddd; margin: 16px 0; padding: 8px 16px; color: #666; }
        table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ddd; padding: 8px; text-align: left; } th { background: #f4f4f4; }
      </style></head><body><h1>${note.title}</h1>${note.content || ""}</body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}.html"`);
      return res.send(htmlDoc);
    }

    return res.status(400).json({ message: "Invalid format. Use txt, md, or pdf." });
  });

  app.get("/api/notes/:id/collaborators", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.ownerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the note owner can manage collaborators" });
    }
    const collabs = await storage.getCollaborators(req.params.id, undefined);
    res.json(collabs);
  });

  app.post("/api/notes/:id/collaborators", requireAuth, async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });
      if (note.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the note owner can add collaborators" });
      }
      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ message: "email and role are required" });

      if (!["viewer", "commenter", "editor"].includes(role)) return res.status(400).json({ message: "Role must be viewer, commenter, or editor" });

      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) return res.status(404).json({ message: "No user found with that email" });
      if (targetUser.id === req.user!.id) return res.status(400).json({ message: "Cannot add yourself as a collaborator" });

      const existingRole = await storage.getCollaboratorRole(req.params.id, undefined, targetUser.id);
      if (existingRole) return res.status(400).json({ message: "User is already a collaborator" });

      const collab = await storage.addCollaborator({ noteId: req.params.id, userId: targetUser.id, role });
      notifyNoteShared(req.user!.id, req.user!.displayName, targetUser.id, note.id, note.title, role).catch((e) => console.error("[notifications] note_shared:", e));
      res.status(201).json(collab);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/notes/:id/collaborators/:collabId", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });
    if (note.ownerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the note owner can remove collaborators" });
    }
    const removed = await storage.removeCollaborator(req.params.collabId, req.params.id);
    if (!removed) return res.status(404).json({ message: "Collaborator not found" });
    res.json({ message: "Removed" });
  });

  app.get("/api/modules", requireAuth, async (req, res) => {
    const mods = await storage.getUserModules(req.user!.id);
    res.json(mods);
  });

  app.post("/api/modules", requireAuth, async (req, res) => {
    try {
      const data = insertModuleSchema.parse(req.body);
      const mod = await storage.createModule(req.user!.id, data);
      res.status(201).json(mod);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid data" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.get("/api/modules/:id", requireAuth, async (req, res) => {
    const mod = await storage.getModule(req.params.id, req.user!.id);
    if (!mod) return res.status(404).json({ message: "Module not found" });

    const isOwner = mod.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(undefined, req.params.id, req.user!.id) : null;

    if (!isOwner && !mod.isPublic && !collabRole) {
      return res.status(403).json({ message: "Access denied" });
    }
    res.json({ ...mod, isOwner, collaboratorRole: collabRole });
  });

  app.patch("/api/modules/:id", requireAuth, async (req, res) => {
    const mod = await storage.getModule(req.params.id, req.user!.id);
    if (!mod) return res.status(404).json({ message: "Module not found" });

    const isOwner = mod.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(undefined, req.params.id, req.user!.id) : null;

    if (!isOwner && collabRole !== "editor") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { title, description, isPublic, categoryLabels } = req.body;
    if (isPublic === true && !mod.isPublic) {
      const moduleData = await storage.getModule(req.params.id, req.user!.id);
      const hasPrivateNotes = moduleData?.notes?.some((n: any) => !n.isPublic);
      if (hasPrivateNotes) {
        return res.status(400).json({ message: "Cannot make module public while it contains private notes. Remove private notes first." });
      }
    }
    const updated = await storage.updateModule(req.params.id, mod.ownerId, { title, description, isPublic, categoryLabels });
    if (!updated) return res.status(404).json({ message: "Update failed" });
    res.json(updated);
  });

  app.delete("/api/modules/:id", requireAuth, async (req, res) => {
    const deleted = await storage.deleteModule(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ message: "Module not found or access denied" });
    res.json({ message: "Deleted" });
  });

  app.post("/api/modules/:id/items", requireAuth, async (req, res) => {
    try {
      const mod = await storage.getModule(req.params.id, req.user!.id);
      if (!mod) return res.status(404).json({ message: "Module not found" });

      const isOwner = mod.ownerId === req.user!.id;
      const collabRole = !isOwner ? await storage.getCollaboratorRole(undefined, req.params.id, req.user!.id) : null;

      if (!isOwner && collabRole !== "editor") {
        return res.status(403).json({ message: "Access denied" });
      }
      const { noteId } = req.body;
      if (!noteId) return res.status(400).json({ message: "noteId is required" });
      const note = await storage.getNote(noteId);
      if (!note) return res.status(404).json({ message: "Note not found" });

      const isNoteOwner = note.ownerId === req.user!.id;
      const noteCollabRole = !isNoteOwner ? await storage.getCollaboratorRole(noteId, undefined, req.user!.id) : null;
      const canAccessNote = isNoteOwner || note.isPublic || !!noteCollabRole;
      if (!canAccessNote) {
        return res.status(403).json({ message: "You don't have access to this note" });
      }
      if (mod.isPublic && !note.isPublic) {
        return res.status(400).json({ message: "Cannot add a private note to a public module" });
      }
      const item = await storage.addModuleItem(req.params.id, noteId);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/modules/:id/items/:noteId", requireAuth, async (req, res) => {
    const mod = await storage.getModule(req.params.id, req.user!.id);
    if (!mod) return res.status(404).json({ message: "Module not found" });

    const isOwner = mod.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(undefined, req.params.id, req.user!.id) : null;

    if (!isOwner && collabRole !== "editor") {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.removeModuleItem(req.params.id, req.params.noteId);
    res.json({ message: "Removed" });
  });

  app.get("/api/modules/:id/collaborators", requireAuth, async (req, res) => {
    const mod = await storage.getModule(req.params.id, req.user!.id);
    if (!mod) return res.status(404).json({ message: "Module not found" });
    if (mod.ownerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the module owner can manage collaborators" });
    }
    const collabs = await storage.getCollaborators(undefined, req.params.id);
    res.json(collabs);
  });

  app.post("/api/modules/:id/collaborators", requireAuth, async (req, res) => {
    try {
      const mod = await storage.getModule(req.params.id, req.user!.id);
      if (!mod) return res.status(404).json({ message: "Module not found" });
      if (mod.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Only the module owner can add collaborators" });
      }
      const { email, role } = req.body;
      if (!email || !role) return res.status(400).json({ message: "email and role are required" });

      if (!["viewer", "commenter", "editor"].includes(role)) return res.status(400).json({ message: "Role must be viewer, commenter, or editor" });

      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) return res.status(404).json({ message: "No user found with that email" });
      if (targetUser.id === req.user!.id) return res.status(400).json({ message: "Cannot add yourself as a collaborator" });

      const existingRole = await storage.getCollaboratorRole(undefined, req.params.id, targetUser.id);
      if (existingRole) return res.status(400).json({ message: "User is already a collaborator" });

      const collab = await storage.addCollaborator({ moduleId: req.params.id, userId: targetUser.id, role });
      notifyModuleShared(req.user!.id, req.user!.displayName, targetUser.id, mod.id, mod.title, role).catch((e) => console.error("[notifications] module_shared:", e));
      res.status(201).json(collab);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/modules/:id/collaborators/:collabId", requireAuth, async (req, res) => {
    const mod = await storage.getModule(req.params.id, req.user!.id);
    if (!mod) return res.status(404).json({ message: "Module not found" });
    if (mod.ownerId !== req.user!.id) {
      return res.status(403).json({ message: "Only the module owner can remove collaborators" });
    }
    const removed = await storage.removeCollaborator(req.params.collabId, undefined, req.params.id);
    if (!removed) return res.status(404).json({ message: "Collaborator not found" });
    res.json({ message: "Removed" });
  });

  app.get("/api/notes/:id/modules", requireAuth, async (req, res) => {
    const userModuleIds = (await db
      .select({ id: modules.id })
      .from(modules)
      .where(eq(modules.ownerId, req.user!.id))
    ).map((m) => m.id);

    if (userModuleIds.length === 0) {
      return res.json([]);
    }

    const result = await db
      .select({ moduleId: moduleItems.moduleId })
      .from(moduleItems)
      .where(and(
        eq(moduleItems.noteId, req.params.id),
        inArray(moduleItems.moduleId, userModuleIds)
      ));
    res.json(result.map((r) => r.moduleId));
  });

  app.get("/api/notes/search/accessible", requireAuth, async (req, res) => {
    const q = req.query.q as string | undefined;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }
    const results = await storage.searchAccessibleNotes(req.user!.id, q.trim());
    res.json(results);
  });
    
  app.get("/api/notes/:id/comments", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isOwner = note.ownerId === req.user!.id;
    const collabRole = !isOwner ? await storage.getCollaboratorRole(req.params.id, undefined, req.user!.id) : null;

    if (!isOwner && !note.isPublic && !collabRole) {
      return res.status(403).json({ message: "Access denied" });
    }

    const threads = await storage.getCommentThreads(req.params.id);
    res.json(threads);
  });

  app.post("/api/notes/:id/comments", requireAuth, async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      const isOwner = note.ownerId === req.user!.id;
      const collabRole = !isOwner ? await storage.getCollaboratorRole(req.params.id, undefined, req.user!.id) : null;

      if (!isOwner && collabRole !== "editor" && collabRole !== "commenter") {
        return res.status(403).json({ message: "Access denied" });
      }

      const bodySchema = z.object({
        fromPos: z.number().int().nonnegative(),
        toPos: z.number().int().nonnegative(),
        content: z.string().min(1).max(2000),
      });

      const { fromPos, toPos, content } = bodySchema.parse(req.body);
      if (toPos <= fromPos) {
        return res.status(400).json({ message: "toPos must be greater than fromPos" });
      }

      await storage.createCommentThread(note.id, fromPos, toPos, req.user!.id, content);
      notifyCommentAdded(req.user!.id, req.user!.displayName, note.id, note.title, note.ownerId).catch((e) => console.error("[notifications] comment_added:", e));
      const threads = await storage.getCommentThreads(note.id);
      res.status(201).json(threads);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid data" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/notes/:id/comments/:threadId", requireAuth, async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) return res.status(404).json({ message: "Note not found" });

      const isOwner = note.ownerId === req.user!.id;
      const collabRole = !isOwner ? await storage.getCollaboratorRole(req.params.id, undefined, req.user!.id) : null;

      if (!isOwner && collabRole !== "editor" && collabRole !== "commenter") {
        return res.status(403).json({ message: "Access denied" });
      }

      const bodySchema = z.object({
        content: z.string().min(1).max(2000),
      });

      const { content } = bodySchema.parse(req.body);
      const existingThreads = await storage.getCommentThreads(note.id);
      const targetThread = existingThreads.find((t) => t.id === req.params.threadId);
      if (!targetThread) {
        return res.status(404).json({ message: "Comment thread not found on this note" });
      }
      await storage.addComment(req.params.threadId, req.user!.id, content);
      const uniqueParticipants = [...new Set(targetThread.comments.map((c: any) => c.userId).filter(Boolean))];
      notifyCommentReply(req.user!.id, req.user!.displayName, note.id, note.title, note.ownerId, uniqueParticipants as string[]).catch((e) => console.error("[notifications] comment_reply:", e));
      const threads = await storage.getCommentThreads(note.id);
      res.status(201).json(threads);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message || "Invalid data" });
      }
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/notes/:id/comments/:threadId", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isOwner = note.ownerId === req.user!.id;
    if (!isOwner) {
      return res.status(403).json({ message: "Only the note owner can resolve comments" });
    }

    const existingThreads = await storage.getCommentThreads(note.id);
    if (!existingThreads.some((t) => t.id === req.params.threadId)) {
      return res.status(404).json({ message: "Comment thread not found on this note" });
    }

    const thread = await storage.resolveCommentThread(req.params.threadId);
    if (!thread) return res.status(404).json({ message: "Comment thread not found" });

    const threads = await storage.getCommentThreads(note.id);
    res.json(threads);
  });

  app.delete("/api/notes/:id/comments/:threadId", requireAuth, async (req, res) => {
    const note = await storage.getNote(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found" });

    const isOwner = note.ownerId === req.user!.id;
    if (!isOwner) {
      return res.status(403).json({ message: "Only the note owner can delete comments" });
    }

    const existingThreads = await storage.getCommentThreads(note.id);
    if (!existingThreads.some((t) => t.id === req.params.threadId)) {
      return res.status(404).json({ message: "Comment thread not found on this note" });
    }

    const deleted = await storage.deleteCommentThread(req.params.threadId);
    if (!deleted) return res.status(404).json({ message: "Comment thread not found" });

    const threads = await storage.getCommentThreads(note.id);
    res.json(threads);
  });

  app.get("/api/explore/notes", requireAuth, async (req, res) => {
    const q = req.query.q as string | undefined;
    const publicNotes = await storage.getPublicNotes(q);
    res.json(publicNotes);
  });

  app.get("/api/explore/modules", requireAuth, async (req, res) => {
    const q = req.query.q as string | undefined;
    const category = req.query.category as string | undefined;
    const publicModules = await storage.getPublicModules(q, category);
    res.json(publicModules);
  });

  app.get("/api/explore/categories", requireAuth, async (_req, res) => {
    const categories = await storage.getAllCategoryLabels();
    res.json(categories);
  });

  app.get("/api/saved", requireAuth, async (req, res) => {
    const items = await storage.getSavedItems(req.user!.id);
    res.json(items);
  });

  app.post("/api/saved", requireAuth, async (req, res) => {
    try {
      const { noteId, moduleId } = req.body;
      if (!noteId && !moduleId) {
        return res.status(400).json({ message: "noteId or moduleId is required" });
      }
      if (noteId) {
        const note = await storage.getNote(noteId);
        if (!note || (!note.isPublic && note.ownerId !== req.user!.id)) {
          return res.status(403).json({ message: "Cannot save a note you don't have access to" });
        }
      }
      if (moduleId) {
        const mod = await storage.getModule(moduleId, req.user!.id);
        if (!mod || (!mod.isPublic && mod.ownerId !== req.user!.id)) {
          return res.status(403).json({ message: "Cannot save a module you don't have access to" });
        }
      }
      const item = await storage.saveItem(req.user!.id, { noteId, moduleId });
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/saved/:id", requireAuth, async (req, res) => {
    const deleted = await storage.removeSavedItem(req.params.id, req.user!.id);
    if (!deleted) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Removed" });
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    const notifs = await storage.getNotifications(req.user!.id);
    res.json(notifs);
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const count = await storage.getUnreadNotificationCount(req.user!.id);
    res.json({ count });
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    const updated = await storage.markNotificationAsRead(req.params.id, req.user!.id);
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Marked as read" });
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    await storage.markAllNotificationsAsRead(req.user!.id);
    res.json({ message: "All notifications marked as read" });
  });

  return httpServer;
}

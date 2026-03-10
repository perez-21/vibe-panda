import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth } from "./auth";
import { storage } from "./storage";
import { insertNoteSchema, insertModuleSchema } from "@shared/schema";
import { z } from "zod";
import TurndownService from "turndown";

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

    const { title, content, isPublic } = req.body;
    const updated = await storage.updateNote(req.params.id, note.ownerId, { title, content, isPublic });
    if (!updated) return res.status(404).json({ message: "Update failed" });
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
      if (!["viewer", "editor", "commenter"].includes(role)) return res.status(400).json({ message: "Role must be viewer, editor, or commenter" });

      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) return res.status(404).json({ message: "No user found with that email" });
      if (targetUser.id === req.user!.id) return res.status(400).json({ message: "Cannot add yourself as a collaborator" });

      const existingRole = await storage.getCollaboratorRole(req.params.id, undefined, targetUser.id);
      if (existingRole) return res.status(400).json({ message: "User is already a collaborator" });

      const collab = await storage.addCollaborator({ noteId: req.params.id, userId: targetUser.id, role });
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
      if (note.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "You can only add your own notes to modules" });
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
      if (!["viewer", "editor", "commenter"].includes(role)) return res.status(400).json({ message: "Role must be viewer, editor, or commenter" });

      const targetUser = await storage.getUserByEmail(email);
      if (!targetUser) return res.status(404).json({ message: "No user found with that email" });
      if (targetUser.id === req.user!.id) return res.status(400).json({ message: "Cannot add yourself as a collaborator" });

      const existingRole = await storage.getCollaboratorRole(undefined, req.params.id, targetUser.id);
      if (existingRole) return res.status(400).json({ message: "User is already a collaborator" });

      const collab = await storage.addCollaborator({ moduleId: req.params.id, userId: targetUser.id, role });
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

  return httpServer;
}

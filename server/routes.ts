import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireAuth } from "./auth";
import { storage } from "./storage";
import { insertNoteSchema, insertModuleSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

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
    if (note.ownerId !== req.user!.id && !note.isPublic) {
      return res.status(403).json({ message: "Access denied" });
    }
    const isOwner = note.ownerId === req.user!.id;
    res.json({ ...note, isOwner });
  });

  app.patch("/api/notes/:id", requireAuth, async (req, res) => {
    const { title, content, isPublic } = req.body;
    const note = await storage.updateNote(req.params.id, req.user!.id, { title, content, isPublic });
    if (!note) return res.status(404).json({ message: "Note not found or access denied" });
    res.json(note);
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
    if (mod.ownerId !== req.user!.id && !mod.isPublic) {
      return res.status(403).json({ message: "Access denied" });
    }
    const isOwner = mod.ownerId === req.user!.id;
    res.json({ ...mod, isOwner });
  });

  app.patch("/api/modules/:id", requireAuth, async (req, res) => {
    const { title, description, isPublic, categoryLabels } = req.body;
    const mod = await storage.updateModule(req.params.id, req.user!.id, { title, description, isPublic, categoryLabels });
    if (!mod) return res.status(404).json({ message: "Module not found or access denied" });
    res.json(mod);
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
      if (mod.ownerId !== req.user!.id) {
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
    if (mod.ownerId !== req.user!.id) {
      return res.status(403).json({ message: "Access denied" });
    }
    await storage.removeModuleItem(req.params.id, req.params.noteId);
    res.json({ message: "Removed" });
  });

  app.get("/api/explore/notes", requireAuth, async (_req, res) => {
    const publicNotes = await storage.getPublicNotes();
    res.json(publicNotes);
  });

  app.get("/api/explore/modules", requireAuth, async (_req, res) => {
    const publicModules = await storage.getPublicModules();
    res.json(publicModules);
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

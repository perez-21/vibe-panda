import { storage } from "./storage";

function logError(context: string, err: unknown) {
  console.error(`[notifications] ${context}:`, err instanceof Error ? err.message : err);
}

export async function notifyNoteShared(actorId: string, actorName: string, targetUserId: string, noteId: string, noteTitle: string, role: string) {
  if (actorId === targetUserId) return;
  await storage.createNotification({
    userId: targetUserId,
    actorId,
    type: "note_shared",
    title: "Note shared with you",
    message: `${actorName} shared "${noteTitle}" with you as ${role}`,
    link: `/notes/${noteId}`,
    noteId,
    moduleId: null,
  });
}

export async function notifyModuleShared(actorId: string, actorName: string, targetUserId: string, moduleId: string, moduleTitle: string, role: string) {
  if (actorId === targetUserId) return;
  await storage.createNotification({
    userId: targetUserId,
    actorId,
    type: "module_shared",
    title: "Module shared with you",
    message: `${actorName} shared "${moduleTitle}" with you as ${role}`,
    link: `/modules/${moduleId}`,
    noteId: null,
    moduleId,
  });
}

export async function notifyNoteEdited(actorId: string, actorName: string, noteId: string, noteTitle: string, noteOwnerId: string) {
  const collabs = await storage.getCollaborators(noteId, undefined);
  const targetUserIds = new Set<string>();
  targetUserIds.add(noteOwnerId);
  for (const c of collabs) {
    targetUserIds.add(c.userId);
  }
  targetUserIds.delete(actorId);

  await Promise.all(
    Array.from(targetUserIds).map((uid) =>
      storage.createNotification({
        userId: uid,
        actorId,
        type: "note_edited",
        title: "Note edited",
        message: `${actorName} edited "${noteTitle}"`,
        link: `/notes/${noteId}`,
        noteId,
        moduleId: null,
      })
    )
  );
}

export async function notifyCommentAdded(actorId: string, actorName: string, noteId: string, noteTitle: string, noteOwnerId: string) {
  const targetUserIds = new Set<string>();
  targetUserIds.add(noteOwnerId);
  targetUserIds.delete(actorId);

  await Promise.all(
    Array.from(targetUserIds).map((uid) =>
      storage.createNotification({
        userId: uid,
        actorId,
        type: "comment_added",
        title: "New comment",
        message: `${actorName} commented on "${noteTitle}"`,
        link: `/notes/${noteId}`,
        noteId,
        moduleId: null,
      })
    )
  );
}

export async function notifyCommentReply(actorId: string, actorName: string, noteId: string, noteTitle: string, noteOwnerId: string, threadParticipantIds: string[]) {
  const targetUserIds = new Set<string>();
  targetUserIds.add(noteOwnerId);
  for (const uid of threadParticipantIds) {
    targetUserIds.add(uid);
  }
  targetUserIds.delete(actorId);

  await Promise.all(
    Array.from(targetUserIds).map((uid) =>
      storage.createNotification({
        userId: uid,
        actorId,
        type: "comment_reply",
        title: "Reply to comment",
        message: `${actorName} replied to a comment on "${noteTitle}"`,
        link: `/notes/${noteId}`,
        noteId,
        moduleId: null,
      })
    )
  );
}

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import type { IncomingMessage } from "http";
import * as Y from "yjs";
import { sessionMiddleware } from "./auth";
import { storage } from "./storage";
import passport from "passport";
import {
  readSyncMessage,
  writeSyncStep1,
  writeUpdate,
} from "y-protocols/sync";
import {
  encodeAwarenessUpdate,
  applyAwarenessUpdate,
  removeAwarenessStates,
  Awareness,
} from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

function wsLog(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [ws] ${message}`);
}

interface RoomConnection {
  ws: WebSocket;
  userId: string;
  displayName: string;
  awarenessClientIds: Set<number>;
}

interface Room {
  ydoc: Y.Doc;
  awareness: Awareness;
  connections: Map<WebSocket, RoomConnection>;
  noteId: string;
  ownerId: string;
}

const rooms = new Map<string, Room>();

function getOrCreateRoom(noteId: string, ownerId: string): Room {
  let room = rooms.get(noteId);
  if (room) return room;

  const ydoc = new Y.Doc();
  const awareness = new Awareness(ydoc);

  room = {
    ydoc,
    awareness,
    connections: new Map(),
    noteId,
    ownerId,
  };

  rooms.set(noteId, room);
  return room;
}

function broadcastToRoom(room: Room, message: Uint8Array, excludeWs?: WebSocket) {
  for (const [ws] of room.connections) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}

function sendSyncStep1ToClient(ws: WebSocket, ydoc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  writeSyncStep1(encoder, ydoc);
  ws.send(encoding.toUint8Array(encoder));
}

function sendAwarenessToClient(ws: WebSocket, awareness: Awareness) {
  const states = awareness.getStates();
  if (states.size > 0) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    const update = encodeAwarenessUpdate(awareness, Array.from(states.keys()));
    encoding.writeVarUint8Array(encoder, update);
    ws.send(encoding.toUint8Array(encoder));
  }
}

export function setupWebSocket(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);

    if (url.pathname === "/vite-hmr") return;
    if (url.pathname !== "/ws") {
      return;
    }

    sessionMiddleware(request as any, {} as any, () => {
      passport.initialize()(request as any, {} as any, () => {
        passport.session()(request as any, {} as any, async () => {
          const user = (request as any).user;
          if (!user) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }

          const noteId = url.searchParams.get("noteId");
          if (!noteId) {
            socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
            socket.destroy();
            return;
          }

          const note = await storage.getNote(noteId);
          if (!note) {
            wss.handleUpgrade(request, socket, head, (ws) => {
              ws.close(4004, "Note not found");
            });
            return;
          }

          const isOwner = note.ownerId === user.id;
          const collabRole = !isOwner
            ? await storage.getCollaboratorRole(noteId, undefined, user.id)
            : null;
          if (!isOwner && collabRole !== "editor") {
            wss.handleUpgrade(request, socket, head, (ws) => {
              ws.close(4403, "Forbidden");
            });
            return;
          }

          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit("connection", ws, request, user, noteId, note.ownerId);
          });
        });
      });
    });
  });

  wss.on("connection", (ws: WebSocket, _request: IncomingMessage, user: any, noteId: string, ownerId: string) => {
    const room = getOrCreateRoom(noteId, ownerId);

    const conn: RoomConnection = {
      ws,
      userId: user.id,
      displayName: user.displayName,
      awarenessClientIds: new Set(),
    };
    room.connections.set(ws, conn);

    const docUpdateHandler = (update: Uint8Array, origin: any) => {
      if (origin === conn) return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      writeUpdate(encoder, update);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(encoding.toUint8Array(encoder));
      }
    };
    room.ydoc.on("update", docUpdateHandler);

    sendSyncStep1ToClient(ws, room.ydoc);
    sendAwarenessToClient(ws, room.awareness);

    wsLog(`${user.displayName} joined note ${noteId} (${room.connections.size} users)`);

    ws.on("message", (data: Buffer) => {
      try {
        const message = new Uint8Array(data);
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);
            readSyncMessage(decoder, encoder, room.ydoc, conn);
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case MSG_AWARENESS: {
            const update = decoding.readVarUint8Array(decoder);
            applyAwarenessUpdate(room.awareness, update, conn);

            const decoder2 = decoding.createDecoder(update);
            const len = decoding.readVarUint(decoder2);
            for (let i = 0; i < len; i++) {
              const clientId = decoding.readVarUint(decoder2);
              conn.awarenessClientIds.add(clientId);
              decoding.readVarUint8Array(decoder2);
            }

            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_AWARENESS);
            encoding.writeVarUint8Array(encoder, update);
            broadcastToRoom(room, encoding.toUint8Array(encoder), ws);
            break;
          }
        }
      } catch (err) {
        console.error("[ws] Error processing message:", err);
      }
    });

    ws.on("close", () => {
      room.ydoc.off("update", docUpdateHandler);
      room.connections.delete(ws);

      const clientIds = Array.from(conn.awarenessClientIds);
      if (clientIds.length > 0) {
        removeAwarenessStates(room.awareness, clientIds, null);
      }

      wsLog(`${user.displayName} left note ${noteId} (${room.connections.size} users)`);

      if (room.connections.size === 0) {
        room.ydoc.destroy();
        rooms.delete(noteId);
        wsLog(`Room ${noteId} closed`);
      }
    });

    ws.on("error", (err) => {
      console.error("[ws] WebSocket error:", err);
      ws.close();
    });
  });

  return wss;
}

import * as Y from "yjs";
import { Awareness } from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

type EventHandler = (...args: any[]) => void;

export class CollaborationProvider {
  doc: Y.Doc;
  awareness: Awareness;

  private ws: WebSocket | null = null;
  private noteId: string;
  private _synced = false;
  private _connected = false;
  private destroyed = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private handlers: Map<string, Set<EventHandler>> = new Map();

  constructor(noteId: string) {
    this.noteId = noteId;
    this.doc = new Y.Doc();
    this.awareness = new Awareness(this.doc);

    this.doc.on("update", (update: Uint8Array, origin: any) => {
      if (origin !== this) {
        this.sendSyncUpdate(update);
      }
    });

    this.awareness.on("update", ({ added, updated, removed }: any) => {
      const changedClients = added.concat(updated).concat(removed);
      const encodedUpdate = awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        changedClients,
      );
      this.sendAwarenessUpdate(encodedUpdate);
    });

    this.awareness.on("change", () => {
      this.emit("awareness", this.awareness.getStates());
    });

    this.connect();
  }

  private connect() {
    if (this.destroyed) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws?noteId=${this.noteId}`;

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectDelay = 1000;
      this.emit("connected");

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      this.ws?.send(encoding.toUint8Array(encoder));

      if (this.awareness.getLocalState() !== null) {
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          [this.doc.clientID],
        );
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, MSG_AWARENESS);
        encoding.writeVarUint8Array(awarenessEncoder, awarenessUpdate);
        this.ws?.send(encoding.toUint8Array(awarenessEncoder));
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = new Uint8Array(event.data as ArrayBuffer);
        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
            if (encoding.length(encoder) > 1) {
              this.ws?.send(encoding.toUint8Array(encoder));
            }
            if (!this._synced) {
              this._synced = true;
              this.emit("synced");
            }
            break;
          }
          case MSG_AWARENESS: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(
              this.awareness,
              update,
              this,
            );
            break;
          }
        }
      } catch (err) {
        console.error("[collab] Error processing message:", err);
      }
    };

    this.ws.onclose = (event) => {
      this._connected = false;
      const wasSynced = this._synced;
      this._synced = false;
      this.ws = null;
      this.emit("disconnected", { wasSynced, code: event.code });
      if (event.code !== 4403 && event.code !== 4004) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {};
  }

  private sendSyncUpdate(update: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  private sendAwarenessUpdate(update: Uint8Array) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    this.ws.send(encoding.toUint8Array(encoder));
  }

  private scheduleReconnect() {
    if (this.destroyed) return;
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      this.maxReconnectDelay,
    );
  }

  setAwarenessUser(user: { name: string; id: string; color: string }) {
    this.awareness.setLocalStateField("user", user);
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, ...args: any[]) {
    this.handlers.get(event)?.forEach((handler) => handler(...args));
  }

  get isSynced() {
    return this._synced;
  }
  get isConnected() {
    return this._connected;
  }

  destroy() {
    this.destroyed = true;
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    awarenessProtocol.removeAwarenessStates(
      this.awareness,
      [this.doc.clientID],
      null,
    );
    this.ws?.close();
    this.doc.destroy();
    this.handlers.clear();
  }
}

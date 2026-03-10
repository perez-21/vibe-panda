import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export interface CommentThreadSummary {
  id: string;
  fromPos: number;
  toPos: number;
  resolvedAt?: string | null;
}

export const commentPluginKey = new PluginKey<DecorationSet>("comment-decorations");

function buildDecorations(threads: CommentThreadSummary[], doc: any): Decoration[] {
  const decorations: Decoration[] = [];
  const docSize = doc.content.size ?? 0;

  for (const thread of threads) {
    if (thread.resolvedAt) continue;
    let from = Math.max(0, thread.fromPos);
    let to = Math.max(0, thread.toPos);
    if (docSize > 0) {
      from = Math.min(from, docSize - 1);
      to = Math.min(to, docSize);
    }
    if (to <= from) continue;

    decorations.push(
      Decoration.inline(from, to, {
        class: "comment-highlight",
        "data-comment-thread-id": thread.id,
      }),
    );
  }

  return decorations;
}

export function createCommentDecorationPlugin() {
  return new Plugin({
    key: commentPluginKey,
    state: {
      init(_, { doc }) {
        return DecorationSet.create(doc, []);
      },
      apply(tr, old, _oldState, newState) {
        let decos = old.map(tr.mapping, newState.doc);
        const meta = tr.getMeta(commentPluginKey) as { type?: string; threads?: CommentThreadSummary[] } | undefined;
        if (meta?.type === "setThreads" && Array.isArray(meta.threads)) {
          return DecorationSet.create(newState.doc, buildDecorations(meta.threads, newState.doc));
        }
        return decos;
      },
    },
    props: {
      decorations(state) {
        return commentPluginKey.getState(state) as DecorationSet;
      },
    },
  });
}

export const CommentDecorationExtension = Extension.create({
  name: "commentDecoration",
  addProseMirrorPlugins() {
    return [createCommentDecorationPlugin()];
  },
});

export function setCommentThreads(editor: Editor, threads: CommentThreadSummary[]) {
  const tr = editor.state.tr.setMeta(commentPluginKey, { type: "setThreads", threads });
  editor.view.dispatch(tr);
}

export function getCommentPositions(
  editor: Editor,
): { threadId: string; fromPos: number; toPos: number }[] {
  const decos = commentPluginKey.getState(editor.state) as DecorationSet | null;
  if (!decos) return [];

  const ranges = new Map<string, { from: number; to: number }>();

  for (const deco of decos.find()) {
    const id = (deco.spec as any)["data-comment-thread-id"] as string | undefined;
    if (!id) continue;
    const existing = ranges.get(id);
    if (!existing) {
      ranges.set(id, { from: deco.from, to: deco.to });
    } else {
      ranges.set(id, {
        from: Math.min(existing.from, deco.from),
        to: Math.max(existing.to, deco.to),
      });
    }
  }

  return Array.from(ranges.entries()).map(([threadId, range]) => ({
    threadId,
    fromPos: range.from,
    toPos: range.to,
  }));
}


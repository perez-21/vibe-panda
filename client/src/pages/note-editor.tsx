import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { Node as TiptapNode } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Underline as UnderlineExt } from "@tiptap/extension-underline";
import { Table as TableExt } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
// @ts-ignore
import katex from "katex";
import "katex/dist/katex.min.css";
import { Image as ImageExt } from "@tiptap/extension-image";
// @ts-ignore
import { ySyncPlugin, ySyncPluginKey, yCursorPlugin, yCursorPluginKey } from "y-prosemirror";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Save,
  ArrowLeft,
  Globe,
  Lock,
  GitFork,
  Bookmark,
  BookmarkCheck,
  Download,
  FileText,
  FileCode,
  File,
  MessageSquare,
  Wifi,
  WifiOff,
  Users,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EditorToolbar } from "@/components/editor-toolbar";
import { ShareDialog } from "@/components/share-dialog";
import { AddToModuleDialog } from "@/components/add-to-module-dialog";
import type { Note } from "@shared/schema";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CommentDecorationExtension,
  setCommentThreads,
  getCommentPositions,
  type CommentThreadSummary,
} from "@/extensions/comment-decoration";
import { CollaborationProvider } from "@/lib/collaboration";

function MathNodeView({ node, updateAttributes, selected }: any) {
  const [editing, setEditing] = useState(false);
  const [latex, setLatex] = useState(node.attrs.latex || "");
  const isBlock = node.type.name === "mathBlock";

  const renderKatex = useCallback((tex: string) => {
    try {
      return katex.renderToString(tex, {
        throwOnError: false,
        displayMode: isBlock,
      });
    } catch {
      return `<span class="text-destructive">${tex}</span>`;
    }
  }, [isBlock]);

  const handleSave = useCallback(() => {
    updateAttributes({ latex });
    setEditing(false);
  }, [latex, updateAttributes]);

  if (editing) {
    return (
      <NodeViewWrapper as={isBlock ? "div" : "span"} className={isBlock ? "my-2" : "inline"}>
        <span
          className={`inline-flex items-center gap-1 border rounded-md p-1 bg-muted/30 ${selected ? "ring-2 ring-primary" : ""}`}
          data-testid="math-editor"
        >
          <input
            type="text"
            value={latex}
            onChange={(e) => setLatex(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setLatex(node.attrs.latex || "");
              }
            }}
            className="bg-transparent border-0 outline-none text-sm font-mono min-w-[80px] px-1"
            autoFocus
            data-testid="input-math-latex"
          />
          <button
            onClick={handleSave}
            className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground rounded"
            data-testid="button-math-save"
            type="button"
          >
            OK
          </button>
        </span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as={isBlock ? "div" : "span"}
      className={`${isBlock ? "my-2 text-center" : "inline"} cursor-pointer ${selected ? "ring-2 ring-primary rounded" : ""}`}
      onClick={() => setEditing(true)}
      data-testid="math-display"
    >
      <span dangerouslySetInnerHTML={{ __html: renderKatex(node.attrs.latex || "?") }} />
    </NodeViewWrapper>
  );
}

const MathInline = TiptapNode.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "E = mc^2",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-latex") || element.textContent || "",
        renderHTML: (attributes: any) => ({ "data-latex": attributes.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = HTMLAttributes["data-latex"] || "";
    let rendered = "";
    try {
      rendered = katex.renderToString(latex, { throwOnError: false, displayMode: false });
    } catch {
      rendered = latex;
    }
    const span = document.createElement("span");
    span.setAttribute("data-type", "math-inline");
    span.setAttribute("data-latex", latex);
    span.classList.add("math-inline");
    span.innerHTML = rendered;
    return { dom: span };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});

const MathBlock = TiptapNode.create({
  name: "mathBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "E = mc^2",
        parseHTML: (element: HTMLElement) => element.getAttribute("data-latex") || element.textContent || "",
        renderHTML: (attributes: any) => ({ "data-latex": attributes.latex }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const latex = HTMLAttributes["data-latex"] || "";
    let rendered = "";
    try {
      rendered = katex.renderToString(latex, { throwOnError: false, displayMode: true });
    } catch {
      rendered = latex;
    }
    const div = document.createElement("div");
    div.setAttribute("data-type", "math-block");
    div.setAttribute("data-latex", latex);
    div.classList.add("math-block");
    div.innerHTML = rendered;
    return { dom: div };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView);
  },
});

type NoteWithOwner = Note & {
  isOwner?: boolean;
  collaboratorRole?: string | null;
};

type NoteCommentThread = CommentThreadSummary & {
  noteId: string;
  createdAt: string;
  comments: {
    id: string;
    content: string;
    createdAt: string;
    user: { displayName: string; email: string; username: string };
  }[];
};

interface CollabUser {
  name: string;
  id: string;
  color: string;
}

const USER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9",
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

export default function NoteEditor() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = params.id === "new";

  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [contentLoaded, setContentLoaded] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState("");
  const [replyTextByThread, setReplyTextByThread] = useState<
    Record<string, string>
  >({});

  const [collabConnected, setCollabConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [collaborators, setCollaborators] = useState<CollabUser[]>([]);
  const providerRef = useRef<CollaborationProvider | null>(null);
  const wasConnectedRef = useRef(false);
  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const collabRef = useRef(false);
  collabRef.current = collabConnected;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        history: false,
      }),
      UnderlineExt,
      TableExt.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      ImageExt.configure({
        inline: true,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder:
          "Start writing your note here...\n\nUse the toolbar above to format your content with headings, lists, code blocks, and more.",
      }),
      MathInline,
      MathBlock,
      CommentDecorationExtension,
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm sm:prose-base max-w-none dark:prose-invert focus:outline-none min-h-[500px] px-4 py-3",
        "data-testid": "input-note-content",
      },
    },
    onUpdate: () => {
      if (collabRef.current) {
        dirtyRef.current = true;
      } else {
        setHasChanges(true);
      }
    },
  });

  useEffect(() => {
    if (!editor || !collabConnected || !providerRef.current) return;

    const provider = providerRef.current;
    const yXmlFragment = provider.doc.getXmlFragment("prosemirror");
    const awareness = provider.awareness;

    try {
      editor.registerPlugin(ySyncPlugin(yXmlFragment));
      editor.registerPlugin(yCursorPlugin(awareness));
    } catch (err) {
      console.error("[collab] Failed to register plugins:", err);
      return;
    }

    return () => {
      try {
        editor.unregisterPlugin(ySyncPluginKey);
        editor.unregisterPlugin(yCursorPluginKey);
      } catch {}
    };
  }, [editor, collabConnected]);

  useEffect(() => {
    if (collabConnected && providerRef.current && user) {
      providerRef.current.setAwarenessUser({
        name: user.displayName,
        id: user.id,
        color: getUserColor(user.id),
      });
    }
  }, [collabConnected, user]);

  useEffect(() => {
    if (!collabConnected || !providerRef.current || !user) return;
    const provider = providerRef.current;
    const handleVisibility = () => {
      if (document.hidden) {
        provider.awareness.setLocalStateField("user", null);
      } else {
        provider.setAwarenessUser({
          name: user.displayName,
          id: user.id,
          color: getUserColor(user.id),
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [collabConnected, user]);

  useEffect(() => {
    if (!collabConnected || !editor || isNew || !params.id) {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    autoSaveTimerRef.current = setInterval(() => {
      if (dirtyRef.current && editor) {
        dirtyRef.current = false;
        const content = editor.getHTML();
        const commentPositions = getCommentPositions(editor);
        apiRequest("PATCH", `/api/notes/${params.id}`, {
          content,
          commentPositions,
        }).catch((err) => console.error("[collab] Auto-save failed:", err));
      }
    }, 10000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [collabConnected, editor, params.id, isNew]);

  useEffect(() => {
    if (isNew) {
      setTitle("");
      setIsPublic(false);
      setHasChanges(false);
      setContentLoaded(false);
      if (editor) {
        editor.commands.clearContent();
      }
    } else {
      setContentLoaded(false);
    }
  }, [isNew, params.id, editor]);

  const { data: note, isLoading } = useQuery<NoteWithOwner>({
    queryKey: ["/api/notes", params.id],
    enabled: !isNew,
  });

  const isOwner = isNew || note?.isOwner || note?.ownerId === user?.id;
  const isCommenter = note?.collaboratorRole === "commenter";
  const canEdit = isOwner || note?.collaboratorRole === "editor";
  const canComment =
    isOwner ||
    note?.collaboratorRole === "editor" ||
    note?.collaboratorRole === "commenter";

  const { data: commentThreads } = useQuery<NoteCommentThread[]>({
    queryKey: ["/api/notes", params.id, "comments"],
    enabled: !isNew,
  });

  useEffect(() => {
    if (isNew || !params.id || !canEdit) return;

    const provider = new CollaborationProvider(params.id);
    providerRef.current = provider;

    provider.on("synced", () => {
      setCollabConnected(true);
      wasConnectedRef.current = true;
      setIsReconnecting(false);
    });

    provider.on("disconnected", ({ code }: { wasSynced: boolean; code: number }) => {
      setCollabConnected(false);
      if (wasConnectedRef.current && code !== 4403 && code !== 4004) {
        setIsReconnecting(true);
      }
    });

    provider.on("awareness", (states: Map<number, any>) => {
      const users: CollabUser[] = [];
      states.forEach((state) => {
        if (state.user && state.user.id !== user?.id) {
          users.push(state.user);
        }
      });
      const uniqueUsers = Array.from(
        new Map(users.map((u) => [u.id, u])).values(),
      );
      setCollaborators(uniqueUsers);
    });

    return () => {
      provider.destroy();
      providerRef.current = null;
      setCollabConnected(false);
      setCollaborators([]);
      setIsReconnecting(false);
      wasConnectedRef.current = false;
    };
  }, [params.id, isNew, canEdit, user?.id]);

  useEffect(() => {
    if (note && editor && !contentLoaded) {
      setTitle(note.title);
      setIsPublic(note.isPublic);
      if (note.content) {
        const isHtml = note.content.trim().startsWith("<");
        if (isHtml) {
          editor.commands.setContent(note.content);
        } else {
          editor.commands.setContent(
            note.content
              .split("\n")
              .map((line) => `<p>${line || "<br>"}</p>`)
              .join(""),
          );
        }
      } else {
        editor.commands.clearContent();
      }
      setContentLoaded(true);
      setHasChanges(false);
    }
  }, [note, editor, contentLoaded]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(canEdit);
    }
  }, [editor, canEdit]);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const { from, to } = editor.state.selection;
      if (from < to && canComment) {
        setSelectionRange({ from, to });
      } else {
        setSelectionRange(null);
      }
    };
    editor.on("selectionUpdate", handler);
    return () => {
      editor.off("selectionUpdate", handler);
    };
  }, [editor, canComment]);

  useEffect(() => {
    if (!editor || !commentThreads) return;
    const summaries: CommentThreadSummary[] = commentThreads.map((t) => ({
      id: t.id,
      fromPos: t.fromPos,
      toPos: t.toPos,
      resolvedAt: t.resolvedAt ?? null,
    }));
    setCommentThreads(editor, summaries);
  }, [editor, commentThreads]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const content = editor?.getHTML() || "";
      const commentPositions = editor ? getCommentPositions(editor) : [];
      if (isNew) {
        const res = await apiRequest("POST", "/api/notes", {
          title,
          content,
          isPublic,
        });
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/notes/${params.id}`, {
          title,
          content,
          isPublic,
          commentPositions,
        });
        return res.json();
      }
    },
    onSuccess: (data: Note) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", data.id] });
      toast({ title: isNew ? "Note created" : "Note saved" });
      setHasChanges(false);
      dirtyRef.current = false;
      if (isNew) {
        setLocation(`/notes/${data.id}`);
      }
    },
    onError: (e: any) => {
      toast({
        title: "Failed to save",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/notes/${params.id}/fork`);
      return res.json();
    },
    onSuccess: (data: Note) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({ title: "Note forked to your collection" });
      setLocation(`/notes/${data.id}`);
    },
    onError: (e: any) => {
      toast({
        title: "Failed to fork",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const { data: savedItems } = useQuery<any[]>({
    queryKey: ["/api/saved"],
    enabled: !isNew && !isOwner,
  });

  const isSaved = savedItems?.some((s) => s.noteId === params.id);
  const savedItemId = savedItems?.find((s) => s.noteId === params.id)?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isSaved && savedItemId) {
        await apiRequest("DELETE", `/api/saved/${savedItemId}`);
      } else {
        await apiRequest("POST", "/api/saved", { noteId: params.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      toast({ title: isSaved ? "Removed from saved" : "Saved to collection" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async ({
      from,
      to,
      content,
    }: {
      from: number;
      to: number;
      content: string;
    }) => {
      const res = await apiRequest("POST", `/api/notes/${params.id}/comments`, {
        fromPos: from,
        toPos: to,
        content,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/notes", params.id, "comments"],
      });
      setNewCommentText("");
      setIsCommentDialogOpen(false);
      toast({ title: "Comment added" });
    },
    onError: (e: any) => {
      toast({
        title: "Failed to add comment",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({
      threadId,
      content,
    }: {
      threadId: string;
      content: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/notes/${params.id}/comments/${threadId}`,
        {
          content,
        },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/notes", params.id, "comments"],
      });
      setReplyTextByThread({});
      toast({ title: "Reply added" });
    },
    onError: (e: any) => {
      toast({
        title: "Failed to add reply",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const resolveThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await apiRequest(
        "PATCH",
        `/api/notes/${params.id}/comments/${threadId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/notes", params.id, "comments"],
      });
      toast({ title: "Thread resolved" });
    },
    onError: (e: any) => {
      toast({
        title: "Failed to resolve thread",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/notes/${params.id}/comments/${threadId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/notes", params.id, "comments"],
      });
      toast({ title: "Thread deleted" });
    },
    onError: (e: any) => {
      toast({
        title: "Failed to delete thread",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const handleExport = async (format: string) => {
    try {
      const response = await fetch(
        `/api/notes/${params.id}/export?format=${format}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filename =
        disposition?.match(/filename="(.+)"/)?.[1] || `note.${format}`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: `Exported as ${format.toUpperCase()}` });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!isNew && !note) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-muted-foreground">Note not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setLocation("/notes")}
        >
          Back to Notes
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {isReconnecting && (
        <div className="flex items-center gap-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-md text-sm" data-testid="banner-reconnecting">
          <Loader2 className="w-4 h-4 animate-spin" />
          Reconnecting to collaboration server...
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation(isOwner ? "/notes" : "/explore")}
            data-testid="button-back-notes"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold">
            {isNew ? "New Note" : isOwner ? "Edit Note" : canEdit ? "Edit Note (Editor)" : isCommenter ? "View Note (Commenter)" : "View Note"}
          </h1>
          {collabConnected && canEdit && (
            <Badge variant="outline" className="text-xs gap-1 border-green-500/50 text-green-700 dark:text-green-400" data-testid="badge-collab-connected">
              <Wifi className="w-3 h-3" />
              Auto-saving
            </Badge>
          )}
          {!collabConnected && hasChanges && canEdit && (
            <Badge variant="outline" className="text-xs" data-testid="badge-unsaved">
              Unsaved changes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && collaborators.length > 0 && (
            <TooltipProvider>
              <div className="flex items-center gap-1 mr-2" data-testid="collaborator-presence">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {collaborators.length} other{collaborators.length !== 1 ? "s" : ""} editing
                </span>
                <div className="flex -space-x-2 ml-1">
                  {collaborators.slice(0, 5).map((collab) => (
                    <Tooltip key={collab.id}>
                      <TooltipTrigger asChild>
                        <div
                          className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ backgroundColor: collab.color }}
                          data-testid={`avatar-collaborator-${collab.id}`}
                        >
                          {collab.name.charAt(0).toUpperCase()}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{collab.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                  {collaborators.length > 5 && (
                    <div className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground">
                      +{collaborators.length - 5}
                    </div>
                  )}
                </div>
              </div>
            </TooltipProvider>
          )}

          {!isNew && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="button-export-note"
                >
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={() => handleExport("txt")}
                  data-testid="button-export-txt"
                >
                  <File className="w-4 h-4 mr-2" />
                  Plain Text (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("md")}
                  data-testid="button-export-md"
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("pdf")}
                  data-testid="button-export-pdf"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  HTML Document (.html)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {!isNew && (
            <AddToModuleDialog noteId={params.id!} noteTitle={title} trigger="button" />
          )}

          {isOwner && !isNew && (
            <ShareDialog resourceType="notes" resourceId={params.id!} />
          )}

          {isOwner ? (
            <>
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="w-4 h-4 text-primary" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                )}
                <Label
                  htmlFor="public-toggle"
                  className="text-sm cursor-pointer"
                >
                  {isPublic ? "Public" : "Private"}
                </Label>
                <Switch
                  id="public-toggle"
                  checked={isPublic}
                  onCheckedChange={(v) => {
                    setIsPublic(v);
                    setHasChanges(true);
                  }}
                  data-testid="switch-note-public"
                />
              </div>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !title.trim()}
                data-testid="button-save-note"
              >
                <Save className="w-4 h-4 mr-1" />
                {saveMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          ) : canEdit ? (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title.trim()}
              data-testid="button-save-note"
            >
              <Save className="w-4 h-4 mr-1" />
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => forkMutation.mutate()}
                disabled={forkMutation.isPending}
                data-testid="button-fork-note"
              >
                <GitFork className="w-4 h-4 mr-1" />
                Fork
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => saveMut.mutate()}
                data-testid="button-save-bookmark"
              >
                {isSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-primary" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <Input
        data-testid="input-note-title"
        placeholder="Note title"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setHasChanges(true);
        }}
        readOnly={!canEdit}
        className={`text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary ${
          !canEdit ? "cursor-default" : ""
        }`}
      />

      {canComment && selectionRange && !isNew && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Commenting on selected text.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCommentDialogOpen(true)}
            data-testid="button-add-inline-comment"
          >
            <MessageSquare className="w-4 h-4 mr-1" />
            Comment selection
          </Button>
        </div>
      )}

      <div className="border rounded-md" data-testid="editor-wrapper">
        {canEdit && <EditorToolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>

      {!isNew && commentThreads && commentThreads.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Comments</h2>
          <div className="space-y-2">
            {commentThreads.map((thread) => (
              <div
                key={thread.id}
                className="rounded-md border p-2 text-sm space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {thread.comments[0]?.user.displayName ?? "Comment"}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {thread.comments[0]?.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {thread.resolvedAt && (
                      <Badge variant="outline" className="text-[10px]">
                        Resolved
                      </Badge>
                    )}
                    {isOwner && (
                      <>
                        {!thread.resolvedAt && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              resolveThreadMutation.mutate(thread.id)
                            }
                          >
                            Resolve
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteThreadMutation.mutate(thread.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {thread.comments.slice(1).map((comment) => (
                  <div
                    key={comment.id}
                    className="pl-3 border-l text-xs text-muted-foreground"
                  >
                    <span className="font-medium">
                      {comment.user.displayName}:
                    </span>{" "}
                    <span>{comment.content}</span>
                  </div>
                ))}

                {canComment && !thread.resolvedAt && (
                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      placeholder="Reply..."
                      value={replyTextByThread[thread.id] ?? ""}
                      onChange={(e) =>
                        setReplyTextByThread((prev) => ({
                          ...prev,
                          [thread.id]: e.target.value,
                        }))
                      }
                      className="h-8 text-xs"
                    />
                    <Button
                      size="sm"
                      disabled={
                        !replyTextByThread[thread.id]?.trim() ||
                        replyMutation.isPending
                      }
                      onClick={() => {
                        const content = replyTextByThread[thread.id]?.trim();
                        if (!content) return;
                        replyMutation.mutate({ threadId: thread.id, content });
                      }}
                    >
                      Reply
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add comment</DialogTitle>
          </DialogHeader>
          <Textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Write your comment..."
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCommentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectionRange || !newCommentText.trim()) return;
                createCommentMutation.mutate({
                  from: selectionRange.from,
                  to: selectionRange.to,
                  content: newCommentText.trim(),
                });
              }}
              disabled={
                !selectionRange ||
                !newCommentText.trim() ||
                createCommentMutation.isPending
              }
            >
              {createCommentMutation.isPending ? "Adding..." : "Add comment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

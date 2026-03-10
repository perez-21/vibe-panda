import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Underline as UnderlineExt } from "@tiptap/extension-underline";
import { Table as TableExt } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Save, ArrowLeft, Globe, Lock, GitFork, Bookmark, BookmarkCheck, Download, FileText, FileCode, File } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EditorToolbar } from "@/components/editor-toolbar";
import { ShareDialog } from "@/components/share-dialog";
import type { Note } from "@shared/schema";
import { useAuth } from "@/lib/auth";

type NoteWithOwner = Note & { isOwner?: boolean; collaboratorRole?: string | null };

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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      TableExt.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({
        placeholder:
          "Start writing your note here...\n\nUse the toolbar above to format your content with headings, lists, code blocks, and more.",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          "tiptap prose prose-sm sm:prose-base max-w-none dark:prose-invert focus:outline-none min-h-[500px] px-4 py-3",
        "data-testid": "input-note-content",
      },
    },
    onUpdate: () => {
      setHasChanges(true);
    },
  });

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
  const canEdit = isOwner || note?.collaboratorRole === "editor";

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
              .join("")
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const content = editor?.getHTML() || "";
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
        });
        return res.json();
      }
    },
    onSuccess: (data: Note) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", data.id] });
      toast({ title: isNew ? "Note created" : "Note saved" });
      setHasChanges(false);
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

  const handleExport = async (format: string) => {
    try {
      const response = await fetch(`/api/notes/${params.id}/export?format=${format}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `note.${format}`;
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
            {isNew ? "New Note" : isOwner ? "Edit Note" : canEdit ? "Edit Note (Editor)" : "View Note"}
          </h1>
          {hasChanges && canEdit && (
            <Badge variant="outline" className="text-xs">
              Unsaved changes
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-export-note">
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport("txt")} data-testid="button-export-txt">
                  <File className="w-4 h-4 mr-2" />
                  Plain Text (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("md")} data-testid="button-export-md">
                  <FileCode className="w-4 h-4 mr-2" />
                  Markdown (.md)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} data-testid="button-export-pdf">
                  <FileText className="w-4 h-4 mr-2" />
                  HTML Document (.html)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      <div className="border rounded-md" data-testid="editor-wrapper">
        {canEdit && <EditorToolbar editor={editor} />}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

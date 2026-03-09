import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Save, ArrowLeft, Globe, Lock, User, GitFork, Bookmark, BookmarkCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Note } from "@shared/schema";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";

type NoteWithOwner = Note & { isOwner?: boolean };

export default function NoteEditor() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const isNew = params.id === "new";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: note, isLoading } = useQuery<NoteWithOwner>({
    queryKey: ["/api/notes", params.id],
    enabled: !isNew,
  });

  const isOwner = isNew || note?.isOwner || note?.ownerId === user?.id;

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setIsPublic(note.isPublic);
    }
  }, [note]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        const res = await apiRequest("POST", "/api/notes", { title, content, isPublic });
        return res.json();
      } else {
        const res = await apiRequest("PATCH", `/api/notes/${params.id}`, { title, content, isPublic });
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
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
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
      toast({ title: "Failed to fork", description: e.message, variant: "destructive" });
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

  const handleChange = useCallback((setter: (v: string) => void) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setter(e.target.value);
      setHasChanges(true);
    };
  }, []);

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
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/notes")}>
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
            {isNew ? "New Note" : isOwner ? "Edit Note" : "View Note"}
          </h1>
          {hasChanges && isOwner && (
            <Badge variant="outline" className="text-xs">Unsaved changes</Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isOwner ? (
            <>
              <div className="flex items-center gap-2">
                {isPublic ? (
                  <Globe className="w-4 h-4 text-primary" />
                ) : (
                  <Lock className="w-4 h-4 text-muted-foreground" />
                )}
                <Label htmlFor="public-toggle" className="text-sm cursor-pointer">
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

      {isOwner ? (
        <>
          <Input
            data-testid="input-note-title"
            placeholder="Note title"
            value={title}
            onChange={handleChange(setTitle)}
            className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
          />
          <Textarea
            data-testid="input-note-content"
            placeholder="Start writing your note here...

Use this space to capture your study materials, lecture notes, formulas, key concepts, and anything else that helps you learn.

Tips:
- Keep your notes organized with clear sections
- Use bullet points for key concepts
- Add examples to reinforce understanding"
            value={content}
            onChange={handleChange(setContent)}
            className="min-h-[500px] resize-none text-base leading-relaxed"
          />
        </>
      ) : (
        <>
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-view-note-title">{title}</h2>
            {note && (
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                <Badge variant={isPublic ? "default" : "secondary"}>
                  {isPublic ? "Public" : "Private"}
                </Badge>
                <span>Updated {format(new Date(note.updatedAt), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap leading-relaxed" data-testid="text-view-note-content">
            {content}
          </div>
        </>
      )}
    </div>
  );
}

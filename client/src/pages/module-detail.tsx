import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileText, Plus, X, Globe, Lock, Clock, Search, ThumbsUp, ThumbsDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Module, Note, ModuleItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShareDialog } from "@/components/share-dialog";
import { format } from "date-fns";

type NoteWithOwner = Note & { owner: { displayName: string; username: string } };

type ModuleDetailResponse = Module & {
  notes: (Note & { orderIndex: number })[];
  owner: { displayName: string; username: string };
  isOwner?: boolean;
};

export default function ModuleDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAddNote, setShowAddNote] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NoteWithOwner[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: module, isLoading } = useQuery<ModuleDetailResponse>({
    queryKey: ["/api/modules", params.id],
  });

  const { data: labelVoteData } = useQuery<{
    votes: { label: string; score: number }[];
    userVotes: { label: string; vote: number }[];
  }>({
    queryKey: ["/api/modules", params.id, "label-votes"],
    enabled: !!params.id,
  });

  const voteMutation = useMutation({
    mutationFn: async ({ label, vote }: { label: string; vote: 1 | -1 }) => {
      const currentUserVote = labelVoteData?.userVotes.find((v) => v.label === label);
      if (currentUserVote && currentUserVote.vote === vote) {
        await apiRequest("DELETE", `/api/modules/${params.id}/label-votes/${encodeURIComponent(label)}`);
      } else {
        await apiRequest("POST", `/api/modules/${params.id}/label-votes`, { label, vote });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", params.id, "label-votes"] });
    },
    onError: () => {
      toast({ title: "Failed to vote", variant: "destructive" });
    },
  });

  const { data: myNotes } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const searchNotes = useCallback(async (q: string) => {
    if (q.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/notes/search/accessible?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchNotes(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchNotes]);

  const addNoteMutation = useMutation({
    mutationFn: async (noteId?: string) => {
      await apiRequest("POST", `/api/modules/${params.id}/items`, {
        noteId: noteId || selectedNoteId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", params.id] });
      setShowAddNote(false);
      setSelectedNoteId("");
      setSearchQuery("");
      setSearchResults([]);
      toast({ title: "Note added to module" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to add note", description: e.message, variant: "destructive" });
    },
  });

  const removeNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/modules/${params.id}/items/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", params.id] });
      toast({ title: "Note removed from module" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-muted-foreground">Module not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/modules")}>
          Back to Modules
        </Button>
      </div>
    );
  }

  const availableNotes = myNotes?.filter(
    (n) => !module.notes?.some((mn) => mn.id === n.id)
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setLocation("/modules")}
            data-testid="button-back-modules"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-module-detail-title">
              {module.title}
            </h1>
            {module.description && (
              <p className="text-muted-foreground mt-1">{module.description}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant={module.isPublic ? "default" : "secondary"}>
                {module.isPublic ? (
                  <><Globe className="w-3 h-3 mr-1" /> Public</>
                ) : (
                  <><Lock className="w-3 h-3 mr-1" /> Private</>
                )}
              </Badge>
              {module.owner && (
                <span className="text-xs text-muted-foreground">
                  by {module.owner.displayName}
                </span>
              )}
            </div>
            {module.categoryLabels && module.categoryLabels.length > 0 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {module.categoryLabels.map((label) => {
                  const voteEntry = labelVoteData?.votes.find((v) => v.label === label);
                  const score = voteEntry?.score ?? 0;
                  const userVote = labelVoteData?.userVotes.find((v) => v.label === label);
                  const isUpvoted = userVote?.vote === 1;
                  const isDownvoted = userVote?.vote === -1;

                  if (!module.isPublic) {
                    return (
                      <Badge key={label} variant="outline" className="text-xs">
                        {label}
                      </Badge>
                    );
                  }

                  return (
                    <div
                      key={label}
                      className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs"
                      data-testid={`label-vote-${label}`}
                    >
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ label, vote: 1 })}
                        disabled={voteMutation.isPending}
                        className={`p-0.5 rounded hover:bg-accent transition-colors ${isUpvoted ? "text-green-600" : "text-muted-foreground"}`}
                        data-testid={`button-upvote-${label}`}
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>
                      <span className={`min-w-[16px] text-center font-medium ${score > 0 ? "text-green-600" : score < 0 ? "text-red-500" : "text-muted-foreground"}`} data-testid={`text-vote-score-${label}`}>
                        {score}
                      </span>
                      <button
                        type="button"
                        onClick={() => voteMutation.mutate({ label, vote: -1 })}
                        disabled={voteMutation.isPending}
                        className={`p-0.5 rounded hover:bg-accent transition-colors ${isDownvoted ? "text-red-500" : "text-muted-foreground"}`}
                        data-testid={`button-downvote-${label}`}
                      >
                        <ThumbsDown className="w-3 h-3" />
                      </button>
                      <span className="ml-0.5">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {module.isOwner && (
            <ShareDialog resourceType="modules" resourceId={params.id!} />
          )}
          {module.isOwner && (
            <Button onClick={() => setShowAddNote(true)} data-testid="button-add-note-to-module">
              <Plus className="w-4 h-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Notes in this module</h2>
        {module.notes && module.notes.length > 0 ? (
          <div className="space-y-2">
            {module.notes.map((note) => (
              <Card key={note.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/notes/${note.id}`} className="flex-1 min-w-0 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate" data-testid={`text-module-note-${note.id}`}>
                            {note.title}
                          </p>
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(note.updatedAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                    {module.isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeNoteMutation.mutate(note.id)}
                        data-testid={`button-remove-note-${note.id}`}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No notes in this module yet. Add some notes to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showAddNote} onOpenChange={(open) => {
        setShowAddNote(open);
        if (!open) {
          setSearchQuery("");
          setSearchResults([]);
        }
      }}>
        <DialogContent className="max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Note to Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search all notes by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-notes"
              />
            </div>
            <div className="overflow-y-auto max-h-[300px] space-y-1">
              {searchQuery.trim().length > 0 ? (
                searching ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Searching...</p>
                ) : searchResults.length > 0 ? (
                  searchResults
                    .filter((n) => !module.notes?.some((mn) => mn.id === n.id))
                    .map((note) => (
                      <div
                        key={note.id}
                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                        data-testid={`search-result-${note.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{note.title}</p>
                          <p className="text-xs text-muted-foreground">
                            by {note.owner.displayName}
                            {note.isPublic ? " · Public" : " · Private"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => addNoteMutation.mutate(note.id)}
                          disabled={addNoteMutation.isPending}
                          data-testid={`button-add-search-result-${note.id}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No notes found</p>
                )
              ) : availableNotes && availableNotes.length > 0 ? (
                <>
                  <p className="text-xs text-muted-foreground px-2 pb-1">Your notes</p>
                  {availableNotes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer"
                      data-testid={`own-note-${note.id}`}
                    >
                      <p className="text-sm font-medium truncate flex-1 min-w-0">{note.title}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addNoteMutation.mutate(note.id)}
                        disabled={addNoteMutation.isPending}
                        data-testid={`button-add-own-note-${note.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Search for notes to add, or create a new note first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

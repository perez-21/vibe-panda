import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileText, Plus, X, Globe, Lock, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Module, Note, ModuleItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShareDialog } from "@/components/share-dialog";
import { format } from "date-fns";

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

  const { data: module, isLoading } = useQuery<ModuleDetailResponse>({
    queryKey: ["/api/modules", params.id],
  });

  const { data: myNotes } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/modules/${params.id}/items`, {
        noteId: selectedNoteId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules", params.id] });
      setShowAddNote(false);
      setSelectedNoteId("");
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
              <div className="flex gap-1 mt-3 flex-wrap">
                {module.categoryLabels.map((label) => (
                  <Badge key={label} variant="outline" className="text-xs">
                    {label}
                  </Badge>
                ))}
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

      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note to Module</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {availableNotes && availableNotes.length > 0 ? (
              <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                <SelectTrigger data-testid="select-note-to-add">
                  <SelectValue placeholder="Select a note" />
                </SelectTrigger>
                <SelectContent>
                  {availableNotes.map((note) => (
                    <SelectItem key={note.id} value={note.id}>
                      {note.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No more notes available to add. Create a new note first.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddNote(false)}>Cancel</Button>
            <Button
              onClick={() => addNoteMutation.mutate()}
              disabled={!selectedNoteId || addNoteMutation.isPending}
              data-testid="button-add-note-submit"
            >
              {addNoteMutation.isPending ? "Adding..." : "Add Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

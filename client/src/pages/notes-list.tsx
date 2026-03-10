import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Clock, Search, Trash2 } from "lucide-react";
import type { Note } from "@shared/schema";
import { format } from "date-fns";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AddToModuleDialog } from "@/components/add-to-module-dialog";

export default function NotesList() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({ title: "Note deleted" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    },
  });

  const filteredNotes = notes?.filter(
    (n) => n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Notes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage your study notes.
          </p>
        </div>
        <Link href="/notes/new">
          <Button data-testid="button-new-note-page">
            <Plus className="w-4 h-4 mr-1" />
            New Note
          </Button>
        </Link>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-testid="input-search-notes"
          type="search"
          placeholder="Search your notes..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-md" />
          ))}
        </div>
      ) : filteredNotes && filteredNotes.length > 0 ? (
        <div className="space-y-2">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/notes/${note.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div>
                      <p className="font-medium truncate" data-testid={`text-note-title-${note.id}`}>
                        {note.title}
                      </p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          Updated {format(new Date(note.updatedAt), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                        <Badge variant={note.isPublic ? "default" : "secondary"}>
                          {note.isPublic ? "Public" : "Private"}
                        </Badge>
                        {note.forkedFromId && (
                          <Badge variant="outline" className="text-xs">Forked</Badge>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1">
                    <AddToModuleDialog noteId={note.id} noteTitle={note.title} />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (confirm("Delete this note?")) {
                          deleteMutation.mutate(note.id);
                        }
                      }}
                      data-testid={`button-delete-note-${note.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">
              {search ? "No matching notes" : "No notes yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? "Try a different search term."
                : "Create your first note to start organizing your study materials."}
            </p>
            {!search && (
              <Link href="/notes/new">
                <Button data-testid="button-create-first-note-empty">
                  <Plus className="w-4 h-4 mr-1" />
                  Create Note
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

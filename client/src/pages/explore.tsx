import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, FolderOpen, Bookmark, BookmarkCheck, GitFork, Clock, User, X } from "lucide-react";
import type { Note, Module } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export type PublicNote = Note & { owner: { displayName: string; username: string } };
export type PublicModule = Module & { owner: { displayName: string; username: string }; noteCount: number };

export default function Explore() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const notesQueryKey = ["/api/explore/notes", debouncedSearch];
  const modulesQueryKey = ["/api/explore/modules", debouncedSearch, category];

  const { data: publicNotes, isLoading: notesLoading } = useQuery<PublicNote[]>({
    queryKey: notesQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      const res = await fetch(`/api/explore/notes?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notes");
      return res.json();
    },
  });

  const { data: publicModules, isLoading: modulesLoading } = useQuery<PublicModule[]>({
    queryKey: modulesQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (category) params.set("category", category);
      const res = await fetch(`/api/explore/modules?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch modules");
      return res.json();
    },
  });

  const { data: categories } = useQuery<string[]>({
    queryKey: ["/api/explore/categories"],
  });

  const { data: savedItems } = useQuery<any[]>({
    queryKey: ["/api/saved"],
  });

  const saveMutation = useMutation({
    mutationFn: async ({ noteId, moduleId }: { noteId?: string; moduleId?: string }) => {
      await apiRequest("POST", "/api/saved", { noteId, moduleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      toast({ title: "Saved to collection" });
    },
  });

  const unsaveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      toast({ title: "Removed from collection" });
    },
  });

  const forkMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await apiRequest("POST", `/api/notes/${noteId}/fork`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({ title: "Note forked to your collection" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to fork", description: e.message, variant: "destructive" });
    },
  });

  const isSaved = (noteId?: string, moduleId?: string) => {
    return savedItems?.some(
      (s) => (noteId && s.noteId === noteId) || (moduleId && s.moduleId === moduleId)
    );
  };

  const getSavedId = (noteId?: string, moduleId?: string) => {
    return savedItems?.find(
      (s) => (noteId && s.noteId === noteId) || (moduleId && s.moduleId === moduleId)
    )?.id;
  };

  const isLoading = notesLoading || modulesLoading;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Discover public notes and modules shared by the community.
        </p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-explore"
            type="search"
            placeholder="Search titles, content, and topics..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48" data-testid="select-category-filter">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {category && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCategory("")}
            data-testid="button-clear-category"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-explore-all">All</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-explore-notes">Notes</TabsTrigger>
          <TabsTrigger value="modules" data-testid="tab-explore-modules">Modules</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6 mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <>
              {publicModules && publicModules.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    Modules
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {publicModules.map((mod) => (
                      <ModuleCard
                        key={mod.id}
                        module={mod}
                        isSaved={isSaved(undefined, mod.id)}
                        onSave={() => {
                          const savedId = getSavedId(undefined, mod.id);
                          if (savedId) unsaveMutation.mutate(savedId);
                          else saveMutation.mutate({ moduleId: mod.id });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {publicNotes && publicNotes.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Notes
                  </h2>
                  <div className="space-y-2">
                    {publicNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        isSaved={isSaved(note.id)}
                        onSave={() => {
                          const savedId = getSavedId(note.id);
                          if (savedId) unsaveMutation.mutate(savedId);
                          else saveMutation.mutate({ noteId: note.id });
                        }}
                        onFork={() => forkMutation.mutate(note.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(!publicNotes?.length && !publicModules?.length) && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-semibold mb-1">No public content found</h3>
                    <p className="text-sm text-muted-foreground">
                      {search ? "Try a different search term." : "Be the first to share your notes with the community!"}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-3 mt-4">
          {notesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-md" />)}
            </div>
          ) : publicNotes && publicNotes.length > 0 ? (
            publicNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isSaved={isSaved(note.id)}
                onSave={() => {
                  const savedId = getSavedId(note.id);
                  if (savedId) unsaveMutation.mutate(savedId);
                  else saveMutation.mutate({ noteId: note.id });
                }}
                onFork={() => forkMutation.mutate(note.id)}
              />
            ))
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No public notes found.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="modules" className="space-y-3 mt-4">
          {modulesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-md" />)}
            </div>
          ) : publicModules && publicModules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {publicModules.map((mod) => (
                <ModuleCard
                  key={mod.id}
                  module={mod}
                  isSaved={isSaved(undefined, mod.id)}
                  onSave={() => {
                    const savedId = getSavedId(undefined, mod.id);
                    if (savedId) unsaveMutation.mutate(savedId);
                    else saveMutation.mutate({ moduleId: mod.id });
                  }}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-sm text-muted-foreground">No public modules found.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoteCard({
  note,
  isSaved,
  onSave,
  onFork,
}: {
  note: PublicNote;
  isSaved?: boolean;
  onSave: () => void;
  onFork: () => void;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/notes/${note.id}`} className="flex-1 min-w-0 cursor-pointer">
            <p className="font-medium truncate" data-testid={`text-explore-note-${note.id}`}>
              {note.title}
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                {note.owner?.displayName}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {format(new Date(note.updatedAt), "MMM d, yyyy")}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={onFork}
              data-testid={`button-fork-note-${note.id}`}
              title="Fork this note"
            >
              <GitFork className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onSave}
              data-testid={`button-save-note-${note.id}`}
              title={isSaved ? "Remove from saved" : "Save to collection"}
            >
              {isSaved ? (
                <BookmarkCheck className="w-4 h-4 text-primary" />
              ) : (
                <Bookmark className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleCard({
  module,
  isSaved,
  onSave,
}: {
  module: PublicModule;
  isSaved?: boolean;
  onSave: () => void;
}) {
  return (
    <Card className="hover-elevate">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/modules/${module.id}`} className="flex-1 min-w-0 cursor-pointer">
            <p className="font-medium truncate" data-testid={`text-explore-module-${module.id}`}>
              {module.title}
            </p>
            {module.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {module.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="w-3 h-3" />
                {module.owner?.displayName}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                {module.noteCount || 0} notes
              </div>
            </div>
          </Link>
          <Button
            size="icon"
            variant="ghost"
            onClick={onSave}
            data-testid={`button-save-module-${module.id}`}
          >
            {isSaved ? (
              <BookmarkCheck className="w-4 h-4 text-primary" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </Button>
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
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, FolderOpen, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/tag-input";
import type { Module } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ModulesList() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [newLabels, setNewLabels] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: modules, isLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const { data: categorySuggestions } = useQuery<string[]>({
    queryKey: ["/api/explore/categories"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/modules", {
        title: newTitle,
        description: newDescription,
        isPublic: newIsPublic,
        categoryLabels: newLabels,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/explore/categories"] });
      setShowCreate(false);
      setNewTitle("");
      setNewDescription("");
      setNewIsPublic(false);
      setNewLabels([]);
      toast({ title: "Module created" });
    },
    onError: (e: any) => {
      toast({ title: "Failed to create", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/modules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
      toast({ title: "Module deleted" });
    },
  });

  const filteredModules = modules?.filter(
    (m) => m.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Modules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Organize notes into modules by course or topic.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-new-module">
          <Plus className="w-4 h-4 mr-1" />
          New Module
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          data-testid="input-search-modules"
          type="search"
          placeholder="Search modules..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-md" />
          ))}
        </div>
      ) : filteredModules && filteredModules.length > 0 ? (
        <div className="space-y-2">
          {filteredModules.map((mod) => (
            <Card key={mod.id} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/modules/${mod.id}`} className="flex-1 min-w-0 cursor-pointer">
                    <div>
                      <p className="font-medium" data-testid={`text-module-title-${mod.id}`}>
                        {mod.title}
                      </p>
                      {mod.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {mod.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant={mod.isPublic ? "default" : "secondary"}>
                          {mod.isPublic ? "Public" : "Private"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Created {format(new Date(mod.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                      {mod.categoryLabels && mod.categoryLabels.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {mod.categoryLabels.map((label) => (
                            <Badge key={label} variant="outline" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm("Delete this module?")) {
                        deleteMutation.mutate(mod.id);
                      }
                    }}
                    data-testid={`button-delete-module-${mod.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">
              {search ? "No matching modules" : "No modules yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? "Try a different search term."
                : "Create a module to organize your notes by course or topic."}
            </p>
            {!search && (
              <Button onClick={() => setShowCreate(true)} data-testid="button-create-first-module-empty">
                <Plus className="w-4 h-4 mr-1" />
                Create Module
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                data-testid="input-module-title"
                placeholder="e.g. CS101 - Intro to Computer Science"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                data-testid="input-module-description"
                placeholder="Brief description of this module..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category Labels</Label>
              <TagInput
                tags={newLabels}
                onChange={setNewLabels}
                placeholder="Type a label and press Enter..."
                suggestions={categorySuggestions || []}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newIsPublic}
                onCheckedChange={setNewIsPublic}
                data-testid="switch-module-public"
              />
              <Label>{newIsPublic ? "Public" : "Private"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!newTitle.trim() || createMutation.isPending}
              data-testid="button-create-module-submit"
            >
              {createMutation.isPending ? "Creating..." : "Create Module"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

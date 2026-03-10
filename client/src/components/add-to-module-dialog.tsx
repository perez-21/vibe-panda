import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FolderPlus, FolderOpen, Globe, Lock, Check, Loader2 } from "lucide-react";
import type { Module } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddToModuleDialogProps {
  noteId: string;
  noteTitle?: string;
  trigger?: "icon" | "button";
}

export function AddToModuleDialog({ noteId, noteTitle, trigger = "icon" }: AddToModuleDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: modules, isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
    enabled: open,
  });

  const { data: noteModuleIds, isLoading: membershipLoading } = useQuery<string[]>({
    queryKey: ["/api/notes", noteId, "modules"],
    queryFn: async () => {
      const res = await fetch(`/api/notes/${noteId}/modules`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const isLoading = modulesLoading || membershipLoading;

  const addMutation = useMutation({
    mutationFn: async (moduleId: string) => {
      await apiRequest("POST", `/api/modules/${moduleId}/items`, { noteId });
    },
    onSuccess: (_, moduleId) => {
      const moduleName = modules?.find((m) => m.id === moduleId)?.title || "module";
      queryClient.invalidateQueries({ queryKey: ["/api/notes", noteId, "modules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/modules", moduleId] });
      toast({ title: `Added to "${moduleName}"` });
    },
    onError: (e: any) => {
      toast({ title: "Failed to add", description: e.message, variant: "destructive" });
    },
  });

  return (
    <>
      {trigger === "icon" ? (
        <Button
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          data-testid={`button-add-to-module-${noteId}`}
          title="Add to module"
        >
          <FolderPlus className="w-4 h-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          data-testid={`button-add-to-module-${noteId}`}
        >
          <FolderPlus className="w-4 h-4 mr-1" />
          Add to Module
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Module</DialogTitle>
            {noteTitle && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                "{noteTitle}"
              </p>
            )}
          </DialogHeader>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : modules && modules.length > 0 ? (
              modules.map((mod) => {
                const alreadyIn = noteModuleIds?.includes(mod.id) ?? false;
                return (
                  <div
                    key={mod.id}
                    className={`flex items-center justify-between p-3 rounded-md ${alreadyIn ? "bg-muted/50" : "hover:bg-muted cursor-pointer"}`}
                    data-testid={`module-option-${mod.id}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FolderOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{mod.title}</p>
                        <div className="flex items-center gap-1">
                          {mod.isPublic ? (
                            <Globe className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {mod.isPublic ? "Public" : "Private"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {alreadyIn ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5" />
                        Added
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          addMutation.mutate(mod.id);
                        }}
                        disabled={addMutation.isPending}
                        data-testid={`button-add-to-${mod.id}`}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  You don't have any modules yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a module first to organize your notes.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

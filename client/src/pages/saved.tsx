import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, FileText, FolderOpen, Trash2 } from "lucide-react";
import type { Note, Module, SavedItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type SavedItemWithData = SavedItem & {
  note?: Note & { owner: { displayName: string } };
  module?: Module & { owner: { displayName: string } };
};

export default function Saved() {
  const { toast } = useToast();

  const { data: savedItems, isLoading } = useQuery<SavedItemWithData[]>({
    queryKey: ["/api/saved"],
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/saved/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved"] });
      toast({ title: "Removed from collection" });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Saved Collection</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Notes and modules you've saved for quick access.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-md" />
          ))}
        </div>
      ) : savedItems && savedItems.length > 0 ? (
        <div className="space-y-2">
          {savedItems.map((item) => (
            <Card key={item.id} className="hover-elevate">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={item.noteId ? `/notes/${item.noteId}` : `/modules/${item.moduleId}`}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {item.noteId ? (
                        <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <FolderOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate" data-testid={`text-saved-item-${item.id}`}>
                          {item.note?.title || item.module?.title || "Untitled"}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {item.noteId ? "Note" : "Module"}
                          </Badge>
                          {(item.note?.owner || item.module?.owner) && (
                            <span className="text-xs text-muted-foreground">
                              by {item.note?.owner?.displayName || item.module?.owner?.displayName}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            Saved {format(new Date(item.savedAt), "MMM d, yyyy")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeMutation.mutate(item.id)}
                    data-testid={`button-remove-saved-${item.id}`}
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
            <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold mb-1">Nothing saved yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Browse the Explore page and save notes or modules to your collection.
            </p>
            <Link href="/explore">
              <Button variant="outline" data-testid="button-go-explore">
                Explore Content
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Share2, UserPlus, X, Users } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ShareDialogProps {
  resourceType: "notes" | "modules";
  resourceId: string;
}

interface CollaboratorEntry {
  id: string;
  userId: string;
  role: string;
  user: { displayName: string; email: string; username: string };
}

export function ShareDialog({ resourceType, resourceId }: ShareDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const { data: collaborators, isLoading } = useQuery<CollaboratorEntry[]>({
    queryKey: [`/api/${resourceType}/${resourceId}/collaborators`],
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/${resourceType}/${resourceId}/collaborators`, { email, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${resourceType}/${resourceId}/collaborators`] });
      toast({ title: "Collaborator added" });
      setEmail("");
      setRole("viewer");
    },
    onError: (e: any) => {
      toast({ title: "Failed to add", description: e.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (collabId: string) => {
      await apiRequest("DELETE", `/api/${resourceType}/${resourceId}/collaborators/${collabId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${resourceType}/${resourceId}/collaborators`] });
      toast({ title: "Collaborator removed" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-share">
          <Share2 className="w-4 h-4 mr-1" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Share {resourceType === "notes" ? "Note" : "Module"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="input-share-email"
              placeholder="Enter email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-28" data-testid="select-share-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="commenter">Commenter</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!email.trim() || addMutation.isPending}
              data-testid="button-add-collaborator"
              size="icon"
            >
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              {isLoading ? "Loading..." : `${collaborators?.length || 0} collaborator${(collaborators?.length || 0) !== 1 ? "s" : ""}`}
            </p>
            {collaborators?.map((collab) => (
              <div
                key={collab.id}
                className="flex items-center justify-between gap-2 p-2 rounded-md border"
                data-testid={`collaborator-${collab.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{collab.user.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">{collab.user.email}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {collab.role}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0"
                  onClick={() => removeMutation.mutate(collab.id)}
                  data-testid={`button-remove-collaborator-${collab.id}`}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

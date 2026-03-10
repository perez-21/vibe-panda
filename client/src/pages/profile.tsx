import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Save } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.displayName || "");

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const profileMutation = useMutation({
    mutationFn: async (data: { displayName: string }) => {
      const res = await apiRequest("PATCH", "/api/auth/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Profile updated", description: "Your display name has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (avatar: string) => {
      const res = await apiRequest("POST", "/api/auth/avatar", { avatar });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({ title: "Avatar updated", description: "Your profile picture has been updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 2MB.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = reader.result as string;
      avatarMutation.mutate(dataUri);
    };
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const handleSave = () => {
    profileMutation.mutate({ displayName });
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-profile-title">Profile Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account information</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="relative group">
            <Avatar className="h-20 w-20 cursor-pointer" onClick={handleAvatarClick} data-testid="button-avatar-upload">
              {user.avatar && <AvatarImage src={user.avatar} alt={user.displayName} />}
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {getInitials(user.displayName)}
              </AvatarFallback>
            </Avatar>
            <div
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleAvatarClick}
            >
              <Camera className="w-6 h-6 text-white" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              data-testid="input-avatar-file"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold" data-testid="text-profile-displayname">{user.displayName}</p>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
            {avatarMutation.isPending && (
              <p className="text-xs text-muted-foreground mt-1">Uploading avatar...</p>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              data-testid="input-profile-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              data-testid="input-profile-username"
              value={user.username}
              disabled
              className="opacity-60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="input-profile-email"
              value={user.email}
              disabled
              className="opacity-60"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={profileMutation.isPending || displayName.trim() === user.displayName}
            data-testid="button-save-profile"
          >
            {profileMutation.isPending ? "Saving..." : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

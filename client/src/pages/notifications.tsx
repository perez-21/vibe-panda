import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Bell, CheckCheck, FileText, FolderOpen, MessageSquare, Share2, AlertCircle } from "lucide-react";
import type { Notification } from "@shared/schema";

type NotificationWithActor = Notification & {
  actor: { displayName: string; username: string; avatar: string | null };
};

function getNotificationIcon(type: string) {
  switch (type) {
    case "note_edited":
      return <FileText className="w-4 h-4 text-blue-500" />;
    case "comment_added":
    case "comment_reply":
      return <MessageSquare className="w-4 h-4 text-green-500" />;
    case "note_shared":
      return <Share2 className="w-4 h-4 text-purple-500" />;
    case "module_shared":
      return <FolderOpen className="w-4 h-4 text-orange-500" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function Notifications() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: notifications, isLoading, isError } = useQuery<NotificationWithActor[]>({
    queryKey: ["/api/notifications"],
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => {
      toast({ title: "Failed to mark notification as read", variant: "destructive" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => {
      toast({ title: "Failed to mark all as read", variant: "destructive" });
    },
  });

  const handleClick = (notification: NotificationWithActor) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-notifications-title">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-unread-count">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="text-notifications-error">
          <AlertCircle className="w-12 h-12 text-destructive/50 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">Failed to load notifications</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">Please try refreshing the page.</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !notifications?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="text-notifications-empty">
          <Bell className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No notifications yet</h3>
          <p className="text-sm text-muted-foreground/70 mt-1">
            You'll be notified when someone shares, edits, or comments on your notes.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`w-full text-left p-4 rounded-lg border transition-colors hover:bg-accent/50 flex items-start gap-3 ${
                notification.isRead ? "opacity-60" : "bg-accent/20 border-primary/10"
              }`}
              data-testid={`button-notification-${notification.id}`}
            >
              <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                {notification.actor.avatar && (
                  <AvatarImage src={notification.actor.avatar} alt={notification.actor.displayName} />
                )}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {notification.actor.displayName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {getNotificationIcon(notification.type)}
                  <span className="text-sm font-medium truncate" data-testid={`text-notification-title-${notification.id}`}>
                    {notification.title}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2" data-testid={`text-notification-message-${notification.id}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1" data-testid={`text-notification-time-${notification.id}`}>
                  {timeAgo(notification.createdAt as unknown as string)}
                </p>
              </div>
              {!notification.isRead && (
                <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" data-testid={`indicator-unread-${notification.id}`} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

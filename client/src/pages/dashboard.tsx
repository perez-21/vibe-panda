import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, FolderOpen, Compass, Bookmark, Plus, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Note, Module } from "@shared/schema";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: recentNotes, isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: recentModules, isLoading: modulesLoading } = useQuery<Module[]>({
    queryKey: ["/api/modules"],
  });

  const { data: savedItems, isLoading: savedLoading } = useQuery<any[]>({
    queryKey: ["/api/saved"],
  });

  const stats = [
    {
      label: "My Notes",
      value: recentNotes?.length ?? 0,
      icon: FileText,
      href: "/notes",
      color: "text-blue-500",
    },
    {
      label: "My Modules",
      value: recentModules?.length ?? 0,
      icon: FolderOpen,
      href: "/modules",
      color: "text-emerald-500",
    },
    {
      label: "Saved Items",
      value: savedItems?.length ?? 0,
      icon: Bookmark,
      href: "/saved",
      color: "text-amber-500",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-dashboard-greeting">
          Welcome back, {user?.displayName?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your study materials.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover-elevate cursor-pointer">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1" data-testid={`text-stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                      {notesLoading || modulesLoading || savedLoading ? (
                        <Skeleton className="h-8 w-12" />
                      ) : (
                        stat.value
                      )}
                    </p>
                  </div>
                  <div className={`p-2 rounded-md bg-muted ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Recent Notes</h2>
            <Link href="/notes">
              <Button variant="ghost" size="sm" data-testid="link-view-all-notes">
                View All
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          {notesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : recentNotes && recentNotes.length > 0 ? (
            <div className="space-y-2">
              {recentNotes.slice(0, 5).map((note) => (
                <Link key={note.id} href={`/notes/${note.id}`}>
                  <Card className="hover-elevate cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" data-testid={`text-note-title-${note.id}`}>
                            {note.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(note.updatedAt), "MMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                        <Badge variant={note.isPublic ? "default" : "secondary"}>
                          {note.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No notes yet. Create your first note!</p>
                <Link href="/notes/new">
                  <Button size="sm" data-testid="button-create-first-note">
                    <Plus className="w-4 h-4 mr-1" />
                    New Note
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Recent Modules</h2>
            <Link href="/modules">
              <Button variant="ghost" size="sm" data-testid="link-view-all-modules">
                View All
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </Link>
          </div>

          {modulesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : recentModules && recentModules.length > 0 ? (
            <div className="space-y-2">
              {recentModules.slice(0, 5).map((mod) => (
                <Link key={mod.id} href={`/modules/${mod.id}`}>
                  <Card className="hover-elevate cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" data-testid={`text-module-title-${mod.id}`}>
                            {mod.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {mod.description || "No description"}
                          </p>
                        </div>
                        <Badge variant={mod.isPublic ? "default" : "secondary"}>
                          {mod.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                      {mod.categoryLabels && mod.categoryLabels.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {mod.categoryLabels.slice(0, 3).map((label) => (
                            <Badge key={label} variant="outline" className="text-xs">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No modules yet. Create one to organize your notes!</p>
                <Link href="/modules">
                  <Button size="sm" data-testid="button-create-first-module">
                    <Plus className="w-4 h-4 mr-1" />
                    New Module
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card className="hover-elevate">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-md bg-primary/10">
              <Compass className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">Explore Community Notes</h3>
              <p className="text-sm text-muted-foreground">
                Discover public notes and modules shared by other students.
              </p>
            </div>
            <Link href="/explore">
              <Button variant="outline" data-testid="button-explore">
                Explore
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

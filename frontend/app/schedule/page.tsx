"use client";

import * as React from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NewPostDialog, NewPostAccount } from "@/components/new-post-dialog";

interface ScheduledPost {
  id: number;
  account_id: number;
  media_url: string;
  caption: string | null;
  post_type: "feed" | "reel" | "story";
  scheduled_time: string;
  status: "pending" | "published" | "failed" | "cancelled";
}

const filters = [
  { label: "All", value: "all" },
  { label: "Feed", value: "feed" },
  { label: "Reels", value: "reel" },
  { label: "Stories", value: "story" },
  { label: "Pending", value: "pending" },
  { label: "Published", value: "published" },
  { label: "Failed", value: "failed" }
] as const;

export default function SchedulePage() {
  const [posts, setPosts] = React.useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = React.useState<NewPostAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<(typeof filters)[number]["value"]>(
    "all"
  );
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);

  const fetchPosts = React.useCallback(async () => {
    try {
      const res = await api.get<ScheduledPost[]>("/posts");
      setPosts(res.data);
    } catch (err) {
      toast.error("Failed to load scheduled posts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = React.useCallback(async () => {
    try {
      const res = await api.get<NewPostAccount[]>("/accounts");
      setAccounts(res.data);
    } catch (err) {
      setAccounts([]);
    }
  }, []);

  React.useEffect(() => {
    fetchPosts();
    fetchAccounts();
  }, [fetchPosts, fetchAccounts]);

  React.useEffect(() => {
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const filteredPosts = posts.filter((post) => {
    if (filter === "all") return true;
    if (["feed", "reel", "story"].includes(filter)) {
      return post.post_type === filter;
    }
    return post.status === filter;
  });

  const handleDelete = async (postId: number) => {
    try {
      await api.delete(`/posts/${postId}`);
      toast.success("Post cancelled");
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to delete post";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Plan and manage upcoming Instagram posts.
          </p>
          {resultMessage ? (
            <p className="mt-2 text-sm text-emerald-600">{resultMessage}</p>
          ) : null}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New post
        </Button>
      </div>

      <NewPostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        onSuccess={(count) => {
          setResultMessage(`Scheduled ${count} posts.`);
          fetchPosts();
        }}
      />

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item.value}
            variant={filter === item.value ? "default" : "secondary"}
            size="sm"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading posts...</p>
      ) : filteredPosts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No scheduled posts</CardTitle>
            <CardDescription>
              Schedule posts to see them appear here.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const account = accounts.find((acc) => acc.id === post.account_id);
            const initials = account?.username?.slice(0, 2).toUpperCase() || "IG";
            const caption = post.caption || "";
            const truncated =
              caption.length > 100 ? `${caption.slice(0, 100)}...` : caption;

            const typeBadge =
              post.post_type === "feed"
                ? { label: "Feed", variant: "info" }
                : post.post_type === "reel"
                ? { label: "Reel", variant: "purple" }
                : { label: "Story", variant: "secondary" };

            const statusBadge =
              post.status === "pending"
                ? { label: "Pending", variant: "warning" }
                : post.status === "published"
                ? { label: "Published", variant: "success" }
                : { label: "Failed", variant: "destructive" };

            return (
              <Card key={post.id}>
                <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
                  <div className="relative h-24 w-24 overflow-hidden rounded-md border">
                    {post.post_type === "reel" ? (
                      <video
                        src={post.media_url}
                        className="h-full w-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={post.media_url}
                        alt="Post media"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={typeBadge.variant as any}>
                        {typeBadge.label}
                      </Badge>
                      <Badge variant={statusBadge.variant as any}>
                        {statusBadge.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{truncated}</p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        {new Date(post.scheduled_time).toLocaleString()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          {account?.avatar_url ? (
                            <AvatarImage
                              src={account.avatar_url}
                              alt={account.username}
                            />
                          ) : null}
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        {account?.username || "Unknown"}
                      </div>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel scheduled post</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will cancel the scheduled post. You can re-schedule it
                          later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(post.id)}>
                          Cancel post
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { CalendarClock, Check, Plus, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Account {
  id: number;
  username: string;
  avatar_url?: string | null;
}

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

const maxCaption = 2200;

export default function SchedulePage() {
  const [posts, setPosts] = React.useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<(typeof filters)[number]["value"]>(
    "all"
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedAccounts, setSelectedAccounts] = React.useState<number[]>([]);
  const [accountsOpen, setAccountsOpen] = React.useState(false);
  const [postType, setPostType] = React.useState<
    "feed" | "reel" | "story"
  >("feed");
  const [caption, setCaption] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [scheduling, setScheduling] = React.useState(false);
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
      const res = await api.get<Account[]>("/accounts");
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
    if (dialogOpen) {
      setResultMessage(null);
    } else {
      setAccountsOpen(false);
    }
  }, [dialogOpen]);

  React.useEffect(() => {
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  React.useEffect(() => {
    if (!mediaFile || !mediaPreview) {
      return;
    }
    return () => {
      URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaFile, mediaPreview]);

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

  const handleAccountToggle = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (file: File | null) => {
    setMediaFile(file);
    setMediaPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSchedule = async () => {
    if (!mediaFile || !scheduledTime || selectedAccounts.length === 0) {
      toast.error("Please complete all required fields");
      return;
    }

    setScheduling(true);
    setResultMessage(null);

    try {
      const requests = selectedAccounts.map((accountId) => {
        const formData = new FormData();
        formData.append("account_id", accountId.toString());
        formData.append("post_type", postType);
        formData.append("caption", caption);
        formData.append("scheduled_time", scheduledTime);
        formData.append("media", mediaFile);
        return api.post("/posts/schedule", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      });

      const results = await Promise.allSettled(requests);
      const successCount = results.filter((r) => r.status === "fulfilled").length;

      setResultMessage(`Scheduled ${successCount} posts.`);
      toast.success(`Scheduled ${successCount} posts`);
      setDialogOpen(false);
      setSelectedAccounts([]);
      setCaption("");
      setScheduledTime("");
      setMediaFile(null);
      setMediaPreview(null);
      fetchPosts();
    } catch (err) {
      toast.error("Failed to schedule posts");
    } finally {
      setScheduling(false);
    }
  };

  const remainingChars = Math.max(0, maxCaption - caption.length);

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New post
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule new post</DialogTitle>
              <DialogDescription>
                Choose accounts, upload media, and set the posting time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Accounts</label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => setAccountsOpen((prev) => !prev)}
                  >
                    {selectedAccounts.length
                      ? `${selectedAccounts.length} selected`
                      : "Select accounts"}
                    <span className="text-xs text-muted-foreground">
                      {accountsOpen ? "Hide" : "Show"}
                    </span>
                  </Button>
                  {accountsOpen ? (
                    <Card className="absolute z-10 mt-2 w-full">
                      <CardContent className="grid max-h-40 gap-2 overflow-y-auto p-3">
                        {accounts.map((account) => {
                          const selected = selectedAccounts.includes(account.id);
                          return (
                            <Button
                              key={account.id}
                              type="button"
                              variant={selected ? "default" : "secondary"}
                              size="sm"
                              className="justify-start"
                              onClick={() => handleAccountToggle(account.id)}
                            >
                              {selected ? (
                                <Check className="mr-2 h-4 w-4" />
                              ) : null}
                              {account.username}
                            </Button>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Post type</label>
                <Select value={postType} onValueChange={(val) => setPostType(val as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feed">Feed</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Media</label>
                <Input
                  type="file"
                  accept={postType === "reel" ? "video/*" : "image/*"}
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] || null)
                  }
                />
                {mediaPreview ? (
                  <div className="mt-2 overflow-hidden rounded-md border">
                    {postType === "reel" ? (
                      <video
                        src={mediaPreview}
                        className="h-48 w-full object-cover"
                        controls
                      />
                    ) : (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="h-48 w-full object-cover"
                      />
                    )}
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Caption</label>
                  <span className="text-xs text-muted-foreground">
                    {remainingChars} characters left
                  </span>
                </div>
                <Textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  maxLength={maxCaption}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Scheduled time</label>
                <Input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSchedule}
                disabled={
                  scheduling ||
                  selectedAccounts.length === 0 ||
                  !scheduledTime ||
                  !mediaFile
                }
              >
                {scheduling ? "Scheduling..." : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

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

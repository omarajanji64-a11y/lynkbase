"use client";

import * as React from "react";
import { Check, Image as ImageIcon, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StoryPost {
  id: number;
  account_id: number;
  media_url: string;
  caption: string | null;
  post_type: "story" | "feed" | "reel";
  scheduled_time: string;
  status: "pending" | "published" | "failed" | "cancelled";
}

interface Account {
  id: number;
  username: string;
  avatar_url?: string | null;
}

interface ScheduleStoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onScheduled?: (count: number) => void;
}

const videoExtensions = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"];

function isVideoUrl(url: string) {
  const lowered = url.toLowerCase();
  return videoExtensions.some((ext) => lowered.includes(ext));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function ScheduleStoryDialog({
  open,
  onOpenChange,
  accounts,
  onScheduled
}: ScheduleStoryDialogProps) {
  const [selectedAccounts, setSelectedAccounts] = React.useState<number[]>([]);
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [isVideo, setIsVideo] = React.useState(false);
  const [scheduling, setScheduling] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);
  const [accountsOpen, setAccountsOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const resetForm = React.useCallback(() => {
    setSelectedAccounts([]);
    setScheduledTime("");
    setCaption("");
    setMediaFile(null);
    setMediaPreview(null);
    setIsVideo(false);
    setAccountsOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      setResultMessage(null);
    } else {
      setResultMessage(null);
      resetForm();
    }
  }, [open, resetForm]);

  React.useEffect(() => {
    if (!mediaFile || !mediaPreview) {
      return;
    }
    return () => {
      URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaFile, mediaPreview]);

  const toggleAccount = (id: number) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleFileChange = (file: File | null) => {
    setMediaFile(file);
    if (!file) {
      setMediaPreview(null);
      setIsVideo(false);
      return;
    }
    setMediaPreview(URL.createObjectURL(file));
    setIsVideo(file.type.startsWith("video/"));
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
        formData.append("post_type", "story");
        formData.append("scheduled_time", scheduledTime);
        if (isVideo) {
          formData.append("caption", caption);
        }
        formData.append("media", mediaFile);

        return api.post("/posts/schedule", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      });

      const results = await Promise.allSettled(requests);
      const successCount = results.filter((result) => result.status === "fulfilled")
        .length;
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(`Scheduled ${successCount} stories`);
        onScheduled?.(successCount);
        resetForm();
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} stories failed to schedule`);
      }

      if (successCount > 0) {
        setResultMessage(`Scheduled ${successCount} stories.`);
      } else {
        setResultMessage(null);
      }
    } catch (err) {
      toast.error("Failed to schedule stories");
    } finally {
      setScheduling(false);
    }
  };

  const selectedNames = selectedAccounts
    .map((id) => accounts.find((account) => account.id === id)?.username)
    .filter(Boolean) as string[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Schedule story</DialogTitle>
          <DialogDescription>
            Pick accounts, upload media, and set the time for your story.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Accounts</label>
            <Popover open={accountsOpen} onOpenChange={setAccountsOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="secondary" className="w-full">
                  {selectedAccounts.length
                    ? `${selectedAccounts.length} selected`
                    : "Select accounts"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0" align="start">
                <Card>
                  <CardContent className="grid max-h-48 gap-2 overflow-y-auto p-3">
                    {accounts.map((account) => {
                      const selected = selectedAccounts.includes(account.id);
                      return (
                        <Button
                          key={account.id}
                          type="button"
                          variant={selected ? "default" : "secondary"}
                          size="sm"
                          className="justify-start"
                          onClick={() => toggleAccount(account.id)}
                        >
                          {selected ? <Check className="mr-2 h-4 w-4" /> : null}
                          {account.username}
                        </Button>
                      );
                    })}
                  </CardContent>
                </Card>
              </PopoverContent>
            </Popover>
            {selectedNames.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedNames.map((name) => (
                  <Badge key={name} variant="secondary">
                    {name}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Media</label>
            <Input
              type="file"
              accept="image/*,video/*"
              ref={fileInputRef}
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
            />
            {mediaPreview ? (
              <div className="mt-3 flex justify-center">
                <div className="aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-md border bg-muted/30">
                  {isVideo ? (
                    <video
                      src={mediaPreview}
                      className="h-full w-full object-cover"
                      controls
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Story preview"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="h-4 w-4" />
                Upload an image or video to preview.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Scheduled time</label>
            <Input
              type="datetime-local"
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
            />
          </div>

          {isVideo ? (
            <div className="space-y-2">
              <label className="text-sm font-medium">Caption (optional)</label>
              <Textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={3}
              />
            </div>
          ) : null}

          {resultMessage ? (
            <p className="text-sm text-muted-foreground">{resultMessage}</p>
          ) : null}
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
            {scheduling ? "Scheduling stories..." : "Schedule story"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function StoriesPage() {
  const [stories, setStories] = React.useState<StoryPost[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filterAccount, setFilterAccount] = React.useState<number | "all">("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);

  const fetchStories = React.useCallback(async () => {
    try {
      const res = await api.get<StoryPost[]>("/posts");
      setStories(res.data.filter((post) => post.post_type === "story"));
    } catch (err) {
      toast.error("Failed to load stories");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAccounts = React.useCallback(async () => {
    try {
      const res = await api.get<Account[]>("/accounts");
      setAccounts(res.data);
    } catch (err) {
      toast.error("Failed to load accounts");
      setAccounts([]);
    }
  }, []);

  React.useEffect(() => {
    fetchStories();
    fetchAccounts();
  }, [fetchStories, fetchAccounts]);

  React.useEffect(() => {
    const interval = setInterval(fetchStories, 30000);
    return () => clearInterval(interval);
  }, [fetchStories]);

  const accountMap = React.useMemo(() => {
    const map = new Map<number, Account>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);

  const filteredStories = stories.filter((story) => {
    if (filterAccount === "all") {
      return true;
    }
    return story.account_id === filterAccount;
  });

  const handleDelete = async (postId: number) => {
    try {
      await api.delete(`/posts/${postId}`);
      toast.success("Story deleted");
      setStories((prev) => prev.filter((post) => post.id !== postId));
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to delete story";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Stories</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage scheduled Instagram stories.
          </p>
          {resultMessage ? (
            <p className="mt-2 text-sm text-emerald-600">{resultMessage}</p>
          ) : null}
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule story
        </Button>
      </div>

      <ScheduleStoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        onScheduled={(count) => {
          setResultMessage(`Scheduled ${count} stories.`);
          fetchStories();
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filterAccount === "all" ? "default" : "secondary"}
          onClick={() => setFilterAccount("all")}
        >
          All accounts
        </Button>
        {accounts.map((account) => (
          <Button
            key={account.id}
            size="sm"
            variant={filterAccount === account.id ? "default" : "secondary"}
            onClick={() => setFilterAccount(account.id)}
          >
            {account.username}
          </Button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading stories...</p>
      ) : stories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="rounded-full bg-muted p-4">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">
              No stories scheduled yet — click Schedule story to get started
            </p>
          </CardContent>
        </Card>
      ) : filteredStories.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No stories for this account</CardTitle>
            <CardDescription>
              Try selecting another account to see its scheduled stories.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStories.map((story) => {
            const account = accountMap.get(story.account_id);
            const initials = account?.username?.slice(0, 2).toUpperCase() || "IG";

            const statusBadge =
              story.status === "pending"
                ? { label: "Pending", variant: "warning" }
                : story.status === "published"
                ? { label: "Published", variant: "success" }
                : story.status === "failed"
                ? { label: "Failed", variant: "destructive" }
                : {
                    label: story.status.charAt(0).toUpperCase() + story.status.slice(1),
                    variant: "secondary"
                  };

            return (
              <Card key={story.id} className="overflow-hidden">
                <CardContent className="space-y-4 p-4">
                  <div className="aspect-[9/16] w-full overflow-hidden rounded-md border bg-muted/30">
                    {isVideoUrl(story.media_url) ? (
                      <video
                        src={story.media_url}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={story.media_url}
                        alt="Story media"
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        {account?.avatar_url ? (
                          <AvatarImage
                            src={account.avatar_url}
                            alt={account.username}
                          />
                        ) : null}
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {account?.username || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(story.scheduled_time)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusBadge.variant as any}>
                      {statusBadge.label}
                    </Badge>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="w-full">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete scheduled story</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the scheduled story. You can schedule it
                          again later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(story.id)}>
                          Delete story
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

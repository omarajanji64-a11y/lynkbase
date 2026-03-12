"use client";

import * as React from "react";
import { Check, Upload } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface NewPostAccount {
  id: number;
  username: string;
  avatar_url?: string | null;
}

interface NewPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: NewPostAccount[];
  initialScheduledTime?: Date | string | null;
  onSuccess?: (count: number) => void;
}

const maxCaption = 2200;

function formatDateTimeLocal(value: Date): string {
  const pad = (num: number) => num.toString().padStart(2, "0");
  const year = value.getFullYear();
  const month = pad(value.getMonth() + 1);
  const day = pad(value.getDate());
  const hours = pad(value.getHours());
  const minutes = pad(value.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function NewPostDialog({
  open,
  onOpenChange,
  accounts,
  initialScheduledTime,
  onSuccess
}: NewPostDialogProps) {
  const [selectedAccounts, setSelectedAccounts] = React.useState<number[]>([]);
  const [postType, setPostType] = React.useState<
    "feed" | "reel" | "story"
  >("feed");
  const [caption, setCaption] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [scheduling, setScheduling] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<string | null>(null);
  const [accountsOpen, setAccountsOpen] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setResultMessage(null);
      if (initialScheduledTime) {
        const date =
          initialScheduledTime instanceof Date
            ? initialScheduledTime
            : new Date(initialScheduledTime);
        if (!Number.isNaN(date.getTime())) {
          setScheduledTime(formatDateTimeLocal(date));
        }
      }
    } else {
      setAccountsOpen(false);
      setSelectedAccounts([]);
      setPostType("feed");
      setCaption("");
      setScheduledTime("");
      setMediaFile(null);
      setMediaPreview(null);
    }
  }, [open, initialScheduledTime]);

  React.useEffect(() => {
    if (!mediaFile || !mediaPreview) {
      return;
    }
    return () => {
      URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaFile, mediaPreview]);

  const remainingChars = Math.max(0, maxCaption - caption.length);

  const toggleAccount = (id: number) => {
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
      const failureCount = results.length - successCount;

      if (successCount > 0) {
        toast.success(`Scheduled ${successCount} posts`);
      }
      if (failureCount > 0) {
        toast.error(`${failureCount} posts failed to schedule`);
      }

      const message = `Scheduled ${successCount} posts.`;
      setResultMessage(message);
      onSuccess?.(successCount);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to schedule posts");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Popover open={accountsOpen} onOpenChange={setAccountsOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="secondary" className="w-full">
                  {selectedAccounts.length
                    ? `${selectedAccounts.length} selected`
                    : "Select accounts"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[280px] p-0">
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
              onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
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
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Upload className="h-4 w-4" />
                Upload a file to preview.
              </div>
            )}
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
            {scheduling ? "Scheduling..." : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

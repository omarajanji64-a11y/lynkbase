"use client";

import * as React from "react";
import { Check, Image as ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Account {
  id: number;
  username: string;
  is_active?: boolean;
  avatar_url?: string | null;
}

interface HighlightStory {
  id?: number;
  story_id?: number;
  media_url: string;
  added_at?: string;
  created_at?: string;
}

interface Highlight {
  id: number;
  name: string;
  cover_url?: string | null;
  stories_count?: number;
  story_count?: number;
  stories?: HighlightStory[];
}

interface PublishedStory {
  id: number;
  media_url: string;
  created_at?: string;
  published_at?: string;
}

const highlightNameLimit = 15;
const highlightLabelLimit = 12;

function truncateHighlightName(name: string) {
  if (name.length <= highlightLabelLimit) return name;
  return `${name.slice(0, highlightLabelLimit)}…`;
}

function formatStoryDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

const videoExtensions = [".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"];

function isVideoUrl(url: string) {
  const lowered = url.toLowerCase();
  return videoExtensions.some((ext) => lowered.includes(ext));
}

function getStoryId(story: HighlightStory | PublishedStory) {
  return "story_id" in story ? story.story_id ?? story.id : story.id;
}

function getHighlightCount(highlight: Highlight) {
  if (typeof highlight.stories_count === "number") return highlight.stories_count;
  if (typeof highlight.story_count === "number") return highlight.story_count;
  return highlight.stories?.length ?? 0;
}

interface NewHighlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number | null;
  onCreated?: (highlight: Highlight) => void;
}

function NewHighlightDialog({
  open,
  onOpenChange,
  accountId,
  onCreated
}: NewHighlightDialogProps) {
  const [name, setName] = React.useState("");
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreview, setCoverPreview] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setCoverFile(null);
      setCoverPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open]);

  React.useEffect(() => {
    if (!coverPreview || !coverPreview.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const handleCoverChange = (file: File | null) => {
    setCoverFile(file);
    if (!file) {
      setCoverPreview(null);
      return;
    }
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!accountId) {
      toast.error("Select an account first");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter a highlight name");
      return;
    }
    if (!coverFile) {
      toast.error("Upload a cover image");
      return;
    }

    setCreating(true);
    try {
      const formData = new FormData();
      formData.append("account_id", accountId.toString());
      formData.append("name", name.trim());
      formData.append("cover", coverFile);

      const res = await api.post("/highlights", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Highlight created");
      onCreated?.(res.data);
      onOpenChange(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to create highlight";
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New highlight</DialogTitle>
          <DialogDescription>
            Create a highlight to group your story moments together.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Highlight name</label>
              <span className="text-xs text-muted-foreground">
                {name.length}/{highlightNameLimit}
              </span>
            </div>
            <Input
              value={name}
              maxLength={highlightNameLimit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cover image</label>
            <Input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(event) =>
                handleCoverChange(event.target.files?.[0] || null)
              }
            />
            <div className="mt-3 flex items-center gap-3">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload a square image for the highlight cover.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Creating..." : "Create highlight"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EditHighlightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  highlight: Highlight | null;
  onUpdated?: () => void;
  onDeleted?: (highlightId: number) => void;
}

function EditHighlightDialog({
  open,
  onOpenChange,
  highlight,
  onUpdated,
  onDeleted
}: EditHighlightDialogProps) {
  const [name, setName] = React.useState("");
  const [coverFile, setCoverFile] = React.useState<File | null>(null);
  const [coverPreview, setCoverPreview] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open && highlight) {
      setName(highlight.name);
      setCoverFile(null);
      setCoverPreview(highlight.cover_url ?? null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [open, highlight]);

  React.useEffect(() => {
    if (!coverPreview || !coverPreview.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const handleCoverChange = (file: File | null) => {
    setCoverFile(file);
    if (!file) {
      setCoverPreview(highlight?.cover_url ?? null);
      return;
    }
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!highlight) return;

    const updates: Promise<unknown>[] = [];
    const trimmedName = name.trim();

    if (!trimmedName) {
      toast.error("Highlight name cannot be empty");
      return;
    }

    if (trimmedName && trimmedName !== highlight.name) {
      updates.push(api.put(`/highlights/${highlight.id}`, { name: trimmedName }));
    }

    if (coverFile) {
      const formData = new FormData();
      formData.append("cover", coverFile);
      updates.push(
        api.put(`/highlights/${highlight.id}/cover`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      );
    }

    if (updates.length === 0) {
      onOpenChange(false);
      return;
    }

    setSaving(true);
    try {
      await Promise.all(updates);
      toast.success("Highlight updated");
      onUpdated?.();
      onOpenChange(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to update highlight";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!highlight) return;
    try {
      await api.delete(`/highlights/${highlight.id}`);
      toast.success("Highlight deleted");
      onDeleted?.(highlight.id);
      onOpenChange(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to delete highlight";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit highlight</DialogTitle>
          <DialogDescription>Update the title or cover.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Highlight name</label>
              <span className="text-xs text-muted-foreground">
                {name.length}/{highlightNameLimit}
              </span>
            </div>
            <Input
              value={name}
              maxLength={highlightNameLimit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Cover image</label>
            <Input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={(event) =>
                handleCoverChange(event.target.files?.[0] || null)
              }
            />
            <div className="mt-3 flex items-center gap-3">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Cover preview"
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Upload a new cover to replace the existing one.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="items-center justify-between gap-3 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete highlight
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete highlight</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the highlight and its story
                  references.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete highlight
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddStoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: number | null;
  highlightId: number | null;
  onAdded?: () => void;
}

function AddStoriesDialog({
  open,
  onOpenChange,
  accountId,
  highlightId,
  onAdded
}: AddStoriesDialogProps) {
  const [stories, setStories] = React.useState<PublishedStory[]>([]);
  const [selectedStories, setSelectedStories] = React.useState<number[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setStories([]);
      setSelectedStories([]);
      return;
    }

    if (!accountId) {
      setStories([]);
      return;
    }

    const fetchStories = async () => {
      setLoading(true);
      try {
        const res = await api.get<PublishedStory[]>("/posts", {
          params: {
            account_id: accountId,
            post_type: "story",
            status: "published"
          }
        });
        setStories(res.data || []);
      } catch (err) {
        toast.error("Failed to load published stories");
        setStories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, [open, accountId]);

  const toggleStory = (storyId: number) => {
    setSelectedStories((prev) =>
      prev.includes(storyId) ? prev.filter((id) => id !== storyId) : [...prev, storyId]
    );
  };

  const handleAdd = async () => {
    if (!highlightId) return;
    if (selectedStories.length === 0) {
      toast.error("Select at least one story");
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/highlights/${highlightId}/stories`, {
        story_ids: selectedStories
      });
      toast.success("Stories added to highlight");
      onAdded?.();
      onOpenChange(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to add stories";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Add stories</DialogTitle>
          <DialogDescription>
            Select published stories to add to this highlight.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading stories...</p>
          ) : stories.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No published stories</CardTitle>
                <CardDescription>
                  Publish stories to make them available here.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stories.map((story) => {
                const storyId = getStoryId(story);
                if (!storyId) return null;
                const selected = selectedStories.includes(storyId);
                return (
                  <Button
                    key={storyId}
                    variant="ghost"
                    className="h-auto w-full p-0"
                    onClick={() => toggleStory(storyId)}
                  >
                    <div
                      className={cn(
                        "relative w-full overflow-hidden rounded-md border",
                        selected && "ring-2 ring-primary"
                      )}
                    >
                      <div className="aspect-[9/16] w-full bg-muted/40">
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
                            alt="Story preview"
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      {selected ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                          <Check className="h-6 w-6" />
                        </div>
                      ) : null}
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleAdd} disabled={submitting}>
            {submitting ? "Adding..." : "Add to highlight"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function HighlightsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [activeAccountId, setActiveAccountId] = React.useState<number | null>(null);
  const [highlights, setHighlights] = React.useState<Highlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = React.useState(true);
  const [selectedHighlightId, setSelectedHighlightId] = React.useState<number | null>(
    null
  );
  const [highlightStories, setHighlightStories] = React.useState<HighlightStory[]>(
    []
  );
  const [storiesLoading, setStoriesLoading] = React.useState(false);

  const [newDialogOpen, setNewDialogOpen] = React.useState(false);
  const [editDialogOpen, setEditDialogOpen] = React.useState(false);
  const [editingHighlight, setEditingHighlight] = React.useState<Highlight | null>(
    null
  );
  const [addStoriesOpen, setAddStoriesOpen] = React.useState(false);

  const fetchAccounts = React.useCallback(async () => {
    try {
      const res = await api.get<Account[]>("/accounts");
      setAccounts(res.data || []);
    } catch (err) {
      toast.error("Failed to load accounts");
      setAccounts([]);
    }
  }, []);

  const fetchHighlights = React.useCallback(async (accountId: number) => {
    setLoadingHighlights(true);
    try {
      const res = await api.get<Highlight[]>("/highlights", {
        params: { account_id: accountId }
      });
      setHighlights(res.data || []);
    } catch (err) {
      toast.error("Failed to load highlights");
      setHighlights([]);
    } finally {
      setLoadingHighlights(false);
    }
  }, []);

  const fetchHighlightStories = React.useCallback(async (highlightId: number) => {
    setStoriesLoading(true);
    try {
      const res = await api.get<HighlightStory[]>(
        `/highlights/${highlightId}/stories`
      );
      setHighlightStories(res.data || []);
    } catch (err) {
      toast.error("Failed to load highlight stories");
      setHighlightStories([]);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  React.useEffect(() => {
    if (accounts.length === 0) return;
    if (activeAccountId !== null) return;
    const activeAccount = accounts.find((account) => account.is_active) || accounts[0];
    setActiveAccountId(activeAccount?.id ?? null);
  }, [accounts, activeAccountId]);

  React.useEffect(() => {
    if (!activeAccountId) return;
    fetchHighlights(activeAccountId);
    setSelectedHighlightId(null);
    setHighlightStories([]);
  }, [activeAccountId, fetchHighlights]);

  const selectedHighlight = React.useMemo(() => {
    return highlights.find((highlight) => highlight.id === selectedHighlightId) || null;
  }, [highlights, selectedHighlightId]);

  const handleSelectHighlight = (highlight: Highlight) => {
    setSelectedHighlightId(highlight.id);
    if (highlight.stories) {
      setHighlightStories(highlight.stories);
    } else {
      fetchHighlightStories(highlight.id);
    }
  };

  const handleRemoveStory = async (storyId: number) => {
    if (!selectedHighlightId) return;
    try {
      await api.delete(`/highlights/${selectedHighlightId}/stories/${storyId}`);
      toast.success("Story removed");
      fetchHighlightStories(selectedHighlightId);
      if (activeAccountId) {
        fetchHighlights(activeAccountId);
      }
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to remove story";
      toast.error(message);
    }
  };

  const handleHighlightCreated = (highlight: Highlight) => {
    setHighlights((prev) => [highlight, ...prev]);
    setSelectedHighlightId(highlight.id);
    setHighlightStories(highlight.stories ?? []);
  };

  const handleHighlightUpdated = () => {
    if (activeAccountId) {
      fetchHighlights(activeAccountId);
    }
  };

  const handleHighlightDeleted = (highlightId: number) => {
    setHighlights((prev) => prev.filter((item) => item.id !== highlightId));
    if (selectedHighlightId === highlightId) {
      setSelectedHighlightId(null);
      setHighlightStories([]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Highlights</h1>
          <p className="text-sm text-muted-foreground">
            Curate and manage story highlights for each account.
          </p>
        </div>
        <Button
          onClick={() => setNewDialogOpen(true)}
          disabled={!activeAccountId}
        >
          <Plus className="mr-2 h-4 w-4" />
          New highlight
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Account</label>
          <Select
            value={activeAccountId ? String(activeAccountId) : ""}
            onValueChange={(value) => setActiveAccountId(Number(value))}
            disabled={accounts.length === 0}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {loadingHighlights ? (
          <p className="text-sm text-muted-foreground">Loading highlights...</p>
        ) : highlights.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="rounded-full bg-muted p-4">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold">
                No highlights yet — create your first one
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="w-full">
            <div className="flex w-max gap-4 pb-4">
              {highlights.map((highlight) => {
                const isSelected = highlight.id === selectedHighlightId;
                const count = getHighlightCount(highlight);
                return (
                  <div
                    key={highlight.id}
                    className="relative flex flex-col items-center gap-2"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto flex-col gap-2 px-2 py-2"
                      onClick={() => handleSelectHighlight(highlight)}
                    >
                      <div
                        className={cn(
                          "rounded-full border-2 p-1",
                          isSelected ? "border-primary" : "border-muted"
                        )}
                      >
                        <Avatar className="h-16 w-16">
                          {highlight.cover_url ? (
                            <AvatarImage
                              src={highlight.cover_url}
                              alt={highlight.name}
                            />
                          ) : null}
                          <AvatarFallback>
                            {highlight.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="text-xs font-medium">
                        {truncateHighlightName(highlight.name)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {count} stories
                      </div>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-7 w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        setEditingHighlight(highlight);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="space-y-4">
        {highlights.length > 0 && !selectedHighlight ? (
          <Card>
            <CardHeader>
              <CardTitle>Select a highlight to view its stories</CardTitle>
            </CardHeader>
          </Card>
        ) : null}

        {selectedHighlight ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedHighlight.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {getHighlightCount(selectedHighlight)} stories in this highlight
                </p>
              </div>
              <Button onClick={() => setAddStoriesOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add stories
              </Button>
            </div>

            {storiesLoading ? (
              <p className="text-sm text-muted-foreground">Loading stories...</p>
            ) : highlightStories.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No stories in this highlight</CardTitle>
                  <CardDescription>
                    Add stories to start building this highlight.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {highlightStories.map((story) => {
                  const storyId = getStoryId(story);
                  if (!storyId) return null;
                  const dateLabel = formatStoryDate(
                    story.added_at || story.created_at
                  );
                  return (
                    <Card key={storyId} className="overflow-hidden">
                      <CardContent className="space-y-3 p-4">
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
                              alt="Highlight story"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-muted-foreground">
                            {dateLabel ? `Added ${dateLabel}` : ""}
                          </p>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove story from highlight
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will remove the story from this highlight.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveStory(storyId)}
                                >
                                  Remove story
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <NewHighlightDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        accountId={activeAccountId}
        onCreated={handleHighlightCreated}
      />

      <EditHighlightDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        highlight={editingHighlight}
        onUpdated={handleHighlightUpdated}
        onDeleted={handleHighlightDeleted}
      />

      <AddStoriesDialog
        open={addStoriesOpen}
        onOpenChange={setAddStoriesOpen}
        accountId={activeAccountId}
        highlightId={selectedHighlightId}
        onAdded={() => {
          if (selectedHighlightId) {
            fetchHighlightStories(selectedHighlightId);
          }
          if (activeAccountId) {
            fetchHighlights(activeAccountId);
          }
        }}
      />
    </div>
  );
}

"use client";

import * as React from "react";
import moment from "moment";
import {
  Calendar as BigCalendar,
  momentLocalizer,
  Views,
  type EventProps
} from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { CalendarClock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  post: ScheduledPost;
}

const localizer = momentLocalizer(moment);

const typeLabels: Record<string, string> = {
  feed: "Feed",
  reel: "Reel",
  story: "Story"
};

export default function CalendarPage() {
  const [posts, setPosts] = React.useState<ScheduledPost[]>([]);
  const [accounts, setAccounts] = React.useState<NewPostAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [date, setDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<"month" | "week">("month");
  const [filterAccounts, setFilterAccounts] = React.useState<number[]>([]);
  const [filterOpen, setFilterOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [prefillTime, setPrefillTime] = React.useState<Date | null>(null);

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
    const interval = setInterval(fetchPosts, 60000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const accountMap = React.useMemo(() => {
    const map = new Map<number, NewPostAccount>();
    accounts.forEach((account) => map.set(account.id, account));
    return map;
  }, [accounts]);

  const events = React.useMemo(() => {
    const filtered = posts.filter((post) => {
      if (filterAccounts.length === 0) {
        return true;
      }
      return filterAccounts.includes(post.account_id);
    });

    return filtered.map((post) => {
      const account = accountMap.get(post.account_id);
      const label = typeLabels[post.post_type] || post.post_type;
      const title = `${account?.username ?? "Unknown"} · ${label}`;
      const start = new Date(post.scheduled_time);
      const end = new Date(start.getTime() + 30 * 60 * 1000);
      return {
        id: post.id,
        title,
        start,
        end,
        post
      } as CalendarEvent;
    });
  }, [posts, filterAccounts, accountMap]);

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

  const handleSelectSlot = (slotInfo: { start: Date }) => {
    setPrefillTime(slotInfo.start);
    setDialogOpen(true);
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    const baseColor =
      event.post.post_type === "feed"
        ? "#a855f7"
        : event.post.post_type === "reel"
        ? "#3b82f6"
        : "#f59e0b";

    let backgroundColor = baseColor;
    let opacity = 1;

    if (event.post.status === "published") {
      opacity = 0.4;
    }

    if (event.post.status === "failed" || event.post.status === "cancelled") {
      backgroundColor = "#ef4444";
      opacity = 0.9;
    }

    return {
      style: {
        backgroundColor,
        border: `1px solid ${backgroundColor}`,
        color: "#fff",
        opacity
      }
    };
  };

  const EventCard = ({ event }: EventProps<CalendarEvent>) => {
    const post = event.post;
    const account = accountMap.get(post.account_id);
    const initials = account?.username?.slice(0, 2).toUpperCase() || "IG";

    const typeBadge =
      post.post_type === "feed"
        ? { label: "Feed", variant: "purple" }
        : post.post_type === "reel"
        ? { label: "Reel", variant: "info" }
        : { label: "Story", variant: "warning" };

    const statusBadge =
      post.status === "pending"
        ? { label: "Pending", variant: "warning" }
        : post.status === "published"
        ? { label: "Published", variant: "success" }
        : { label: "Failed", variant: "destructive" };

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex h-full w-full items-center truncate text-left text-xs font-medium">
            {event.title}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                {account?.avatar_url ? (
                  <AvatarImage src={account.avatar_url} alt={account.username} />
                ) : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="text-sm font-medium">
                {account?.username || "Unknown"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={typeBadge.variant as any}>{typeBadge.label}</Badge>
              <Badge variant={statusBadge.variant as any}>
                {statusBadge.label}
              </Badge>
            </div>
            <div className="overflow-hidden rounded-md border">
              {post.post_type === "reel" ? (
                <video
                  src={post.media_url}
                  className="h-40 w-full object-cover"
                  controls
                />
              ) : (
                <img
                  src={post.media_url}
                  alt="Post media"
                  className="h-40 w-full object-cover"
                />
              )}
            </div>
            {post.caption ? (
              <p className="text-sm text-muted-foreground">{post.caption}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No caption</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {new Date(post.scheduled_time).toLocaleString()}
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full">
                  Delete post
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel scheduled post</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the scheduled post from the queue.
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
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const handlePrev = () => {
    const next = moment(date).subtract(1, view).toDate();
    setDate(next);
  };

  const handleNext = () => {
    const next = moment(date).add(1, view).toDate();
    setDate(next);
  };

  const handleToday = () => {
    setDate(new Date());
  };

  const toggleAccountFilter = (id: number) => {
    setFilterAccounts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Visualize scheduled posts across all accounts.
          </p>
        </div>
        <Button
          onClick={() => {
            setPrefillTime(null);
            setDialogOpen(true);
          }}
        >
          New post
        </Button>
      </div>

      <NewPostDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) {
            setPrefillTime(null);
          }
        }}
        accounts={accounts}
        initialScheduledTime={prefillTime}
        onSuccess={() => {
          fetchPosts();
        }}
      />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="secondary" onClick={handleToday}>
              Today
            </Button>
            <Button size="sm" variant="secondary" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={view === "month" ? "default" : "secondary"}
                onClick={() => setView(Views.MONTH)}
              >
                Month
              </Button>
              <Button
                size="sm"
                variant={view === "week" ? "default" : "secondary"}
                onClick={() => setView(Views.WEEK)}
              >
                Week
              </Button>
            </div>
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="secondary">
                  {filterAccounts.length
                    ? `${filterAccounts.length} accounts`
                    : "All accounts"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0">
                <Card>
                  <CardContent className="grid max-h-48 gap-2 overflow-y-auto p-3">
                    {accounts.map((account) => {
                      const selected = filterAccounts.includes(account.id);
                      return (
                        <Button
                          key={account.id}
                          type="button"
                          variant={selected ? "default" : "secondary"}
                          size="sm"
                          className="justify-start"
                          onClick={() => toggleAccountFilter(account.id)}
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
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading calendar...</p>
      ) : (
        <div className="rounded-lg border bg-card p-2">
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            date={date}
            view={view}
            views={[Views.MONTH, Views.WEEK]}
            onNavigate={setDate}
            onView={(nextView) => setView(nextView as "month" | "week")}
            selectable
            onSelectSlot={handleSelectSlot}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventCard
            }}
            toolbar={false}
            style={{ height: 700 }}
          />
        </div>
      )}
    </div>
  );
}

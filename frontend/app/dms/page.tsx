"use client";

import * as React from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

interface Account {
  id: number;
  username: string;
  is_active?: boolean;
  avatar_url?: string | null;
}

interface DMThread {
  account_id: number;
  username: string;
  thread_id: string;
  last_message: string | null;
  updated_at: string;
  unread_count?: number;
  unread?: boolean;
}

interface DMMessage {
  id: string;
  sender: string | null;
  text: string | null;
  timestamp: string | null;
  optimistic?: boolean;
}

const accountColors = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-lime-500",
  "bg-indigo-500"
];

function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function formatRelativeTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 10) return "now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatMessageTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });
}

function getInitials(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2);
}

function createMessageId(message: { timestamp?: string | null }, index: number) {
  return `${message.timestamp ?? "no-ts"}-${index}`;
}

export default function DmsPage() {
  const [threads, setThreads] = React.useState<DMThread[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loadingThreads, setLoadingThreads] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [accountFilter, setAccountFilter] = React.useState("all");
  const [selectedThread, setSelectedThread] = React.useState<DMThread | null>(null);
  const [messages, setMessages] = React.useState<DMMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [polling, setPolling] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  const accountColorMap = React.useMemo(() => {
    const map = new Map<number, string>();
    accounts.forEach((account, index) => {
      map.set(account.id, accountColors[index % accountColors.length]);
    });
    return map;
  }, [accounts]);

  const fetchAccounts = React.useCallback(async () => {
    try {
      const res = await api.get<Account[]>("/accounts");
      setAccounts(res.data || []);
    } catch (err) {
      toast.error("Failed to load accounts");
      setAccounts([]);
    }
  }, []);

  const fetchThreads = React.useCallback(async () => {
    try {
      const res = await api.get<DMThread[]>("/dms");
      setThreads(res.data || []);
    } catch (err) {
      toast.error("Failed to load threads");
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const fetchMessages = React.useCallback(async (thread: DMThread) => {
    setLoadingMessages(true);
    try {
      const res = await api.get<
        { sender: string | null; text: string | null; timestamp: string | null }[]
      >(`/dms/${thread.account_id}/${thread.thread_id}`);
      const normalized = (res.data || []).map((message, index) => ({
        id: createMessageId(message, index),
        sender: message.sender ?? null,
        text: message.text ?? "",
        timestamp: message.timestamp ?? null
      }));
      normalized.sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return aTime - bTime;
      });
      setMessages(normalized);
    } catch (err) {
      toast.error("Failed to load messages");
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAccounts();
    fetchThreads();
  }, [fetchAccounts, fetchThreads]);

  React.useEffect(() => {
    const interval = setInterval(fetchThreads, 30000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  React.useEffect(() => {
    if (!selectedThread) return;
    fetchMessages(selectedThread);
  }, [selectedThread, fetchMessages]);

  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  React.useEffect(() => {
    if (selectedThread) {
      const updated = threads.find(
        (thread) =>
          thread.thread_id === selectedThread.thread_id &&
          thread.account_id === selectedThread.account_id
      );
      if (updated) {
        setSelectedThread(updated);
      }
    }
  }, [threads, selectedThread]);

  React.useEffect(() => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    const maxHeight = 120;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [replyText]);

  const handleSelectThread = (thread: DMThread) => {
    setSelectedThread(thread);
  };

  const pollAll = async () => {
    if (polling) return;
    setPolling(true);
    try {
      const res = await api.post<{ new_messages: number }>("/dms/poll");
      const count = res.data?.new_messages ?? 0;
      toast.success(`Found ${count} new messages`);
      await fetchThreads();
      if (selectedThread) {
        await fetchMessages(selectedThread);
      }
    } catch (err) {
      toast.error("Failed to refresh messages");
    } finally {
      setPolling(false);
    }
  };

  const handleSend = async () => {
    if (!selectedThread || sending) return;
    const originalText = replyText;
    if (!originalText.trim()) return;

    const account = accounts.find(
      (item) => item.id === selectedThread.account_id
    );

    const optimisticMessage: DMMessage = {
      id: `temp-${Date.now()}`,
      sender: account?.username ?? "You",
      text: originalText,
      timestamp: new Date().toISOString(),
      optimistic: true
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyText("");
    setSending(true);

    try {
      await api.post(`/dms/${selectedThread.account_id}/${selectedThread.thread_id}/reply`, {
        text: originalText
      });
      setMessages((prev) =>
        prev.map((message) =>
          message.id === optimisticMessage.id
            ? { ...message, optimistic: false }
            : message
        )
      );
      toast.success("Message sent");
      setThreads((prev) =>
        prev.map((thread) =>
          thread.thread_id === selectedThread.thread_id &&
          thread.account_id === selectedThread.account_id
            ? {
                ...thread,
                last_message: originalText,
                updated_at: new Date().toISOString()
              }
            : thread
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.filter((message) => message.id !== optimisticMessage.id)
      );
      setReplyText(originalText);
      const message = err?.response?.data?.detail || "Failed to send message";
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = threads.filter((thread) => {
    const matchesAccount =
      accountFilter === "all" || thread.account_id === Number(accountFilter);
    const matchesSearch =
      !searchTerm ||
      (thread.username || "").toLowerCase()
    return matchesAccount && matchesSearch;
  });

  const selectedAccount = selectedThread
    ? accounts.find((account) => account.id === selectedThread.account_id)
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4">
      <div className="relative flex w-80 flex-shrink-0 flex-col rounded-lg border bg-card">
        <div className="space-y-3 border-b p-4">
          <Input
            placeholder="Search by username"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>
                  {account.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 p-3">
            {loadingThreads ? (
              <p className="text-sm text-muted-foreground">Loading threads...</p>
            ) : filteredThreads.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No messages yet</CardTitle>
                  <CardDescription>
                    No messages yet — threads will appear here once your accounts
                    receive DMs
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              filteredThreads.map((thread) => {
                const accountColor =
                  accountColorMap.get(thread.account_id) || "bg-muted-foreground";
                const isSelected =
                  selectedThread?.thread_id === thread.thread_id &&
                  selectedThread?.account_id === thread.account_id;
                const isUnread =
                  (thread.unread_count ?? 0) > 0 || Boolean(thread.unread);

                return (
                  <Button
                    key={`${thread.account_id}-${thread.thread_id}`}
                    variant="ghost"
                    className={cn(
                      "relative h-auto w-full flex-col items-start gap-2 rounded-lg border p-3 text-left",
                      isSelected && "bg-muted"
                    )}
                    onClick={() => handleSelectThread(thread)}
                  >
                    <span
                      className={cn(
                        "absolute left-2 top-2 h-2 w-2 rounded-full",
                        accountColor
                      )}
                    />
                    <div className="flex w-full items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {thread.username ? (
                            <AvatarFallback>
                              {getInitials(thread.username) || "DM"}
                            </AvatarFallback>
                          ) : null}
                        </Avatar>
                        <div>
                          <p
                            className={cn(
                              "text-sm font-semibold",
                              isUnread && "font-bold"
                            )}
                          >
                            {thread.username || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {truncateText(thread.last_message || "", 50)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(thread.updated_at)}
                      </span>
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <Button
          type="button"
          className="absolute bottom-4 right-4 shadow"
          onClick={pollAll}
          disabled={polling}
        >
          {polling ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh all
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col rounded-lg border bg-card">
        {!selectedThread ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-semibold">
                Select a conversation to start replying
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {selectedThread.username ? (
                    <AvatarFallback>
                      {getInitials(selectedThread.username) || "DM"}
                    </AvatarFallback>
                  ) : null}
                </Avatar>
                <div>
                  <p className="text-base font-semibold">
                    {selectedThread.username || "Unknown"}
                  </p>
                  {selectedAccount ? (
                    <Badge variant="secondary" className="mt-1 gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          accountColorMap.get(selectedAccount.id) ||
                            "bg-muted-foreground"
                        )}
                      />
                      {selectedAccount.username}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={pollAll}
                disabled={polling}
              >
                {polling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Manual poll
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-6 p-4">
                {loadingMessages ? (
                  <p className="text-sm text-muted-foreground">
                    Loading messages...
                  </p>
                ) : messages.length === 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>No messages yet</CardTitle>
                      <CardDescription>
                        This conversation does not have any messages.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  messages.map((message) => {
                    const isOwn =
                      message.sender &&
                      selectedAccount &&
                      message.sender === selectedAccount.username;
                    return (
                      <div
                        key={message.id}
                        className={cn(
                          "flex flex-col",
                          isOwn ? "items-end" : "items-start"
                        )}
                      >
                        <span className="text-xs text-muted-foreground">
                          {message.sender || "Unknown"}
                        </span>
                        <div
                          className={cn(
                            "mt-1 max-w-[75%] rounded-2xl px-4 py-2 text-sm",
                            isOwn
                              ? "bg-purple-600 text-white"
                              : "bg-muted text-foreground"
                          )}
                        >
                          {message.text || ""}
                        </div>
                        <span className="mt-1 text-xs text-muted-foreground">
                          {formatMessageTime(message.timestamp)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t p-4">
              <div className="flex items-end gap-3">
                <Textarea
                  ref={textareaRef}
                  rows={1}
                  value={replyText}
                  placeholder="Write a reply..."
                  className="min-h-[44px] flex-1 resize-none overflow-y-auto"
                  onChange={(event) => setReplyText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                      event.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button onClick={handleSend} disabled={sending || !replyText.trim()}>
                  {sending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

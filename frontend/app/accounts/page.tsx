"use client";

import * as React from "react";
import { Plus, Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface Account {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
  session_alive: boolean;
  full_name?: string;
  avatar_url?: string | null;
}

interface ProxyItem {
  id: number;
  host: string;
  port: number;
  username?: string | null;
}

interface ImportSummary {
  created: { id: number; username: string }[];
  errors: { row: number; username?: string; error: string }[];
}

const emptyAddForm = {
  username: "",
  password: "",
  proxy_id: null as number | null
};

const emptyEditForm = {
  username: "",
  full_name: "",
  biography: "",
  website: ""
};

export default function AccountsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [proxies, setProxies] = React.useState<ProxyItem[]>([]);

  const [addOpen, setAddOpen] = React.useState(false);
  const [addForm, setAddForm] = React.useState({ ...emptyAddForm });
  const [addLoading, setAddLoading] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<Account | null>(null);
  const [editForm, setEditForm] = React.useState({ ...emptyEditForm });
  const [editLoading, setEditLoading] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);

  const [importing, setImporting] = React.useState(false);
  const [importProgress, setImportProgress] = React.useState({
    total: 0,
    imported: 0
  });

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const fetchAccounts = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Account[]>("/accounts");
      setAccounts((prev) =>
        res.data.map((account) => {
          const existing = prev.find((item) => item.id === account.id);
          return {
            ...account,
            full_name: existing?.full_name,
            avatar_url: existing?.avatar_url ?? null
          };
        })
      );
    } catch (err) {
      toast.error("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProxies = React.useCallback(async () => {
    try {
      const res = await api.get<ProxyItem[]>("/proxies");
      setProxies(res.data);
    } catch (err) {
      setProxies([]);
    }
  }, []);

  React.useEffect(() => {
    fetchAccounts();
    fetchProxies();
  }, [fetchAccounts, fetchProxies]);

  React.useEffect(() => {
    if (!photoFile || !photoPreview) {
      return;
    }
    return () => {
      URL.revokeObjectURL(photoPreview);
    };
  }, [photoFile, photoPreview]);

  const handleAddAccount = async () => {
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await api.post("/accounts/add", {
        username: addForm.username,
        password: addForm.password,
        proxy_id: addForm.proxy_id
      });
      setAccounts((prev) => [
        ...prev,
        {
          id: res.data.id,
          username: res.data.username,
          is_active: res.data.is_active ?? false,
          created_at: res.data.created_at,
          session_alive: true
        }
      ]);
      toast.success("Account added");
      setAddForm({ ...emptyAddForm });
      setAddOpen(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Login failed";
      setAddError(message);
      toast.error(message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleSwitch = async (account: Account) => {
    try {
      const res = await api.post(`/accounts/${account.id}/switch`);
      const profile = res.data || {};
      setAccounts((prev) =>
        prev.map((item) => {
          const isActive = item.id === account.id;
          return {
            ...item,
            is_active: isActive,
            session_alive: isActive ? true : item.session_alive,
            full_name: isActive ? profile.full_name ?? item.full_name : item.full_name,
            avatar_url: isActive
              ? profile.profile_pic_url ?? item.avatar_url
              : item.avatar_url
          };
        })
      );
      toast.success("Switched account");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to switch account";
      toast.error(message);
    }
  };

  const handleDelete = async (account: Account) => {
    try {
      await api.delete(`/accounts/${account.id}`);
      setAccounts((prev) => prev.filter((item) => item.id !== account.id));
      toast.success("Account deleted");
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to delete account";
      toast.error(message);
    }
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setEditForm({
      username: account.username || "",
      full_name: account.full_name || "",
      biography: "",
      website: ""
    });
    setPhotoFile(null);
    setPhotoPreview(account.avatar_url || null);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editingAccount) {
      return;
    }

    const payload: Record<string, string> = {};
    if (editForm.username && editForm.username !== editingAccount.username) {
      payload.username = editForm.username;
    }
    if (editForm.full_name) {
      payload.full_name = editForm.full_name;
    }
    if (editForm.biography) {
      payload.biography = editForm.biography;
    }
    if (editForm.website) {
      payload.website = editForm.website;
    }

    setEditLoading(true);
    try {
      if (Object.keys(payload).length > 0) {
        await api.put(`/accounts/${editingAccount.id}/profile`, payload);
      }

      if (photoFile) {
        const formData = new FormData();
        formData.append("file", photoFile);
        await api.put(`/accounts/${editingAccount.id}/photo`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      setAccounts((prev) =>
        prev.map((item) =>
          item.id === editingAccount.id
            ? {
                ...item,
                username: payload.username ?? item.username,
                full_name: payload.full_name ?? item.full_name,
                avatar_url: photoPreview ?? item.avatar_url
              }
            : item
        )
      );

      toast.success("Profile updated");
      setEditOpen(false);
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Failed to update profile";
      toast.error(message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      const total = Math.max(0, lines.length - 1);
      setImportProgress({ total, imported: 0 });

      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post<ImportSummary>("/accounts/import", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const createdCount = res.data.created.length;
      setImportProgress({ total, imported: createdCount });

      if (res.data.errors.length) {
        toast.error(`Imported ${createdCount} accounts with errors`);
      } else {
        toast.success(`Imported ${createdCount} accounts`);
      }

      fetchAccounts();
    } catch (err: any) {
      const message = err?.response?.data?.detail || "Import failed";
      toast.error(message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleProxyChange = (value: string) => {
    if (value === "none") {
      setAddForm((prev) => ({ ...prev, proxy_id: null }));
      return;
    }
    setAddForm((prev) => ({ ...prev, proxy_id: Number(value) }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Manage Instagram accounts connected to Lynkbase.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {importing ? (
            <span className="text-sm text-muted-foreground">
              Importing... {importProgress.imported} of {importProgress.total}
            </span>
          ) : importProgress.total > 0 ? (
            <span className="text-sm text-muted-foreground">
              Imported {importProgress.imported} of {importProgress.total}
            </span>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleImportFile}
          />
          <Button variant="secondary" onClick={handleImportClick}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add account</DialogTitle>
                <DialogDescription>
                  Log in to add a new Instagram account.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    value={addForm.username}
                    onChange={(event) =>
                      setAddForm((prev) => ({
                        ...prev,
                        username: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={addForm.password}
                    onChange={(event) =>
                      setAddForm((prev) => ({
                        ...prev,
                        password: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Proxy</label>
                  <Select
                    value={
                      addForm.proxy_id ? addForm.proxy_id.toString() : "none"
                    }
                    onValueChange={handleProxyChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No proxy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No proxy</SelectItem>
                      {proxies.map((proxy) => (
                        <SelectItem key={proxy.id} value={proxy.id.toString()}>
                          {proxy.host}:{proxy.port}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {addError ? (
                  <p className="text-sm text-destructive">{addError}</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  onClick={handleAddAccount}
                  disabled={
                    addLoading ||
                    !addForm.username.trim() ||
                    !addForm.password.trim()
                  }
                >
                  {addLoading ? "Logging in..." : "Add account"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading accounts...</p>
      ) : accounts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No accounts yet</CardTitle>
            <CardDescription>
              Add your first Instagram account to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const initials = account.username.slice(0, 2).toUpperCase();
            return (
              <Card
                key={account.id}
                className={
                  account.is_active
                    ? "border-purple-500 shadow-[0_0_0_1px_rgba(168,85,247,0.4)]"
                    : ""
                }
              >
                <CardHeader className="flex flex-row items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {account.avatar_url ? (
                      <AvatarImage src={account.avatar_url} alt={account.username} />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold">
                      {account.username}
                    </CardTitle>
                    <CardDescription>
                      {account.full_name || "No full name"}
                    </CardDescription>
                  </div>
                  <span
                    className={
                      "ml-auto h-2.5 w-2.5 rounded-full " +
                      (account.session_alive ? "bg-green-500" : "bg-red-500")
                    }
                  />
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleSwitch(account)}>
                    Switch
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEditDialog(account)}
                  >
                    Edit profile
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete account</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove the account from Lynkbase. This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(account)}>
                          Delete
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
            <DialogDescription>
              Update the profile details for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {photoPreview ? (
                  <AvatarImage src={photoPreview} alt="Profile preview" />
                ) : null}
                <AvatarFallback>
                  {editingAccount?.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <label className="text-sm font-medium">Profile photo</label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setPhotoFile(file);
                    setPhotoPreview(file ? URL.createObjectURL(file) : null);
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <Input
                value={editForm.username}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    username: event.target.value
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Full name</label>
              <Input
                value={editForm.full_name}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    full_name: event.target.value
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bio</label>
              <Textarea
                value={editForm.biography}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    biography: event.target.value
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Website</label>
              <Input
                value={editForm.website}
                onChange={(event) =>
                  setEditForm((prev) => ({
                    ...prev,
                    website: event.target.value
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveProfile} disabled={editLoading}>
              {editLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

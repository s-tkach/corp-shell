"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil } from "lucide-react";
import { UserCompaniesClient } from "./user-companies-client";

interface UserSub {
  tierId: string;
  slug: string;
  displayName: string;
  level: number;
  expiresAt: Date | null;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  roles: { slug: string; displayName: string }[];
  subscription: UserSub | null;
  companyIds?: string[];
}

interface Role {
  id: string;
  slug: string;
  displayName: string;
}

interface Tier {
  id: string;
  slug: string;
  displayName: string;
  level: number;
}

interface Props {
  users: User[];
  allRoles: Role[];
  allTiers: Tier[];
  allCompanies: { id: string; parentId: string | null; name: string; isActive: boolean; sortOrder: number }[];
  page: number;
  hasMore: boolean;
}

interface EditForm {
  isActive: boolean;
  selectedRoles: string[];
  tierId: string;
  expiresAt: string;
}

export function UserManagerClient({ users: initialUsers, allRoles, allTiers, allCompanies, page, hasMore }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [form, setForm] = useState<EditForm>({ isActive: true, selectedRoles: [], tierId: "", expiresAt: "" });
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  function openEdit(user: User) {
    setForm({
      isActive: user.isActive,
      selectedRoles: user.roles.map((r) => r.slug),
      tierId: user.subscription?.tierId ?? "",
      expiresAt: user.subscription?.expiresAt ? new Date(user.subscription.expiresAt).toISOString().split("T")[0]! : "",
    });
    setEditDialog({ open: true, user });
  }

  async function save() {
    setError(null);
    const { user } = editDialog;
    if (!user) return;

    const body: Record<string, unknown> = {
      isActive: form.isActive,
      roleSlugs: form.selectedRoles,
    };
    if (form.tierId) {
      body.tierId = form.tierId;
      body.expiresAt = form.expiresAt || null;
    }

    const res = await fetch(`/api/settings/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { setError(data.error ?? "Failed to update user"); return; }
    setEditDialog({ open: false, user: null });
    refresh();
  }

  function toggleRole(slug: string) {
    setForm((f) => ({
      ...f,
      selectedRoles: f.selectedRoles.includes(slug)
        ? f.selectedRoles.filter((r) => r !== slug)
        : [...f.selectedRoles, slug],
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Manager</h1>
        <p className="text-muted-foreground">Manage users, roles, and subscriptions</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialUsers.map((user) => (
              <TableRow key={user.id} className={!user.isActive ? "opacity-50" : undefined}>
                <TableCell>
                  <div>
                    <p className="font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((r) => (
                      <Badge key={r.slug} variant="secondary" className="text-xs">{r.displayName}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  {user.subscription ? (
                    <span className="text-sm">{user.subscription.displayName}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "destructive"} className="text-xs">
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || isPending}
            onClick={() => startTransition(() => { router.push(`?page=${page - 1}`); })}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasMore || isPending}
            onClick={() => startTransition(() => { router.push(`?page=${page + 1}`); })}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={editDialog.open} onOpenChange={(o) => setEditDialog((s) => ({ ...s, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User — {editDialog.user?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label>Active</Label>
            </div>

            <div className="space-y-1">
              <Label>Roles</Label>
              <div className="flex flex-wrap gap-2">
                {allRoles.map((role) => (
                  <button
                    key={role.slug}
                    type="button"
                    onClick={() => toggleRole(role.slug)}
                    className="rounded border px-2 py-0.5 text-xs transition-colors"
                    style={{
                      background: form.selectedRoles.includes(role.slug) ? "var(--primary)" : "transparent",
                      color: form.selectedRoles.includes(role.slug) ? "var(--primary-foreground)" : "inherit",
                    }}
                  >
                    {role.displayName}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Subscription Tier</Label>
              <Select value={form.tierId} onValueChange={(v) => setForm((f) => ({ ...f, tierId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {allTiers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.displayName} (L{t.level})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Expires At (optional)</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>

            {allCompanies.length > 0 && editDialog.user && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-medium">Company Access</p>
                <UserCompaniesClient
                  userId={editDialog.user.id}
                  allCompanies={allCompanies}
                  assignedCompanyIds={editDialog.user.companyIds ?? []}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, user: null })}>Cancel</Button>
            <Button onClick={save} disabled={isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string;
  targetType: string;
  targetUserId: string | null;
  targetSubLevel: number | null;
  expiresAt: Date | null;
  createdAt: Date;
  readCount: number;
  actionLabel: string | null;
  actionType: string | null;
  actionPayload: string | null;
}

interface Props {
  initialNotifications: Notification[];
}

export function NotificationsAdminClient({ initialNotifications }: Props) {
  const router = useRouter();
  const [notifs, setNotifs] = useState(initialNotifications);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    title: "",
    body: "",
    targetType: "all",
    targetUserId: "",
    targetSubLevel: "",
    actionLabel: "",
    actionType: "",
    actionPayload: "",
    expiresAt: "",
  });

  async function handleCreate() {
    const payload = {
      title: form.title,
      body: form.body,
      targetType: form.targetType,
      targetUserId: form.targetType === "user" ? form.targetUserId || undefined : undefined,
      targetSubLevel: form.targetType === "sub_level" ? Number(form.targetSubLevel) || undefined : undefined,
      actionLabel: form.actionLabel || undefined,
      actionType: form.actionType || undefined,
      actionPayload: form.actionPayload || undefined,
      expiresAt: form.expiresAt || undefined,
    };

    const res = await fetch("/api/settings/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return;
    setDialogOpen(false);
    setForm({ title: "", body: "", targetType: "all", targetUserId: "", targetSubLevel: "", actionLabel: "", actionType: "", actionPayload: "", expiresAt: "" });
    startTransition(() => router.refresh());
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/settings/notifications/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create notification
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Reads</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {notifs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No notifications
              </TableCell>
            </TableRow>
          )}
          {notifs.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="font-medium max-w-xs truncate">{n.title}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {n.targetType === "all" && "Everyone"}
                {n.targetType === "user" && `User: ${n.targetUserId ?? "—"}`}
                {n.targetType === "sub_level" && `Sub ≥ ${n.targetSubLevel ?? 0}`}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {n.expiresAt
                  ? formatDistanceToNow(new Date(n.expiresAt), { addSuffix: true })
                  : "Never"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">{n.readCount}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create notification</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Notification title"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Notification message"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Target</Label>
              <Select
                value={form.targetType}
                onValueChange={(v) => setForm((f) => ({ ...f, targetType: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone</SelectItem>
                  <SelectItem value="user">Specific user</SelectItem>
                  <SelectItem value="sub_level">Subscription level ≥</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.targetType === "user" && (
              <div className="space-y-1.5">
                <Label>User ID</Label>
                <Input
                  value={form.targetUserId}
                  onChange={(e) => setForm((f) => ({ ...f, targetUserId: e.target.value }))}
                  placeholder="User UUID"
                />
              </div>
            )}

            {form.targetType === "sub_level" && (
              <div className="space-y-1.5">
                <Label>Minimum subscription level</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.targetSubLevel}
                  onChange={(e) => setForm((f) => ({ ...f, targetSubLevel: e.target.value }))}
                  placeholder="0"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Action label (optional)</Label>
                <Input
                  value={form.actionLabel}
                  onChange={(e) => setForm((f) => ({ ...f, actionLabel: e.target.value }))}
                  placeholder="View details"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Action URL (optional)</Label>
                <Input
                  value={form.actionPayload}
                  onChange={(e) => setForm((f) => ({ ...f, actionPayload: e.target.value }))}
                  placeholder="/dashboard"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Expires at (optional)</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!form.title || !form.body || isPending}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

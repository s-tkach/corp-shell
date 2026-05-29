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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Policy {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
}

interface Props {
  policies: Policy[];
}

interface PolicyForm {
  slug: string;
  displayName: string;
  description: string;
}

const emptyForm: PolicyForm = { slug: "", displayName: "", description: "" };

export function PoliciesClient({ policies: initialPolicies }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Policy | null }>({ open: false, editing: null });
  const [form, setForm] = useState<PolicyForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Policy[]>(initialPolicies);

  function openCreate() {
    setForm(emptyForm);
    setError(null);
    setDialog({ open: true, editing: null });
  }

  function openEdit(policy: Policy) {
    setForm({ slug: policy.slug, displayName: policy.displayName, description: policy.description ?? "" });
    setError(null);
    setDialog({ open: true, editing: policy });
  }

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  async function save() {
    setError(null);
    const { editing } = dialog;
    if (editing) {
      const res = await fetch(`/api/platform/policies/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: form.displayName, description: form.description || null }),
      });
      const data = await res.json() as { error?: string } & Partial<Policy>;
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setRows((prev) => prev.map((p) => p.id === editing.id ? { ...p, displayName: form.displayName, description: form.description || null } : p));
    } else {
      const res = await fetch("/api/platform/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: form.slug, displayName: form.displayName, description: form.description || undefined }),
      });
      const data = await res.json() as { error?: string } & Partial<Policy>;
      if (!res.ok) { setError(data.error ?? "Failed to create"); return; }
      if (data.id) setRows((prev) => [...prev, data as Policy]);
    }
    setDialog({ open: false, editing: null });
    refresh();
  }

  async function deletePolicy(id: string) {
    if (!confirm("Delete this policy? Tenant role assignments using this slug will become inactive.")) return;
    const res = await fetch(`/api/platform/policies/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json() as { error: string };
      alert(data.error);
      return;
    }
    setRows((prev) => prev.filter((p) => p.id !== id));
    refresh();
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Policies</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New Policy
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Display Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-sm">{p.slug}</TableCell>
              <TableCell>{p.displayName}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{p.description ?? "—"}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deletePolicy(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No policies yet.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialog.open} onOpenChange={(open) => !open && setDialog({ open: false, editing: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Policy" : "New Policy"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!dialog.editing && (
              <div className="space-y-1">
                <Label htmlFor="p-slug">Slug</Label>
                <Input
                  id="p-slug"
                  placeholder="users:delete"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="p-name">Display Name</Label>
              <Input
                id="p-name"
                placeholder="Delete Users"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={save} disabled={isPending || !form.displayName || (!dialog.editing && !form.slug)}>
              {dialog.editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

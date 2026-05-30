"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ChevronRight } from "lucide-react";

interface Company {
  id: string;
  parentId: string | null;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
}

interface Props {
  companies: Company[];
}

interface FormState {
  name: string;
  parentId: string | null;
  logoUrl: string;
  isActive: boolean;
}

function flattenTree(
  companies: Company[],
  parentId: string | null = null,
  depth = 0
): { company: Company; depth: number }[] {
  return companies
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .flatMap((c) => [{ company: c, depth }, ...flattenTree(companies, c.id, depth + 1)]);
}

export function CompaniesClient({ companies }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingChildOf, setAddingChildOf] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    name: "",
    parentId: null,
    logoUrl: "",
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);

  const flat = flattenTree(companies);

  function openCreate(parentId: string | null) {
    setEditingId(null);
    setAddingChildOf(parentId);
    setForm({ name: "", parentId, logoUrl: "", isActive: true });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(company: Company) {
    setEditingId(company.id);
    setAddingChildOf(null);
    setForm({
      name: company.name,
      parentId: company.parentId,
      logoUrl: company.logoUrl ?? "",
      isActive: company.isActive,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);
    const payload = {
      name: form.name.trim(),
      parentId: form.parentId,
      logoUrl: form.logoUrl.trim() || null,
      isActive: form.isActive,
    };

    if (!payload.name) {
      setError("Name is required");
      return;
    }

    startTransition(async () => {
      try {
        if (editingId) {
          const res = await fetch(`/api/admin/companies/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("Failed to update");
        } else {
          const res = await fetch("/api/admin/companies", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) throw new Error("Failed to create");
        }
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this company? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/companies/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        alert(data.error ?? "Delete failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">Manage your organizational hierarchy</p>
        </div>
        <Button onClick={() => openCreate(null)}>
          <Plus className="mr-2 h-4 w-4" />
          Add root company
        </Button>
      </div>

      <div className="rounded-md border divide-y">
        {flat.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No companies yet. Add a root company to get started.
          </p>
        )}
        {flat.map(({ company, depth }) => (
          <div
            key={company.id}
            className="flex items-center gap-2 p-3 hover:bg-muted/30"
            style={{ paddingLeft: `${depth * 24 + 12}px` }}
          >
            {depth > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            )}
            {company.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
            )}
            <span className="flex-1 text-sm font-medium">{company.name}</span>
            {!company.isActive && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => openCreate(company.id)}
                title="Add child company"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => openEdit(company)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => handleDelete(company.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit company" : addingChildOf ? "Add child company" : "Add root company"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="company-name">Name</Label>
              <Input
                id="company-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Freight Ltd"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="company-logo">Logo URL</Label>
              <Input
                id="company-logo"
                value={form.logoUrl}
                onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="company-active"
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
              />
              <Label htmlFor="company-active">Active</Label>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

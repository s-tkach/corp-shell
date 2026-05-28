"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Tier {
  id: string;
  slug: string;
  displayName: string;
  level: number;
  upgradeCtaHeadline: string | null;
  upgradeCtaBody: string | null;
  upgradeCtaLabel: string | null;
  upgradeUrl: string | null;
}

interface Props {
  tiers: Tier[];
}

interface TierForm {
  slug: string;
  displayName: string;
  level: string;
  upgradeCtaHeadline: string;
  upgradeCtaBody: string;
  upgradeCtaLabel: string;
  upgradeUrl: string;
}

const emptyForm: TierForm = {
  slug: "",
  displayName: "",
  level: "1",
  upgradeCtaHeadline: "",
  upgradeCtaBody: "",
  upgradeCtaLabel: "",
  upgradeUrl: "",
};

export function SubscriptionTiersClient({ tiers: initialTiers }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Tier | null }>({ open: false, editing: null });
  const [form, setForm] = useState<TierForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  function openNew() {
    setForm(emptyForm);
    setDialog({ open: true, editing: null });
  }

  function openEdit(tier: Tier) {
    setForm({
      slug: tier.slug,
      displayName: tier.displayName,
      level: String(tier.level),
      upgradeCtaHeadline: tier.upgradeCtaHeadline ?? "",
      upgradeCtaBody: tier.upgradeCtaBody ?? "",
      upgradeCtaLabel: tier.upgradeCtaLabel ?? "",
      upgradeUrl: tier.upgradeUrl ?? "",
    });
    setDialog({ open: true, editing: tier });
  }

  async function save() {
    setError(null);
    const { editing } = dialog;
    const payload = {
      slug: form.slug,
      displayName: form.displayName,
      level: Number(form.level),
      upgradeCtaHeadline: form.upgradeCtaHeadline || null,
      upgradeCtaBody: form.upgradeCtaBody || null,
      upgradeCtaLabel: form.upgradeCtaLabel || null,
      upgradeUrl: form.upgradeUrl || null,
    };

    if (editing) {
      const res = await fetch(`/api/platform/subscriptions/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to update tier"); return; }
    } else {
      const res = await fetch("/api/platform/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to create tier"); return; }
    }
    setDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteTier(id: string) {
    if (!confirm("Delete this tier?")) return;
    const res = await fetch(`/api/platform/subscriptions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json() as { error: string };
      alert(data.error);
      return;
    }
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscription Tiers</h1>
          <p className="text-muted-foreground">Manage tiers and upgrade prompt content</p>
        </div>
        <Button onClick={openNew} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" /> New Tier
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Upgrade CTA</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialTiers.map((tier) => (
              <TableRow key={tier.id}>
                <TableCell className="font-medium">
                  {tier.displayName}
                  {tier.slug === "free" && <Badge variant="secondary" className="ml-2 text-xs">default</Badge>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{tier.slug}</TableCell>
                <TableCell>{tier.level}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {tier.upgradeCtaHeadline ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(tier)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void deleteTier(tier.id)}
                      disabled={tier.slug === "free" || isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit Tier" : "New Tier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!dialog.editing && (
              <div className="space-y-1">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="standard" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Display Name</Label>
              <Input value={form.displayName} onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Level (numeric, higher = more access)</Label>
              <Input type="number" min={0} value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))} />
            </div>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Upgrade Prompt (shown on restricted routes)</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Headline</Label>
                  <Input value={form.upgradeCtaHeadline} onChange={(e) => setForm((f) => ({ ...f, upgradeCtaHeadline: e.target.value }))} placeholder="Upgrade to Standard" />
                </div>
                <div className="space-y-1">
                  <Label>Body</Label>
                  <Textarea value={form.upgradeCtaBody} onChange={(e) => setForm((f) => ({ ...f, upgradeCtaBody: e.target.value }))} placeholder="Unlock advanced features..." />
                </div>
                <div className="space-y-1">
                  <Label>CTA Button Label</Label>
                  <Input value={form.upgradeCtaLabel} onChange={(e) => setForm((f) => ({ ...f, upgradeCtaLabel: e.target.value }))} placeholder="Upgrade Now" />
                </div>
                <div className="space-y-1">
                  <Label>CTA URL</Label>
                  <Input value={form.upgradeUrl} onChange={(e) => setForm((f) => ({ ...f, upgradeUrl: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={() => void save()} disabled={!form.displayName || isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

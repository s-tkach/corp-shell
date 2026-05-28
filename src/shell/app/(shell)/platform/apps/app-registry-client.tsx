"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Pencil, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface App {
  id: string;
  name: string;
  remoteUrl: string;
  routePrefix: string;
  healthCheckUrl: string | null;
  isEnabled: boolean;
  lastHealthyAt: Date | null;
}

interface Props {
  apps: App[];
}

interface AppForm {
  name: string;
  remoteUrl: string;
  routePrefix: string;
  healthCheckUrl: string;
}

const emptyForm: AppForm = { name: "", remoteUrl: "", routePrefix: "", healthCheckUrl: "" };

interface ManifestResult {
  valid: boolean;
  manifest?: { name: string; version: string; routePrefix: string; routes: { path: string; label: string }[] };
  error?: string;
}

interface HealthResult {
  healthy: boolean;
  status?: number;
  error?: string;
}

export function AppRegistryClient({ apps: initialApps }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<{ open: boolean; editing: App | null }>({ open: false, editing: null });
  const [form, setForm] = useState<AppForm>(emptyForm);
  const [manifestResult, setManifestResult] = useState<ManifestResult | null>(null);
  const [healthResults, setHealthResults] = useState<Record<string, HealthResult>>({});
  const [validating, setValidating] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  function openNew() {
    setForm(emptyForm);
    setManifestResult(null);
    setDialog({ open: true, editing: null });
  }

  function openEdit(app: App) {
    setForm({
      name: app.name,
      remoteUrl: app.remoteUrl,
      routePrefix: app.routePrefix,
      healthCheckUrl: app.healthCheckUrl ?? "",
    });
    setManifestResult(null);
    setDialog({ open: true, editing: app });
  }

  async function save() {
    setError(null);
    const { editing } = dialog;
    const payload = { ...form, healthCheckUrl: form.healthCheckUrl || undefined };

    if (editing) {
      const res = await fetch(`/api/platform/apps/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to update app"); return; }
    } else {
      const res = await fetch("/api/platform/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Failed to register app"); return; }
    }
    setDialog({ open: false, editing: null });
    refresh();
  }

  async function deleteApp(id: string) {
    if (!confirm("Delete this app?")) return;
    await fetch(`/api/platform/apps/${id}`, { method: "DELETE" });
    refresh();
  }

  async function toggleEnabled(app: App) {
    await fetch(`/api/platform/apps/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !app.isEnabled }),
    });
    refresh();
  }

  async function validateManifest(appId: string) {
    setValidating(true);
    setManifestResult(null);
    try {
      const res = await fetch(`/api/platform/apps/${appId}/validate`, { method: "POST" });
      const data = await res.json() as ManifestResult;
      setManifestResult(data);
    } finally {
      setValidating(false);
    }
  }

  async function checkHealth(appId: string) {
    setCheckingHealth(appId);
    try {
      const res = await fetch(`/api/platform/apps/${appId}/health`, { method: "POST" });
      const data = await res.json() as HealthResult;
      setHealthResults((r) => ({ ...r, [appId]: data }));
    } finally {
      setCheckingHealth(null);
    }
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Application Registry</h1>
          <p className="text-muted-foreground">Register and manage child apps</p>
        </div>
        <Button onClick={openNew} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" /> Register App
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Route Prefix</TableHead>
              <TableHead>Remote URL</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Enabled</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialApps.map((app) => {
              const health = healthResults[app.id];
              return (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">{app.name}</TableCell>
                  <TableCell className="font-mono text-xs">{app.routePrefix}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{app.remoteUrl}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {health ? (
                        health.healthy ? (
                          <Badge variant="default" className="flex items-center gap-1 text-xs">
                            <CheckCircle className="h-3 w-3" /> OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                            <XCircle className="h-3 w-3" /> Down
                          </Badge>
                        )
                      ) : app.lastHealthyAt ? (
                        <span className="text-xs text-muted-foreground">
                          Last OK: {new Date(app.lastHealthyAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unknown</span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => void checkHealth(app.id)}
                        disabled={checkingHealth === app.id}
                      >
                        <RefreshCw className={`h-3 w-3 ${checkingHealth === app.id ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Switch checked={app.isEnabled} onCheckedChange={() => void toggleEnabled(app)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(app)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void deleteApp(app.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {initialApps.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No apps registered yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((s) => ({ ...s, open: o }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.editing ? "Edit App" : "Register App"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name (MF remote name)</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="inventoryApp" />
            </div>
            <div className="space-y-1">
              <Label>Remote URL</Label>
              <Input value={form.remoteUrl} onChange={(e) => setForm((f) => ({ ...f, remoteUrl: e.target.value }))} placeholder="https://abc123.cloudfront.net" />
            </div>
            <div className="space-y-1">
              <Label>Route Prefix</Label>
              <Input value={form.routePrefix} onChange={(e) => setForm((f) => ({ ...f, routePrefix: e.target.value }))} placeholder="/inventory" />
            </div>
            <div className="space-y-1">
              <Label>Health Check URL (optional)</Label>
              <Input value={form.healthCheckUrl} onChange={(e) => setForm((f) => ({ ...f, healthCheckUrl: e.target.value }))} placeholder="https://..." />
            </div>

            {dialog.editing && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void validateManifest(dialog.editing!.id)}
                  disabled={validating}
                >
                  <RefreshCw className={`mr-2 h-3 w-3 ${validating ? "animate-spin" : ""}`} />
                  Validate & Fetch Manifest
                </Button>
                {manifestResult && (
                  <div className={`rounded-md border p-3 text-sm ${manifestResult.valid ? "border-green-500/30 bg-green-50 dark:bg-green-950/20" : "border-destructive/30 bg-destructive/10"}`}>
                    {manifestResult.valid ? (
                      <div className="space-y-1">
                        <p className="font-medium text-green-700 dark:text-green-400">Valid manifest</p>
                        <p className="text-xs text-muted-foreground">
                          {manifestResult.manifest?.name} v{manifestResult.manifest?.version} — {manifestResult.manifest?.routes?.length ?? 0} routes
                        </p>
                      </div>
                    ) : (
                      <p className="text-destructive">{manifestResult.error}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, editing: null })}>Cancel</Button>
            <Button onClick={() => void save()} disabled={!form.name || !form.remoteUrl || !form.routePrefix || isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

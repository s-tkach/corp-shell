"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle, Loader2, Pencil } from "lucide-react";
import { useNotifications } from "@/components/shell/notifications/notification-provider";

interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  status: "active" | "suspended" | "deleted";
  isPlatform: boolean;
  createdAt: string;
  tierId: string | null;
  tierSlug: string | null;
  tierDisplayName: string | null;
  tierLevel: number | null;
}

interface TierOption {
  id: string;
  slug: string;
  displayName: string;
  level: number;
}

const EMPTY_FORM = {
  slug: "",
  displayName: "",
  adminEmail: "",
  tierId: "",
  oidcIssuer: "",
  oidcClientId: "",
  oidcClientSecret: "",
  appName: "",
};

type OidcStatus = "idle" | "testing" | "ok" | "error";

export default function PlatformTenantsPage() {
  const { showToast } = useNotifications();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tiers, setTiers] = useState<TierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingTierTenant, setEditingTierTenant] = useState<Tenant | null>(null);
  const [editingTierId, setEditingTierId] = useState("");
  const [oidcStatus, setOidcStatus] = useState<OidcStatus>("idle");
  const [oidcError, setOidcError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/platform/tenants").then((r) => r.json() as Promise<Tenant[]>),
      fetch("/api/platform/subscriptions").then((r) => r.json() as Promise<TierOption[]>),
    ])
      .then(([tenantData, tierData]) => {
        setTenants(tenantData);
        setTiers(tierData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleTestOidc() {
    setOidcStatus("testing");
    setOidcError("");
    try {
      const res = await fetch(
        `/api/platform/validate-oidc?issuer=${encodeURIComponent(form.oidcIssuer.trim())}`
      );
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error ?? "Connection failed");
      }
      setOidcStatus("ok");
    } catch (err) {
      setOidcStatus("error");
      setOidcError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string; tenantId?: string };
      if (!res.ok) {
        showToast({ title: data.error ?? "Failed to create tenant", variant: "error" });
        return;
      }
      setTenants((prev) => [
        ...prev,
        {
          id: data.tenantId!,
          slug: form.slug,
          displayName: form.displayName,
          status: "active",
          isPlatform: false,
          createdAt: new Date().toISOString(),
          tierId: form.tierId,
          tierSlug: tiers.find((tier) => tier.id === form.tierId)?.slug ?? null,
          tierDisplayName: tiers.find((tier) => tier.id === form.tierId)?.displayName ?? null,
          tierLevel: tiers.find((tier) => tier.id === form.tierId)?.level ?? null,
        },
      ]);
      showToast({ title: `Tenant "${form.displayName}" created successfully.`, variant: "success" });
      setAdding(false);
      setForm(EMPTY_FORM);
      setOidcStatus("idle");
    } finally {
      setSaving(false);
    }
  }

  function closeDialog() {
    setAdding(false);
    setOidcStatus("idle");
  }

  async function handleStatusChange(id: string, status: "active" | "suspended" | "deleted") {
    if (status === "deleted" && !confirm("Soft-delete this tenant? This cannot be undone easily.")) return;
    await fetch(`/api/platform/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTenants((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
  }

  async function handleTierSave() {
    if (!editingTierTenant || !editingTierId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/platform/tenants/${editingTierTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: editingTierId }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        showToast({ title: data.error ?? "Failed to update tenant tier", variant: "error" });
        return;
      }

      const nextTier = tiers.find((tier) => tier.id === editingTierId) ?? null;
      setTenants((prev) =>
        prev.map((tenant) =>
          tenant.id === editingTierTenant.id
            ? {
                ...tenant,
                tierId: nextTier?.id ?? null,
                tierSlug: nextTier?.slug ?? null,
                tierDisplayName: nextTier?.displayName ?? null,
                tierLevel: nextTier?.level ?? null,
              }
            : tenant
        )
      );
      setEditingTierTenant(null);
      setEditingTierId("");
    } finally {
      setSaving(false);
    }
  }

  const canTest = form.oidcIssuer.trim().length > 0;
  const canCreate = form.slug && form.displayName && form.adminEmail && form.tierId && form.oidcIssuer && form.oidcClientId && form.oidcClientSecret;

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <Button onClick={() => setAdding(true)}>New Tenant</Button>
      </div>

      <Dialog open={adding} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Tenant</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="slug">Subdomain slug</Label>
              <Input
                id="slug"
                placeholder="acme"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="displayName">Organization name</Label>
              <Input
                id="displayName"
                placeholder="Acme Corp"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adminEmail">Initial admin email</Label>
              <Input
                id="adminEmail"
                type="email"
                placeholder="admin@acme.com"
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Subscription tier</Label>
              <Select value={form.tierId} onValueChange={(tierId) => setForm((f) => ({ ...f, tierId }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.displayName} (L{tier.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium">Identity Provider (OIDC)</h3>
            <div className="space-y-1">
              <Label htmlFor="oidcIssuer">Issuer URL</Label>
              <Input
                id="oidcIssuer"
                placeholder="https://your-tenant.auth0.com/"
                value={form.oidcIssuer}
                onChange={(e) => {
                  setForm((f) => ({ ...f, oidcIssuer: e.target.value }));
                  setOidcStatus("idle");
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oidcClientId">Client ID</Label>
              <Input
                id="oidcClientId"
                placeholder="your-client-id"
                value={form.oidcClientId}
                onChange={(e) => setForm((f) => ({ ...f, oidcClientId: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="oidcClientSecret">Client Secret</Label>
              <Input
                id="oidcClientSecret"
                type="password"
                placeholder="••••••••"
                value={form.oidcClientSecret}
                onChange={(e) => setForm((f) => ({ ...f, oidcClientSecret: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canTest || oidcStatus === "testing"}
                onClick={handleTestOidc}
              >
                {oidcStatus === "testing" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Test Connection
              </Button>
              {oidcStatus === "ok" && (
                <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" /> Connected
                </span>
              )}
              {oidcStatus === "error" && (
                <span className="text-sm text-destructive">{oidcError}</span>
              )}
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-medium">Branding (optional)</h3>
            <div className="space-y-1">
              <Label htmlFor="appName">App name</Label>
              <Input
                id="appName"
                placeholder="Defaults to organization name"
                value={form.appName}
                onChange={(e) => setForm((f) => ({ ...f, appName: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleCreate} disabled={saving || !canCreate}>
              {saving ? "Creating…" : "Create Tenant"}
            </Button>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editingTierTenant !== null} onOpenChange={(open) => { if (!open) { setEditingTierTenant(null); setEditingTierId(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Subscription Tier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Tenant</Label>
              <p className="text-sm text-muted-foreground">
                {editingTierTenant?.displayName} ({editingTierTenant?.slug})
              </p>
            </div>
            <div className="space-y-1">
              <Label>Subscription tier</Label>
              <Select value={editingTierId} onValueChange={setEditingTierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {tiers.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      {tier.displayName} (L{tier.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingTierTenant(null); setEditingTierId(""); }}>
              Cancel
            </Button>
            <Button onClick={() => void handleTierSave()} disabled={saving || !editingTierId}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-2">
        {tenants.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="font-medium">{t.displayName}</p>
              <p className="text-sm text-muted-foreground">{t.slug}</p>
              <p className="text-sm text-muted-foreground">
                Tier: {t.tierDisplayName ? `${t.tierDisplayName} (L${t.tierLevel ?? 0})` : "Unassigned"}
              </p>
              <p className="text-xs text-muted-foreground">
                Status: <span className={t.status === "active" ? "text-green-600" : "text-destructive"}>{t.status}</span>
                {" · "}Created {new Date(t.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              {!t.isPlatform && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTierTenant(t);
                    setEditingTierId(t.tierId ?? "");
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Tier
                </Button>
              )}
              {t.status === "active" && !t.isPlatform && (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange(t.id, "suspended")}>
                  Suspend
                </Button>
              )}
              {t.status === "suspended" && !t.isPlatform && (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange(t.id, "active")}>
                  Reactivate
                </Button>
              )}
              {t.status !== "deleted" && !t.isPlatform && (
                <Button variant="destructive" size="sm" onClick={() => handleStatusChange(t.id, "deleted")}>
                  Delete
                </Button>
              )}
            </div>
          </div>
        ))}
        {tenants.length === 0 && (
          <p className="text-sm text-muted-foreground">No tenants yet.</p>
        )}
      </div>
    </div>
  );
}

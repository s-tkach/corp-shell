"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2 } from "lucide-react";

interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
}

const EMPTY_FORM = {
  slug: "",
  displayName: "",
  adminEmail: "",
  oidcIssuer: "",
  oidcClientId: "",
  oidcClientSecret: "",
  appName: "",
};

type OidcStatus = "idle" | "testing" | "ok" | "error";

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [oidcStatus, setOidcStatus] = useState<OidcStatus>("idle");
  const [oidcError, setOidcError] = useState("");

  useEffect(() => {
    fetch("/api/platform/tenants")
      .then((r) => r.json())
      .then((data: Tenant[]) => { setTenants(data); setLoading(false); })
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
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string; tenantId?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create tenant");
        return;
      }
      setTenants((prev) => [
        ...prev,
        { id: data.tenantId!, slug: form.slug, displayName: form.displayName, status: "active", createdAt: new Date().toISOString() },
      ]);
      setSuccess(`Tenant "${form.displayName}" created successfully.`);
      setAdding(false);
      setForm(EMPTY_FORM);
      setOidcStatus("idle");
    } finally {
      setSaving(false);
    }
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

  const canTest = form.oidcIssuer.trim().length > 0;
  const canCreate = form.slug && form.displayName && form.adminEmail && form.oidcIssuer && form.oidcClientId && form.oidcClientSecret;

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <Button onClick={() => { setAdding(true); setSuccess(null); }} disabled={adding}>New Tenant</Button>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-4 text-sm text-green-800 dark:text-green-300">
          {success}
        </div>
      )}

      {adding && (
        <div className="rounded-md border p-4 space-y-4">
          <h2 className="font-medium">New Tenant</h2>
          {error && <p className="text-sm text-destructive">{error}</p>}

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
            <Button variant="outline" onClick={() => { setAdding(false); setError(null); setOidcStatus("idle"); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {tenants.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="font-medium">{t.displayName}</p>
              <p className="text-sm text-muted-foreground">{t.slug}</p>
              <p className="text-xs text-muted-foreground">
                Status: <span className={t.status === "active" ? "text-green-600" : "text-destructive"}>{t.status}</span>
                {" · "}Created {new Date(t.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              {t.status === "active" && (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange(t.id, "suspended")}>
                  Suspend
                </Button>
              )}
              {t.status === "suspended" && (
                <Button variant="outline" size="sm" onClick={() => handleStatusChange(t.id, "active")}>
                  Reactivate
                </Button>
              )}
              {t.status !== "deleted" && (
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

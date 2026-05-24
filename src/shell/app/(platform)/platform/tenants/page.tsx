"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Tenant {
  id: string;
  slug: string;
  displayName: string;
  status: "active" | "suspended" | "deleted";
  createdAt: string;
}

export default function PlatformTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ slug: "", displayName: "", adminEmail: "" });
  const [error, setError] = useState<string | null>(null);
  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/platform/tenants")
      .then((r) => r.json())
      .then((data: Tenant[]) => { setTenants(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    setSetupUrl(null);
    try {
      const res = await fetch("/api/platform/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { error?: string; tenantId?: string; setupUrl?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create tenant");
        return;
      }
      setTenants((prev) => [
        ...prev,
        { id: data.tenantId!, slug: form.slug, displayName: form.displayName, status: "active", createdAt: new Date().toISOString() },
      ]);
      setSetupUrl(data.setupUrl ?? null);
      setAdding(false);
      setForm({ slug: "", displayName: "", adminEmail: "" });
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

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <Button onClick={() => setAdding(true)} disabled={adding}>New Tenant</Button>
      </div>

      {setupUrl && (
        <div className="rounded-md bg-muted p-4 text-sm">
          <p className="font-medium">Tenant created. Share this setup link with the tenant admin:</p>
          <code className="mt-1 block break-all">{setupUrl}</code>
        </div>
      )}

      {adding && (
        <div className="rounded-md border p-4 space-y-3">
          <h2 className="font-medium">New Tenant</h2>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Input
            placeholder="Subdomain slug (e.g. acme)"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Input
            placeholder="Organization name"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
          <Input
            placeholder="Initial admin email"
            value={form.adminEmail}
            onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Creating…" : "Create Tenant"}
            </Button>
            <Button variant="outline" onClick={() => { setAdding(false); setError(null); }}>
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
              <p className="text-sm text-muted-foreground">{t.slug}.corp.example.com</p>
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

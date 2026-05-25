"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Provider {
  id: string;
  slug: string;
  displayName: string;
  issuer: string;
  clientId: string;
  scopes: string[];
  groupClaimName: string | null;
  isEnabled: boolean;
}

interface SsoClientProps {
  initialProviders: Provider[];
}

export function SsoClient({ initialProviders }: SsoClientProps) {
  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    displayName: "",
    issuer: "",
    clientId: "",
    clientSecret: "",
    scopes: "openid email profile",
    groupClaimName: "groups",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          scopes: form.scopes.split(/\s+/).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to add provider");
        return;
      }
      const data = await res.json() as { id: string };
      setProviders((prev) => [
        ...prev,
        {
          id: data.id,
          slug: form.slug,
          displayName: form.displayName,
          issuer: form.issuer,
          clientId: form.clientId,
          scopes: form.scopes.split(/\s+/).filter(Boolean),
          groupClaimName: form.groupClaimName,
          isEnabled: true,
        },
      ]);
      setAdding(false);
      setForm({ slug: "", displayName: "", issuer: "", clientId: "", clientSecret: "", scopes: "openid email profile", groupClaimName: "groups" });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(id: string, isEnabled: boolean) {
    await fetch(`/api/admin/sso/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled }),
    });
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, isEnabled } : p)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this IDP provider?")) return;
    await fetch(`/api/admin/sso/${id}`, { method: "DELETE" });
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Identity Providers</h2>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          Add Provider
        </Button>
      </div>

      {providers.length === 0 && !adding && (
        <p className="text-muted-foreground text-sm">
          No providers configured. Add one to enable SSO.
        </p>
      )}

      <div className="space-y-3">
        {providers.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="font-medium">{p.displayName}</p>
              <p className="text-sm text-muted-foreground">{p.issuer}</p>
              <p className="text-xs text-muted-foreground">Client ID: {p.clientId}</p>
              <p className="text-xs text-muted-foreground">
                Callback URL: {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/callback/{p.slug}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={p.isEnabled}
                onCheckedChange={(checked) => handleToggle(p.id, checked)}
              />
              <Button variant="destructive" size="sm" onClick={() => handleDelete(p.id)}>
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      {adding && (
        <div className="rounded-md border p-4 space-y-3">
          <h3 className="font-medium">New Provider</h3>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Input
            placeholder="Slug (e.g. okta — used in callback URL)"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
          />
          <Input
            placeholder="Display Name (e.g. Okta)"
            value={form.displayName}
            onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
          />
          <Input
            placeholder="Issuer URL (e.g. https://dev-123.okta.com)"
            value={form.issuer}
            onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))}
          />
          <Input
            placeholder="Client ID"
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
          />
          <Input
            type="password"
            placeholder="Client Secret"
            value={form.clientSecret}
            onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
          />
          <Input
            placeholder="Scopes (space-separated)"
            value={form.scopes}
            onChange={(e) => setForm((f) => ({ ...f, scopes: e.target.value }))}
          />
          <Input
            placeholder="Group Claim Name"
            value={form.groupClaimName}
            onChange={(e) => setForm((f) => ({ ...f, groupClaimName: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Save Provider"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Admin {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export default function PlatformAdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/platform/admins")
      .then((r) => r.json())
      .then((data: Admin[]) => { setAdmins(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleInvite() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to invite admin");
        return;
      }
      setSuccess(`${email} added as platform admin.`);
      setEmail("");
      // Refresh list
      const listRes = await fetch("/api/platform/admins");
      const updated = await listRes.json() as Admin[];
      setAdmins(updated);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Platform Admins</h1>

      <div className="rounded-md border p-4 space-y-3">
        <h2 className="text-sm font-medium">Invite Admin</h2>
        <p className="text-sm text-muted-foreground">
          Add an email to grant platform admin access. The user will receive the role on their next OIDC login.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && (
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <Label htmlFor="adminEmail">Email</Label>
            <Input
              id="adminEmail"
              type="email"
              placeholder="admin@corp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button onClick={handleInvite} disabled={saving || !email.trim()}>
            {saving ? "Adding…" : "Add Admin"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="font-medium">{a.displayName}</p>
              <p className="text-sm text-muted-foreground">{a.email}</p>
            </div>
          </div>
        ))}
        {admins.length === 0 && (
          <p className="text-sm text-muted-foreground">No platform admins yet. The first user to log in will become super admin.</p>
        )}
      </div>
    </div>
  );
}

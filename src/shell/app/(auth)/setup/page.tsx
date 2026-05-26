"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMethod = "client_secret_post" | "client_secret_basic";

interface FormState {
  adminEmail: string;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  scopes: string;
  tokenEndpointAuthMethod: AuthMethod;
}

export default function SetupPage() {
  const [form, setForm] = useState<FormState>({
    adminEmail: "",
    oidcIssuer: "",
    oidcClientId: "",
    oidcClientSecret: "",
    scopes: "openid profile email",
    tokenEndpointAuthMethod: "client_secret_post",
  });
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    try {
      const res = await fetch(
        `/api/setup/validate-oidc?issuer=${encodeURIComponent(form.oidcIssuer)}`
      );
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setValidateResult({ ok: true, message: "Issuer reachable and valid" });
      } else {
        setValidateResult({ ok: false, message: data.error ?? "Validation failed" });
      }
    } catch {
      setValidateResult({ ok: false, message: "Could not reach validation endpoint" });
    } finally {
      setValidating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        window.location.href = "/login";
        return;
      }
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Setup failed");
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Platform Setup</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure your identity provider and admin account to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Admin Email</label>
            <Input
              type="email"
              placeholder="admin@your-org.com"
              value={form.adminEmail}
              onChange={set("adminEmail")}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">OIDC Issuer URL</label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://your-idp.example.com"
                value={form.oidcIssuer}
                onChange={(e) => {
                  set("oidcIssuer")(e);
                  setValidateResult(null);
                }}
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={validating || !form.oidcIssuer}
              >
                {validating ? "…" : "Validate"}
              </Button>
            </div>
            {validateResult && (
              <p className={`text-xs mt-1 ${validateResult.ok ? "text-green-600" : "text-red-600"}`}>
                {validateResult.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Client ID</label>
            <Input
              placeholder="Client ID"
              value={form.oidcClientId}
              onChange={set("oidcClientId")}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Client Secret</label>
            <Input
              type="password"
              placeholder="Client Secret"
              value={form.oidcClientSecret}
              onChange={set("oidcClientSecret")}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Scopes</label>
            <Input
              placeholder="openid profile email"
              value={form.scopes}
              onChange={set("scopes")}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Token Endpoint Auth Method</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              value={form.tokenEndpointAuthMethod}
              onChange={set("tokenEndpointAuthMethod")}
            >
              <option value="client_secret_post">client_secret_post</option>
              <option value="client_secret_basic">client_secret_basic</option>
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={submitting} className="mt-2">
            {submitting ? "Setting up…" : "Complete Setup"}
          </Button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CheckCircle, Loader2 } from "lucide-react";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface WizardData {
  // Step 1
  appName: string;
  logoUrl: string;
  primaryColor: string;
  // Step 2
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  // Step 3
  superAdminEmail: string;
}

const TOTAL_STEPS = 4;

const STEP_LABELS = ["Branding", "Identity Provider", "Super Admin", "Review & Launch"];

// ────────────────────────────────────────────────────────────
// Step indicator
// ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={stepNum} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <CheckCircle className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={cn(
                  "text-xs",
                  active ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={cn(
                  "h-px w-12 -mt-5 transition-colors",
                  stepNum < current ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Step 1 — Branding
// ────────────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  onNext,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewUrl, setPreviewUrl] = useState(data.logoUrl);

  const canProceed = data.appName.trim().length > 0;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      // Get presigned URL from our API
      const res = await fetch("/api/setup/upload-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { uploadUrl, publicUrl } = (await res.json()) as {
        uploadUrl: string;
        publicUrl: string;
      };
      // Upload directly to S3
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!putRes.ok) throw new Error("Upload to S3 failed");
      onChange({ logoUrl: publicUrl });
      setPreviewUrl(publicUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Branding</CardTitle>
        <CardDescription>Set your app name, logo, and brand color.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="appName">App Name</Label>
          <Input
            id="appName"
            placeholder="Acme Corp Shell"
            value={data.appName}
            onChange={(e) => onChange({ appName: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label>Logo</Label>
          <div className="flex items-center gap-4">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Logo preview"
                className="h-16 w-16 rounded-md object-contain border"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed text-muted-foreground text-xs">
                No logo
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {uploading ? "Uploading…" : "Upload Image"}
              </Button>
              <span className="text-xs text-muted-foreground">PNG, JPG, SVG — max 2 MB</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="primaryColor">Primary Brand Color</Label>
          <div className="flex items-center gap-3">
            <input
              id="primaryColor"
              type="color"
              value={data.primaryColor}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="h-10 w-10 cursor-pointer rounded border"
            />
            <Input
              value={data.primaryColor}
              onChange={(e) => onChange({ primaryColor: e.target.value })}
              className="w-32 font-mono"
              maxLength={7}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </CardFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 2 — Identity Provider (generic OIDC)
// ────────────────────────────────────────────────────────────

type OidcStatus = "idle" | "testing" | "ok" | "error";

function Step2({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<OidcStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const canTest =
    data.oidcIssuer.trim().length > 0 &&
    data.oidcClientId.trim().length > 0 &&
    data.oidcClientSecret.trim().length > 0;

  const canProceed = status === "ok";

  async function handleTest() {
    setStatus("testing");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/setup/validate-oidc?issuer=${encodeURIComponent(data.oidcIssuer.trim())}`
      );
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error ?? "Connection failed");
      }
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Identity Provider</CardTitle>
        <CardDescription>
          Enter your OIDC credentials. Works with any standard OIDC provider — Auth0, Okta,
          Google Workspace, Keycloak, and others.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="oidcIssuer">Issuer URL</Label>
          <Input
            id="oidcIssuer"
            placeholder="https://your-tenant.auth0.com/"
            value={data.oidcIssuer}
            onChange={(e) => {
              onChange({ oidcIssuer: e.target.value });
              setStatus("idle");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oidcClientId">Client ID</Label>
          <Input
            id="oidcClientId"
            placeholder="your-client-id"
            value={data.oidcClientId}
            onChange={(e) => {
              onChange({ oidcClientId: e.target.value });
              setStatus("idle");
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oidcClientSecret">Client Secret</Label>
          <Input
            id="oidcClientSecret"
            type="password"
            placeholder="••••••••"
            value={data.oidcClientSecret}
            onChange={(e) => {
              onChange({ oidcClientSecret: e.target.value });
              setStatus("idle");
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={!canTest || status === "testing"}
            onClick={handleTest}
          >
            {status === "testing" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Test Connection
          </Button>
          {status === "ok" && (
            <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4" /> Connected
            </span>
          )}
          {status === "error" && (
            <span className="text-sm text-destructive">{errorMsg}</span>
          )}
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Next
        </Button>
      </CardFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 3 — Super Admin
// ────────────────────────────────────────────────────────────

function Step3({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.superAdminEmail);

  return (
    <>
      <CardHeader>
        <CardTitle>Super Admin</CardTitle>
        <CardDescription>
          Enter the email address that will become the initial super admin. This must match the
          email returned by your OIDC provider on first login.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="superAdminEmail">Super Admin Email</Label>
          <Input
            id="superAdminEmail"
            type="email"
            placeholder="admin@corp.com"
            value={data.superAdminEmail}
            onChange={(e) => onChange({ superAdminEmail: e.target.value })}
          />
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Note:</strong> The super admin role is granted based on this email. Make sure it
          matches exactly what your OIDC provider will send.
        </div>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!isValidEmail}>
          Next
        </Button>
      </CardFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Step 4 — Review & Launch
// ────────────────────────────────────────────────────────────

function Step4({
  data,
  onBack,
}: {
  data: WizardData;
  onBack: () => void;
}) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  async function handleLaunch() {
    setLaunching(true);
    setError("");
    try {
      const res = await fetch("/api/setup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error: string };
        throw new Error(body.error ?? "Launch failed");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLaunching(false);
    }
  }

  const rows: [string, string][] = [
    ["App Name", data.appName],
    ["Logo", data.logoUrl || "(none)"],
    ["Brand Color", data.primaryColor],
    ["OIDC Issuer", data.oidcIssuer],
    ["Client ID", data.oidcClientId],
    ["Client Secret", "••••••••"],
    ["Super Admin Email", data.superAdminEmail],
  ];

  return (
    <>
      <CardHeader>
        <CardTitle>Review & Launch</CardTitle>
        <CardDescription>
          Review your configuration below. Clicking "Launch Shell" writes everything to the
          database and permanently closes this wizard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y rounded-md border text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center gap-4 px-4 py-2">
              <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" onClick={onBack} disabled={launching}>
          Back
        </Button>
        <Button onClick={handleLaunch} disabled={launching}>
          {launching && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {launching ? "Launching…" : "Launch Shell"}
        </Button>
      </CardFooter>
    </>
  );
}

// ────────────────────────────────────────────────────────────
// Main wizard page
// ────────────────────────────────────────────────────────────

const DEFAULT_DATA: WizardData = {
  appName: "",
  logoUrl: "",
  primaryColor: "#0f172a",
  oidcIssuer: "",
  oidcClientId: "",
  oidcClientSecret: "",
  superAdminEmail: "",
};

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(DEFAULT_DATA);

  function patch(update: Partial<WizardData>) {
    setData((d) => ({ ...d, ...update }));
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Corp Shell</h1>
        <p className="mt-1 text-muted-foreground">
          Complete this one-time setup to get started.
        </p>
      </div>

      <StepIndicator current={step} />

      <Card>
        {step === 1 && (
          <Step1 data={data} onChange={patch} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <Step2
            data={data}
            onChange={patch}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step3
            data={data}
            onChange={patch}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && <Step4 data={data} onBack={() => setStep(3)} />}
      </Card>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Step {step} of {TOTAL_STEPS}
      </p>
    </div>
  );
}

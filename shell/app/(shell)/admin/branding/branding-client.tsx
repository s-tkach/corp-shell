"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Upload } from "lucide-react";

interface Config {
  id: string;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

interface Props {
  config: Config | null;
}

export function BrandingClient({ config }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [appName, setAppName] = useState(config?.appName ?? "");
  const [primaryColor, setPrimaryColor] = useState(config?.primaryColor ?? "#6366f1");
  const [logoUrl, setLogoUrl] = useState(config?.logoUrl ?? "");
  const [previewLogoUrl, setPreviewLogoUrl] = useState(config?.logoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function refresh() {
    startTransition(() => { router.refresh(); });
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!res.ok) { setError("Failed to get upload URL"); return; }
      const { uploadUrl, key } = await res.json() as { uploadUrl: string; key: string };
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const cdnUrl = `${process.env["NEXT_PUBLIC_CDN_URL"] ?? ""}/${key}`;
      setLogoUrl(cdnUrl);
      setPreviewLogoUrl(URL.createObjectURL(file));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaved(false);
    const res = await fetch("/api/admin/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appName, primaryColor, logoUrl: logoUrl || undefined }),
    });
    if (!res.ok) { setError("Failed to save branding"); return; }
    setSaved(true);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Theme & Branding</h1>
        <p className="text-muted-foreground">Customize app name, logo, and brand color</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">App Identity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>App Name</Label>
                <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Corp Shell" />
              </div>

              <div className="space-y-1">
                <Label>Logo</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadLogo(file);
                    }}
                  />
                  {previewLogoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewLogoUrl} alt="Logo preview" className="h-10 w-10 rounded object-contain" />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <Label>Primary Brand Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded border"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#6366f1"
                    className="w-32"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-green-600 dark:text-green-400">Saved successfully</p>}

          <Button onClick={() => void save()} disabled={isPending || uploading}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </div>

        {/* Live preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-background p-4 shadow-sm">
              <div className="flex items-center gap-3 border-b pb-3">
                {previewLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewLogoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded text-white text-xs font-bold"
                    style={{ background: primaryColor }}
                  >
                    {appName.charAt(0).toUpperCase() || "A"}
                  </div>
                )}
                <span className="font-semibold" style={{ color: primaryColor }}>{appName || "App Name"}</span>
              </div>
              <div className="mt-3 space-y-1">
                {["Dashboard", "Reports", "Settings"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                    <div className="h-2 w-2 rounded-full" style={{ background: primaryColor }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

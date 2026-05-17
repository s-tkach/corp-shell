"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Save, Upload } from "lucide-react";

// ── Color conversion helpers ────────────────────────────────────────────────

function hslStringToHex(hsl: string): string {
  const parts = hsl.trim().split(/\s+/);
  if (parts.length < 3) return "#000000";
  const h = parseFloat(parts[0]!) / 360;
  const s = parseFloat(parts[1]!) / 100;
  const l = parseFloat(parts[2]!) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHslString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ── Color groups config ──────────────────────────────────────────────────────

const COLOR_GROUPS = [
  {
    label: "Primary Theme Colors",
    colors: [
      { name: "Background", variable: "--background" },
      { name: "Foreground", variable: "--foreground" },
      { name: "Primary", variable: "--primary" },
      { name: "Primary Foreground", variable: "--primary-foreground" },
    ],
  },
  {
    label: "Secondary & Accent Colors",
    colors: [
      { name: "Secondary", variable: "--secondary" },
      { name: "Secondary Foreground", variable: "--secondary-foreground" },
      { name: "Accent", variable: "--accent" },
      { name: "Accent Foreground", variable: "--accent-foreground" },
    ],
  },
  {
    label: "UI Component Colors",
    colors: [
      { name: "Card", variable: "--card" },
      { name: "Card Foreground", variable: "--card-foreground" },
      { name: "Popover", variable: "--popover" },
      { name: "Popover Foreground", variable: "--popover-foreground" },
      { name: "Muted", variable: "--muted" },
      { name: "Muted Foreground", variable: "--muted-foreground" },
    ],
  },
  {
    label: "Utility & Form Colors",
    colors: [
      { name: "Border", variable: "--border" },
      { name: "Input", variable: "--input" },
      { name: "Ring", variable: "--ring" },
    ],
  },
  {
    label: "Status & Feedback Colors",
    colors: [
      { name: "Destructive", variable: "--destructive" },
      { name: "Destructive Foreground", variable: "--destructive-foreground" },
    ],
  },
  {
    label: "Sidebar & Navigation Colors",
    colors: [
      { name: "Sidebar Background", variable: "--sidebar-background" },
      { name: "Sidebar Foreground", variable: "--sidebar-foreground" },
      { name: "Sidebar Primary", variable: "--sidebar-primary" },
      { name: "Sidebar Primary Foreground", variable: "--sidebar-primary-foreground" },
      { name: "Sidebar Accent", variable: "--sidebar-accent" },
      { name: "Sidebar Accent Foreground", variable: "--sidebar-accent-foreground" },
      { name: "Sidebar Border", variable: "--sidebar-border" },
      { name: "Sidebar Ring", variable: "--sidebar-ring" },
    ],
  },
];

function getCssVar(variable: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

// ── Theme color palette ──────────────────────────────────────────────────────

interface ThemeColorPaletteProps {
  overrides: Record<string, string>;
  onChange: (variable: string, hex: string) => void;
}

function ThemeColorPalette({ overrides, onChange }: ThemeColorPaletteProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Theme Colors</h2>
        <p className="text-sm text-muted-foreground">Click any swatch to override a color. Changes apply live and persist on save.</p>
      </div>
      {COLOR_GROUPS.map((group) => (
        <div key={group.label} className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">{group.label}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.colors.map(({ name, variable }) => {
              const baseHsl = getCssVar(variable);
              const overrideHex = overrides[variable];
              const displayBg = overrideHex ?? (baseHsl ? `hsl(${baseHsl})` : "transparent");
              const pickerValue = overrideHex ?? (baseHsl ? hslStringToHex(baseHsl) : "#000000");
              const label = overrideHex ?? (baseHsl || "—");

              return (
                <div key={variable} className="flex items-center gap-3">
                  <label className="relative h-10 w-10 shrink-0 cursor-pointer rounded-md border overflow-hidden" title={`Edit ${name}`}>
                    <div className="h-full w-full" style={{ background: displayBg }} />
                    <input
                      type="color"
                      value={pickerValue}
                      onChange={(e) => onChange(variable, e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                  </label>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <p className="font-mono text-xs text-muted-foreground truncate">{label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Config {
  id: string;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  colorOverrides: Record<string, string> | null;
}

interface Props {
  config: Config | null;
}

export function BrandingClient({ config }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [appName, setAppName] = useState(config?.appName ?? "");
  const [logoUrl, setLogoUrl] = useState(config?.logoUrl ?? "");
  const [previewLogoUrl, setPreviewLogoUrl] = useState(config?.logoUrl ?? "");
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>(
    config?.colorOverrides ?? {}
  );
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    for (const [variable, hex] of Object.entries(colorOverrides)) {
      document.documentElement.style.setProperty(variable, hexToHslString(hex));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleColorChange(variable: string, hex: string) {
    setColorOverrides((prev) => ({ ...prev, [variable]: hex }));
    document.documentElement.style.setProperty(variable, hexToHslString(hex));
  }

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
      const urlData = await res.json() as { uploadUrl?: string; publicUrl?: string; error?: string };
      if (!res.ok) { setError(urlData.error ?? "Failed to get upload URL"); return; }
      const { uploadUrl, publicUrl } = urlData as { uploadUrl: string; publicUrl: string };
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setLogoUrl(publicUrl);
      setPreviewLogoUrl(URL.createObjectURL(file));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);
    setSaved(false);
    const primaryHex = colorOverrides["--primary"];
    const res = await fetch("/api/admin/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appName,
        logoUrl: logoUrl || undefined,
        colorOverrides,
        ...(primaryHex ? { primaryColor: primaryHex } : {}),
      }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { setError(data.error ?? "Failed to save branding"); return; }
    setSaved(true);
    refresh();
  }

  const primaryHex = colorOverrides["--primary"];
  const primaryBg = primaryHex ?? (typeof window !== "undefined" ? hslStringToHex(getCssVar("--primary")) : "#000000");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Theme & Branding</h1>
        <p className="text-muted-foreground">Customize app name, logo, and brand colors</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          </CardContent>
          <CardFooter className="flex-col items-start gap-2">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-green-600 dark:text-green-400">Saved successfully</p>}
            <Button onClick={() => void save()} disabled={isPending || uploading}>
              <Save className="mr-2 h-4 w-4" /> Save Changes
            </Button>
          </CardFooter>
        </Card>

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
                    style={{ background: primaryBg }}
                  >
                    {appName.charAt(0).toUpperCase() || "A"}
                  </div>
                )}
                <span className="font-semibold" style={{ color: primaryBg }}>{appName || "App Name"}</span>
              </div>
              <div className="mt-3 space-y-1">
                {["Dashboard", "Reports", "Settings"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                    <div className="h-2 w-2 rounded-full" style={{ background: primaryBg }} />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 border-t pt-8">
        <ThemeColorPalette overrides={colorOverrides} onChange={handleColorChange} />
      </div>
    </div>
  );
}

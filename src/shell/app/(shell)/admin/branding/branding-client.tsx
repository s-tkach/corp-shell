"use client";

import React, { useState, useTransition, useRef, useEffect } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Save, RotateCcw, ChevronDown, Bell, Moon, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Color conversion helpers ────────────────────────────────────────────────

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

// ── Color groups ─────────────────────────────────────────────────────────────

const COLOR_GROUPS = [
  {
    label: "Primary surface",
    colors: [
      { name: "Background", variable: "--background" },
      { name: "Foreground", variable: "--foreground" },
      { name: "Primary", variable: "--primary" },
      { name: "Primary Foreground", variable: "--primary-foreground" },
    ],
  },
  {
    label: "Secondary & accent",
    colors: [
      { name: "Secondary", variable: "--secondary" },
      { name: "Secondary Foreground", variable: "--secondary-foreground" },
      { name: "Accent", variable: "--accent" },
      { name: "Accent Foreground", variable: "--accent-foreground" },
    ],
  },
  {
    label: "Surfaces (card, popover, muted)",
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
    label: "Form & focus",
    colors: [
      { name: "Border", variable: "--border" },
      { name: "Input", variable: "--input" },
      { name: "Ring", variable: "--ring" },
    ],
  },
  {
    label: "Status & feedback",
    colors: [
      { name: "Destructive", variable: "--destructive" },
      { name: "Destructive Foreground", variable: "--destructive-foreground" },
    ],
  },
  {
    label: "Sidebar & navigation",
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

// ── Default theme colors (from globals.css) ───────────────────────────────────

const DEFAULT_LIGHT: Record<string, string> = {
  "--background": "#ffffff",
  "--foreground": "#020817",
  "--card": "#ffffff",
  "--card-foreground": "#020817",
  "--popover": "#ffffff",
  "--popover-foreground": "#020817",
  "--primary": "#0f172a",
  "--primary-foreground": "#f8fafc",
  "--secondary": "#f1f5f9",
  "--secondary-foreground": "#0f172a",
  "--muted": "#f1f5f9",
  "--muted-foreground": "#64748b",
  "--accent": "#f1f5f9",
  "--accent-foreground": "#0f172a",
  "--destructive": "#ef4444",
  "--destructive-foreground": "#f8fafc",
  "--border": "#e2e8f0",
  "--input": "#e2e8f0",
  "--ring": "#020817",
  "--sidebar-background": "#fafafa",
  "--sidebar-foreground": "#3f3f46",
  "--sidebar-primary": "#18181b",
  "--sidebar-primary-foreground": "#fafafa",
  "--sidebar-accent": "#f4f4f5",
  "--sidebar-accent-foreground": "#18181b",
  "--sidebar-border": "#e5e7eb",
  "--sidebar-ring": "#3b82f6",
};

const DEFAULT_DARK: Record<string, string> = {
  "--background": "#020817",
  "--foreground": "#f8fafc",
  "--card": "#020817",
  "--card-foreground": "#f8fafc",
  "--popover": "#020817",
  "--popover-foreground": "#f8fafc",
  "--primary": "#f8fafc",
  "--primary-foreground": "#0f172a",
  "--secondary": "#1e293b",
  "--secondary-foreground": "#f8fafc",
  "--muted": "#1e293b",
  "--muted-foreground": "#94a3b8",
  "--accent": "#1e293b",
  "--accent-foreground": "#f8fafc",
  "--destructive": "#7f1d1d",
  "--destructive-foreground": "#f8fafc",
  "--border": "#1e293b",
  "--input": "#1e293b",
  "--ring": "#cbd5e1",
  "--sidebar-background": "#18181b",
  "--sidebar-foreground": "#f4f4f5",
  "--sidebar-primary": "#1d4ed8",
  "--sidebar-primary-foreground": "#ffffff",
  "--sidebar-accent": "#27272a",
  "--sidebar-accent-foreground": "#f4f4f5",
  "--sidebar-border": "#27272a",
  "--sidebar-ring": "#3b82f6",
};

// ── Date format options ───────────────────────────────────────────────────────

const DATE_FORMAT_OPTIONS = [
  { token: "PPP", label: "Long" },
  { token: "PP", label: "Medium" },
  { token: "P", label: "Numeric" },
  { token: "EEEE, MMM d", label: "Weekday" },
  { token: "yyyy-MM-dd", label: "ISO" },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

interface Config {
  id: string;
  appName: string;
  logoUrl: string | null;
  colorOverrides: Record<string, string> | null;
  colorOverridesDark: Record<string, string> | null;
  loginBgImageUrl: string | null;
  loginBgColor: string | null;
  loginHeadline: string | null;
  loginFormPosition: string | null;
  loginCardColor: string | null;
  loginButtonColor: string | null;
  loginButtonText: string | null;
  headerShowDate: boolean | null;
  headerDateFormat: string | null;
}

interface Props {
  config: Config | null;
}

// ── Color swatch ──────────────────────────────────────────────────────────────

interface SwatchProps {
  name: string;
  variable: string;
  overrides: Record<string, string>;
  defaults: Record<string, string>;
  onChange: (variable: string, hex: string) => void;
}

function ColorSwatch({ name, variable, overrides, defaults, onChange }: SwatchProps) {
  const overrideHex = overrides[variable];
  const defaultHex = defaults[variable];
  const displayBg = overrideHex ?? (defaultHex ? defaultHex : "transparent");
  const pickerValue = overrideHex ?? defaultHex ?? "#000000";
  const label = overrideHex ?? defaultHex ?? "—";

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <label
        className="relative h-10 w-10 shrink-0 cursor-pointer rounded-md border overflow-hidden"
        title={`Edit ${name}`}
      >
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
}

// ── Color group (collapsible) ─────────────────────────────────────────────────

interface GroupProps {
  label: string;
  colors: { name: string; variable: string }[];
  overrides: Record<string, string>;
  defaults: Record<string, string>;
  onChange: (variable: string, hex: string) => void;
  defaultOpen?: boolean;
}

function ColorGroup({ label, colors, overrides, defaults, onChange, defaultOpen = false }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const overrideCount = colors.filter((c) => overrides[c.variable]).length;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
      >
        <span>{label}</span>
        <span className="text-muted-foreground text-xs">
          {overrideCount} / {colors.length}
          <span className="ml-2">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          {colors.map((c) => (
            <ColorSwatch
              key={c.variable}
              name={c.name}
              variable={c.variable}
              overrides={overrides}
              defaults={defaults}
              onChange={onChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BrandingClient({ config }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [appName, setAppName] = useState(config?.appName ?? "");
  const [logoUrl, setLogoUrl] = useState(config?.logoUrl ?? "");
  const [previewLogoUrl, setPreviewLogoUrl] = useState(config?.logoUrl ?? "");
  const [colorOverrides, setColorOverrides] = useState<Record<string, string>>(
    config?.colorOverrides ?? {}
  );
  const [colorOverridesDark, setColorOverridesDark] = useState<Record<string, string>>(
    config?.colorOverridesDark ?? {}
  );
  const [activeTheme, setActiveTheme] = useState<"light" | "dark">("light");
  const [loginBgImageUrl, setLoginBgImageUrl] = useState(config?.loginBgImageUrl ?? "");
  const [previewLoginBgImageUrl, setPreviewLoginBgImageUrl] = useState(config?.loginBgImageUrl ?? "");
  const [loginBgColor, setLoginBgColor] = useState(config?.loginBgColor ?? "#0f172a");
  const [loginHeadline, setLoginHeadline] = useState(config?.loginHeadline ?? "");
  const [loginFormPosition, setLoginFormPosition] = useState<"left" | "center" | "right">(
    (config?.loginFormPosition as "left" | "center" | "right") ?? "center"
  );
  const [loginCardColor, setLoginCardColor] = useState(config?.loginCardColor ?? "#ffffff");
  const [loginButtonColor, setLoginButtonColor] = useState(config?.loginButtonColor ?? "#0f172a");
  const [loginButtonText, setLoginButtonText] = useState(config?.loginButtonText ?? "");
  const [headerShowDate, setHeaderShowDate] = useState(config?.headerShowDate ?? false);
  const [headerDateFormat, setHeaderDateFormat] = useState(config?.headerDateFormat ?? "PPP");
  const [savedHeaderShowDate] = useState(config?.headerShowDate ?? false);
  const [savedHeaderDateFormat] = useState(config?.headerDateFormat ?? "PPP");
  const [uploading, setUploading] = useState(false);
  const [loginBgUploading, setLoginBgUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const loginBgFileRef = useRef<HTMLInputElement>(null);
  const [savedOverrides, setSavedOverrides] = useState<Record<string, string>>(
    config?.colorOverrides ?? {}
  );
  const [savedOverridesDark, setSavedOverridesDark] = useState<Record<string, string>>(
    config?.colorOverridesDark ?? {}
  );
  const [savedAppName] = useState(config?.appName ?? "");

  function countDiffs(a: Record<string, string>, b: Record<string, string>) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let count = 0;
    for (const k of keys) if (a[k] !== b[k]) count++;
    return count;
  }

  const unsavedCount =
    countDiffs(colorOverrides, savedOverrides) +
    countDiffs(colorOverridesDark, savedOverridesDark) +
    (appName !== savedAppName ? 1 : 0) +
    (headerShowDate !== savedHeaderShowDate ? 1 : 0) +
    (headerDateFormat !== savedHeaderDateFormat ? 1 : 0);

  const activeOverrides = activeTheme === "light" ? colorOverrides : colorOverridesDark;
  const setActiveOverrides = activeTheme === "light" ? setColorOverrides : setColorOverridesDark;

  useEffect(() => {
    for (const [variable, hex] of Object.entries(colorOverrides)) {
      document.documentElement.style.setProperty(variable, hexToHslString(hex));
    }
  }, []); // intentional: apply saved overrides once on mount

  function handleColorChange(variable: string, hex: string) {
    setActiveOverrides((prev) => ({ ...prev, [variable]: hex }));
  }

  function handleResetUnsaved() {
    setColorOverrides(savedOverrides);
    setColorOverridesDark(savedOverridesDark);
  }

  function handleResetToDefault() {
    if (activeTheme === "light") {
      setColorOverrides({});
    } else {
      setColorOverridesDark({});
    }
  }

  function handleResetLoginPage() {
    setLoginBgImageUrl("");
    setPreviewLoginBgImageUrl("");
    setLoginBgColor("#0f172a");
    setLoginHeadline("");
    setLoginFormPosition("center");
    setLoginCardColor("#ffffff");
    setLoginButtonColor("#0f172a");
    setLoginButtonText("");
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

  async function uploadLoginBg(file: File) {
    setLoginBgUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, uploadType: "login-bg" }),
      });
      const urlData = await res.json() as { uploadUrl?: string; publicUrl?: string; error?: string };
      if (!res.ok) { setError(urlData.error ?? "Failed to get upload URL"); return; }
      const { uploadUrl, publicUrl } = urlData as { uploadUrl: string; publicUrl: string };
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      setLoginBgImageUrl(publicUrl);
      setPreviewLoginBgImageUrl(URL.createObjectURL(file));
    } finally {
      setLoginBgUploading(false);
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
        colorOverridesDark,
        loginBgImageUrl: loginBgImageUrl || undefined,
        loginBgColor,
        loginHeadline,
        loginFormPosition,
        loginCardColor,
        loginButtonColor,
        loginButtonText,
        headerShowDate,
        headerDateFormat,
        ...(primaryHex ? { primaryColor: primaryHex } : {}),
      }),
    });
    const data = await res.json() as { error?: string };
    if (!res.ok) { setError(data.error ?? "Failed to save branding"); return; }
    for (const [variable, hex] of Object.entries(colorOverrides)) {
      document.documentElement.style.setProperty(variable, hexToHslString(hex));
    }
    setSavedOverrides(colorOverrides);
    setSavedOverridesDark(colorOverridesDark);
    setSaved(true);
    refresh();
  }

  const TAB_ORDER = ["identity", "colors", "login"] as const;
  type TabKey = typeof TAB_ORDER[number];
  const TAB_LABELS: Record<TabKey, string> = {
    identity: "Identity",
    colors: "Design colors",
    login: "Login page",
  };
  const [activeTab, setActiveTab] = useState<TabKey>("identity");

  const activeDefaults = activeTheme === "light" ? DEFAULT_LIGHT : DEFAULT_DARK;
  const previewVars = Object.fromEntries(
    Object.entries({
      ...activeDefaults,
      ...(activeTheme === "light" ? colorOverrides : colorOverridesDark),
    }).map(([variable, hex]) => [variable, hexToHslString(hex)])
  ) as React.CSSProperties;

  const previewPrimaryHex =
    (activeTheme === "light" ? colorOverrides : colorOverridesDark)["--primary"] ??
    activeDefaults["--primary"] ??
    "#3b82f6";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Theme &amp; Branding</h1>
        <p className="text-muted-foreground text-sm">
          Tune your workspace identity and design colors. Changes preview live on the right and
          only ship to teammates when you save.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left: tabs */}
        <div className="w-1/2 min-w-0">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="identity">Identity</TabsTrigger>
              <TabsTrigger value="colors">Design colors</TabsTrigger>
              <TabsTrigger value="login">Login page</TabsTrigger>
            </TabsList>

            {/* Identity tab */}
            <TabsContent value="identity" className="mt-6">
              <div className="space-y-6 max-w-sm">
                <div className="space-y-1">
                  <Label>App Name</Label>
                  <Input
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Corp Shell"
                  />
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
                      <img
                        src={previewLogoUrl}
                        alt="Logo preview"
                        className="h-10 w-10 rounded object-contain"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="header-show-date"
                      checked={headerShowDate}
                      onCheckedChange={setHeaderShowDate}
                    />
                    <Label htmlFor="header-show-date">Show date in header</Label>
                  </div>
                  {headerShowDate && (
                    <div className="space-y-1">
                      <Label>Date format</Label>
                      <Select value={headerDateFormat} onValueChange={setHeaderDateFormat}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATE_FORMAT_OPTIONS.map(({ token, label }) => (
                            <SelectItem key={token} value={token}>
                              <span className="font-medium">{label}</span>
                              <span className="ml-2 text-muted-foreground font-mono text-xs">
                                {format(new Date(), token)}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Design colors tab */}
            <TabsContent value="colors" className="mt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <p className="flex-1 text-sm text-muted-foreground">
                    Click any swatch to edit. All values are HSL — paste hex/RGB and we&apos;ll convert.
                  </p>
                  <span className="shrink-0">
                    {Object.keys(activeOverrides).length} colors · {COLOR_GROUPS.length} groups
                  </span>
                </div>
                <div className="space-y-2">
                  {COLOR_GROUPS.map((group, i) => (
                    <ColorGroup
                      key={group.label}
                      label={group.label}
                      colors={group.colors}
                      overrides={activeOverrides}
                      defaults={activeDefaults}
                      onChange={handleColorChange}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Login page tab */}
            <TabsContent value="login" className="mt-6">
              <div className="space-y-6">
                {/* Background image */}
                <div className="space-y-1">
                  <Label>Background image</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loginBgFileRef.current?.click()}
                      disabled={loginBgUploading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      {loginBgUploading ? "Uploading..." : "Upload image"}
                    </Button>
                    <input
                      ref={loginBgFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadLoginBg(file);
                      }}
                    />
                    {previewLoginBgImageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewLoginBgImageUrl}
                        alt="Background preview"
                        className="h-10 w-16 rounded object-cover border"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Used as the full-screen background. A dark overlay is added automatically.</p>
                </div>

                {/* Color pickers row */}
                <div className="space-y-1">
                  <Label>Colors</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Background color */}
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <label className="relative h-10 w-10 shrink-0 cursor-pointer rounded-md border overflow-hidden" title="Edit Background color">
                        <div className="h-full w-full" style={{ background: loginBgColor }} />
                        <input
                          type="color"
                          value={loginBgColor}
                          onChange={(e) => setLoginBgColor(e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">Background</p>
                        <p className="font-mono text-xs text-muted-foreground truncate">{loginBgColor}</p>
                      </div>
                    </div>
                    {/* Card color */}
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <label className="relative h-10 w-10 shrink-0 cursor-pointer rounded-md border overflow-hidden" title="Edit Card background color">
                        <div className="h-full w-full" style={{ background: loginCardColor }} />
                        <input
                          type="color"
                          value={loginCardColor}
                          onChange={(e) => setLoginCardColor(e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">Card</p>
                        <p className="font-mono text-xs text-muted-foreground truncate">{loginCardColor}</p>
                      </div>
                    </div>
                    {/* Button color */}
                    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <label className="relative h-10 w-10 shrink-0 cursor-pointer rounded-md border overflow-hidden" title="Edit Button color">
                        <div className="h-full w-full" style={{ background: loginButtonColor }} />
                        <input
                          type="color"
                          value={loginButtonColor}
                          onChange={(e) => setLoginButtonColor(e.target.value)}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">Button</p>
                        <p className="font-mono text-xs text-muted-foreground truncate">{loginButtonColor}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Headline + Button text */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Headline / tagline</Label>
                    <Input
                      value={loginHeadline}
                      onChange={(e) => setLoginHeadline(e.target.value)}
                      placeholder="Welcome to your workspace"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Button text</Label>
                    <Input
                      value={loginButtonText}
                      onChange={(e) => setLoginButtonText(e.target.value)}
                      placeholder="Sign in with SSO"
                    />
                  </div>
                </div>

                {/* Form position */}
                <div className="space-y-2">
                  <Label>Form panel position</Label>
                  <div className="flex gap-2">
                    {(["left", "center", "right"] as const).map((pos) => (
                      <Button
                        key={pos}
                        type="button"
                        variant={loginFormPosition === pos ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLoginFormPosition(pos)}
                        className="capitalize"
                      >
                        {pos}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

          </Tabs>

          {/* Step navigation */}
          <div className="mt-6 flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
            <span>Step {TAB_ORDER.indexOf(activeTab) + 1} of {TAB_ORDER.length} · {TAB_LABELS[activeTab]}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={TAB_ORDER.indexOf(activeTab) === 0}
                onClick={() => setActiveTab(TAB_ORDER[TAB_ORDER.indexOf(activeTab) - 1]!)}
              >
                ← Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={TAB_ORDER.indexOf(activeTab) === TAB_ORDER.length - 1}
                onClick={() => setActiveTab(TAB_ORDER[TAB_ORDER.indexOf(activeTab) + 1]!)}
              >
                Next →
              </Button>
            </div>
          </div>
        </div>

        {/* Right: live preview */}
        <div className="w-1/2 min-w-0 sticky top-6">
          {/* Preview header */}
          <div className="mb-3 flex items-center gap-3">
            <div className="shrink-0">
              <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Live Preview</p>
              <p className="text-lg font-semibold">Preview</p>
            </div>
            {/* Dark/Light toggle — hidden on login tab */}
            <div className={`flex rounded-md border overflow-hidden text-sm ${activeTab === "login" ? "invisible" : ""}`}>
              <button
                type="button"
                onClick={() => setActiveTheme("dark")}
                className={`px-3 py-1.5 transition-colors ${
                  activeTheme === "dark"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setActiveTheme("light")}
                className={`px-3 py-1.5 transition-colors ${
                  activeTheme === "light"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Light
              </button>
            </div>
            <div className="flex flex-1 items-center justify-end gap-2">
              {unsavedCount > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  {unsavedCount} unsaved {unsavedCount === 1 ? "change" : "changes"}
                </span>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {saved && <p className="text-sm text-green-600 dark:text-green-400">Saved</p>}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                    Reset
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {activeTab !== "login" && (
                    <>
                      <DropdownMenuItem
                        onClick={handleResetUnsaved}
                        disabled={unsavedCount === 0}
                      >
                        Reset unsaved changes
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleResetToDefault}>
                        Reset to default ({activeTheme})
                      </DropdownMenuItem>
                    </>
                  )}
                  {activeTab === "login" && (
                    <DropdownMenuItem onClick={handleResetLoginPage}>
                      Reset login page to defaults
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" onClick={() => void save()} disabled={isPending || uploading}>
                <Save className="mr-2 h-3.5 w-3.5" />
                Save changes
              </Button>
            </div>
          </div>

          {/* Preview body */}
          {activeTab === "login" ? (
            /* Login page preview */
            <div
              className="rounded-lg border overflow-hidden relative flex items-center"
              style={{
                minHeight: "520px",
                backgroundColor: loginBgColor,
                ...(previewLoginBgImageUrl
                  ? { backgroundImage: `url(${previewLoginBgImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : {}),
                justifyContent: loginFormPosition === "left" ? "flex-start" : loginFormPosition === "right" ? "flex-end" : "center",
              }}
            >
              {previewLoginBgImageUrl && (
                <div className="absolute inset-0 bg-black/40 rounded-lg" />
              )}
              <div
                className="relative z-10 m-4 rounded-xl shadow-xl p-5 flex flex-col gap-3"
                style={{ width: "140px", backgroundColor: loginCardColor }}
              >
                <div className="flex items-center gap-2">
                  {previewLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewLogoUrl} alt="" className="h-5 w-5 rounded object-contain flex-shrink-0" />
                  ) : (
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded text-white text-[9px] font-bold flex-shrink-0"
                      style={{ background: previewPrimaryHex }}
                    >
                      {appName.charAt(0).toUpperCase() || "A"}
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-zinc-800 truncate">{appName || "Corp Shell"}</span>
                </div>
                {loginHeadline && (
                  <p className="text-[10px] font-bold text-zinc-800 leading-tight">{loginHeadline}</p>
                )}
                <button
                  type="button"
                  className="w-full rounded text-white text-[9px] font-semibold py-1.5 cursor-pointer"
                  style={{ background: loginButtonColor }}
                >
                  {loginButtonText || "Sign in with SSO"}
                </button>
              </div>
            </div>
          ) : (
          <div
            className={`rounded-lg border overflow-hidden ${activeTheme === "dark" ? "dark" : ""}`}
            style={previewVars}
          >
            <div className="transition-all duration-200 bg-background text-foreground w-full flex" style={{ minHeight: "520px" }}>

              {/* Sidebar */}
              <div className="flex flex-col border-r w-40 flex-shrink-0" style={{ background: "hsl(var(--sidebar-background))", borderColor: "hsl(var(--sidebar-border))" }}>
                {/* Logo row */}
                <div className="flex items-center gap-2 px-3 py-2.5 border-b" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
                  {previewLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewLogoUrl} alt="" className="h-5 w-5 rounded object-contain flex-shrink-0" />
                  ) : (
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded text-white text-xs font-bold flex-shrink-0"
                      style={{ background: previewPrimaryHex }}
                    >
                      {appName.charAt(0).toUpperCase() || "N"}
                    </div>
                  )}
                  <span className="text-xs font-semibold truncate" style={{ color: "hsl(var(--sidebar-foreground))" }}>
                    {appName || "Northwind"}
                  </span>
                </div>

                {/* Nav items */}
                <div className="flex-1 p-1.5 space-y-0.5">
                  <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--sidebar-foreground) / 0.5)" }}>
                    Main
                  </p>
                  {[
                    { label: "Dashboard", active: true },
                    { label: "Reports", active: false },
                    { label: "Team", active: false },
                  ].map(({ label, active }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium"
                      style={
                        active
                          ? { background: "hsl(var(--sidebar-primary))", color: "hsl(var(--sidebar-primary-foreground))" }
                          : { color: "hsl(var(--sidebar-foreground))" }
                      }
                    >
                      <span className="h-3 w-3 flex-shrink-0 rounded-sm opacity-70" style={{ background: active ? "hsl(var(--sidebar-primary-foreground) / 0.4)" : "hsl(var(--sidebar-foreground) / 0.3)" }} />
                      {label}
                    </div>
                  ))}
                </div>

                {/* Admin link at bottom */}
                <div className="p-1.5 border-t" style={{ borderColor: "hsl(var(--sidebar-border))" }}>
                  <div
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs"
                    style={{ color: "hsl(var(--sidebar-foreground) / 0.6)" }}
                  >
                    <Settings className="h-3 w-3 flex-shrink-0 opacity-60" style={{ color: "hsl(var(--sidebar-foreground))" }} />
                    Admin
                  </div>
                </div>
              </div>

              {/* Content area */}
              <div className="flex flex-col flex-1 min-w-0">
                {/* Top bar */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-background" style={{ minHeight: "36px" }}>
                  <span className="text-xs text-muted-foreground">Dashboard</span>
                  <div className="flex items-center gap-1.5">
                    {headerShowDate && (
                      <span className="text-[10px] text-muted-foreground tabular-nums mr-1">
                        {format(new Date(), headerDateFormat || "PPP")}
                      </span>
                    )}
                    <div className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-70 hover:opacity-100">
                      <Bell className="h-3 w-3" />
                    </div>
                    <div className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-70 hover:opacity-100">
                      <Moon className="h-3 w-3" />
                    </div>
                    <div
                      className="flex h-5 w-5 items-center justify-center rounded-full text-white text-[9px] font-bold"
                      style={{ background: previewPrimaryHex }}
                    >
                      A
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 grid gap-4 grid-cols-2">
                  {/* Stats card */}
                  <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Today&apos;s pipeline</p>
                      <p className="text-xs text-muted-foreground">Across all regions</p>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">$248,910</span>
                      <span
                        className="text-xs font-medium px-1.5 py-0.5 rounded"
                        style={{ background: previewPrimaryHex, color: "#fff" }}
                      >
                        +12.4%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full w-full bg-muted overflow-hidden">
                      <div className="h-full w-3/4 rounded-full" style={{ background: previewPrimaryHex }} />
                    </div>
                    <div className="flex gap-1">
                      {["NA", "EU", "APAC"].map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded font-medium text-white"
                        style={{ background: previewPrimaryHex }}
                      >
                        Open report
                      </button>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded font-medium border border-border bg-background text-foreground"
                      >
                        Share
                      </button>
                    </div>
                  </div>

                  {/* Invite card */}
                  <div className="rounded-lg border bg-card text-card-foreground p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Invite a teammate</p>
                      <p className="text-xs text-muted-foreground">They&apos;ll see the new workspace identity.</p>
                    </div>
                    <input
                      readOnly
                      value="name@company.com"
                      className="w-full rounded border border-input bg-background px-3 py-1.5 text-xs text-muted-foreground outline-none"
                    />
                    <div className="space-y-1">
                      {[
                        { name: "Avery Chen", role: "Owner" },
                        { name: "Jules Park", role: "Member" },
                        { name: "Sami Otieno", role: "Member" },
                      ].map(({ name, role }) => (
                        <div key={name} className="flex items-center justify-between text-xs py-1 border-b border-border last:border-0">
                          <span>{name}</span>
                          <span className="text-muted-foreground">{role}</span>
                        </div>
                      ))}
                    </div>
                    <div
                      className="rounded p-2 text-xs"
                      style={{ background: `${previewPrimaryHex}22`, color: previewPrimaryHex }}
                    >
                      <strong>Heads up:</strong> Brand colors apply to email invites within 5 minutes.
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded font-medium text-white"
                        style={{ background: previewPrimaryHex }}
                      >
                        Send invite
                      </button>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded font-medium border border-border bg-background text-foreground"
                      >
                        Copy link
                      </button>
                      <button
                        type="button"
                        className="text-xs px-3 py-1.5 rounded font-medium bg-destructive text-destructive-foreground"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
          )}
        </div>
      </div>


    </div>
  );
}

import {
  Palette,
  Shield,
  Users,
  KeyRound,
  Bell,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SettingsRoute {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_ROUTES: SettingsRoute[] = [
  { href: "/settings/branding",      label: "Branding",      description: "App name, logo, and brand color",            icon: Palette },
  { href: "/settings/roles",         label: "Roles",         description: "Manage roles and IDP group mappings",        icon: Shield },
  { href: "/settings/companies",     label: "Companies",     description: "Manage company hierarchy",                   icon: Building2 },
  { href: "/settings/users",         label: "Users",         description: "View users, assign roles and subscriptions", icon: Users },
  { href: "/settings/sso",           label: "SSO",           description: "OIDC connection health",                     icon: KeyRound },
  { href: "/settings/notifications", label: "Notifications", description: "Create and manage notifications",            icon: Bell },
];

export const SETTINGS_ROUTE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  SETTINGS_ROUTES.map((r) => [r.href, r.label])
);

export const PLATFORM_ROUTE_LABEL_MAP: Record<string, string> = {
  "/platform": "Platform",
  "/platform/tenants": "Tenants",
  "/platform/admins": "Platform Admins",
  "/platform/apps": "Apps",
  "/platform/subscriptions": "Subscriptions",
  "/platform/menu": "Menu",
};

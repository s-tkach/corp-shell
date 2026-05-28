import {
  Palette,
  Shield,
  Users,
  KeyRound,
  Bell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AdminRoute {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const ADMIN_ROUTES: AdminRoute[] = [
  { href: "/admin/branding",      label: "Branding",      description: "App name, logo, and brand color",            icon: Palette },
  { href: "/admin/roles",         label: "Roles",         description: "Manage roles and IDP group mappings",        icon: Shield },
  { href: "/admin/users",         label: "Users",         description: "View users, assign roles and subscriptions", icon: Users },
  { href: "/admin/sso",           label: "SSO",           description: "OIDC connection health",                     icon: KeyRound },
  { href: "/admin/notifications", label: "Notifications", description: "Create and manage notifications",            icon: Bell },
];

export const ADMIN_ROUTE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  ADMIN_ROUTES.map((r) => [r.href, r.label])
);

export const PLATFORM_ROUTE_LABEL_MAP: Record<string, string> = {
  "/platform": "Platform",
  "/platform/tenants": "Tenants",
  "/platform/admins": "Platform Admins",
  "/platform/apps": "Apps",
  "/platform/subscriptions": "Subscriptions",
  "/platform/menu": "Menu",
};

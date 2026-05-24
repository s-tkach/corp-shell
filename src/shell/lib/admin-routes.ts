import {
  Palette,
  Menu,
  Shield,
  Users,
  KeyRound,
  AppWindow,
  CreditCard,
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
  { href: "/admin/menu",          label: "Menu",          description: "CRUD and reorder nav sections and items",    icon: Menu },
  { href: "/admin/roles",         label: "Roles",         description: "Manage roles and IDP group mappings",        icon: Shield },
  { href: "/admin/users",         label: "Users",         description: "View users, assign roles and subscriptions", icon: Users },
  { href: "/admin/sso",           label: "SSO",           description: "OIDC connection health",                     icon: KeyRound },
  { href: "/admin/apps",          label: "Apps",          description: "Register and manage child apps",             icon: AppWindow },
  { href: "/admin/subscriptions", label: "Subscriptions", description: "Manage tiers and upgrade prompts",           icon: CreditCard },
  { href: "/admin/notifications", label: "Notifications", description: "Create and manage notifications",            icon: Bell },
];

export const ADMIN_ROUTE_LABEL_MAP: Record<string, string> = Object.fromEntries(
  ADMIN_ROUTES.map((r) => [r.href, r.label])
);

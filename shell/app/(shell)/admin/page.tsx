import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Menu, Shield, Users, KeyRound, AppWindow, CreditCard, Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const sections: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  { href: "/admin/menu", title: "Menu Manager", description: "CRUD and reorder nav sections and items", icon: Menu },
  { href: "/admin/roles", title: "Role Manager", description: "Manage roles and IDP group mappings", icon: Shield },
  { href: "/admin/users", title: "User Manager", description: "View users, assign roles and subscriptions", icon: Users },
  { href: "/admin/sso", title: "SSO Status", description: "OIDC connection health", icon: KeyRound },
  { href: "/admin/apps", title: "Application Registry", description: "Register and manage child apps", icon: AppWindow },
  { href: "/admin/subscriptions", title: "Subscription Tiers", description: "Manage tiers and upgrade prompts", icon: CreditCard },
  { href: "/admin/branding", title: "Theme & Branding", description: "App name, logo, and brand color", icon: Palette },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage all shell configuration</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map(({ href, title, description, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

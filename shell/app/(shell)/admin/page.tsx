import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const sections = [
  { href: "/admin/menu", title: "Menu Manager", description: "CRUD and reorder nav sections and items" },
  { href: "/admin/roles", title: "Role Manager", description: "Manage roles and IDP group mappings" },
  { href: "/admin/users", title: "User Manager", description: "View users, assign roles and subscriptions" },
  { href: "/admin/sso", title: "SSO Status", description: "OIDC connection health" },
  { href: "/admin/apps", title: "Application Registry", description: "Register and manage child apps" },
  { href: "/admin/subscriptions", title: "Subscription Tiers", description: "Manage tiers and upgrade prompts" },
  { href: "/admin/branding", title: "Theme & Branding", description: "App name, logo, and brand color" },
];

export default function AdminIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">Manage all shell configuration</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="h-full cursor-pointer transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

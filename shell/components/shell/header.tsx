"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, LogOut, User } from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MenuSection } from "@/app/api/menu/route";

interface HeaderProps {
  menu: MenuSection[];
  appName: string;
  logoUrl: string | null;
  userName: string;
  userEmail: string;
  userRoles: string[];
}

const ADMIN_ROUTE_LABELS: Record<string, string> = {
  "/admin": "Admin",
  "/admin/branding": "Branding",
  "/admin/menu": "Menu",
  "/admin/roles": "Roles",
  "/admin/users": "Users",
  "/admin/sso": "SSO",
  "/admin/apps": "Apps",
  "/admin/subscriptions": "Subscriptions",
};

function buildBreadcrumbs(
  pathname: string,
  menu: MenuSection[]
): { label: string; href: string }[] {
  if (pathname.startsWith("/admin")) {
    const crumbs: { label: string; href: string }[] = [{ label: "Admin", href: "/admin" }];
    if (pathname !== "/admin" && ADMIN_ROUTE_LABELS[pathname]) {
      crumbs.push({ label: ADMIN_ROUTE_LABELS[pathname]!, href: pathname });
    }
    return crumbs;
  }

  const allItems = menu.flatMap((s) => s.items);
  const match = allItems
    .filter((item) => pathname === item.route || pathname.startsWith(item.route + "/"))
    .sort((a, b) => b.route.length - a.route.length)[0];

  if (!match) return [];
  if (match.route === pathname) return [{ label: match.label, href: match.route }];

  const sub = pathname.slice(match.route.length).replace(/^\//, "").split("/")[0] ?? "";
  const crumbs: { label: string; href: string }[] = [{ label: match.label, href: match.route }];
  if (sub) crumbs.push({ label: sub, href: pathname });
  return crumbs;
}

export function Header({ menu, appName, logoUrl, userName, userEmail, userRoles }: HeaderProps) {
  const pathname = usePathname();
  const { setTheme } = useTheme();

  const breadcrumbs = buildBreadcrumbs(pathname, menu);

  function handleTheme(theme: "light" | "dark" | "system") {
    setTheme(theme);
    fetch("/api/users/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme }),
    }).catch(() => undefined);
  }

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4">
      <div className="flex items-center gap-2 min-w-0">
        {logoUrl && (
          <Image src={logoUrl} alt={appName} width={28} height={28} className="rounded object-contain flex-shrink-0" />
        )}
        <span className="font-semibold text-sm truncate hidden sm:block">{appName}</span>
      </div>

      <nav className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <span className="select-none">/</span>}
              {isLast ? (
                <span className="text-foreground font-medium">{crumb.label}</span>
              ) : (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div data-shell-notifications />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Toggle theme">
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="User menu">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">{userName || userEmail}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              {userRoles.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {userRoles.map((role) => (
                    <span
                      key={role}
                      className="inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/api/auth/logout" })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

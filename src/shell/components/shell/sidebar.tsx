"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Settings, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { ICON_MAP } from "@/lib/icon-map";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useShellStore } from "@/lib/store/shell-store";
import { ADMIN_ROLES } from "@/lib/roles";
import { SETTINGS_ROUTES } from "@/lib/settings-routes";
import { CompanySwitcher } from "./company-switcher";
import type { MenuSection } from "@/app/api/menu/route";

interface SidebarProps {
  menu: MenuSection[];
  appName: string;
  logoUrl: string | null;
  userRoles: string[];
  userName: string;
  userEmail: string;
  tenantSlug: string;
  accessibleCompanies: { id: string; parentId: string | null; name: string; logoUrl: string | null; depth: number }[];
  activeCompanyId: string | null;
}

export function Sidebar({ menu, appName, logoUrl, userRoles, userName, userEmail, accessibleCompanies, activeCompanyId }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed } = useShellStore();
  const activeCompany = accessibleCompanies.find((c) => c.id === activeCompanyId) ?? accessibleCompanies[0] ?? null;
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const section of menu) {
      for (const item of section.items) {
        if (item.isFolder) ids.add(item.id);
      }
    }
    return ids;
  });

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      for (const section of menu) {
        const hasActive = section.items.some(
          (item) =>
            (item.route && (pathname === item.route || pathname.startsWith(item.route + "/"))) ||
            item.children.some(
              (child) => pathname === child.route || pathname.startsWith(child.route + "/")
            )
        );
        if (hasActive) next.delete(section.id);
      }
      return next;
    });

    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      for (const section of menu) {
        for (const item of section.items) {
          if (item.isFolder) {
            const hasActive = item.children.some(
              (child) => pathname === child.route || pathname.startsWith(child.route + "/")
            );
            if (hasActive) next.delete(item.id);
          }
        }
      }
      return next;
    });
  }, [pathname, menu]);

  function toggleSection(id: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFolder(id: string) {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border">
        {sidebarCollapsed ? (
          activeCompany?.logoUrl ? (
            <Image src={activeCompany.logoUrl} alt={activeCompany.name} width={28} height={28} className="rounded-full object-contain flex-shrink-0 mx-auto" />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground mx-auto">
              {(activeCompany?.name ?? appName).charAt(0).toUpperCase()}
            </span>
          )
        ) : (
          <div className="flex items-center min-w-0 flex-1">
            <CompanySwitcher companies={accessibleCompanies} activeCompanyId={activeCompanyId} />
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-4">
          {menu.map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            return (
            <div key={section.id}>
              {!sidebarCollapsed && section.label && (
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between px-3 py-1 group cursor-pointer"
                >
                  <p className="text-xs font-semibold uppercase text-sidebar-foreground/50 tracking-wider group-hover:text-sidebar-foreground/80 transition-colors">
                    {section.label}
                  </p>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 transition-all",
                      isCollapsed && "-rotate-90"
                    )}
                  />
                </button>
              )}
              {!isCollapsed && (
              <div className="space-y-1">
                {section.items.map((item) => {
                  if (item.isFolder) {
                    const folderCollapsed = collapsedFolders.has(item.id);
                    const hasActiveChild = item.children.some(
                      (child) => pathname === child.route || pathname.startsWith(child.route + "/")
                    );
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleFolder(item.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                            hasActiveChild
                              ? "text-sidebar-primary-foreground bg-sidebar-primary/20"
                              : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                          )}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          {item.icon && (() => {
                            const Icon = ICON_MAP[item.icon];
                            return Icon
                              ? <Icon className="h-4 w-4 flex-shrink-0" />
                              : <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center text-base leading-none">{item.icon}</span>;
                          })()}
                          {!sidebarCollapsed && (
                            <>
                              <span className="flex-1 truncate text-left">{item.label}</span>
                              {folderCollapsed
                                ? <ChevronRight className="h-3 w-3 flex-shrink-0 text-sidebar-foreground/50" />
                                : <ChevronDown className="h-3 w-3 flex-shrink-0 text-sidebar-foreground/50" />
                              }
                            </>
                          )}
                        </button>
                        {!sidebarCollapsed && !folderCollapsed && item.children.length > 0 && (
                          <div className="ml-4 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                            {item.children.map((child) => {
                              const active =
                                pathname === child.route || pathname.startsWith(child.route + "/");
                              return (
                                <Link
                                  key={child.id}
                                  href={child.route}
                                  className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                    active
                                      ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                                      : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                                  )}
                                >
                                  {child.icon && (() => {
                                    const Icon = ICON_MAP[child.icon];
                                    return Icon
                                      ? <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                                      : <span className="h-3.5 w-3.5 flex-shrink-0 flex items-center justify-center text-xs leading-none">{child.icon}</span>;
                                  })()}
                                  <span className="flex-1 truncate">{child.label}</span>
                                  {child.badge && (
                                    <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-xs font-medium text-sidebar-primary-foreground">
                                      {child.badge}
                                    </span>
                                  )}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  const active =
                    pathname === item.route || pathname.startsWith(item.route + "/");
                  return (
                    <Link
                      key={item.id}
                      href={item.route}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground"
                      )}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      {item.icon && (() => {
                        const Icon = ICON_MAP[item.icon];
                        return Icon
                          ? <Icon className="h-4 w-4 flex-shrink-0" />
                          : <span className="h-4 w-4 flex-shrink-0 flex items-center justify-center text-base leading-none">{item.icon}</span>;
                      })()}
                      {!sidebarCollapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!sidebarCollapsed && item.badge && (
                        <span className="ml-auto rounded-full bg-sidebar-primary px-1.5 py-0.5 text-xs font-medium text-sidebar-primary-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
              )}
            </div>
            );
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-sidebar-border" />
      <div className="p-2 space-y-1">
        {userRoles.some((r) => ADMIN_ROLES.has(r)) && (
          <>
            <Link
              href="/settings"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/settings"
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/60"
              )}
              title={sidebarCollapsed ? "Settings" : undefined}
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="flex-1">Settings</span>}
            </Link>
            {!sidebarCollapsed && pathname.startsWith("/settings") && (
              <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                {SETTINGS_ROUTES.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === "/settings" ? pathname === "/settings" : pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        active
                          ? "font-medium text-sidebar-primary-foreground bg-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="User menu"
              className={cn(
                "flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                sidebarCollapsed ? "justify-center" : "gap-3"
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {(userName || userEmail).charAt(0).toUpperCase()}
              </span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex min-w-0 flex-1 flex-col text-left">
                    <span className="truncate text-sm font-medium text-sidebar-foreground">{userName || userEmail}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{userEmail}</span>
                  </span>
                  <ChevronUp className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={sidebarCollapsed ? "center" : "start"} className="w-64">
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
    </aside>
  );
}

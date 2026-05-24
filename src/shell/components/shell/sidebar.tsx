"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronDown, Settings } from "lucide-react";
import { ICON_MAP } from "@/lib/icon-map";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useShellStore } from "@/lib/store/shell-store";
import { ADMIN_ROLES } from "@/lib/roles";
import { ADMIN_ROUTES } from "@/lib/admin-routes";
import type { MenuSection } from "@/app/api/menu/route";

interface SidebarProps {
  menu: MenuSection[];
  appName: string;
  logoUrl: string | null;
  userRoles: string[];
}

export function Sidebar({ menu, appName, logoUrl, userRoles }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useShellStore();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      for (const section of menu) {
        const hasActive = section.items.some(
          (item) => pathname === item.route || pathname.startsWith(item.route + "/")
        );
        if (hasActive) next.delete(section.id);
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

  function handleToggle() {
    const next = !sidebarCollapsed;
    toggleSidebar();
    fetch("/api/users/me/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sidebarCollapsed: next }),
    }).catch(() => undefined);
  }

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar-background text-sidebar-foreground transition-all duration-300",
        sidebarCollapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
        {sidebarCollapsed ? (
          logoUrl && (
            <Image src={logoUrl} alt={appName} width={28} height={28} className="rounded object-contain flex-shrink-0 mx-auto" />
          )
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl && (
              <Image src={logoUrl} alt={appName} width={28} height={28} className="rounded object-contain flex-shrink-0" />
            )}
            <span className="font-semibold text-sidebar-foreground truncate">{appName}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")}
          />
        </Button>
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
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/60"
              )}
              title={sidebarCollapsed ? "Admin" : undefined}
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              {!sidebarCollapsed && <span className="flex-1">Admin</span>}
            </Link>
            {!sidebarCollapsed && pathname.startsWith("/admin") && (
              <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                {ADMIN_ROUTES.map(({ href, label, icon: Icon }) => {
                  const active =
                    href === "/admin" ? pathname === "/admin" : pathname === href;
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
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 text-xs text-sidebar-foreground/60",
            sidebarCollapsed && "justify-center"
          )}
        >
          {!sidebarCollapsed && process.env.NEXT_PUBLIC_APP_VERSION && (
              <span>{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            )}
        </div>
      </div>
    </aside>
  );
}

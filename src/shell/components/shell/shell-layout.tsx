"use client";

import { useEffect } from "react";
import { useShellStore } from "@/lib/store/shell-store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { NotificationProvider } from "./notifications/notification-provider";
import { NotificationToastStack } from "./notifications/notification-toast";
import type { ToastConfig } from "./notifications/notification-provider";
import type { MenuSection } from "@/app/api/menu/route";

interface ShellLayoutClientProps {
  children: React.ReactNode;
  menu: MenuSection[];
  appName: string;
  logoUrl: string | null;
  userName: string;
  userEmail: string;
  userRoles: string[];
  tenantSlug: string;
  initialSidebarCollapsed: boolean;
  headerShowDate: boolean;
  headerDateFormat: string;
  toastConfig: ToastConfig;
  accessibleCompanies: { id: string; parentId: string | null; name: string; logoUrl: string | null; depth: number }[];
  activeCompanyId: string | null;
}

export function ShellLayoutClient({
  children,
  menu,
  appName,
  logoUrl,
  userName,
  userEmail,
  userRoles,
  tenantSlug,
  initialSidebarCollapsed,
  headerShowDate,
  headerDateFormat,
  toastConfig,
  accessibleCompanies,
  activeCompanyId,
}: ShellLayoutClientProps) {
  const { setSidebarCollapsed } = useShellStore();

  useEffect(() => {
    setSidebarCollapsed(initialSidebarCollapsed);
  }, [initialSidebarCollapsed, setSidebarCollapsed]);

  return (
    <NotificationProvider toastConfig={toastConfig}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar menu={menu} appName={appName} logoUrl={logoUrl} userRoles={userRoles} userName={userName} userEmail={userEmail} tenantSlug={tenantSlug} accessibleCompanies={accessibleCompanies} activeCompanyId={activeCompanyId} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            menu={menu}
            headerShowDate={headerShowDate}
            headerDateFormat={headerDateFormat}
          />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
      <NotificationToastStack />
    </NotificationProvider>
  );
}

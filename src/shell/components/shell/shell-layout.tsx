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
  initialSidebarCollapsed: boolean;
  headerShowDate: boolean;
  headerDateFormat: string;
  toastConfig: ToastConfig;
}

export function ShellLayoutClient({
  children,
  menu,
  appName,
  logoUrl,
  userName,
  userEmail,
  userRoles,
  initialSidebarCollapsed,
  headerShowDate,
  headerDateFormat,
  toastConfig,
}: ShellLayoutClientProps) {
  const { setSidebarCollapsed } = useShellStore();

  useEffect(() => {
    setSidebarCollapsed(initialSidebarCollapsed);
  }, [initialSidebarCollapsed, setSidebarCollapsed]);

  return (
    <NotificationProvider toastConfig={toastConfig}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar menu={menu} appName={appName} logoUrl={logoUrl} userRoles={userRoles} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header
            menu={menu}
            appName={appName}
            userName={userName}
            userEmail={userEmail}
            userRoles={userRoles}
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

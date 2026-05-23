"use client";

import { Suspense } from "react";
import { useShellRouting } from "@/lib/mf/use-shell-routing";
import { ShellSDKProvider } from "@/components/shell/shell-sdk-provider";
import { AppErrorBoundary } from "@/components/shell/error-boundary";
import { AppSkeleton } from "@/components/shell/app-skeleton";
import { AppErrorView } from "@/components/shell/app-error-view";
import type { RegisteredApp } from "@/lib/mf/router";
import type { ShellUser } from "@corp/shell-sdk";

interface ChildAppHostProps {
  apps: RegisteredApp[];
  user: ShellUser | null;
}

export function ChildAppHost({ apps, user }: ChildAppHostProps) {
  const { AppEntry, loading, error } = useShellRouting(apps);

  if (loading) {
    return <AppSkeleton />;
  }

  if (error) {
    return <AppErrorView error={error} />;
  }

  if (!AppEntry) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-12 text-center">
        <p className="text-muted-foreground">No application registered for this route.</p>
      </div>
    );
  }

  return (
    <ShellSDKProvider user={user}>
      <AppErrorBoundary>
        <Suspense fallback={<AppSkeleton />}>
          <AppEntry />
        </Suspense>
      </AppErrorBoundary>
    </ShellSDKProvider>
  );
}

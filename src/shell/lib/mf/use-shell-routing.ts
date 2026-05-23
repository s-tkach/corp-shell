"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { RegisteredApp } from "./router";
import type { RemoteModule } from "./load-remote";

interface RoutingState {
  AppEntry: React.ComponentType | null;
  loading: boolean;
  error: Error | null;
}

export function useShellRouting(apps: RegisteredApp[]): RoutingState {
  const pathname = usePathname();
  const [state, setState] = useState<RoutingState>({
    AppEntry: null,
    loading: false,
    error: null,
  });
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    let match: RegisteredApp | null = null;
    let matchLength = 0;

    for (const app of apps) {
      const prefix = app.routePrefix.endsWith("/")
        ? app.routePrefix.slice(0, -1)
        : app.routePrefix;

      if (pathname === prefix || pathname.startsWith(prefix + "/")) {
        if (prefix.length > matchLength) {
          match = app;
          matchLength = prefix.length;
        }
      }
    }

    if (!match) {
      setState({ AppEntry: null, loading: false, error: null });
      loadedRef.current = null;
      return;
    }

    const cacheKey = `${match.name}@${match.remoteUrl}`;
    if (loadedRef.current === cacheKey) return;

    setState({ AppEntry: null, loading: true, error: null });
    loadedRef.current = cacheKey;

    const remoteEntryUrl = match.remoteUrl.endsWith("/remoteEntry.js")
      ? match.remoteUrl
      : `${match.remoteUrl}/remoteEntry.js`;

    const markName = `mf-load-start:${match.name}`;
    const measureName = `mf-cold-load:${match.name}`;
    performance.mark(markName);

    import("./load-remote")
      .then((mod) => mod.loadRemoteModule(match!.name, remoteEntryUrl))
      .then((remote: RemoteModule) => {
        performance.measure(measureName, markName);
        setState({ AppEntry: remote.AppEntry, loading: false, error: null });
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ AppEntry: null, loading: false, error });
        loadedRef.current = null;
      });
  }, [pathname, apps]);

  return state;
}

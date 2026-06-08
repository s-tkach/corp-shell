"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ShellContext } from "@s-tkach/shell-sdk";
import type { ShellUser } from "@s-tkach/shell-sdk";

interface ShellSDKProviderProps {
  children: React.ReactNode;
  user: ShellUser | null;
}

export function ShellSDKProvider({ children, user }: ShellSDKProviderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <ShellContext.Provider
      value={{
        user,
        navigate: (path) => router.push(path),
        theme: (theme === "dark" ? "dark" : "light") as "light" | "dark",
        setTheme: (t) => setTheme(t),
      }}
    >
      {children}
    </ShellContext.Provider>
  );
}

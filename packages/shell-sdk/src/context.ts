import { createContext } from "react";

export interface ShellUser {
  userId: string;
  email: string;
  name: string;
  roles: string[];
  subscriptionTier: string;
  subscriptionLevel: number;
}

export interface ShellContextValue {
  user: ShellUser | null;
  navigate: (path: string) => void;
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
}

export const ShellContext = createContext<ShellContextValue>({
  user: null,
  navigate: () => undefined,
  theme: "light",
  setTheme: () => undefined,
});

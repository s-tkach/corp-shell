import { useContext } from "react";
import { ShellContext } from "../context";
import type { ShellUser } from "../context";

export function useShellUser(): ShellUser | null {
  return useContext(ShellContext).user;
}

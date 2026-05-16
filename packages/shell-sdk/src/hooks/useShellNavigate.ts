import { useContext } from "react";
import { ShellContext } from "../context";

export function useShellNavigate(): (path: string) => void {
  return useContext(ShellContext).navigate;
}

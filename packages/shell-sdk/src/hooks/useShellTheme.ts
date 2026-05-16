import { useContext } from "react";
import { ShellContext } from "../context";

export function useShellTheme(): { theme: "light" | "dark"; setTheme: (t: "light" | "dark") => void } {
  const { theme, setTheme } = useContext(ShellContext);
  return { theme, setTheme };
}

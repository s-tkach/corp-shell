export interface ShellTailwindPreset {
  theme: {
    extend: {
      colors: Record<string, string>;
      spacing: Record<string, string>;
    };
  };
}

export const shellPreset: ShellTailwindPreset = {
  theme: {
    extend: {
      colors: {
        "shell-primary": "var(--shell-primary, #0f172a)",
        "shell-primary-foreground": "var(--shell-primary-foreground, #f8fafc)",
        "shell-sidebar": "var(--shell-sidebar, #1e293b)",
        "shell-sidebar-foreground": "var(--shell-sidebar-foreground, #f1f5f9)",
      },
      spacing: {
        "shell-sidebar-width": "var(--shell-sidebar-width, 240px)",
        "shell-header-height": "var(--shell-header-height, 56px)",
      },
    },
  },
};

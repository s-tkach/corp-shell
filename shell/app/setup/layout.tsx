import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup — Corp Shell",
};

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {children}
    </div>
  );
}

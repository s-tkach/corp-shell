import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/roles";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const roles: string[] = session?.user.roles ?? [];
  const hasAccess = roles.some((r) => ADMIN_ROLES.has(r));

  if (!hasAccess) {
    redirect("/403");
  }

  return <>{children}</>;
}

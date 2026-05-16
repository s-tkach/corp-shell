import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

const ADMIN_ROLES = new Set(["super_admin", "admin"]);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const roles: string[] = session?.user.roles ?? [];
  const hasAccess = roles.some((r) => ADMIN_ROLES.has(r));

  if (!hasAccess) {
    redirect("/403");
  }

  return <>{children}</>;
}

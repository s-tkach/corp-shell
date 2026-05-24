import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-guard";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || !isPlatformAdmin({
    roles: session.user.roles ?? [],
    tenantSlug: session.user.tenantSlug ?? "",
  })) {
    redirect("/403");
  }
  return <>{children}</>;
}

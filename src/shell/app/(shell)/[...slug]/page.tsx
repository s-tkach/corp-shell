import { fetchRegisteredApps } from "@/lib/mf/router";
import { auth } from "@/lib/auth";
import { getRequestAccessSnapshot } from "@/lib/request-access";
import { ChildAppHost } from "./child-app-host";
import type { ShellUser } from "@s-tkach/shell-sdk";

export default async function SlugPage() {
  const [apps, session] = await Promise.all([
    fetchRegisteredApps(),
    auth(),
  ]);
  const tenantSlug = session?.user.tenantSlug ?? "";
  const access = session
    ? await getRequestAccessSnapshot({
        tenantSlug,
        pathname: "",
        session,
      })
    : null;

  const user: ShellUser | null = session
    ? {
        userId: session.user.userId ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        roles: access?.userRoles ?? session.user.roles ?? [],
        subscriptionTier: access?.subscriptionTier ?? session.user.subscriptionTier ?? "free",
        subscriptionLevel: access?.subscriptionLevel ?? session.user.subscriptionLevel ?? 0,
      }
    : null;

  return <ChildAppHost apps={apps} user={user} />;
}

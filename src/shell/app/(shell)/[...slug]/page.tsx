import { fetchRegisteredApps } from "@/lib/mf/router";
import { auth } from "@/lib/auth";
import { ChildAppHost } from "./child-app-host";
import type { ShellUser } from "@corp/shell-sdk";

export default async function SlugPage() {
  const [apps, session] = await Promise.all([
    fetchRegisteredApps(),
    auth(),
  ]);

  const user: ShellUser | null = session
    ? {
        userId: session.user.userId ?? "",
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        roles: session.user.roles ?? [],
        subscriptionTier: session.user.subscriptionTier ?? "free",
        subscriptionLevel: session.user.subscriptionLevel ?? 0,
      }
    : null;

  return <ChildAppHost apps={apps} user={user} />;
}

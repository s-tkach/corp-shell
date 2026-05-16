import { auth } from "@/lib/auth";

export async function requireRoles(requiredRoles: string[]): Promise<void> {
  const session = await auth();

  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userRoles: string[] = session.user.roles ?? [];
  const hasRole = requiredRoles.some((r) => userRoles.includes(r));

  if (!hasRole) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

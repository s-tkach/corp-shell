import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function requireRoles(requiredRoles: string[]): Promise<NextResponse | null> {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRoles: string[] = session.user.roles ?? [];
  const hasRole = requiredRoles.some((r) => userRoles.includes(r));

  if (!hasRole) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}

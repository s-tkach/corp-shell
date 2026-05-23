import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { eq } from "drizzle-orm";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const { id } = await params;
  await db.delete(notifications).where(eq(notifications.id, id));

  return new NextResponse(null, { status: 204 });
}

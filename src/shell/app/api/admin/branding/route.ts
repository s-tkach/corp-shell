import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { storageProvider } from "@/lib/storage";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";

export async function GET() {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const rows = await db.select().from(shellConfig).limit(1);
  return NextResponse.json(rows[0] ?? null);
}

export async function PATCH(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;
  const body = await req.json() as Partial<{
    appName: string;
    logoUrl: string;
    colorOverrides: Record<string, string>;
    colorOverridesDark: Record<string, string>;
    loginBgImageUrl: string;
    loginBgColor: string;
    loginHeadline: string;
    loginFormPosition: string;
    loginCardColor: string;
    loginButtonColor: string;
    loginButtonText: string;
    headerShowDate: boolean;
    headerDateFormat: string;
  }>;
  const rows = await db.select({ id: shellConfig.id }).from(shellConfig).limit(1);
  const id = rows[0]?.id;
  if (!id) {
    return NextResponse.json({ error: "Shell config not initialized" }, { status: 400 });
  }
  const [row] = await db
    .update(shellConfig)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(shellConfig.id, id))
    .returning();
  revalidateTag("shell-config", {});
  return NextResponse.json(row);
}

export async function POST(req: NextRequest) {
  const authError = await requireRoles(["super_admin", "admin"]);
  if (authError) return authError;

  const body = await req.json() as { fileName: string; contentType: string; uploadType?: string };
  if (!body.fileName || !body.contentType?.startsWith("image/")) {
    return NextResponse.json({ error: "fileName and an image contentType are required" }, { status: 400 });
  }

  const prefix = body.uploadType === "login-bg" ? "login-bg" : "logos";
  const result = await storageProvider().upload(body.fileName, body.contentType, undefined, prefix);

  return NextResponse.json(result);
}

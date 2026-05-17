import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { revalidateTag } from "next/cache";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const rows = await db.select().from(shellConfig).limit(1);
  return NextResponse.json(rows[0] ?? null);
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }
  const body = await req.json() as Partial<{
    appName: string;
    logoUrl: string;
    primaryColor: string;
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
  try {
    await requireRoles(["super_admin", "admin"]);
  } catch (r) {
    return r as Response;
  }

  const body = await req.json() as { fileName: string; contentType: string };
  const bucket = process.env["AWS_S3_BUCKET"];
  if (!bucket) {
    return NextResponse.json({ error: "AWS_S3_BUCKET not configured" }, { status: 500 });
  }

  const s3 = new S3Client({ region: process.env["AWS_REGION"] ?? "eu-central-1" });
  const key = `logos/${Date.now()}-${body.fileName}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: body.contentType }),
    { expiresIn: 300 }
  );
  return NextResponse.json({ uploadUrl: url, key });
}

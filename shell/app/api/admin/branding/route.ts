import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { shellConfig } from "@/lib/db/schema";
import { requireRoles } from "@/lib/auth-guard";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
    primaryColor: string;
    colorOverrides: Record<string, string>;
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

  const body = await req.json() as { fileName: string; contentType: string };
  if (!body.fileName || !body.contentType?.startsWith("image/")) {
    return NextResponse.json({ error: "fileName and an image contentType are required" }, { status: 400 });
  }
  const bucket = process.env["AWS_S3_BUCKET"];
  if (!bucket) {
    return NextResponse.json({ error: "AWS_S3_BUCKET not configured" }, { status: 500 });
  }

  const sanitized = body.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const region = process.env["AWS_REGION"] ?? "eu-central-1";
  const s3 = new S3Client({ region });
  const key = `logos/${Date.now()}-${sanitized}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: body.contentType }),
    { expiresIn: 300 }
  );
  const cdnBase = process.env["LOGO_CDN_BASE"];
  const publicUrl = cdnBase
    ? `${cdnBase}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return NextResponse.json({ uploadUrl, publicUrl });
}

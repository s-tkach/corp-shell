import { NextResponse } from "next/server";

const BUCKET = process.env["AWS_S3_BUCKET"];
const REGION = process.env["AWS_REGION"] ?? "eu-central-1";
const CDN_BASE = process.env["LOGO_CDN_BASE"]; // e.g. https://d123.cloudfront.net

export async function POST(request: Request) {
  if (!BUCKET) {
    return NextResponse.json({ error: "AWS_S3_BUCKET not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { filename?: string; contentType?: string };
  const { filename, contentType } = body;

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }

  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  const key = `logos/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // Build the presigned PUT URL using the AWS SDK v3 (available in Lambda env via SST)
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const s3 = new S3Client({ region: REGION });
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    // 2 MB limit enforced via content-length-range condition would require
    // a PostObject; for simplicity we rely on Lambda request size limits here.
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = CDN_BASE
    ? `${CDN_BASE}/${key}`
    : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return NextResponse.json({ uploadUrl, publicUrl });
}

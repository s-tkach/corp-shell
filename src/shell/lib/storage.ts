import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface StorageProvider {
  upload(
    filename: string,
    contentType: string,
    data?: Buffer,
    prefix?: string
  ): Promise<{ uploadUrl?: string; publicUrl: string }>;
}

class S3StorageProvider implements StorageProvider {
  async upload(
    filename: string,
    contentType: string,
    _data?: Buffer,
    prefix = "logos"
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const bucket = process.env["AWS_S3_BUCKET"]!;
    const region = process.env["AWS_REGION"] ?? "eu-central-1";
    const cdnBase = process.env["LOGO_CDN_BASE"];

    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${prefix}/${Date.now()}-${sanitized}`;
    const s3 = new S3Client({ region });
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    );
    const publicUrl = cdnBase
      ? `${cdnBase}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return { uploadUrl, publicUrl };
  }
}

class LocalStorageProvider implements StorageProvider {
  async upload(
    filename: string,
    _contentType: string,
    data?: Buffer,
    prefix = "logos"
  ): Promise<{ publicUrl: string }> {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `${Date.now()}-${sanitized}`;
    const dir = join(process.cwd(), "public", "uploads", prefix);
    await mkdir(dir, { recursive: true });
    if (data) {
      await writeFile(join(dir, name), data);
    }
    return { publicUrl: `/uploads/${prefix}/${name}` };
  }
}

function getProvider(): StorageProvider {
  const provider = process.env["STORAGE_PROVIDER"];
  const hasBucket = !!process.env["AWS_S3_BUCKET"];

  if (provider === "s3" || (!provider && hasBucket)) {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

let _provider: StorageProvider | null = null;

export function storageProvider(): StorageProvider {
  if (!_provider) _provider = getProvider();
  return _provider;
}

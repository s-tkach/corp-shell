import { NextResponse } from "next/server";
import { storageProvider } from "@/lib/storage";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const filename = form.get("filename");
  const contentType = form.get("contentType");

  if (!(file instanceof File) || typeof filename !== "string" || typeof contentType !== "string") {
    return NextResponse.json({ error: "file, filename and contentType required" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await storageProvider().upload(filename, contentType, buffer);
  return NextResponse.json(result);
}

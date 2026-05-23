import { NextResponse } from "next/server";
import { storageProvider } from "@/lib/storage";

export async function POST(request: Request) {
  const body = (await request.json()) as { filename?: string; contentType?: string };
  const { filename, contentType } = body;

  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  const result = await storageProvider().upload(filename, contentType);
  return NextResponse.json(result);
}

import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

import { NextResponse } from "next/server";

export function PATCH() {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

export function DELETE() {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}

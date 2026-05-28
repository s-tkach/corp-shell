import { NextResponse } from "next/server";
export async function PATCH() { return NextResponse.json({ error: "Gone" }, { status: 410 }); }
export async function DELETE() { return new NextResponse(null, { status: 410 }); }

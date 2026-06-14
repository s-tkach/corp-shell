import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Platform menu role editing moved to /api/settings/menu for tenant-local role hiding",
    },
    { status: 410 }
  );
}

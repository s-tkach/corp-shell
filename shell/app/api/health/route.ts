import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";

// Lightweight liveness + DB reachability check for Route 53 health checks (M12-4).
// Returns 200 when the Lambda is warm and can reach Aurora; 503 otherwise.
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "db_unreachable" }, { status: 503 });
  }
}

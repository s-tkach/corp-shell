import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db/client";
import { tenantSubscription, tenants } from "@/lib/db/schema";
import { withTenant } from "@/lib/db/tenant";
import { eq } from "drizzle-orm";

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  const expectedBuf = Buffer.from(`sha256=${expected}`, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env["WEBHOOK_SECRET"];
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("x-webhook-signature") ?? "";
  const rawBody = await req.text();

  if (!verifySignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { tenantSlug: string; tierId: string; expiresAt?: string };
  try {
    payload = JSON.parse(rawBody) as { tenantSlug: string; tierId: string; expiresAt?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tenantSlug, tierId, expiresAt } = payload;
  if (!tenantSlug || !tierId) {
    return NextResponse.json({ error: "tenantSlug and tierId are required" }, { status: 400 });
  }

  // Verify tenant exists
  const tenantRows = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);
  if (!tenantRows[0]) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const tenantDb = withTenant(tenantSlug);

  // Check if subscription already exists
  const existing = await tenantDb
    .select()
    .from(tenantSubscription)
    .limit(1);

  if (existing[0]) {
    // Update existing subscription
    await tenantDb
      .update(tenantSubscription)
      .set({
        tierId,
        status: "active",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedAt: new Date(),
      });
  } else {
    // Insert new subscription
    await tenantDb
      .insert(tenantSubscription)
      .values({
        tierId,
        status: "active",
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
  }

  return NextResponse.json({ ok: true });
}

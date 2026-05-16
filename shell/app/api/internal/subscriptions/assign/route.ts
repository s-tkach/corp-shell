import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db/client";
import { userSubscriptions } from "@/lib/db/schema";
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

  let payload: { userId: string; tierId: string; expiresAt?: string };
  try {
    payload = JSON.parse(rawBody) as { userId: string; tierId: string; expiresAt?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, tierId, expiresAt } = payload;
  if (!userId || !tierId) {
    return NextResponse.json({ error: "userId and tierId are required" }, { status: 400 });
  }

  await db
    .insert(userSubscriptions)
    .values({
      userId,
      tierId,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .onConflictDoUpdate({
      target: userSubscriptions.userId,
      set: {
        tierId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { registerSubscriber, removeSubscriber } from "@/lib/sse-registry";
import { randomUUID } from "crypto";
import { getRequestAccessSnapshot, mapRequestAccessOutcomeToDecision } from "@/lib/request-access";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantSlug = session.user.tenantSlug ?? "";
  const access = await getRequestAccessSnapshot({
    tenantSlug,
    pathname: "/api/notifications/stream",
    session,
  });
  const decision = mapRequestAccessOutcomeToDecision({
    outcome: access.outcome,
    pathname: "/api/notifications/stream",
    isApi: true,
  });
  if (decision === "401") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (decision === "404") return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  if (decision === "403") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const userId = session.user.userId;
  const subLevel = access.subscriptionLevel;
  const connectionId = randomUUID();
  const encoder = new TextEncoder();

  let intervalId: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      registerSubscriber(connectionId, tenantSlug, userId, subLevel, controller);
      controller.enqueue(encoder.encode(": ping\n\n"));

      intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(intervalId);
        }
      }, 30_000);
    },
    cancel() {
      clearInterval(intervalId);
      removeSubscriber(connectionId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

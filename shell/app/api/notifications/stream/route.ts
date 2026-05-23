import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { registerSubscriber, removeSubscriber } from "@/lib/sse-registry";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.userId;
  const subLevel = session.user.subscriptionLevel ?? 0;
  const connectionId = randomUUID();
  const encoder = new TextEncoder();

  let intervalId: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      registerSubscriber(connectionId, userId, subLevel, controller);
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

// shell/lib/sse-registry.ts
type Subscriber = {
  userId: string;
  subLevel: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

// Module-level map: connectionId → subscriber
const subscribers = new Map<string, Subscriber>();

export function registerSubscriber(
  id: string,
  userId: string,
  subLevel: number,
  controller: ReadableStreamDefaultController<Uint8Array>
) {
  subscribers.set(id, { userId, subLevel, controller });
}

export function removeSubscriber(id: string) {
  subscribers.delete(id);
}

export function pushToEligible(
  payload: string,
  targetType: string,
  targetUserId: string | null,
  targetSubLevel: number | null
) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`event: notification\ndata: ${payload}\n\n`);

  for (const sub of subscribers.values()) {
    if (targetType === "user" && sub.userId !== targetUserId) continue;
    if (targetType === "sub_level" && (targetSubLevel === null || sub.subLevel < targetSubLevel)) continue;
    try {
      sub.controller.enqueue(data);
    } catch {
      // subscriber disconnected; cleanup happens on stream cancel
    }
  }
}

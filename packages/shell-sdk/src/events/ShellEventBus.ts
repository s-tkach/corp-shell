type Handler<T = unknown> = (payload: T) => void;

class ShellEventBusImpl {
  private listeners = new Map<string, Set<Handler>>();

  on<T = unknown>(event: string, handler: Handler<T>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler as Handler);
  }

  off<T = unknown>(event: string, handler: Handler<T>): void {
    this.listeners.get(event)?.delete(handler as Handler);
  }

  emit<T = unknown>(event: string, payload: T): void {
    this.listeners.get(event)?.forEach((h) => h(payload));
  }
}

export const ShellEventBus = new ShellEventBusImpl();

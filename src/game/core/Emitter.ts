type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter: the game talks to the UI (and any other observer) through it. */
export class Emitter<Events extends { [K in keyof Events]: unknown }> {
  private readonly handlers = new Map<keyof Events, Set<Handler<never>>>();

  /** Subscribes to an event; returns the unsubscribe function. */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(handler as Handler<never>);
    return () => set.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((handler) => (handler as Handler<Events[K]>)(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}

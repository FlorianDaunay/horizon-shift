/** Thin wrapper around the Pointer Lock API for one element. */
export class PointerLock {
  private listeners = new Set<(locked: boolean) => void>();
  private readonly handleChange = () => this.listeners.forEach((l) => l(this.locked));

  constructor(private readonly element: HTMLElement) {
    document.addEventListener("pointerlockchange", this.handleChange);
  }

  get locked(): boolean {
    return document.pointerLockElement === this.element;
  }

  /** Must be called from a user gesture (a click or key press). */
  request(): void {
    // Browsers reject the request for a moment after the user pressed Escape; that is fine.
    Promise.resolve(this.element.requestPointerLock()).catch(() => undefined);
  }

  release(): void {
    if (this.locked) document.exitPointerLock();
  }

  onChange(listener: (locked: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    document.removeEventListener("pointerlockchange", this.handleChange);
    this.listeners.clear();
    this.release();
  }
}

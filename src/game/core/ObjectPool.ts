/**
 * Reuses objects instead of allocating and garbage-collecting them: chunk meshes and instanced
 * meshes are acquired when a chunk streams in and released when it streams out.
 */
export class ObjectPool<T> {
  private readonly free: T[] = [];
  private created = 0;

  constructor(
    private readonly create: () => T,
    private readonly reset?: (item: T) => void
  ) {}

  acquire(): T {
    const item = this.free.pop();
    if (item !== undefined) return item;
    this.created++;
    return this.create();
  }

  release(item: T): void {
    this.reset?.(item);
    this.free.push(item);
  }

  /** Objects ever created (a proxy for peak usage). */
  get size(): number {
    return this.created;
  }

  /** Lets go of every idle object; `dispose` frees its GPU resources. */
  clear(dispose?: (item: T) => void): void {
    if (dispose) for (const item of this.free) dispose(item);
    this.created -= this.free.length;
    this.free.length = 0;
  }
}

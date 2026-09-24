import type { ChunkRequest, ChunkResult } from "./generation/generateChunk";

/** A small pool of terrain workers. Each worker holds at most `perWorker` jobs so the queue stays in the main thread, where it can be re-prioritised. */
export class WorkerPool {
  private readonly workers: Worker[] = [];
  private readonly busy: number[] = [];

  constructor(
    factory: () => Worker,
    size: number,
    private readonly perWorker: number,
    onResult: (result: ChunkResult) => void
  ) {
    for (let i = 0; i < size; i++) {
      const worker = factory();
      worker.onmessage = (event: MessageEvent<ChunkResult>) => {
        this.busy[i]--;
        onResult(event.data);
      };
      this.workers.push(worker);
      this.busy.push(0);
    }
  }

  get hasCapacity(): boolean {
    return this.busy.some((b) => b < this.perWorker);
  }

  get inFlight(): number {
    return this.busy.reduce((a, b) => a + b, 0);
  }

  post(request: ChunkRequest): void {
    let target = 0;
    for (let i = 1; i < this.busy.length; i++) if (this.busy[i] < this.busy[target]) target = i;
    this.busy[target]++;
    this.workers[target].postMessage(request);
  }

  dispose(): void {
    this.workers.forEach((w) => w.terminate());
    this.workers.length = 0;
  }
}

/** Leaves a core for the main thread and the browser, but never fewer than one worker. */
export const defaultWorkerCount = () => Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));

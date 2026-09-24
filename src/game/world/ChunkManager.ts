import type { Scene } from "three";
import { CHUNK_SIZE } from "../config";
import { ChunkView, ChunkViewFactory } from "./ChunkView";
import { chunkKey, type ChunkRequest, type ChunkResult } from "./generation/generateChunk";
import { SCATTER_FULL } from "./generation/scatter";
import TerrainWorker from "./workers/terrain.worker?worker";
import { WorkerPool, defaultWorkerCount } from "./WorkerPool";

export interface StreamingConfig {
  /** Chunks kept loaded around the player. */
  viewRadius: number;
  vegetationRadius: number;
  grassRadius: number;
}

export interface StreamingStats {
  loaded: number;
  /** Chunks still being generated or waiting to be shown. */
  pending: number;
}

/** Chunk-distance thresholds of the LOD rings: LOD 0 up to the first, LOD 1 up to the second, LOD 2 beyond. */
const LOD_RINGS = [2.5, 4.5];
/** Extra distance a chunk must cross before its detail level changes, so borders do not flicker. */
const HYSTERESIS = 0.75;
/** Chunks beyond `viewRadius + UNLOAD_MARGIN` are unloaded. */
const UNLOAD_MARGIN = 1.5;

interface Want {
  cx: number;
  cz: number;
  distance: number;
  lod: number;
  scatter: number;
}

/** Index of the first threshold that `distance` does not exceed (thresholds.length when beyond all). */
const band = (distance: number, thresholds: readonly number[]) => {
  let i = 0;
  while (i < thresholds.length && distance > thresholds[i]) i++;
  return i;
};

/** `band`, but a change from the `current` band only happens once `distance` is clearly past the limit. */
function stableBand(distance: number, thresholds: readonly number[], current: number | undefined): number {
  const next = band(distance, thresholds);
  if (current === undefined || next === current) return next;
  return next < current
    ? band(distance + HYSTERESIS, thresholds) < current ? next : current
    : band(distance - HYSTERESIS, thresholds) > current ? next : current;
}

/**
 * Streams terrain chunks around a focus point: decides what should exist, asks workers to build
 * it nearest-first, and shows results within a per-frame time budget so streaming never stalls a frame.
 */
export class ChunkManager {
  private readonly views = new Map<string, ChunkView>();
  private readonly inFlight = new Map<string, number>();
  private readonly ready: ChunkResult[] = [];
  private readonly factory: ChunkViewFactory;
  private readonly workers: WorkerPool;
  private todo: Want[] = [];
  private nextId = 1;
  private centerX = NaN;
  private centerZ = NaN;
  private dirty = true;

  constructor(
    scene: Scene,
    private seed: number,
    private config: StreamingConfig
  ) {
    this.factory = new ChunkViewFactory(scene);
    this.workers = new WorkerPool(() => new TerrainWorker(), defaultWorkerCount(), 2, (result) => this.onResult(result));
  }

  configure(config: StreamingConfig): void {
    this.config = config;
    this.dirty = true;
  }

  /** Throws every chunk away and starts over with another seed. */
  reseed(seed: number): void {
    this.seed = seed;
    for (const view of this.views.values()) this.factory.release(view);
    this.views.clear();
    this.inFlight.clear();
    this.ready.length = 0;
    this.todo = [];
    this.dirty = true;
  }

  get stats(): StreamingStats {
    return { loaded: this.views.size, pending: this.todo.length + this.inFlight.size + this.ready.length };
  }

  /** True once every chunk within `radius` chunks of the focus is shown at some detail level. */
  isReady(radius: number): boolean {
    if (Number.isNaN(this.centerX)) return false;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.hypot(dx, dz) <= radius && !this.views.has(chunkKey(this.centerX + dx, this.centerZ + dz))) return false;
      }
    }
    return true;
  }

  update(x: number, z: number, applyBudgetMs = 3): void {
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    if (this.dirty || cx !== this.centerX || cz !== this.centerZ) {
      this.centerX = cx;
      this.centerZ = cz;
      this.dirty = false;
      this.plan();
    }
    this.dispatch();
    this.show(applyBudgetMs);
  }

  /** Works out which chunks should exist, unloads the far ones and queues the missing ones. */
  private plan(): void {
    const { viewRadius, vegetationRadius, grassRadius } = this.config;
    const todo: Want[] = [];

    for (let dz = -viewRadius; dz <= viewRadius; dz++) {
      for (let dx = -viewRadius; dx <= viewRadius; dx++) {
        const distance = Math.hypot(dx, dz);
        if (distance > viewRadius) continue;
        const cx = this.centerX + dx;
        const cz = this.centerZ + dz;
        const current = this.views.get(chunkKey(cx, cz));
        const lod = stableBand(distance, LOD_RINGS, current?.lod);
        // Scatter bands: 0 = grass, 1 = trees only, 2 = nothing; the level is the reverse.
        const scatterBand = stableBand(distance, [grassRadius, vegetationRadius], current ? SCATTER_FULL - current.scatter : undefined);
        const scatter = SCATTER_FULL - scatterBand;
        if (!current || current.lod !== lod || current.scatter !== scatter) todo.push({ cx, cz, distance, lod, scatter });
      }
    }
    todo.sort((a, b) => a.distance - b.distance);
    this.todo = todo;

    for (const [key, view] of this.views) {
      if (Math.hypot(view.cx - this.centerX, view.cz - this.centerZ) > viewRadius + UNLOAD_MARGIN) {
        this.factory.release(view);
        this.views.delete(key);
      }
    }
  }

  private dispatch(): void {
    while (this.todo.length > 0 && this.workers.hasCapacity) {
      const want = this.todo.shift()!;
      const key = chunkKey(want.cx, want.cz);
      if (this.inFlight.has(key)) continue;
      const request: ChunkRequest = { id: this.nextId++, seed: this.seed, cx: want.cx, cz: want.cz, lod: want.lod, scatter: want.scatter };
      this.inFlight.set(key, request.id);
      this.workers.post(request);
    }
  }

  private onResult(result: ChunkResult): void {
    const key = chunkKey(result.cx, result.cz);
    if (this.inFlight.get(key) !== result.id) return; // stale: the world was reseeded meanwhile
    this.inFlight.delete(key);
    this.ready.push(result);
  }

  private show(budgetMs: number): void {
    const start = performance.now();
    while (this.ready.length > 0) {
      const result = this.ready.shift()!;
      const distance = Math.hypot(result.cx - this.centerX, result.cz - this.centerZ);
      if (distance <= this.config.viewRadius + UNLOAD_MARGIN) {
        const key = chunkKey(result.cx, result.cz);
        const existing = this.views.get(key);
        if (existing) this.factory.refill(existing, result);
        else this.views.set(key, this.factory.build(result));
      }
      if (performance.now() - start > budgetMs) break;
    }
  }

  /** The point of interest closest to (x, z) among loaded chunks, if any. */
  nearestPoi(x: number, z: number) {
    let best: { type: string; x: number; z: number; distance: number } | null = null;
    for (const view of this.views.values()) {
      if (!view.poi) continue;
      const distance = Math.hypot(view.poi.x - x, view.poi.z - z);
      if (!best || distance < best.distance) best = { type: view.poi.type, x: view.poi.x, z: view.poi.z, distance };
    }
    return best;
  }

  dispose(): void {
    this.workers.dispose();
    for (const view of this.views.values()) this.factory.release(view);
    this.views.clear();
    this.factory.dispose();
  }
}

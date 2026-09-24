import type { Scene, Vector3 } from "three";
import { CHUNK_SIZE } from "../config";
import { ChunkView, ChunkViewFactory } from "./ChunkView";
import { COLLIDER_STRIDE, EMITTER_STRIDE, INTERACT_STRIDE } from "./generation/collision";
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

/** Describes something the player can interact with (filled in by `nearestInteractable`). */
export interface InteractHit {
  type: number;
  x: number;
  y: number;
  z: number;
  kindIndex: number;
  instance: number;
  cx: number;
  cz: number;
}

export const createInteractHit = (): InteractHit => ({ type: 0, x: 0, y: 0, z: 0, kindIndex: 0, instance: 0, cx: 0, cz: 0 });

export interface StreamingStats {
  loaded: number;
  /** Chunks still being generated or waiting to be shown. */
  pending: number;
}

/** Chunk-distance thresholds of the LOD rings: LOD 0 up to the first, LOD 1 up to the second, LOD 2 beyond. */
const LOD_RINGS = [2.5, 4.5];
/** Extra distance a chunk must cross before its detail level changes, so borders do not flicker. */
const HYSTERESIS = 0.75;
/** How far above the feet a surface can be and still be stepped or landed on (meters). */
const REACH = 0.55;
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
  private readonly views = new Map<number, ChunkView>();
  private readonly inFlight = new Map<number, number>();
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
    private config: StreamingConfig,
    private readonly taken: Set<string> = new Set()
  ) {
    this.factory = new ChunkViewFactory(scene, (cx, cz, kind, instance) => this.taken.has(`${cx},${cz},${kind},${instance}`));
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

  /**
   * Highest standable surface under (x, z) that the player can step or land on from `feetY`
   * (the top must be no more than REACH above the feet), or -Infinity.
   */
  supportAt(x: number, z: number, feetY: number): number {
    let best = -Infinity;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = this.views.get(chunkKey(cx + dx, cz + dz))?.colliders;
        if (!c) continue;
        for (let i = 0; i < c.length; i += COLLIDER_STRIDE) {
          if (c[i + 5] === 0) continue;
          const top = c[i + 4];
          if (top <= best || top > feetY + REACH || feetY < c[i + 3]) continue;
          const ex = x - c[i];
          const ez = z - c[i + 1];
          if (ex * ex + ez * ez < c[i + 2] * c[i + 2]) best = top;
        }
      }
    }
    return best;
  }

  /** Pushes a body (a vertical cylinder at `position` with the given radius) out of every solid it overlaps. */
  resolve(position: Vector3, radius: number, height: number): void {
    const cx = Math.floor(position.x / CHUNK_SIZE);
    const cz = Math.floor(position.z / CHUNK_SIZE);
    for (let pass = 0; pass < 2; pass++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const c = this.views.get(chunkKey(cx + dx, cz + dz))?.colliders;
          if (!c) continue;
          for (let i = 0; i < c.length; i += COLLIDER_STRIDE) {
            // Only what is at body height, and not what can be stepped onto.
            if (position.y + height <= c[i + 3] || position.y >= c[i + 4] - REACH) continue;
            const ex = position.x - c[i];
            const ez = position.z - c[i + 1];
            const reach = c[i + 2] + radius;
            const d2 = ex * ex + ez * ez;
            if (d2 >= reach * reach) continue;
            const d = Math.sqrt(d2);
            const nx = d > 1e-4 ? ex / d : 1;
            const nz = d > 1e-4 ? ez / d : 0;
            position.x = c[i] + nx * reach;
            position.z = c[i + 1] + nz * reach;
          }
        }
      }
    }
  }

  /**
   * Fills `out` (5 floats per slot: x, y, z, type, squared distance) with the nearest light spots
   * within `range` of the point, nearest first. Returns how many were found.
   */
  nearestEmitters(x: number, y: number, z: number, range: number, out: Float32Array): number {
    const slots = out.length / 5;
    let found = 0;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const limit = range * range;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const e = this.views.get(chunkKey(cx + dx, cz + dz))?.emitters;
        if (!e) continue;
        for (let i = 0; i < e.length; i += EMITTER_STRIDE) {
          if (e[i + 3] < 0) continue; // its crystal was taken
          const d2 = (e[i] - x) ** 2 + (e[i + 1] - y) ** 2 + (e[i + 2] - z) ** 2;
          if (d2 > limit) continue;
          let slot = found < slots ? found : slots - 1;
          if (found >= slots && d2 >= out[slot * 5 + 4]) continue;
          while (slot > 0 && out[(slot - 1) * 5 + 4] > d2) {
            out.copyWithin(slot * 5, (slot - 1) * 5, slot * 5);
            slot--;
          }
          out[slot * 5] = e[i];
          out[slot * 5 + 1] = e[i + 1];
          out[slot * 5 + 2] = e[i + 2];
          out[slot * 5 + 3] = e[i + 3];
          out[slot * 5 + 4] = d2;
          if (found < slots) found++;
        }
      }
    }
    return found;
  }

  /** Finds the nearest thing to interact with within `range` and describes it in `out`; false if none. */
  nearestInteractable(x: number, y: number, z: number, range: number, out: InteractHit): boolean {
    let best = range * range;
    let found = false;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const view = this.views.get(chunkKey(cx + dx, cz + dz));
        const s = view?.interactables;
        if (!view || !s) continue;
        for (let i = 0; i < s.length; i += INTERACT_STRIDE) {
          if (s[i + 3] < 0) continue;
          const d2 = (s[i] - x) ** 2 + (s[i + 1] - y) ** 2 + (s[i + 2] - z) ** 2;
          if (d2 >= best) continue;
          best = d2;
          found = true;
          out.type = s[i + 3];
          out.x = s[i];
          out.y = s[i + 1];
          out.z = s[i + 2];
          out.kindIndex = s[i + 4];
          out.instance = s[i + 5];
          out.cx = view.cx;
          out.cz = view.cz;
        }
      }
    }
    return found;
  }

  /** Uses up an interactable: it disappears and stays gone. */
  take(hit: InteractHit): void {
    this.taken.add(`${hit.cx},${hit.cz},${hit.kindIndex},${hit.instance}`);
    const view = this.views.get(chunkKey(hit.cx, hit.cz));
    if (view) this.factory.hide(view, hit.kindIndex, hit.instance);
  }

  /** The landmark (structure or floating island) closest to (x, z) among loaded chunks, if any. */
  nearestPoi(x: number, z: number) {
    let best: { type: string; x: number; z: number; distance: number } | null = null;
    for (const view of this.views.values()) {
      const landmarks = [
        view.poi && { type: view.poi.type as string, x: view.poi.x, z: view.poi.z },
        view.island && { type: "island", x: view.island.x, z: view.island.z },
      ];
      for (const landmark of landmarks) {
        if (!landmark) continue;
        const distance = Math.hypot(landmark.x - x, landmark.z - z);
        if (!best || distance < best.distance) best = { ...landmark, distance };
      }
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

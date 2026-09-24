import { CHUNK_SIZE, LOD_RESOLUTIONS } from "../../config";
import { buildChunkMesh, surfaceHeightFn } from "./chunkMesh";
import { InstanceCollector, type InstanceBatch } from "./instanceBuffer";
import { SimplexNoise } from "./noise";
import { buildIsland, findIsland, type Island } from "./islands";
import { buildPoi, findPoi, type Poi } from "./poi";
import { scatterChunk } from "./scatter";
import { TerrainSampler } from "./TerrainSampler";

/** What the main thread asks a worker to build. */
export interface ChunkRequest {
  /** Echoed back so the main thread can match the answer to its request. */
  id: number;
  seed: number;
  cx: number;
  cz: number;
  lod: number;
  /** One of the `SCATTER_*` levels. */
  scatter: number;
}

/** Everything needed to display a chunk. All arrays are transferable. */
export interface ChunkResult {
  id: number;
  cx: number;
  cz: number;
  lod: number;
  scatter: number;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  minY: number;
  maxY: number;
  batches: InstanceBatch[];
  /** Collision circles (see `collision.ts`); x/z are chunk-local, y is world. */
  colliders: Float32Array;
  /** Light spots (see `collision.ts`); coordinates are chunk-local. */
  emitters: Float32Array;
  /** Highest point of any instance, for the culling volume. */
  instanceMaxY: number;
  poi: Poi | null;
  island: Island | null;
}

const worlds = new Map<number, { sampler: TerrainSampler; colorNoise: SimplexNoise; patchNoise: SimplexNoise }>();

function world(seed: number) {
  let w = worlds.get(seed);
  if (!w) {
    if (worlds.size > 2) worlds.clear();
    w = { sampler: new TerrainSampler(seed), colorNoise: new SimplexNoise(seed + 11), patchNoise: new SimplexNoise(seed + 12) };
    worlds.set(seed, w);
  }
  return w;
}

/** Pure chunk generation: the worker's whole job, also usable (and tested) on the main thread. */
export function generateChunk(request: ChunkRequest): ChunkResult {
  const { sampler, colorNoise, patchNoise } = world(request.seed);
  const { cx, cz, lod, scatter } = request;
  const res = LOD_RESOLUTIONS[lod];
  const mesh = buildChunkMesh(sampler, colorNoise, cx, cz, res);
  const surface = surfaceHeightFn(mesh.positions, res);

  const instances = new InstanceCollector();
  const poi = scatter > 0 ? findPoi(sampler, cx, cz) : null;
  if (poi) buildPoi(sampler, poi, cx, cz, instances, surface);
  const island = scatter > 0 ? findIsland(sampler, cx, cz) : null;
  if (island) buildIsland(sampler, island, cx, cz, instances, surface);
  scatterChunk(sampler, patchNoise, cx, cz, scatter, poi, instances, surface);

  return {
    id: request.id,
    cx,
    cz,
    lod,
    scatter,
    ...mesh,
    batches: instances.finish(),
    colliders: instances.finishColliders(),
    emitters: instances.finishEmitters(),
    instanceMaxY: instances.maxY,
    poi,
    island,
  };
}

/** Buffers to hand over (not copy) when posting a result from a worker. */
export function transferables(result: ChunkResult): ArrayBuffer[] {
  const buffers = [result.positions.buffer, result.normals.buffer, result.colors.buffer, result.colliders.buffer, result.emitters.buffer] as ArrayBuffer[];
  for (const batch of result.batches) buffers.push(batch.matrices.buffer as ArrayBuffer, batch.tints.buffer as ArrayBuffer);
  return buffers;
}

/** Numeric key of a chunk (no string allocation in hot paths). Valid for |coordinate| < 32768. */
export const chunkKey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
export const chunkCenter = (c: number) => (c + 0.5) * CHUNK_SIZE;

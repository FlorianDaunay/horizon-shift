import { CHUNK_SIZE, SKIRT_DEPTH } from "../../config";
import { SimplexNoise } from "./noise";
import { createSample, type TerrainSample, type TerrainSampler } from "./TerrainSampler";
import { terrainColor } from "./terrainColor";

/** Vertices of one chunk: the (res+1)² grid followed by a skirt of (res+1) vertices per side. */
export const chunkVertexCount = (res: number) => (res + 1) * (res + 1) + 4 * (res + 1);

/** Step used to measure slopes, identical for every LOD so normals match across chunk borders. */
const NORMAL_EPS = 1.25;
/** Distance at which the terrain around a vertex is compared to it for ambient occlusion. */
const AO_RADIUS = 4;

export interface ChunkMeshBuffers {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  minY: number;
  maxY: number;
}

/** Builds the vertex data of a chunk (local coordinates: the chunk's corner is the origin). */
export function buildChunkMesh(
  sampler: TerrainSampler,
  colorNoise: SimplexNoise,
  cx: number,
  cz: number,
  res: number
): ChunkMeshBuffers {
  const w = res + 1;
  const count = chunkVertexCount(res);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const step = CHUNK_SIZE / res;
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const sample: TerrainSample = createSample();
  let minY = Infinity;
  let maxY = -Infinity;

  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {
      const lx = i * step;
      const lz = j * step;
      const wx = originX + lx;
      const wz = originZ + lz;
      const v = j * w + i;

      sampler.sample(wx, wz, sample);
      const y = sample.height;
      const hx0 = sampler.heightAt(wx - NORMAL_EPS, wz);
      const hx1 = sampler.heightAt(wx + NORMAL_EPS, wz);
      const hz0 = sampler.heightAt(wx, wz - NORMAL_EPS);
      const hz1 = sampler.heightAt(wx, wz + NORMAL_EPS);
      let nx = hx0 - hx1;
      let ny = 2 * NORMAL_EPS;
      let nz = hz0 - hz1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;

      positions[v * 3] = lx;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = lz;
      normals[v * 3] = nx;
      normals[v * 3 + 1] = ny;
      normals[v * 3 + 2] = nz;
      terrainColor(sample.weights, y, 1 - ny, colorNoise.fbm(wx * 0.05, wz * 0.05, 2), colors, v * 3);

      // Baked ambient occlusion: hollows are darker, crests a touch brighter. Free at runtime.
      const around =
        (sampler.heightAt(wx - AO_RADIUS, wz) + sampler.heightAt(wx + AO_RADIUS, wz) + sampler.heightAt(wx, wz - AO_RADIUS) + sampler.heightAt(wx, wz + AO_RADIUS)) / 4;
      const ao = Math.min(1.06, Math.max(0.68, 1 - (around - y) * 0.055));
      colors[v * 3] *= ao;
      colors[v * 3 + 1] *= ao;
      colors[v * 3 + 2] *= ao;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Skirts: a copy of each border vertex, lowered. Order: north (z=0), south (z=res), west (x=0), east (x=res).
  const skirtBase = w * w;
  for (let side = 0; side < 4; side++) {
    for (let k = 0; k < w; k++) {
      const source = side === 0 ? k : side === 1 ? res * w + k : side === 2 ? k * w : k * w + res;
      const target = skirtBase + side * w + k;
      positions[target * 3] = positions[source * 3];
      positions[target * 3 + 1] = positions[source * 3 + 1] - SKIRT_DEPTH;
      positions[target * 3 + 2] = positions[source * 3 + 2];
      normals.copyWithin(target * 3, source * 3, source * 3 + 3);
      colors.copyWithin(target * 3, source * 3, source * 3 + 3);
    }
  }

  return { positions, normals, colors, minY: minY - SKIRT_DEPTH, maxY };
}

const indexCache = new Map<number, Uint16Array>();

/** Triangle indices for a chunk of `res` quads per side, including skirts (cached per resolution). */
export function chunkIndices(res: number): Uint16Array {
  const cached = indexCache.get(res);
  if (cached) return cached;

  const w = res + 1;
  const indices: number[] = [];
  for (let j = 0; j < res; j++) {
    for (let i = 0; i < res; i++) {
      const a = j * w + i;
      indices.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
    }
  }

  const skirtBase = w * w;
  const topIndex = (side: number, k: number) =>
    side === 0 ? k : side === 1 ? res * w + k : side === 2 ? k * w : k * w + res;
  for (let side = 0; side < 4; side++) {
    // North and east faces wind one way, south and west the other, so every skirt faces outward.
    const flipped = side === 1 || side === 2;
    for (let k = 0; k < res; k++) {
      const t0 = topIndex(side, k);
      const t1 = topIndex(side, k + 1);
      const s0 = skirtBase + side * w + k;
      const s1 = s0 + 1;
      if (flipped) indices.push(s0, t1, t0, s0, s1, t1);
      else indices.push(t0, t1, s0, t1, s1, s0);
    }
  }

  const result = new Uint16Array(indices);
  indexCache.set(res, result);
  return result;
}

/**
 * Height of the rendered surface at a chunk-local point, interpolated on the same triangles the
 * GPU draws. Instances are placed with it so they sit on the mesh at every LOD, not on the
 * (more detailed) true terrain that a coarse chunk only approximates.
 */
export function surfaceHeightFn(positions: Float32Array, res: number): (x: number, z: number) => number {
  const w = res + 1;
  const step = CHUNK_SIZE / res;
  const y = (i: number, j: number) => positions[(j * w + i) * 3 + 1];
  return (x, z) => {
    const gx = Math.min(res - 1e-6, Math.max(0, x / step));
    const gz = Math.min(res - 1e-6, Math.max(0, z / step));
    const i = Math.floor(gx);
    const j = Math.floor(gz);
    const fx = gx - i;
    const fz = gz - j;
    const h00 = y(i, j);
    const h10 = y(i + 1, j);
    const h01 = y(i, j + 1);
    // The quad is split along the (1,0)-(0,1) diagonal, matching `chunkIndices`.
    if (fx + fz <= 1) return h00 + fx * (h10 - h00) + fz * (h01 - h00);
    const h11 = y(i + 1, j + 1);
    return h11 + (1 - fx) * (h01 - h11) + (1 - fz) * (h10 - h11);
  };
}

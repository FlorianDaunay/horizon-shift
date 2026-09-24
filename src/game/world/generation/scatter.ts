import { CHUNK_SIZE, WATER_LEVEL } from "../../config";
import { InstanceCollector } from "./instanceBuffer";
import { createRng, hash2, smoothstep, type SimplexNoise } from "./noise";
import type { Poi } from "./poi";
import { createSample, type TerrainSampler } from "./TerrainSampler";

/** How much vegetation a chunk gets, from the cheapest to the richest. */
export const SCATTER_NONE = 0;
export const SCATTER_TREES = 1; // trees, cacti, rocks and points of interest
export const SCATTER_FULL = 2; // ... plus grass

const TREE_CELL = 6;
const GRASS_CELL = 1.6;
const WATER_CELL = 3;

const jitterTint = (rng: () => number, r: number, g: number, b: number): [number, number, number] => {
  const v = 0.85 + rng() * 0.3;
  return [r * v, g * v, b * v];
};

/**
 * Scatters trees, cacti, rocks and grass over a chunk with jittered grids, so density follows the
 * biome and the layout is the same every time the chunk is generated.
 */
export function scatterChunk(
  sampler: TerrainSampler,
  patchNoise: SimplexNoise,
  cx: number,
  cz: number,
  level: number,
  poi: Poi | null,
  out: InstanceCollector,
  surface: (x: number, z: number) => number
): void {
  if (level === SCATTER_NONE) return;
  const rng = createRng(Math.floor(hash2(sampler.seed, cx, cz) * 4294967296));
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const sample = createSample();
  const w = sample.weights; // forest, desert, snow, swamp

  const nearPoi = (x: number, z: number) =>
    poi !== null && Math.hypot(x + ox - poi.x, z + oz - poi.z) < poi.radius;

  const slopeAt = (wx: number, wz: number, h: number) =>
    Math.max(Math.abs(sampler.heightAt(wx + 1.5, wz) - h), Math.abs(sampler.heightAt(wx, wz + 1.5) - h)) / 1.5;

  // Trees, cacti and rocks
  for (let gz = 0; gz < CHUNK_SIZE / TREE_CELL; gz++) {
    for (let gx = 0; gx < CHUNK_SIZE / TREE_CELL; gx++) {
      const x = (gx + rng()) * TREE_CELL;
      const z = (gz + rng()) * TREE_CELL;
      const roll = rng();
      const rollKind = rng();
      const rollSize = rng();
      const rollYaw = rng();
      const wx = ox + x;
      const wz = oz + z;
      sampler.sample(wx, wz, sample);
      const h = sample.height;
      const y0 = surface(x, z);
      if (h < WATER_LEVEL + 0.35 || nearPoi(x, z)) continue;
      const slope = slopeAt(wx, wz, h);
      const clump = patchNoise.fbm(wx * 0.02, wz * 0.02, 2) * 0.5 + 0.5; // forests grow in patches

      const forestness = w[0] * smoothstep(0.25, 0.65, clump);
      const treeChance = forestness * 0.85 + w[2] * 0.3 * (1 - smoothstep(30, 50, h)) * clump + w[3] * 0.16;
      const size = 0.8 + rollSize * 0.9;

      if (slope < 1.0 && roll < treeChance) {
        if (w[3] > 0.35) {
          out.add("deadTree", x, y0 - 0.2, z, rollYaw * 6.28, size, size * (0.9 + rollKind * 0.4), size, jitterTint(rng, 0.9, 0.85, 0.8));
        } else if (w[2] > 0.45 || (h > 30 && w[2] > 0.2)) {
          out.add("pine", x, y0 - 0.3, z, rollYaw * 6.28, size, size, size, jitterTint(rng, 0.85, 0.95, 0.95));
        } else if (rollKind < 0.55) {
          out.add("broadleaf", x, y0 - 0.3, z, rollYaw * 6.28, size, size, size, jitterTint(rng, 1, 1, 0.9));
        } else {
          out.add("pine", x, y0 - 0.3, z, rollYaw * 6.28, size, size, size, jitterTint(rng, 0.9, 1, 0.9));
        }
        continue;
      }
      if (slope < 0.8 && w[1] > 0.5 && roll < 0.05 + w[1] * 0.06) {
        out.add("cactus", x, y0 - 0.2, z, rollYaw * 6.28, size * 0.9, size * (0.8 + rollKind * 0.7), size * 0.9, jitterTint(rng, 0.9, 1, 0.85));
        continue;
      }
      const shroomChance = w[3] * 0.09 + w[0] * 0.012;
      if (slope < 0.8 && roll > 0.9 && rollKind < shroomChance * 6) {
        const m = 0.7 + rollSize * 0.9;
        out.add("glowShroom", x, y0 - 0.02, z, rollYaw * 6.28, m, m, m, [1, 1, 1]);
        continue;
      }
      const rockChance = 0.05 + w[1] * 0.08 + w[2] * 0.12 + sample.mountain * 0.12;
      if (slope < 1.6 && rollKind < rockChance && roll > 0.4) {
        const s = 0.5 + rollSize * 1.6;
        out.add("rock", x, y0 - s * 0.25, z, rollYaw * 6.28, s, s * (0.6 + rollSize * 0.5), s * (0.8 + rollKind), jitterTint(rng, 1, 1, 1));
      }
    }
  }

  // Water life: lily pads floating on calm water, reeds along the shore.
  for (let gz = 0; gz < CHUNK_SIZE / WATER_CELL; gz++) {
    for (let gx = 0; gx < CHUNK_SIZE / WATER_CELL; gx++) {
      const x = (gx + rng()) * WATER_CELL;
      const z = (gz + rng()) * WATER_CELL;
      const roll = rng();
      const rollYaw = rng();
      const rollSize = rng();
      const wx = ox + x;
      const wz = oz + z;
      sampler.sample(wx, wz, sample);
      const h = sample.height;
      if (h > WATER_LEVEL + 0.8 || h < WATER_LEVEL - 3 || nearPoi(x, z)) continue;
      const wet = w[0] * 0.6 + w[3] * 1.2; // forests and swamps; deserts and snow stay bare
      if (wet < 0.1 || patchNoise.fbm(wx * 0.06, wz * 0.06, 2) < -0.1) continue;
      if (h < WATER_LEVEL - 0.35) {
        if (roll < 0.2 * wet) out.add("lilyPad", x, WATER_LEVEL + 0.03, z, rollYaw * 6.28, 0.8 + rollSize * 0.7, 1, 0.8 + rollSize * 0.7, [1, 1, 1]);
      } else if (h > WATER_LEVEL - 0.15 && roll < 0.4 * wet) {
        const s = 0.8 + rollSize * 0.6;
        out.add("reed", x, surface(x, z) - 0.05, z, rollYaw * 6.28, s, s, s, [0.95, 1, 0.9]);
      }
    }
  }

  if (level < SCATTER_FULL) return;

  // Grass
  for (let gz = 0; gz < CHUNK_SIZE / GRASS_CELL; gz++) {
    for (let gx = 0; gx < CHUNK_SIZE / GRASS_CELL; gx++) {
      if (!out.has("grass")) return;
      const x = (gx + rng()) * GRASS_CELL;
      const z = (gz + rng()) * GRASS_CELL;
      const roll = rng();
      const rollSize = rng();
      const rollYaw = rng();
      const wx = ox + x;
      const wz = oz + z;
      sampler.sample(wx, wz, sample);
      const h = sample.height;
      const y0 = surface(x, z);
      if (h < WATER_LEVEL + 0.25 || h > 48) continue;
      const density = w[0] * 0.75 + w[3] * 0.6 + w[1] * 0.08 + w[2] * 0.05;
      if (roll > density || nearPoi(x, z)) continue;
      if (slopeAt(wx, wz, h) > 0.9) continue;
      const s = 0.8 + rollSize * 0.6;
      // Blade color by biome (linear RGB): fresh green, dry scrub, pale frost, olive marsh.
      const r = w[0] * 0.1 + w[1] * 0.45 + w[2] * 0.55 + w[3] * 0.14;
      const g = w[0] * 0.3 + w[1] * 0.34 + w[2] * 0.6 + w[3] * 0.18;
      const b = w[0] * 0.05 + w[1] * 0.1 + w[2] * 0.65 + w[3] * 0.06;
      out.add("grass", x, y0 - 0.05, z, rollYaw * 6.28, s, s * (0.8 + rollSize * 0.5), s, jitterTint(rng, r, g, b));
    }
  }
}

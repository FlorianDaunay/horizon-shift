import { CHUNK_SIZE, WATER_LEVEL } from "../../config";
import { InstanceCollector } from "./instanceBuffer";
import { createRng, hash2 } from "./noise";
import type { TerrainSampler } from "./TerrainSampler";

/** A small island hovering in the sky, with a spiral of floating stones leading up to it. */
export interface Island {
  x: number;
  z: number;
  /** Height of the walkable top surface. */
  topY: number;
  radius: number;
  /** Where the stair starts (world XZ) and its spiral radius around the island's axis. */
  stairAngle: number;
}

const ISLAND_SALT = 0x2545f491;
/** Chance per chunk. Kept low: islands must decorate the sky, not hide it. */
const ISLAND_CHANCE = 0.05;
/** Keeps the island and its stairs inside the chunk, so it never straddles two chunks. */
const MARGIN = 20;
/** Vertical gap between consecutive stones: needs a jump (walking steps up to 0.55 m), well within jump height. */
const MAX_RISE = 1.3;
const STONE_GAP = 2.5;

export function findIsland(sampler: TerrainSampler, cx: number, cz: number): Island | null {
  const seed = sampler.seed ^ ISLAND_SALT;
  if (hash2(seed, cx, cz) > ISLAND_CHANCE) return null;
  const x = cx * CHUNK_SIZE + MARGIN + hash2(seed + 1, cx, cz) * (CHUNK_SIZE - 2 * MARGIN);
  const z = cz * CHUNK_SIZE + MARGIN + hash2(seed + 2, cx, cz) * (CHUNK_SIZE - 2 * MARGIN);
  const ground = Math.max(sampler.heightAt(x, z), WATER_LEVEL);
  if (ground > 55) return null;
  const island: Island = {
    x,
    z,
    radius: 7.5 + hash2(seed + 3, cx, cz) * 4.5,
    topY: ground + 24 + hash2(seed + 4, cx, cz) * 12,
    stairAngle: hash2(seed + 5, cx, cz) * Math.PI * 2,
  };
  // The stairs start where the terrain is; skip islands whose stair would be too long to build.
  const start = stairStart(island);
  return stairSteps(island, sampler.heightAt(start.x, start.z) + 0.4) <= MAX_STEPS ? island : null;
}

const MAX_STEPS = 60;
const stairSpiral = (island: Island) => island.radius + 3.4;
const stairStart = (island: Island) => ({
  x: island.x + Math.cos(island.stairAngle) * stairSpiral(island),
  z: island.z + Math.sin(island.stairAngle) * stairSpiral(island),
});
const stairSteps = (island: Island, startY: number) => Math.max(1, Math.ceil((island.topY - startY) / MAX_RISE));

const GREEN: [number, number, number] = [0.9, 1, 0.85];

export function buildIsland(
  sampler: TerrainSampler,
  island: Island,
  cx: number,
  cz: number,
  out: InstanceCollector,
  ground: (x: number, z: number) => number
): void {
  const rng = createRng(Math.floor(hash2(sampler.seed ^ ISLAND_SALT, cx, cz) * 4294967296) ^ 0x1a2b);
  const lx = island.x - cx * CHUNK_SIZE;
  const lz = island.z - cz * CHUNK_SIZE;
  const { radius: R, topY } = island;

  out.add("islandBase", lx, topY, lz, rng() * 6, R, R * 0.8, R, [1, 1, 1]);

  // Life on top: a few trees, glowing crystals, a lantern and mushrooms.
  const place = (minR: number, maxR: number) => {
    const angle = rng() * Math.PI * 2;
    const r = R * (minR + rng() * (maxR - minR));
    return [lx + Math.cos(angle) * r, lz + Math.sin(angle) * r] as const;
  };
  for (let i = 0; i < 3 + Math.floor(rng() * 2); i++) {
    const [x, z] = place(0.25, 0.75);
    const s = 0.8 + rng() * 0.5;
    out.add(rng() < 0.6 ? "broadleaf" : "pine", x, topY - 0.05, z, rng() * 6, s, s, s, [1, 1, 1]);
  }
  for (let i = 0; i < 3; i++) {
    const [x, z] = place(0.2, 0.6);
    out.add("crystal", x, topY - 0.05, z, rng() * 6, 0.7, 1.1 + rng() * 0.9, 0.7, [0.55, 0.95, 1]);
  }
  const [lanternX, lanternZ] = place(0.55, 0.8);
  out.add("lantern", lanternX, topY - 0.05, lanternZ, 0, 1, 1, 1, [1, 1, 1]);
  for (let i = 0; i < 5; i++) {
    const [x, z] = place(0.3, 0.9);
    out.add("glowShroom", x, topY - 0.02, z, rng() * 6, 1, 1, 1, [1, 1, 1]);
  }
  for (let i = 0; i < 40; i++) {
    const [x, z] = place(0.1, 0.92);
    const s = 0.9 + rng() * 0.5;
    out.add("grass", x, topY - 0.03, z, rng() * 6, s, s, s, [0.1 * GREEN[0], 0.3 * GREEN[1], 0.06 * GREEN[2]]);
  }

  // The stairway: stones spiralling up from the ground around the island.
  const spiral = stairSpiral(island);
  const x0 = lx + Math.cos(island.stairAngle) * spiral;
  const z0 = lz + Math.sin(island.stairAngle) * spiral;
  const y0 = ground(x0, z0) + 0.4;
  const steps = Math.min(MAX_STEPS, stairSteps(island, y0));
  const rise = (topY - y0) / steps;
  const turn = STONE_GAP / spiral;
  for (let i = 0; i < steps; i++) {
    const angle = island.stairAngle + i * turn;
    const x = lx + Math.cos(angle) * spiral;
    const z = lz + Math.sin(angle) * spiral;
    const s = 0.95 + rng() * 0.25;
    out.add("floatStone", x, i === 0 ? y0 : y0 + i * rise, z, rng() * 6, s, 1, s, [0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 1]);
  }
}

import { CHUNK_SIZE, WATER_LEVEL } from "../../config";
import { spiralStairs } from "./stairs";
import { InstanceCollector } from "./instanceBuffer";
import { createRng, hash2 } from "./noise";
import { createSample, type TerrainSampler } from "./TerrainSampler";

export const POI_TYPES = [
  "ruins",
  "tower",
  "cave",
  "circle",
  "obelisk",
  "camp",
  "shrine",
  "arch",
  "windmill",
  "well",
  "hut",
  "graveyard",
  "giantTree",
  "watchtower",
  "dock",
] as const;
export type PoiType = (typeof POI_TYPES)[number];

/** A point of interest in world coordinates. */
export interface Poi {
  type: PoiType;
  x: number;
  z: number;
  /** Ground footprint radius, used to keep vegetation away. */
  radius: number;
  /** Docks: direction (radians) and distance (m) from the hut to the shore the pier leads to. */
  aim?: number;
  length?: number;
}

const RADIUS: Record<PoiType, number> = {
  ruins: 13,
  tower: 8,
  cave: 9,
  circle: 9,
  obelisk: 7,
  camp: 7,
  shrine: 8,
  arch: 6,
  windmill: 8,
  well: 6,
  hut: 9,
  graveyard: 10,
  giantTree: 12,
  watchtower: 8,
  dock: 8,
};

/** Relative chance of each structure per biome (forest, desert, snow, swamp order of `weights`). */
type LandType = Exclude<PoiType, "dock">;
const TABLE: Record<LandType, [number, number, number, number]> = {
  ruins: [0.2, 0.3, 0.05, 0.3],
  tower: [0.12, 0.1, 0.15, 0.02],
  cave: [0.08, 0.02, 0.3, 0],
  circle: [0.2, 0.05, 0.15, 0.2],
  obelisk: [0.05, 0.3, 0.2, 0.2],
  camp: [0.2, 0.1, 0.2, 0.02],
  shrine: [0.12, 0.03, 0.05, 0.3],
  arch: [0.08, 0.2, 0.05, 0.01],
  windmill: [0.12, 0.15, 0.02, 0],
  well: [0.1, 0.15, 0.03, 0.04],
  hut: [0.15, 0.05, 0.12, 0.1],
  graveyard: [0.06, 0.03, 0.05, 0.2],
  giantTree: [0.12, 0, 0.02, 0.1],
  watchtower: [0.08, 0.12, 0.1, 0.02],
};
const LAND_TYPES = Object.keys(TABLE) as LandType[];

const POI_SALT = 0x9e3779b1;
const POI_CHANCE = 0.075;
const MARGIN = 20;

const STONE: [number, number, number] = [1, 1, 1];
const tint = (rng: () => number, spread = 0.12): [number, number, number] => {
  const v = 1 - spread + rng() * spread * 2;
  return [v, v, v];
};

/**
 * Decides, from the chunk coordinates alone, whether the chunk holds a point of interest and where.
 * At most one per chunk, kept `MARGIN` meters from the borders, so a POI never straddles two chunks.
 */
export function findPoi(sampler: TerrainSampler, cx: number, cz: number): Poi | null {
  return findLandPoi(sampler, cx, cz) ?? findDock(sampler, cx, cz);
}

const DOCK_SALT = 0x3c6ef372;
const DOCK_CHANCE = 0.4;
/** Height of a dock's deck above the water. */
export const DECK_HEIGHT = 0.55;

/**
 * A stilt hut out on a lake with a pier leading to the nearest shore. Everything stays inside the
 * chunk, so the walkway never straddles two chunks.
 */
export function findDock(sampler: TerrainSampler, cx: number, cz: number): Poi | null {
  const seed = sampler.seed ^ DOCK_SALT;
  if (hash2(seed, cx, cz) > DOCK_CHANCE) return null;
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const lx = 22 + hash2(seed + 1, cx, cz) * (CHUNK_SIZE - 44);
  const lz = 22 + hash2(seed + 2, cx, cz) * (CHUNK_SIZE - 44);
  if (sampler.heightAt(ox + lx, oz + lz) > WATER_LEVEL - 1.8) return null;

  let best: { aim: number; length: number } | null = null;
  for (let k = 0; k < 16; k++) {
    const aim = (k / 16) * Math.PI * 2 + hash2(seed + 3, cx, cz);
    for (let r = 4; r <= 30; r += 1.5) {
      const x = lx + Math.cos(aim) * r;
      const z = lz + Math.sin(aim) * r;
      if (x < 3 || x > CHUNK_SIZE - 3 || z < 3 || z > CHUNK_SIZE - 3) break;
      if (sampler.heightAt(ox + x, oz + z) > WATER_LEVEL + 0.35) {
        if (!best || r < best.length) best = { aim, length: r };
        break;
      }
    }
  }
  if (!best) return null;
  return { type: "dock", x: ox + lx, z: oz + lz, radius: RADIUS.dock, aim: best.aim, length: best.length };
}

function findLandPoi(sampler: TerrainSampler, cx: number, cz: number): Poi | null {
  const seed = sampler.seed ^ POI_SALT;
  if (hash2(seed, cx, cz) > POI_CHANCE) return null;

  const x = cx * CHUNK_SIZE + MARGIN + hash2(seed + 1, cx, cz) * (CHUNK_SIZE - 2 * MARGIN);
  const z = cz * CHUNK_SIZE + MARGIN + hash2(seed + 2, cx, cz) * (CHUNK_SIZE - 2 * MARGIN);
  const sample = sampler.sample(x, z, createSample());
  if (sample.height < WATER_LEVEL + 1.5) return null;
  const slope = Math.max(
    Math.abs(sampler.heightAt(x + 6, z) - sample.height),
    Math.abs(sampler.heightAt(x, z + 6) - sample.height)
  );
  if (slope > 4.5) return null;

  // Weighted pick among the structures, weighted by how much of each biome is here.
  const w = sample.weights;
  const scores = LAND_TYPES.map((type) => TABLE[type][0] * w[0] + TABLE[type][1] * w[1] + TABLE[type][2] * w[2] + TABLE[type][3] * w[3]);
  let roll = hash2(seed + 3, cx, cz) * scores.reduce((a, b) => a + b, 0);
  let index = 0;
  while (index < scores.length - 1 && roll > scores[index]) roll -= scores[index++];
  const type = LAND_TYPES[index];
  return { type, x, z, radius: RADIUS[type] };
}

type Ground = (x: number, z: number) => number;

/** Emits the instances that make up a POI (chunk-local coordinates; `ground` is the rendered surface height). */
export function buildPoi(
  sampler: TerrainSampler,
  poi: Poi,
  cx: number,
  cz: number,
  out: InstanceCollector,
  ground: Ground
): void {
  const rng = createRng(Math.floor(hash2(sampler.seed ^ POI_SALT, cx, cz) * 4294967296) ^ 0x51ed);
  const lx = poi.x - cx * CHUNK_SIZE;
  const lz = poi.z - cz * CHUNK_SIZE;
  if (poi.type === "dock") return buildDock(poi, cx, cz, out, ground, rng);
  const ctx: Ctx = { out, ground, rng, lx, lz, base: ground(lx, lz) };
  BUILDERS[poi.type](ctx);
}

interface Ctx {
  out: InstanceCollector;
  ground: Ground;
  rng: () => number;
  lx: number;
  lz: number;
  base: number;
}

/** A torch planted in the ground at a spot around the center. */
function torch({ out, ground, rng }: Ctx, x: number, z: number) {
  out.add("torch", x, ground(x, z) - 0.05, z, rng() * 6, 1, 1, 1, STONE);
}

/** A chest at a spot on the ground. */
function chest({ out, ground, rng }: Ctx, x: number, z: number) {
  out.add("chest", x, ground(x, z) - 0.02, z, rng() * 6, 1, 1, 1, STONE);
}

const BUILDERS: Record<LandType, (ctx: Ctx) => void> = {
  ruins(ctx) {
    const { out, ground, rng, lx, lz } = ctx;
    const wallCount = 9 + Math.floor(rng() * 4);
    for (let i = 0; i < wallCount; i++) {
      if (rng() < 0.3) continue; // gaps: the walls have crumbled
      const angle = (i / wallCount) * Math.PI * 2;
      const r = 8 + rng() * 1.5;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      out.add("ruinBlock", x, ground(x, z) - 0.6, z, -angle + Math.PI / 2, 3.6 + rng() * 1.6, 1 + rng() * 2.6, 0.9, tint(rng));
    }
    const pillars = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < pillars; i++) {
      const angle = rng() * Math.PI * 2;
      const r = 2 + rng() * 5;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      out.add("ruinPillar", x, ground(x, z) - 0.5, z, rng() * 6, 0.7 + rng() * 0.3, 2 + rng() * 4, 0.7 + rng() * 0.3, tint(rng));
      if (i < 2) torch(ctx, x + 1, z + 1);
    }
    for (let i = 0; i < 5; i++) {
      const x = lx + (rng() - 0.5) * 12;
      const z = lz + (rng() - 0.5) * 12;
      out.add("ruinBlock", x, ground(x, z) - 0.2, z, rng() * 6, 1 + rng(), 0.6 + rng() * 0.5, 1 + rng(), tint(rng));
    }
  },

  tower(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const height = 12 + rng() * 5;
    const radius = 2.3 + rng() * 0.5;
    out.add("towerBody", lx, base - 3, lz, rng() * 6, radius, height + 3, radius, STONE);
    out.add("towerRoof", lx, base + height, lz, 0, radius * 1.35, 3.6, radius * 1.35, [0.75, 0.42, 0.34]);
    for (let i = 0; i < 6; i++) {
      const angle = rng() * Math.PI * 2;
      const r = radius + 0.6 + rng() * 2.4;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      out.add("rock", x, ground(x, z) - 0.3, z, rng() * 6, 0.9 + rng(), 0.7 + rng() * 0.8, 0.9 + rng(), tint(rng));
    }
    const door = rng() * Math.PI * 2;
    for (const side of [-0.45, 0.45]) torch(ctx, lx + Math.cos(door + side) * (radius + 1.4), lz + Math.sin(door + side) * (radius + 1.4));
  },

  cave(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const facing = rng() * Math.PI * 2;
    for (let i = 0; i < 7; i++) {
      const angle = facing + Math.PI + (i / 6 - 0.5) * Math.PI * 1.5;
      const r = 3.6 + rng() * 1.2;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      const s = 3 + rng() * 2.2;
      out.add("rock", x, ground(x, z) - 0.6, z, rng() * 6, s, s * (0.9 + rng() * 0.6), s, tint(rng));
    }
    out.add("rock", lx, base + 1.5, lz, rng() * 6, 5.5, 4.5, 5.5, tint(rng));
    const mx = lx + Math.cos(facing) * 3.2;
    const mz = lz + Math.sin(facing) * 3.2;
    out.add("caveMouth", mx, ground(mx, mz) - 0.2, mz, -facing + Math.PI / 2, 2.6, 3.2, 1.6, STONE);
    for (const side of [-1.3, 1.3]) {
      const x = lx + Math.cos(facing) * 5.4 + Math.cos(facing + Math.PI / 2) * side * 1.6;
      const z = lz + Math.sin(facing) * 5.4 + Math.sin(facing + Math.PI / 2) * side * 1.6;
      torch(ctx, x, z);
    }
    for (let i = 0; i < 5; i++) {
      const angle = facing + (rng() - 0.5) * 1.6;
      const r = 5 + rng() * 3;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      out.add("glowShroom", x, ground(x, z) - 0.02, z, rng() * 6, 0.8 + rng() * 0.6, 0.8 + rng() * 0.6, 0.8 + rng() * 0.6, STONE);
    }
  },

  circle(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const stones = 8;
    const gap = Math.floor(rng() * stones);
    for (let i = 0; i < stones; i++) {
      if (i === gap) continue;
      const angle = (i / stones) * Math.PI * 2;
      const x = lx + Math.cos(angle) * 5.5;
      const z = lz + Math.sin(angle) * 5.5;
      out.add("menhir", x, ground(x, z) - 0.4, z, rng() * 6, 0.9 + rng() * 0.3, 2.4 + rng() * 1.6, 0.9 + rng() * 0.3, tint(rng));
    }
    out.add("crystal", lx, base + 1.7, lz, 0, 1.3, 1.9, 1.3, [0.5, 0.95, 1]);
    for (let i = 0; i < 3; i++) {
      const angle = rng() * Math.PI * 2;
      const x = lx + Math.cos(angle) * 2.2;
      const z = lz + Math.sin(angle) * 2.2;
      out.add("crystal", x, ground(x, z) - 0.1, z, rng() * 6, 0.5, 0.9 + rng() * 0.6, 0.5, [0.6, 0.8, 1]);
    }
  },

  obelisk(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    out.add("obelisk", lx, base - 0.5, lz, rng() * 6, 1.3, 8 + rng() * 2, 1.3, STONE);
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.6;
      const x = lx + Math.cos(angle) * 3.6;
      const z = lz + Math.sin(angle) * 3.6;
      out.add("crystal", x, ground(x, z) + 0.8, z, rng() * 6, 0.6, 1.2, 0.6, [1, 0.6, 1]);
      out.add("ruinBlock", x + Math.cos(angle) * 1.6, ground(x, z) - 0.3, z + Math.sin(angle) * 1.6, -angle, 1.6, 0.5, 1.6, tint(rng));
    }
    for (const dx of [-1, 1]) torch(ctx, lx + dx * 2.6, lz + 2.6);
  },

  camp(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    out.add("campfire", lx, base - 0.05, lz, rng() * 6, 1, 1, 1, STONE);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = lx + Math.cos(angle) * 0.95;
      const z = lz + Math.sin(angle) * 0.95;
      out.add("rock", x, ground(x, z) - 0.08, z, rng() * 6, 0.3, 0.28, 0.3, tint(rng));
    }
    const tentAngle = rng() * Math.PI * 2;
    for (const side of [-1, 1]) {
      const angle = tentAngle + side * 1.1;
      const x = lx + Math.cos(angle) * 4.2;
      const z = lz + Math.sin(angle) * 4.2;
      out.add("tent", x, ground(x, z) - 0.1, z, -angle + Math.PI / 4, 1.2 + rng() * 0.3, 1.1, 1.2 + rng() * 0.3, [1, 0.9 + rng() * 0.2, 0.8]);
    }
    const x = lx + Math.cos(tentAngle + Math.PI) * 3.5;
    const z = lz + Math.sin(tentAngle + Math.PI) * 3.5;
    out.add("lantern", x, ground(x, z) - 0.05, z, 0, 1, 1, 1, STONE);
  },

  shrine(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const yaw = rng() * Math.PI;
    const dir = [Math.cos(yaw), Math.sin(yaw)];
    const across = [-dir[1], dir[0]];
    for (const side of [-1, 1]) {
      const x = lx + dir[0] * 2.4 * side;
      const z = lz + dir[1] * 2.4 * side;
      out.add("ruinPillar", x, ground(x, z) - 0.5, z, 0, 0.9, 5, 0.9, [0.85, 0.6, 0.55]);
      const px = lx + dir[0] * 3.4 * side + across[0] * 3.2;
      const pz = lz + dir[1] * 3.4 * side + across[1] * 3.2;
      out.add("lantern", px, ground(px, pz) - 0.05, pz, 0, 1, 1, 1, STONE);
    }
    out.add("ruinBlock", lx, base + 4.9, lz, -yaw, 6.8, 0.6, 0.9, [0.85, 0.55, 0.5]);
    out.add("rock", lx + across[0] * 4, ground(lx + across[0] * 4, lz + across[1] * 4) - 0.2, lz + across[1] * 4, 0, 1.1, 0.9, 1.1, tint(rng));
    out.add("crystal", lx + across[0] * 4, ground(lx + across[0] * 4, lz + across[1] * 4) + 1.1, lz + across[1] * 4, 0, 0.6, 1.1, 0.6, [1, 0.8, 0.6]);
    for (let i = 0; i < 4; i++) {
      const x = lx + across[0] * (i - 1.5) * 1.6 - across[0] * 7;
      const z = lz + across[1] * (i - 1.5) * 1.6 - across[1] * 7;
      out.add("glowShroom", x, ground(x, z) - 0.02, z, rng() * 6, 1, 1, 1, STONE);
    }
  },

  arch(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const yaw = rng() * Math.PI;
    const dir = [Math.cos(yaw), Math.sin(yaw)];
    const height = 6 + rng() * 1.5;
    for (const side of [-1, 1]) {
      const x = lx + dir[0] * 2.6 * side;
      const z = lz + dir[1] * 2.6 * side;
      out.add("ruinPillar", x, ground(x, z) - 0.6, z, 0, 1.1, height, 1.1, tint(rng));
      torch(ctx, x + dir[1] * 1.4, z - dir[0] * 1.4);
    }
    out.add("ruinBlock", lx, base + height - 0.3, lz, -yaw, 6.6, 1, 1.4, tint(rng));
    for (let i = 0; i < 3; i++) {
      const x = lx + (rng() - 0.5) * 8;
      const z = lz + (rng() - 0.5) * 8;
      out.add("rock", x, ground(x, z) - 0.2, z, rng() * 6, 0.6 + rng() * 0.6, 0.5 + rng() * 0.5, 0.6 + rng() * 0.6, tint(rng));
    }
    // A bell hangs in the arch.
    out.add("bell", lx, base + height - 1.2, lz, 0, 1.3, 1.3, 1.3, STONE);
  },

  windmill(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const facing = rng() * Math.PI * 2;
    const height = 8 + rng() * 1.5;
    const r = 2.5;
    out.add("towerBody", lx, base - 2, lz, 0, r, height + 2, r, [1.12, 1.08, 0.98]);
    out.add("towerRoof", lx, base + height, lz, 0, r * 1.25, 2.6, r * 1.25, [0.62, 0.36, 0.3]);
    // The sails turn on the side the wind comes from.
    const hub = r * 0.85 + 0.55;
    out.add("windmillBlades", lx + Math.cos(facing) * hub, base + height - 1.9, lz + Math.sin(facing) * hub, Math.PI / 2 - facing, 1.15, 1.15, 1.15, STONE);
    const door = facing + Math.PI;
    for (const side of [-0.5, 0.5]) torch(ctx, lx + Math.cos(door + side) * (r + 1.3), lz + Math.sin(door + side) * (r + 1.3));
    chest(ctx, lx + Math.cos(door + 1.1) * (r + 2.6), lz + Math.sin(door + 1.1) * (r + 2.6));
    for (let i = 0; i < 5; i++) {
      const angle = rng() * Math.PI * 2;
      const x = lx + Math.cos(angle) * (r + 2 + rng() * 3);
      const z = lz + Math.sin(angle) * (r + 2 + rng() * 3);
      out.add("rock", x, ground(x, z) - 0.2, z, rng() * 6, 0.5 + rng() * 0.5, 0.4 + rng() * 0.4, 0.5 + rng() * 0.5, tint(rng));
    }
  },

  well(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    out.add("well", lx, base - 0.05, lz, rng() * 6, 1, 1, 1, STONE);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3;
      const x = lx + Math.cos(angle) * 2.4;
      const z = lz + Math.sin(angle) * 2.4;
      out.add("rock", x, ground(x, z) - 0.15, z, rng() * 6, 0.35, 0.3, 0.35, tint(rng));
    }
    torch(ctx, lx + 3.2, lz + 0.5);
    out.add("lantern", lx - 3.2, ground(lx - 3.2, lz - 0.4) - 0.05, lz - 0.4, 0, 1, 1, 1, STONE);
    if (rng() < 0.6) chest(ctx, lx + 2.6, lz - 3.2);
    for (let i = 0; i < 6; i++) {
      const x = lx + (rng() - 0.5) * 9;
      const z = lz + (rng() - 0.5) * 9;
      out.add("glowShroom", x, ground(x, z) - 0.02, z, rng() * 6, 1, 1, 1, STONE);
    }
  },

  hut(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const yaw = rng() * Math.PI * 2;
    out.add("cabin", lx, base - 0.1, lz, yaw, 1, 1, 1, tint(rng, 0.06));
    // The door faces local +Z.
    const front = [Math.sin(yaw), Math.cos(yaw)];
    const side = [front[1], -front[0]];
    const at = (f: number, s: number) => [lx + front[0] * f + side[0] * s, lz + front[1] * f + side[1] * s] as const;
    const [lamp, lampZ] = at(2.6, 1.3);
    out.add("lantern", lamp, ground(lamp, lampZ) - 0.05, lampZ, 0, 1, 1, 1, STONE);
    const [fire, fireZ] = at(5.6, -2);
    out.add("campfire", fire, ground(fire, fireZ) - 0.05, fireZ, rng() * 6, 1, 1, 1, STONE);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x = fire + Math.cos(angle) * 0.95;
      const z = fireZ + Math.sin(angle) * 0.95;
      out.add("rock", x, ground(x, z) - 0.08, z, rng() * 6, 0.3, 0.28, 0.3, tint(rng));
    }
    const [c, cz] = at(-1, 3.4);
    chest(ctx, c, cz);
    // A little fence around the garden, with a gap for the path.
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(angle - yaw), Math.cos(angle - yaw))) < 0.45) continue;
      const x = lx + Math.cos(angle) * 7.5;
      const z = lz + Math.sin(angle) * 7.5;
      out.add("post", x, ground(x, z) - 0.1, z, 0, 1, 1.1, 1, [0.95, 0.9, 0.9]);
    }
  },

  graveyard(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        if (rng() < 0.15) continue;
        const x = lx + (col - 1.5) * 2.3 + (rng() - 0.5) * 0.4;
        const z = lz + (row - 1) * 2.6 + (rng() - 0.5) * 0.4;
        out.add("headstone", x, ground(x, z) - 0.15, z, (rng() - 0.5) * 0.3 + (rng() < 0.2 ? 0.5 : 0), 1, 0.8 + rng() * 0.5, 1, tint(rng));
      }
    }
    for (const side of [-1, 1]) {
      const x = lx + side * 6.2;
      out.add("deadTree", x, ground(x, lz) - 0.2, lz + (rng() - 0.5) * 3, rng() * 6, 1.2, 1.3, 1.2, [0.7, 0.7, 0.75]);
      const gx = lx + side * 2.2;
      const gz = lz + 6;
      out.add("ruinPillar", gx, ground(gx, gz) - 0.5, gz, 0, 0.7, 3, 0.7, tint(rng));
      torch(ctx, gx + side * 0.9, gz + 0.6);
    }
    out.add("crystal", lx, base + 0.1, lz + 0.2, 0, 0.6, 1.1, 0.6, [0.6, 0.75, 1]);
    chest(ctx, lx + 5, lz - 4.6);
    for (let i = 0; i < 4; i++) {
      const x = lx + (rng() - 0.5) * 10;
      const z = lz + (rng() - 0.5) * 8;
      out.add("glowShroom", x, ground(x, z) - 0.02, z, rng() * 6, 1, 1, 1, STONE);
    }
  },

  giantTree(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    out.add("broadleaf", lx, base - 0.4, lz, rng() * 6, 4.3, 4.3, 4.3, [0.9, 1.08, 0.8]);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + rng();
      const x = lx + Math.cos(angle) * (2.6 + rng() * 0.6);
      const z = lz + Math.sin(angle) * (2.6 + rng() * 0.6);
      out.add("rock", x, ground(x, z) - 0.25, z, rng() * 6, 0.9 + rng() * 0.5, 0.5 + rng() * 0.4, 0.9 + rng() * 0.5, [0.7, 0.85, 0.65]);
    }
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2 + rng() * 0.4;
      const r = 4.5 + rng() * 4;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      out.add("glowShroom", x, ground(x, z) - 0.02, z, rng() * 6, 1 + rng() * 0.6, 1 + rng() * 0.6, 1 + rng() * 0.6, STONE);
    }
    for (let i = 0; i < 3; i++) {
      const angle = rng() * Math.PI * 2;
      const x = lx + Math.cos(angle) * 3.3;
      const z = lz + Math.sin(angle) * 3.3;
      out.add("crystal", x, ground(x, z) - 0.1, z, rng() * 6, 0.6, 1 + rng() * 0.5, 0.6, [0.6, 1, 0.8]);
    }
    chest(ctx, lx + Math.cos(2.2) * 3.8, lz + Math.sin(2.2) * 3.8);
    for (const angle of [0.5, 3.6]) {
      const x = lx + Math.cos(angle) * 7;
      const z = lz + Math.sin(angle) * 7;
      out.add("lantern", x, ground(x, z) - 0.05, z, 0, 1, 1, 1, STONE);
    }
  },

  watchtower(ctx) {
    const { out, ground, rng, lx, lz, base } = ctx;
    const height = 7.5 + rng() * 1.2;
    const top = base + height;
    for (const [sx, sz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
      const x = lx + sx;
      const z = lz + sz;
      const bottom = ground(x, z) - 0.6;
      out.add("post", x, bottom, z, 0, 1.2, top + 2.3 - bottom, 1.2, [0.95, 0.9, 0.9]);
    }
    out.add("plank", lx, top, lz, rng() * 0.5, 2, 1, 1.75, [1, 0.95, 0.95]);
    out.add("towerRoof", lx, top + 2.3, lz, Math.PI / 4, 2.7, 1.5, 2.7, [0.5, 0.33, 0.25]);
    torch(ctx, lx + 1.2, lz + 1.2);
    // torch() plants on the ground; a second one and the chest sit on the platform instead.
    out.add("torch", lx - 1.2, top, lz + 1.2, 0, 1, 1, 1, STONE);
    out.add("chest", lx, top + 0.02, lz - 0.3, rng() * 6, 1, 1, 1, STONE);
    const spiral = 3.1;
    const startAngle = rng() * Math.PI * 2;
    const x0 = lx + Math.cos(startAngle) * spiral;
    const z0 = lz + Math.sin(startAngle) * spiral;
    spiralStairs(out, { kind: "plank", x: lx, z: lz, radius: spiral, startAngle, fromY: ground(x0, z0) + 0.4, toY: top, gap: 2.4, rng });
    out.add("torch", x0 + 1.2, ground(x0 + 1.2, z0) - 0.05, z0, 0, 1, 1, 1, STONE);
  },
};

/** The stilt hut, its pier and boat. Chunk-local coordinates; `poi.aim` points at the shore. */
function buildDock(poi: Poi, cx: number, cz: number, out: InstanceCollector, ground: Ground, rng: () => number): void {
  const lx = poi.x - cx * CHUNK_SIZE;
  const lz = poi.z - cz * CHUNK_SIZE;
  const aim = poi.aim ?? 0;
  const length = poi.length ?? 10;
  const deck = WATER_LEVEL + DECK_HEIGHT;
  const dir = [Math.cos(aim), Math.sin(aim)];
  const across = [-dir[1], dir[0]];
  const at = (along: number, side: number) => [lx + dir[0] * along + across[0] * side, lz + dir[1] * along + across[1] * side] as const;
  const post = (x: number, z: number) => {
    const bottom = ground(x, z) - 0.4;
    if (bottom < deck - 0.3) out.add("post", x, bottom, z, 0, 1, deck - 0.1 - bottom, 1, [0.95, 0.9, 0.9]);
  };

  // Deck and hut. The door faces the shore (local +Z, so yaw = pi/2 - aim).
  out.add("plank", lx, deck, lz, -aim, 2.6, 1, 2.6, [1, 1, 1]);
  out.add("cabin", lx, deck, lz, Math.PI / 2 - aim, 1, 1, 1, [1, 0.97, 0.94]);
  for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    const [px, pz] = at(a, b);
    post(px, pz);
  }
  const [lampX, lampZ] = at(2.3, 1.7);
  out.add("lantern", lampX, deck, lampZ, 0, 1, 1, 1, STONE);
  const [chestX, chestZ] = at(-1.5, 2.3);
  out.add("chest", chestX, deck + 0.02, chestZ, rng() * 6, 1, 1, 1, STONE);

  // The pier: planks along the path from the deck to a little past the shore.
  const end = length + 1.2;
  for (let d = 2.7, i = 0; d < end; d += 1.6, i++) {
    const [x, z] = at(d, 0);
    out.add("plank", x, deck, z, -aim, 1, 1, 1, [0.95 + rng() * 0.1, 0.95 + rng() * 0.1, 0.95 + rng() * 0.1]);
    if (i % 2 === 0) {
      for (const side of [0.85, -0.85]) {
        const [px, pz] = at(d, side);
        post(px, pz);
      }
    }
    if (i % 4 === 1) {
      const [tx, tz] = at(d, 1.05);
      out.add("torch", tx, deck, tz, 0, 1, 1, 1, STONE);
    }
  }

  // A boat tied up beside the hut.
  const [bx, bz] = at(0.5, -4.4);
  out.add("boat", bx, WATER_LEVEL + 0.02, bz, rng() * 6, 1, 1, 1, [1, 1, 1]);
}

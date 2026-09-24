import { CHUNK_SIZE, WATER_LEVEL } from "../../config";
import { InstanceCollector } from "./instanceBuffer";
import { createRng, hash2 } from "./noise";
import { createSample, type TerrainSampler } from "./TerrainSampler";

export const POI_TYPES = ["ruins", "tower", "cave", "circle", "obelisk", "camp", "shrine", "arch"] as const;
export type PoiType = (typeof POI_TYPES)[number];

/** A point of interest in world coordinates. */
export interface Poi {
  type: PoiType;
  x: number;
  z: number;
  /** Ground footprint radius, used to keep vegetation away. */
  radius: number;
}

const RADIUS: Record<PoiType, number> = { ruins: 13, tower: 8, cave: 9, circle: 9, obelisk: 7, camp: 7, shrine: 8, arch: 6 };

/** Relative chance of each structure per biome (forest, desert, snow, swamp order of `weights`). */
const TABLE: Record<PoiType, [number, number, number, number]> = {
  ruins: [0.2, 0.3, 0.05, 0.3],
  tower: [0.12, 0.1, 0.15, 0.02],
  cave: [0.08, 0.02, 0.3, 0],
  circle: [0.2, 0.05, 0.15, 0.2],
  obelisk: [0.05, 0.3, 0.2, 0.2],
  camp: [0.2, 0.1, 0.2, 0.02],
  shrine: [0.12, 0.03, 0.05, 0.3],
  arch: [0.08, 0.2, 0.05, 0.01],
};

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
  const scores = POI_TYPES.map((type) => TABLE[type][0] * w[0] + TABLE[type][1] * w[1] + TABLE[type][2] * w[2] + TABLE[type][3] * w[3]);
  let roll = hash2(seed + 3, cx, cz) * scores.reduce((a, b) => a + b, 0);
  let index = 0;
  while (index < scores.length - 1 && roll > scores[index]) roll -= scores[index++];
  const type = POI_TYPES[index];
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

const BUILDERS: Record<PoiType, (ctx: Ctx) => void> = {
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
  },
};

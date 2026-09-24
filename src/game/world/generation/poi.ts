import { CHUNK_SIZE, WATER_LEVEL } from "../../config";
import { InstanceCollector } from "./instanceBuffer";
import { createRng, hash2 } from "./noise";
import { createSample, type TerrainSampler } from "./TerrainSampler";

export const POI_TYPES = ["ruins", "tower", "cave"] as const;
export type PoiType = (typeof POI_TYPES)[number];

/** A point of interest in world coordinates. */
export interface Poi {
  type: PoiType;
  x: number;
  z: number;
  /** Ground footprint radius, used to keep vegetation away. */
  radius: number;
}

const POI_SALT = 0x9e3779b1;
const POI_CHANCE = 0.07;
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

  const w = sample.weights; // forest, desert, snow, swamp
  const pick = hash2(seed + 3, cx, cz);
  let type: PoiType;
  if (w[2] > 0.4) type = pick < 0.5 ? "cave" : "tower";
  else if (w[1] > 0.4) type = pick < 0.75 ? "ruins" : "tower";
  else type = pick < 0.5 ? "ruins" : pick < 0.8 ? "tower" : "cave";
  return { type, x, z, radius: type === "ruins" ? 13 : type === "tower" ? 8 : 9 };
}

/** Emits the instances that make up a POI (chunk-local coordinates; `ground` is the rendered surface height). */
export function buildPoi(
  sampler: TerrainSampler,
  poi: Poi,
  cx: number,
  cz: number,
  out: InstanceCollector,
  ground: (x: number, z: number) => number
): void {
  const rng = createRng(Math.floor(hash2(sampler.seed ^ POI_SALT, cx, cz) * 4294967296) ^ 0x51ed);
  const ox = cx * CHUNK_SIZE;
  const oz = cz * CHUNK_SIZE;
  const lx = poi.x - ox;
  const lz = poi.z - oz;
  const base = ground(lx, lz);

  if (poi.type === "ruins") {
    const wallCount = 9 + Math.floor(rng() * 4);
    for (let i = 0; i < wallCount; i++) {
      if (rng() < 0.3) continue; // gaps: the walls have crumbled
      const angle = (i / wallCount) * Math.PI * 2;
      const r = 8 + rng() * 1.5;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      const height = 1 + rng() * 2.6;
      out.add("ruinBlock", x, ground(x, z) - 0.6, z, -angle + Math.PI / 2, 3.6 + rng() * 1.6, height, 0.9, tint(rng));
    }
    const pillars = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < pillars; i++) {
      const angle = rng() * Math.PI * 2;
      const r = 2 + rng() * 5;
      const x = lx + Math.cos(angle) * r;
      const z = lz + Math.sin(angle) * r;
      const h = 2 + rng() * 4;
      out.add("ruinPillar", x, ground(x, z) - 0.5, z, rng() * 6, 0.7 + rng() * 0.3, h, 0.7 + rng() * 0.3, tint(rng));
    }
    for (let i = 0; i < 5; i++) {
      const x = lx + (rng() - 0.5) * 12;
      const z = lz + (rng() - 0.5) * 12;
      out.add("ruinBlock", x, ground(x, z) - 0.2, z, rng() * 6, 1 + rng(), 0.6 + rng() * 0.5, 1 + rng(), tint(rng));
    }
  } else if (poi.type === "tower") {
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
  } else {
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
  }
}

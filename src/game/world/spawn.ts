import { WATER_LEVEL } from "../config";
import type { TerrainSampler } from "./generation/TerrainSampler";

/** Walks outward in a spiral from the origin to the first flat, dry, low-altitude spot. */
export function findSpawn(sampler: TerrainSampler): { x: number; z: number } {
  const step = 20;
  for (let ring = 0; ring < 60; ring++) {
    for (let i = 0; i < Math.max(1, ring * 8); i++) {
      const angle = (i / Math.max(1, ring * 8)) * Math.PI * 2;
      const x = Math.cos(angle) * ring * step;
      const z = Math.sin(angle) * ring * step;
      const h = sampler.heightAt(x, z);
      if (h < WATER_LEVEL + 2 || h > 25) continue;
      const slope = Math.max(Math.abs(sampler.heightAt(x + 4, z) - h), Math.abs(sampler.heightAt(x, z + 4) - h));
      if (slope < 1.2) return { x, z };
    }
  }
  return { x: 0, z: 0 };
}

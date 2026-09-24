import { WATER_LEVEL } from "../../config";
import { smoothstep } from "./noise";
import { createSample, type TerrainSampler } from "./TerrainSampler";

/** What the ground is made of at a point: drives footstep sounds. */
export type Surface = "grass" | "sand" | "snow" | "mud" | "rock" | "water" | "stone";

const sample = createSample();

/** The dominant ground material at (x, z), mirroring the terrain coloring rules. */
export function surfaceAt(sampler: TerrainSampler, x: number, z: number): Surface {
  sampler.sample(x, z, sample);
  const h = sample.height;
  if (h < WATER_LEVEL - 0.05) return "water";
  const slope = Math.max(Math.abs(sampler.heightAt(x + 1.5, z) - h), Math.abs(sampler.heightAt(x, z + 1.5) - h)) / 1.5;
  const w = sample.weights; // forest, desert, snow, swamp
  if (slope > 0.9) return "rock";
  if (smoothstep(46, 62, h) > 0.5 || w[2] > 0.55) return "snow";
  if (h < WATER_LEVEL + 0.9 || w[3] > 0.5) return "mud";
  if (w[1] > 0.5) return "sand";
  return "grass";
}

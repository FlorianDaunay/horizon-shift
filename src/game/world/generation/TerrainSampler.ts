import { BIOME_IDS, type BiomeId } from "./biomes";
import { SimplexNoise, clamp, smoothstep } from "./noise";

/** Result of sampling the world at one point. Reuse one object to avoid allocations in hot loops. */
export interface TerrainSample {
  height: number;
  /** 0..1, how mountainous the area is. */
  mountain: number;
  /** Blend weight of each biome (same order as `BIOME_IDS`), sums to 1. */
  weights: Float32Array;
}

export const createSample = (): TerrainSample => ({ height: 0, mountain: 0, weights: new Float32Array(BIOME_IDS.length) });

/**
 * The single source of truth for the shape of the world: height and biome at any (x, z).
 * Pure and deterministic, so the workers (meshing, scattering) and the main thread (player
 * physics, camera collision) always agree without sharing any memory.
 */
export class TerrainSampler {
  private readonly temperature: SimplexNoise;
  private readonly moisture: SimplexNoise;
  private readonly mountains: SimplexNoise;
  private readonly ridges: SimplexNoise;
  private readonly hills: SimplexNoise;
  private readonly dunes: SimplexNoise;
  private readonly scratch = createSample();

  constructor(readonly seed: number) {
    this.temperature = new SimplexNoise(seed + 1);
    this.moisture = new SimplexNoise(seed + 2);
    this.mountains = new SimplexNoise(seed + 3);
    this.ridges = new SimplexNoise(seed + 4);
    this.hills = new SimplexNoise(seed + 5);
    this.dunes = new SimplexNoise(seed + 6);
  }

  sample(x: number, z: number, out: TerrainSample): TerrainSample {
    const temp = clamp(this.temperature.fbm(x * 0.0006, z * 0.0006, 2) * 1.8, -1, 1);
    const wet = clamp(this.moisture.fbm(x * 0.0008 + 100, z * 0.0008, 2) * 1.8, -1, 1);
    const mountain = smoothstep(0.12, 0.5, this.mountains.fbm(x * 0.0005, z * 0.0005, 2) * 1.6);

    // Biome affinities from climate; the softmax below turns them into smooth blend weights.
    const forest = 0.7 - 0.9 * Math.abs(temp - 0.05) - 0.5 * Math.abs(wet - 0.15);
    const desert = 2.6 * temp - 2.2 * wet - 0.9 - 1.5 * mountain;
    const snow = -3.0 * temp + 3.2 * mountain - 1.1;
    const swamp = 2.6 * wet - 0.8 * Math.abs(temp - 0.1) - 1.3 - 2.5 * mountain;
    const k = 3.2;
    const e0 = Math.exp(k * forest);
    const e1 = Math.exp(k * desert);
    const e2 = Math.exp(k * snow);
    const e3 = Math.exp(k * swamp);
    const inv = 1 / (e0 + e1 + e2 + e3);
    const w = out.weights;
    w[0] = e0 * inv;
    w[1] = e1 * inv;
    w[2] = e2 * inv;
    w[3] = e3 * inv;

    const rolling = this.hills.fbm(x * 0.004, z * 0.004, 4);
    let height = 0;
    if (w[0] > 0.001) height += w[0] * (7 + rolling * 9);
    if (w[1] > 0.001) height += w[1] * (5 + (1 - Math.abs(this.dunes.fbm(x * 0.008, z * 0.006, 3))) * 7 + rolling * 3);
    if (w[2] > 0.001) height += w[2] * (16 + rolling * 12);
    if (w[3] > 0.001) height += w[3] * (0.5 + rolling * 1.7);

    if (mountain > 0.001) {
      const ridge = 1 - Math.abs(this.ridges.fbm(x * 0.0025, z * 0.0025, 5));
      height += mountain * (22 + ridge * ridge * 85);
    }

    out.height = height;
    out.mountain = mountain;
    return out;
  }

  heightAt(x: number, z: number): number {
    return this.sample(x, z, this.scratch).height;
  }

  /** The strongest biome at a point. */
  biomeAt(x: number, z: number): BiomeId {
    const w = this.sample(x, z, this.scratch).weights;
    let best = 0;
    for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i;
    return BIOME_IDS[best];
  }
}

import { describe, expect, it } from "vitest";
import { DEFAULT_SEED } from "../src/game/config";
import { BIOME_IDS } from "../src/game/world/generation/biomes";
import { TerrainSampler, createSample } from "../src/game/world/generation/TerrainSampler";

describe("TerrainSampler", () => {
  it("is deterministic for a given seed", () => {
    const a = new TerrainSampler(DEFAULT_SEED);
    const b = new TerrainSampler(DEFAULT_SEED);
    for (const [x, z] of [[0, 0], [123.4, -987.6], [-5000, 4200]]) expect(a.heightAt(x, z)).toBe(b.heightAt(x, z));
  });

  it("differs between seeds", () => {
    expect(new TerrainSampler(1).heightAt(300, 300)).not.toBe(new TerrainSampler(2).heightAt(300, 300));
  });

  it("produces normalised biome weights and finite heights", () => {
    const sampler = new TerrainSampler(DEFAULT_SEED);
    const out = createSample();
    for (let i = 0; i < 500; i++) {
      sampler.sample(i * 97.3 - 20000, i * -53.1 + 9000, out);
      expect(Number.isFinite(out.height)).toBe(true);
      expect(out.weights.reduce((s, w) => s + w, 0)).toBeCloseTo(1, 4);
    }
  });

  it("lets every biome dominate a meaningful part of the world", () => {
    const sampler = new TerrainSampler(DEFAULT_SEED);
    const counts: Record<string, number> = Object.fromEntries(BIOME_IDS.map((id) => [id, 0]));
    const steps = 60;
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < steps; j++) counts[sampler.biomeAt((i - steps / 2) * 400, (j - steps / 2) * 400)]++;
    }
    for (const id of BIOME_IDS) expect(counts[id] / (steps * steps), `${id} share`).toBeGreaterThan(0.05);
  });
});

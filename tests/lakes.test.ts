import { describe, expect, it } from "vitest";
import { DEFAULT_SEED, WATER_LEVEL } from "../src/game/config";
import { TerrainSampler } from "../src/game/world/generation/TerrainSampler";

describe("lakes", () => {
  it("carves real, swimmable lakes into the world", () => {
    const sampler = new TerrainSampler(DEFAULT_SEED);
    let water = 0;
    let deep = 0;
    let total = 0;
    for (let x = -6000; x < 6000; x += 60) {
      for (let z = -6000; z < 6000; z += 60) {
        const h = sampler.heightAt(x, z);
        total++;
        if (h < WATER_LEVEL) water++;
        if (h < WATER_LEVEL - 2.5) deep++;
      }
    }
    expect(water / total).toBeGreaterThan(0.03);
    expect(water / total).toBeLessThan(0.4);
    expect(deep / total).toBeGreaterThan(0.01); // deep enough to dive
  });
});

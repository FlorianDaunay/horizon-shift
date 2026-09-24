import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, DEFAULT_SEED, LOD_RESOLUTIONS, WATER_LEVEL } from "../src/game/config";
import { chunkIndices, chunkVertexCount, surfaceHeightFn } from "../src/game/world/generation/chunkMesh";
import { generateChunk } from "../src/game/world/generation/generateChunk";
import { SCATTER_FULL } from "../src/game/world/generation/scatter";
import { COLLIDER_STRIDE, INTERACT_STRIDE } from "../src/game/world/generation/collision";
import { DECK_HEIGHT, POI_TYPES, findDock, findPoi } from "../src/game/world/generation/poi";
import { TerrainSampler } from "../src/game/world/generation/TerrainSampler";
import { INSTANCE_CAPACITY } from "../src/game/world/instances/kinds";

describe("chunk indices", () => {
  it.each(LOD_RESOLUTIONS)("faces up on the surface and outward on the skirts (res %i)", (res) => {
    const w = res + 1;
    const indices = chunkIndices(res);
    // Flat surface, skirts one unit below, so triangle normals are easy to reason about.
    const pos = (v: number): [number, number, number] => {
      if (v < w * w) return [(v % w) * (CHUNK_SIZE / res), 0, Math.floor(v / w) * (CHUNK_SIZE / res)];
      const k = (v - w * w) % w;
      const side = Math.floor((v - w * w) / w);
      const t = k * (CHUNK_SIZE / res);
      const p: [number, number, number][] = [[t, -1, 0], [t, -1, CHUNK_SIZE], [0, -1, t], [CHUNK_SIZE, -1, t]];
      return p[side];
    };
    const outward: [number, number][] = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [pos(indices[t]), pos(indices[t + 1]), pos(indices[t + 2])];
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const isSkirt = indices[t] >= w * w || indices[t + 1] >= w * w || indices[t + 2] >= w * w;
      if (!isSkirt) {
        expect(n[1]).toBeGreaterThan(0);
      } else {
        const side = Math.floor((Math.max(indices[t], indices[t + 1], indices[t + 2]) - w * w) / w);
        expect(n[0] * outward[side][0] + n[2] * outward[side][1]).toBeGreaterThan(0);
      }
    }
    expect(Math.max(...indices)).toBeLessThan(chunkVertexCount(res));
  });
});

describe("generateChunk", () => {
  const request = { id: 1, seed: DEFAULT_SEED, cx: 3, cz: -2, lod: 0, scatter: SCATTER_FULL };

  it("is deterministic", () => {
    const a = generateChunk(request);
    const b = generateChunk({ ...request, id: 2 });
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(a.batches.map((x) => [x.kind, x.count])).toEqual(b.batches.map((x) => [x.kind, x.count]));
  });

  it("stays within instance budgets and buffer sizes", () => {
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        const r = generateChunk({ ...request, cx, cz });
        expect(r.positions.length).toBe(chunkVertexCount(LOD_RESOLUTIONS[0]) * 3);
        for (const batch of r.batches) {
          expect(batch.count).toBeLessThanOrEqual(INSTANCE_CAPACITY[batch.kind]);
          expect(batch.matrices.length).toBe(batch.count * 16);
        }
      }
    }
  });

  it("shares border heights between neighbouring chunks", () => {
    const a = generateChunk({ ...request, cx: 0, cz: 0 });
    const b = generateChunk({ ...request, cx: 1, cz: 0 });
    const w = LOD_RESOLUTIONS[0] + 1;
    for (let j = 0; j < w; j++) expect(a.positions[(j * w + w - 1) * 3 + 1]).toBeCloseTo(b.positions[j * w * 3 + 1], 5);
  });

  it("places some points of interest across the world", () => {
    let found = 0;
    for (let cx = -20; cx < 20; cx++) {
      for (let cz = -20; cz < 20; cz++) found += generateChunk({ ...request, cx, cz, lod: 2, scatter: 1 }).poi ? 1 : 0;
    }
    expect(found).toBeGreaterThan(10);
  });
});

describe("surfaceHeightFn", () => {
  it.each([0, 1, 2])("follows the triangles that are drawn (LOD %i)", (lod) => {
    const res = LOD_RESOLUTIONS[lod];
    const w = res + 1;
    const step = CHUNK_SIZE / res;
    const { positions } = generateChunk({ id: 1, seed: DEFAULT_SEED, cx: 2, cz: 5, lod, scatter: 0 });
    const surface = surfaceHeightFn(positions, res);
    const y = (i: number, j: number) => positions[(j * w + i) * 3 + 1];
    for (const [i, j] of [[0, 0], [1, 2], [res - 1, res - 1], [res, res]]) expect(surface(i * step, j * step)).toBeCloseTo(y(i, j), 4);
    // Centroids of both triangles of a quad are the mean of their corners.
    expect(surface((1 + 1 / 3) * step, (1 + 1 / 3) * step)).toBeCloseTo((y(1, 1) + y(2, 1) + y(1, 2)) / 3, 4);
    expect(surface((1 + 2 / 3) * step, (1 + 2 / 3) * step)).toBeCloseTo((y(2, 1) + y(1, 2) + y(2, 2)) / 3, 4);
  });
});

describe("solid objects", () => {
  const near = { id: 1, seed: DEFAULT_SEED, lod: 0, scatter: SCATTER_FULL };

  it("gives trees and rocks collision circles that match their instances", () => {
    for (let cx = -3; cx <= 3; cx++) {
      for (let cz = -3; cz <= 3; cz++) {
        const r = generateChunk({ ...near, cx, cz });
        expect(r.colliders.length % COLLIDER_STRIDE).toBe(0);
        const solids = r.batches.filter((b) => ["pine", "broadleaf", "deadTree", "cactus", "rock"].includes(b.kind)).reduce((n, b) => n + b.count, 0);
        expect(r.colliders.length / COLLIDER_STRIDE).toBeGreaterThanOrEqual(solids);
        for (let i = 0; i < r.colliders.length; i += COLLIDER_STRIDE) {
          expect(r.colliders[i + 2]).toBeGreaterThan(0);
          expect(r.colliders[i + 4]).toBeGreaterThan(r.colliders[i + 3]);
        }
      }
    }
  });

  it("builds every kind of structure somewhere in the world", () => {
    const sampler = new TerrainSampler(DEFAULT_SEED);
    const seen = new Set<string>();
    for (let cx = -40; cx < 40; cx++) for (let cz = -40; cz < 40; cz++) {
      const poi = findPoi(sampler, cx, cz);
      if (poi) seen.add(poi.type);
    }
    expect([...seen].sort()).toEqual([...POI_TYPES].sort());
  });

  it("puts light sources on structures", () => {
    let emitters = 0;
    for (let cx = -20; cx < 20; cx++) for (let cz = -20; cz < 20; cz++) emitters += generateChunk({ ...near, cx, cz, lod: 2, scatter: 1 }).emitters.length / 4;
    expect(emitters).toBeGreaterThan(20);
  });
});

describe("floating islands", () => {
  it("come with a stair of stones that can be climbed by jumping", () => {
    let checked = 0;
    for (let cx = -30; cx < 30 && checked < 6; cx++) {
      for (let cz = -30; cz < 30 && checked < 6; cz++) {
        const r = generateChunk({ id: 1, seed: DEFAULT_SEED, cx, cz, lod: 0, scatter: SCATTER_FULL });
        if (!r.island) continue;
        checked++;
        const stones = r.batches.find((b) => b.kind === "floatStone")!;
        const list = Array.from({ length: stones.count }, (_, i) => ({ x: stones.matrices[i * 16 + 12], y: stones.matrices[i * 16 + 13], z: stones.matrices[i * 16 + 14] }));
        for (let i = 1; i < list.length; i++) {
          const rise = list[i].y - list[i - 1].y;
          expect(rise).toBeGreaterThan(0);
          expect(rise).toBeLessThanOrEqual(1.4); // a jump reaches ~1.9 m
          expect(Math.hypot(list[i].x - list[i - 1].x, list[i].z - list[i - 1].z)).toBeLessThan(3.2);
        }
        // The first stone is at ground level (steppable) and the last is within a jump of the island top.
        expect(list[0].y - r.island.topY).toBeLessThan(0);
        const last = list[list.length - 1];
        expect(r.island.topY - last.y).toBeLessThanOrEqual(1.4);
        const gap = Math.hypot(last.x - (r.island.x - cx * CHUNK_SIZE), last.z - (r.island.z - cz * CHUNK_SIZE)) - r.island.radius * 0.94 - 1.3;
        expect(gap).toBeLessThan(4.5);
        // Everything stays inside its chunk.
        for (const s of list) {
          expect(s.x).toBeGreaterThan(0);
          expect(s.x).toBeLessThan(CHUNK_SIZE);
          expect(s.z).toBeGreaterThan(0);
          expect(s.z).toBeLessThan(CHUNK_SIZE);
        }
      }
    }
    expect(checked).toBeGreaterThan(3);
  });
});

describe("docks", () => {
  const sampler = new TerrainSampler(DEFAULT_SEED);
  const spots: [number, number][] = [];
  for (let cx = -60; cx < 60 && spots.length < 6; cx++) for (let cz = -60; cz < 60 && spots.length < 6; cz++) if (findDock(sampler, cx, cz)) spots.push([cx, cz]);

  const positionsOf = (r: ReturnType<typeof generateChunk>, kind: string) => {
    const b = r.batches.find((x) => x.kind === kind);
    return Array.from({ length: b?.count ?? 0 }, (_, i) => ({ x: b!.matrices[i * 16 + 12], y: b!.matrices[i * 16 + 13], z: b!.matrices[i * 16 + 14] }));
  };

  it("exist on lakes", () => {
    expect(spots.length).toBeGreaterThanOrEqual(4);
  });

  it("have a hut, a boat and a pier that stays in its chunk, is continuous and ends on dry land", () => {
    for (const [cx, cz] of spots) {
      const r = generateChunk({ id: 1, seed: DEFAULT_SEED, cx, cz, lod: 0, scatter: SCATTER_FULL });
      expect(r.poi?.type).toBe("dock");
      expect(positionsOf(r, "cabin")).toHaveLength(1);
      expect(positionsOf(r, "boat")).toHaveLength(1);

      const hut = { x: r.poi!.x - cx * CHUNK_SIZE, z: r.poi!.z - cz * CHUNK_SIZE };
      const fromHut = (p: { x: number; z: number }) => Math.hypot(p.x - hut.x, p.z - hut.z);
      const all = positionsOf(r, "plank");
      for (const p of all) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(CHUNK_SIZE);
        expect(p.z).toBeGreaterThan(0);
        expect(p.z).toBeLessThan(CHUNK_SIZE);
        expect(p.y).toBeCloseTo(WATER_LEVEL + DECK_HEIGHT, 5);
      }
      // The deck under the hut is one big plank; the pier is the rest, in order of distance from it.
      const planks = all.filter((p) => fromHut(p) > 0.5).sort((a, b) => fromHut(a) - fromHut(b));
      expect(all.length - planks.length).toBe(1);
      expect(fromHut(planks[0])).toBeLessThan(3); // joins the deck (radius ~2.5 m)
      // Each plank is within reach of the previous one, so the pier can be walked without jumping.
      for (let i = 1; i < planks.length; i++) expect(Math.hypot(planks[i].x - planks[i - 1].x, planks[i].z - planks[i - 1].z)).toBeLessThan(1.8);
      const end = planks[planks.length - 1];
      expect(sampler.heightAt(cx * CHUNK_SIZE + end.x, cz * CHUNK_SIZE + end.z)).toBeGreaterThan(WATER_LEVEL - 0.05);
    }
  });
});

describe("watchtowers", () => {
  it("can be climbed by a stair of planks up to a platform", () => {
    const sampler = new TerrainSampler(DEFAULT_SEED);
    let checked = 0;
    for (let cx = -60; cx < 60 && checked < 4; cx++) {
      for (let cz = -60; cz < 60 && checked < 4; cz++) {
        if (findPoi(sampler, cx, cz)?.type !== "watchtower") continue;
        checked++;
        const r = generateChunk({ id: 1, seed: DEFAULT_SEED, cx, cz, lod: 0, scatter: SCATTER_FULL });
        const planks = r.batches.find((b) => b.kind === "plank")!;
        const all = Array.from({ length: planks.count }, (_, i) => ({ y: planks.matrices[i * 16 + 13], scale: planks.matrices[i * 16] ** 2 + planks.matrices[i * 16 + 2] ** 2 }));
        const platform = all.reduce((a, b) => (b.y > a.y ? b : a));
        const stairs = all.filter((p) => p !== platform).sort((a, b) => a.y - b.y);
        expect(stairs.length).toBeGreaterThan(3);
        for (let i = 1; i < stairs.length; i++) expect(stairs[i].y - stairs[i - 1].y).toBeLessThanOrEqual(1.4);
        expect(platform.y - stairs[stairs.length - 1].y).toBeLessThanOrEqual(1.4);
      }
    }
    expect(checked).toBeGreaterThan(1);
  });
});

describe("interactables", () => {
  it("offer crystals, chests, bells and campfires", () => {
    const types = new Set<number>();
    for (let cx = -25; cx < 25; cx++) {
      for (let cz = -25; cz < 25; cz++) {
        const r = generateChunk({ id: 1, seed: DEFAULT_SEED, cx, cz, lod: 2, scatter: 1 });
        expect(r.interactables.length % INTERACT_STRIDE).toBe(0);
        for (let i = 0; i < r.interactables.length; i += INTERACT_STRIDE) types.add(r.interactables[i + 3]);
      }
    }
    expect([...types].sort()).toEqual([0, 1, 2, 3]);
  });
});

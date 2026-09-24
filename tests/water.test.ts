import type { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { WATER_LEVEL } from "../src/game/config";
import { createFrame, type InputFrame } from "../src/game/input/actions";
import { GLIDE_SECONDS_PER_SHARD, Progress } from "../src/game/Progress";
import { PlayerController, SURFACE_LEVEL, type Walkable } from "../src/game/player/PlayerController";

interface Platform {
  x: number;
  z: number;
  radius: number;
  base: number;
  top: number;
}

/**
 * A lake for z > 0 (floor at -4), a bank rising towards -z, and optional flat platforms (docks, boats).
 * Forward for a camera yaw of 0 is -z.
 */
function lake(platforms: Platform[] = []): Walkable {
  return {
    heightAt: (_x, z) => (z >= 0 ? -4 : Math.min(3, -4 + -z * 0.7)),
    supportAt(x, z, feetY) {
      let best = -Infinity;
      for (const p of platforms) {
        if (p.top <= best || p.top > feetY + 0.55 || feetY < p.base) continue;
        if ((x - p.x) ** 2 + (z - p.z) ** 2 < p.radius ** 2) best = p.top;
      }
      return best;
    },
    resolveObstacles(_position: Vector3) {},
  };
}

function frame(patch: { moveY?: number; jump?: boolean; jumpHeld?: boolean; dive?: boolean; sprint?: boolean } = {}): InputFrame {
  const f = createFrame();
  f.axes.moveY = patch.moveY ?? 0;
  f.buttons.jump.pressed = patch.jump ?? false;
  f.buttons.jump.down = patch.jump || patch.jumpHeld || false;
  f.buttons.dive.down = patch.dive ?? false;
  f.buttons.sprint.down = patch.sprint ?? false;
  return f;
}

function run(player: PlayerController, seconds: number, make: () => InputFrame, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) player.update(1 / fps, make(), 0);
}

function inLake(world: Walkable, y: number, z = 6) {
  const player = new PlayerController(world);
  player.spawn(0, z);
  player.position.y = y;
  player.grounded = false;
  return player;
}

describe("swimming", () => {
  it("falls into deep water with a splash and floats with the head above the surface", () => {
    const player = inLake(lake(), 6);
    let splash = 0;
    for (let i = 0; i < 240; i++) {
      player.update(1 / 60, frame(), 0);
      splash = Math.max(splash, player.events.splash);
    }
    expect(splash).toBeGreaterThan(3);
    expect(player.swimming).toBe(true);
    expect(player.position.y).toBeCloseTo(SURFACE_LEVEL, 0);
    expect(player.headUnderwater).toBe(false);
  });

  it("dives down with the dive key, spends air, and floats back up when released", () => {
    const player = inLake(lake(), SURFACE_LEVEL);
    run(player, 0.5, () => frame());
    run(player, 3, () => frame({ dive: true }));
    expect(player.position.y).toBeLessThan(SURFACE_LEVEL - 2);
    expect(player.headUnderwater).toBe(true);
    expect(player.oxygen).toBeLessThan(1);
    run(player, 6, () => frame());
    expect(player.headUnderwater).toBe(false);
    expect(player.oxygen).toBeGreaterThan(0.9);
  });

  it("cannot dive through the lake floor", () => {
    const player = inLake(lake(), SURFACE_LEVEL);
    run(player, 6, () => frame({ dive: true }));
    expect(player.position.y).toBeGreaterThanOrEqual(-4 - 1e-6);
    expect(player.position.y).toBeLessThan(-3.9);
  });

  it("is lifted to the surface when the air runs out", () => {
    const player = inLake(lake(), SURFACE_LEVEL);
    let drowned = false;
    let lowest = 1;
    run(player, 60, () => {
      drowned ||= player.drowning;
      lowest = Math.min(lowest, player.oxygen);
      return frame({ dive: true }); // never lets go
    });
    expect(drowned).toBe(true);
    expect(lowest).toBeGreaterThanOrEqual(0);
  });

  it("swims to a bank and walks out of the water", () => {
    const player = inLake(lake(), SURFACE_LEVEL);
    run(player, 14, () => frame({ moveY: 1 }));
    expect(player.swimming).toBe(false);
    expect(player.position.z).toBeLessThan(-7);
    expect(player.grounded).toBe(true);
  });

  it("swims slower than it walks and faster when sprinting", () => {
    const slow = inLake(lake(), SURFACE_LEVEL);
    run(slow, 3, () => frame({ moveY: 1 }));
    const fast = inLake(lake(), SURFACE_LEVEL);
    run(fast, 3, () => frame({ moveY: 1, sprint: true }));
    expect(slow.speed).toBeLessThan(4);
    expect(fast.speed).toBeGreaterThan(slow.speed + 1);
  });

  it("hops out of the water onto a dock", () => {
    const deck = WATER_LEVEL + 0.55;
    const dock: Platform = { x: 0, z: -1.2, radius: 1.6, base: WATER_LEVEL - 0.6, top: deck };
    const player = inLake(lake([dock]), SURFACE_LEVEL, 3);
    // Swim up to the dock, then hop out while still swimming forward.
    let hopped = false;
    for (let i = 0; i < 180 && !(hopped && player.onObject); i++) {
      const hop: boolean = !hopped && player.position.z < 1.4;
      hopped ||= hop;
      player.update(1 / 60, frame({ moveY: 1, jump: hop }), 0);
    }
    expect(hopped).toBe(true);
    expect(player.onObject).toBe(true);
    expect(player.position.y).toBeCloseTo(deck, 1);
    expect(player.swimming).toBe(false);
  });

  it("wades (does not swim) in shallow water", () => {
    const player = new PlayerController(lake());
    player.spawn(0, -6.2); // terrain here is only just under the surface
    run(player, 1, () => frame());
    expect(player.swimming).toBe(false);
    expect(player.grounded).toBe(true);
  });
});

describe("gliding", () => {
  const flat: Walkable = { heightAt: () => 10, supportAt: () => -Infinity, resolveObstacles() {} };

  function fall(canGlide: boolean, seconds: number) {
    const player = new PlayerController(flat);
    player.spawn(0, 0);
    player.position.y = 60;
    player.grounded = false;
    player.canGlide = canGlide;
    run(player, seconds, () => frame({ jumpHeld: true }));
    return player;
  }

  it("slows a fall to a gentle descent while the magic lasts", () => {
    const gliding = fall(true, 1.5);
    expect(gliding.gliding).toBe(true);
    expect(-gliding.velocity.y).toBeLessThanOrEqual(1.71);
    expect(gliding.glideTime).toBeGreaterThan(1);
    const falling = fall(false, 1.5);
    expect(falling.gliding).toBe(false);
    expect(-falling.velocity.y).toBeGreaterThan(10);
  });
});

describe("Progress", () => {
  it("turns gliding time into spent shards and never goes below zero", () => {
    const progress = new Progress(new Set());
    progress.add(3);
    expect(progress.spendGlide(GLIDE_SECONDS_PER_SHARD - 0.5)).toBe(false);
    expect(progress.shards).toBe(3);
    expect(progress.spendGlide(1)).toBe(true);
    expect(progress.shards).toBe(2);
    progress.spendGlide(100);
    expect(progress.shards).toBe(0);
  });

  it("caps shards at nine and reports how many were actually gained", () => {
    const progress = new Progress(new Set());
    expect(progress.add(7)).toBe(7);
    expect(progress.add(5)).toBe(2);
    expect(progress.shards).toBe(9);
  });
});

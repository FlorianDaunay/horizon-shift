import type { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createFrame, type InputFrame } from "../src/game/input/actions";
import { PLAYER_HEIGHT, PlayerController, type Walkable } from "../src/game/player/PlayerController";

interface Circle {
  x: number;
  z: number;
  radius: number;
  base: number;
  top: number;
  standable: boolean;
}

const REACH = 0.55;

/** A flat world at height 10 with vertical cylinders, following the same rules as the real world. */
function flatWorld(circles: Circle[] = []): Walkable {
  return {
    heightAt: () => 10,
    supportAt(x, z, feetY) {
      let best = -Infinity;
      for (const c of circles) {
        if (!c.standable || c.top <= best || c.top > feetY + REACH || feetY < c.base) continue;
        if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.radius ** 2) best = c.top;
      }
      return best;
    },
    resolveObstacles(position: Vector3, radius: number, height: number) {
      for (const c of circles) {
        if (position.y + height <= c.base || position.y >= c.top - REACH) continue;
        const dx = position.x - c.x;
        const dz = position.z - c.z;
        const reach = c.radius + radius;
        const d = Math.hypot(dx, dz);
        if (d >= reach) continue;
        position.x = c.x + (d > 1e-4 ? dx / d : 1) * reach;
        position.z = c.z + (d > 1e-4 ? dz / d : 0) * reach;
      }
    },
  };
}

function input(patch: { moveY?: number; jump?: boolean; sprint?: boolean }): InputFrame {
  const frame = createFrame();
  frame.axes.moveY = patch.moveY ?? 0;
  frame.buttons.jump.down = frame.buttons.jump.pressed = patch.jump ?? false;
  frame.buttons.sprint.down = patch.sprint ?? false;
  return frame;
}

/** Runs until `done` is true (or the time is up). */
function runUntil(player: PlayerController, seconds: number, frame: () => InputFrame, done: () => boolean, fps = 60) {
  for (let i = 0; i < seconds * fps && !done(); i++) player.update(1 / fps, frame(), 0);
}

/** Camera yaw 0 means "forward" is -Z. */
function run(player: PlayerController, seconds: number, frame: () => InputFrame, fps = 60) {
  for (let i = 0; i < seconds * fps; i++) player.update(1 / fps, frame(), 0);
}

describe("PlayerController jumping", () => {
  it("jumps about two meters high", () => {
    const player = new PlayerController(flatWorld());
    player.spawn(0, 0);
    let apex = 0;
    player.update(1 / 60, input({ jump: true }), 0);
    for (let i = 0; i < 70; i++) {
      player.update(1 / 60, input({}), 0);
      apex = Math.max(apex, player.position.y - 10);
    }
    expect(apex).toBeGreaterThan(1.7);
    expect(apex).toBeLessThan(2.3);
    expect(player.grounded).toBe(true);
  });

  it("keeps the sprint speed through a jump even when the sprint key is released", () => {
    const player = new PlayerController(flatWorld());
    player.spawn(0, 0);
    run(player, 1.5, () => input({ moveY: 1, sprint: true }));
    expect(player.speed).toBeGreaterThan(9);

    player.update(1 / 60, input({ moveY: 1, sprint: true, jump: true }), 0);
    expect(player.grounded).toBe(false);
    run(player, 0.4, () => input({ moveY: 1, sprint: false })); // key released mid-air
    expect(player.grounded).toBe(false);
    expect(player.sprinting).toBe(true);
    expect(player.speed).toBeGreaterThan(9);
  });

  it("falls back to walking speed after landing without the sprint key", () => {
    const player = new PlayerController(flatWorld());
    player.spawn(0, 0);
    run(player, 1.2, () => input({ moveY: 1, sprint: true }));
    player.update(1 / 60, input({ moveY: 1, sprint: true, jump: true }), 0);
    run(player, 2.5, () => input({ moveY: 1 }));
    expect(player.grounded).toBe(true);
    expect(player.speed).toBeLessThan(5.5);
  });

  it("reports jump, step and landing events", () => {
    const player = new PlayerController(flatWorld());
    player.spawn(0, 0);
    let steps = 0;
    let landed = 0;
    let jumped = 0;
    for (let i = 0; i < 180; i++) {
      player.update(1 / 60, input({ moveY: 1, jump: i === 30 }), 0);
      steps += player.events.step ? 1 : 0;
      landed += player.events.land > 0 ? 1 : 0;
      jumped += player.events.jump ? 1 : 0;
    }
    expect(jumped).toBe(1);
    expect(landed).toBe(1);
    expect(steps).toBeGreaterThan(4);
  });
});

describe("PlayerController collisions", () => {
  const tree: Circle = { x: 0, z: -5, radius: 0.5, base: 9, top: 20, standable: false };

  it("is stopped by a tree instead of walking through it", () => {
    const player = new PlayerController(flatWorld([tree]));
    player.spawn(0, 0);
    run(player, 3, () => input({ moveY: 1 })); // straight into the trunk
    expect(Math.hypot(player.position.x - tree.x, player.position.z - tree.z)).toBeGreaterThanOrEqual(tree.radius + 0.34);
    expect(player.position.z).toBeGreaterThan(tree.z);
  });

  it("steps up onto a low rock and can stand on it", () => {
    const rock: Circle = { x: 0, z: -4, radius: 1.5, base: 9, top: 10.45, standable: true };
    const player = new PlayerController(flatWorld([rock]));
    player.spawn(0, 0);
    runUntil(player, 3, () => input({ moveY: 1 }), () => player.onObject);
    expect(player.onObject).toBe(true);
    expect(player.position.y).toBeCloseTo(10.45, 1);
  });

  it("cannot walk onto a high rock, but can jump onto it", () => {
    const rock: Circle = { x: 0, z: -4, radius: 1.5, base: 9, top: 11.3, standable: true };
    const walker = new PlayerController(flatWorld([rock]));
    walker.spawn(0, 0);
    run(walker, 2, () => input({ moveY: 1 }));
    expect(walker.position.y).toBeCloseTo(10, 1);
    expect(walker.onObject).toBe(false);

    // Walk up to the rock, then jump against it.
    const jumper = new PlayerController(flatWorld([rock]));
    jumper.spawn(0, -1);
    let jumps = 0;
    runUntil(jumper, 3, () => {
      const wantJump = jumper.grounded && !jumper.onObject && jumper.position.z < -1.5 && jumps++ < 1;
      return input({ moveY: 1, jump: wantJump });
    }, () => jumper.onObject);
    expect(jumper.onObject).toBe(true);
    expect(jumper.position.y).toBeCloseTo(11.3, 1);
  });

  it("does not tunnel through a thin stone while falling fast (and lands on it)", () => {
    const stone: Circle = { x: 0, z: 0, radius: 1.3, base: 24.5, top: 25, standable: true };
    const player = new PlayerController(flatWorld([stone]));
    player.spawn(0, 0);
    player.position.y = 40;
    player.grounded = false;
    // A very long frame (0.1 s) is split into sub-steps.
    for (let i = 0; i < 30; i++) player.update(0.1, input({}), 0);
    expect(player.position.y).toBeCloseTo(25, 1);
    expect(player.position.y + PLAYER_HEIGHT).toBeGreaterThan(25);
  });
});

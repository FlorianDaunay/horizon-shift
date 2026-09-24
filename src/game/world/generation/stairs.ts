import type { InstanceCollector } from "./instanceBuffer";

/** Vertical gap between consecutive steps: needs a jump (walking steps up to 0.55 m), well within jump height. */
export const MAX_RISE = 1.3;

export interface SpiralOptions {
  kind: "floatStone" | "plank";
  /** Chunk-local center of the spiral axis. */
  x: number;
  z: number;
  radius: number;
  startAngle: number;
  /** Height of the first step and of the surface the last step leads to. */
  fromY: number;
  toY: number;
  /** Distance between two steps along the spiral. */
  gap: number;
  rng: () => number;
}

/** Steps needed to climb `height` meters. */
export const stepsFor = (height: number) => Math.max(1, Math.ceil(height / MAX_RISE));

/**
 * Places steps spiralling up around an axis. Each is at most `MAX_RISE` above the previous one and
 * the last is one rise below `toY`, so the surface it leads to can be jumped onto from it.
 */
export function spiralStairs(out: InstanceCollector, options: SpiralOptions, maxSteps = 60): number {
  const { kind, x, z, radius, startAngle, fromY, toY, gap, rng } = options;
  const steps = Math.min(maxSteps, stepsFor(toY - fromY));
  const rise = (toY - fromY) / steps;
  const turn = gap / radius;
  for (let i = 0; i < steps; i++) {
    const angle = startAngle + i * turn;
    const px = x + Math.cos(angle) * radius;
    const pz = z + Math.sin(angle) * radius;
    // Planks lie along the path; stones are turned at random.
    const yaw = kind === "plank" ? -(angle + Math.PI / 2) : rng() * 6;
    const s = kind === "plank" ? 1 : 0.95 + rng() * 0.25;
    const tone = 0.95 + rng() * 0.1;
    out.add(kind, px, fromY + i * rise, pz, yaw, s, 1, s, [tone, tone, tone]);
  }
  return steps;
}

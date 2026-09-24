import type { InstanceKind } from "../instances/kinds";

/**
 * Collision is a set of vertical cylinders (circle in XZ, a vertical extent), generated next to the
 * instances so it always matches what is drawn. Layout of one entry in the flat arrays:
 * `x, z, radius, base, top, standable` (world Y; the player can stand on `standable` tops).
 */
export const COLLIDER_STRIDE = 6;

/** Layout of one light-emitting spot: `x, y, z, type`. */
export const EMITTER_STRIDE = 4;
export const EMITTER_FIRE = 0;
export const EMITTER_MAGIC = 1;
export const EMITTER_LANTERN = 2;

/** Layout of one interactable thing: `x, y, z, type, kind index, instance index within its kind`. */
export const INTERACT_STRIDE = 6;
export const INTERACT_COLLECT = 0;
export const INTERACT_OPEN = 1;
export const INTERACT_RING = 2;
export const INTERACT_REST = 3;

/** Adds a circle: `dx, dz` are offsets in the instance's own (unrotated) axes, `base`/`top` relative to its origin. */
type Push = (dx: number, dz: number, radius: number, base: number, top: number, standable: boolean) => void;

/** Collision shape of each kind, from the instance's scale. Kinds not listed are walk-through. */
export const COLLISION: Partial<Record<InstanceKind, (sx: number, sy: number, sz: number, push: Push) => void>> = {
  pine: (sx, sy, _sz, push) => push(0, 0, 0.42 * sx, -1, 6.5 * sy, false),
  broadleaf: (sx, sy, _sz, push) => push(0, 0, 0.48 * sx, -1, 5.5 * sy, false),
  deadTree: (sx, sy, _sz, push) => push(0, 0, 0.3 * sx, -1, 4 * sy, false),
  cactus: (sx, sy, _sz, push) => push(0, 0, 0.5 * sx, -1, 3.3 * sy, false),
  rock: (sx, sy, sz, push) => push(0, 0, 0.85 * Math.max(sx, sz) * 0.9, -1, 1.1 * sy, true),
  ruinBlock: (sx, sy, sz, push) => {
    // A long wall: a row of circles along its length.
    const r = Math.max(0.5, 0.5 * sz + 0.1);
    for (const f of [-0.33, 0, 0.33]) push(f * sx, 0, r, -1, sy, true);
  },
  ruinPillar: (sx, sy, _sz, push) => push(0, 0, 0.5 * sx, -1, sy, false),
  towerBody: (sx, sy, _sz, push) => push(0, 0, 0.95 * sx, -1, sy, false),
  menhir: (sx, sy, _sz, push) => push(0, 0, 0.55 * sx, -1, sy, false),
  obelisk: (sx, sy, _sz, push) => push(0, 0, 0.55 * sx, -1, sy, false),
  tent: (sx, _sy, _sz, push) => push(0, 0, 1.1 * sx, -1, 1.6, false),
  campfire: (_sx, _sy, _sz, push) => push(0, 0, 0.55, -1, 0.35, true),
  crystal: (sx, sy, _sz, push) => push(0, 0, 0.35 * sx, -0.5, 1.7 * sy, false),
  floatStone: (sx, _sy, _sz, push) => push(0, 0, 1.25 * sx, -0.5, 0, true),
  islandBase: (sx, sy, _sz, push) => push(0, 0, 0.94 * sx, -1.4 * sy, 0, true),
  plank: (sx, _sy, sz, push) => push(0, 0, 0.95 * Math.max(sx, sz), -0.6, 0, true),
  post: (sx, sy, _sz, push) => push(0, 0, 0.17 * sx, -1, sy, false),
  cabin: (sx, sy, _sz, push) => push(0, 0, 1.75 * sx, -1, 2.6 * sy, false),
  headstone: (sx, sy, _sz, push) => push(0, 0, 0.32 * sx, -1, sy, false),
  chest: (_sx, _sy, _sz, push) => push(0, 0, 0.5, -1, 0.6, false),
  boat: (sx, _sy, sz, push) => push(0, 0, 1.3 * Math.max(sx, sz * 0.5), -0.5, 0.35, true),
  well: (sx, sy, _sz, push) => push(0, 0, 1.0 * sx, -1, 0.9 * sy, false),
};

/** Kinds the player can interact with: offset of the interaction point and what happens. */
export const INTERACTIONS: Partial<Record<InstanceKind, (sy: number) => [number, number, number, number]>> = {
  crystal: (sy) => [0, 0.9 * sy, 0, INTERACT_COLLECT],
  chest: () => [0, 0.5, 0, INTERACT_OPEN],
  bell: () => [0, 0, 0, INTERACT_RING],
  campfire: () => [0, 0.4, 0, INTERACT_REST],
};

/** Light-emitting kinds: local offset of the light and its type. */
export const EMITTERS: Partial<Record<InstanceKind, (sy: number) => [number, number, number, number]>> = {
  torch: () => [0, 1.5, 0, EMITTER_FIRE],
  campfire: () => [0, 0.7, 0, EMITTER_FIRE],
  lantern: () => [0, 2.1, 0, EMITTER_LANTERN],
  crystal: (sy) => [0, 0.9 * sy, 0, EMITTER_MAGIC],
};

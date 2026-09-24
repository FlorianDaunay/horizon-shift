/**
 * Everything that is drawn as instances (vegetation, rocks, structures, magic). This file only
 * holds ids and budgets so workers can use it; geometry and materials live in `models.ts`.
 * Adding a kind: add its id + capacity here, a model in `models.ts`, optionally a collision shape
 * or light in `../generation/collision.ts`, and emit it from the generators.
 */
export const INSTANCE_KINDS = [
  "pine",
  "broadleaf",
  "deadTree",
  "cactus",
  "rock",
  "grass",
  "glowShroom",
  "ruinBlock",
  "ruinPillar",
  "towerBody",
  "towerRoof",
  "caveMouth",
  "menhir",
  "obelisk",
  "tent",
  "campfire",
  "torch",
  "lantern",
  "crystal",
  "floatStone",
  "islandBase",
] as const;

export type InstanceKind = (typeof INSTANCE_KINDS)[number];

/** Maximum instances of each kind in one chunk (the size of a pooled `InstancedMesh`). */
export const INSTANCE_CAPACITY: Record<InstanceKind, number> = {
  pine: 160,
  broadleaf: 140,
  deadTree: 90,
  cactus: 70,
  rock: 90,
  grass: 1800,
  glowShroom: 60,
  ruinBlock: 80,
  ruinPillar: 40,
  towerBody: 4,
  towerRoof: 4,
  caveMouth: 4,
  menhir: 24,
  obelisk: 4,
  tent: 8,
  campfire: 4,
  torch: 24,
  lantern: 16,
  crystal: 32,
  floatStone: 64,
  islandBase: 4,
};

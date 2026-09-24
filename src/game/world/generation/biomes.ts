/** Biome catalogue. Adding a biome: add it here, then give it an affinity + profile in `TerrainSampler`. */

export const BIOME_IDS = ["forest", "desert", "snow", "swamp"] as const;
export type BiomeId = (typeof BIOME_IDS)[number];

export const BIOME_INDEX: Record<BiomeId, number> = { forest: 0, desert: 1, snow: 2, swamp: 3 };

export const BIOME_LABELS: Record<BiomeId, string> = {
  forest: "Verdant Forest",
  desert: "Scorched Desert",
  snow: "Frozen Peaks",
  swamp: "Murky Swamp",
};

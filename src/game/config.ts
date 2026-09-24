/** World-wide constants shared by the main thread and the terrain workers. Keep this file dependency-free. */

/** Side of one terrain chunk, in meters. */
export const CHUNK_SIZE = 64;

/** Quads per chunk side for each level of detail (index = LOD). */
export const LOD_RESOLUTIONS = [32, 16, 8] as const;

/** Vertical skirt hanging under chunk borders to hide cracks between LOD levels. */
export const SKIRT_DEPTH = 6;

/** Height of the water plane (swamps and low ground dip below it). */
export const WATER_LEVEL = 1.2;

/** Deepest water the player may wade into. */
export const MAX_WADE_DEPTH = 1.0;

export const DEFAULT_SEED = 20240924;

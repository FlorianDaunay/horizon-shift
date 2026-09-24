import { WATER_LEVEL } from "../../config";
import { smoothstep } from "./noise";

type Rgb = [number, number, number];

/** sRGB hex to linear RGB (vertex colors live in the linear working space). */
function linear(hex: number): Rgb {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return [c((hex >> 16) & 255), c((hex >> 8) & 255), c(hex & 255)];
}

// [ground, variation] per biome, in the same order as BIOME_IDS.
const GROUND: [Rgb, Rgb][] = [
  [linear(0x4f8a3a), linear(0x3b6d2c)], // forest
  [linear(0xdbb86c), linear(0xc59a4c)], // desert
  [linear(0xeef3f8), linear(0xcfdbe8)], // snow
  [linear(0x4b5b33), linear(0x39472a)], // swamp
];
const ROCK = linear(0x746e69);
const MUD = linear(0x5a4c36);
const LAKEBED = linear(0x1c4b57);

/**
 * Terrain vertex color from biome weights, altitude, steepness and a `variation` noise value in
 * [-1, 1]. Snow settles on high flat ground, rock shows through on steep slopes, and the shore is muddy.
 */
export function terrainColor(
  weights: ArrayLike<number>,
  height: number,
  steepness: number,
  variation: number,
  out: Float32Array,
  offset: number
): void {
  const v = variation * 0.5 + 0.5;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < GROUND.length; i++) {
    const w = weights[i];
    const [base, alt] = GROUND[i];
    r += w * (base[0] + (alt[0] - base[0]) * v);
    g += w * (base[1] + (alt[1] - base[1]) * v);
    b += w * (base[2] + (alt[2] - base[2]) * v);
  }

  const snowAmount = smoothstep(46, 62, height + variation * 6) * (1 - smoothstep(0.35, 0.6, steepness));
  const snow = GROUND[2][0];
  r += (snow[0] - r) * snowAmount;
  g += (snow[1] - g) * snowAmount;
  b += (snow[2] - b) * snowAmount;

  const rockAmount = smoothstep(0.32, 0.55, steepness) * (1 - snowAmount * 0.6);
  r += (ROCK[0] - r) * rockAmount;
  g += (ROCK[1] - g) * rockAmount;
  b += (ROCK[2] - b) * rockAmount;

  const mudAmount = 1 - smoothstep(WATER_LEVEL - 0.4, WATER_LEVEL + 0.9, height);
  r += (MUD[0] - r) * mudAmount;
  g += (MUD[1] - g) * mudAmount;
  b += (MUD[2] - b) * mudAmount;

  // Below the surface the ground turns from muddy shallows into the dark teal of deep water.
  const deep = 1 - smoothstep(WATER_LEVEL - 4.5, WATER_LEVEL - 0.2, height);
  r += (LAKEBED[0] - r) * deep * 0.85;
  g += (LAKEBED[1] - g) * deep * 0.85;
  b += (LAKEBED[2] - b) * deep * 0.85;

  out[offset] = r;
  out[offset + 1] = g;
  out[offset + 2] = b;
}

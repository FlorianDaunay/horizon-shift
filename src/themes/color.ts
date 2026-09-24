export interface Rgba {
  r: number;
  g: number;
  b: number;
  /** 0..1 */
  a: number;
}

const HEX = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Parses `#RGB`, `#RGBA`, `#RRGGBB` or `#RRGGBBAA`. */
export function parseColor(input: string): Rgba {
  const match = HEX.exec(input.trim());
  if (!match) throw new Error(`Invalid color "${input}": expected #RGB, #RGBA, #RRGGBB or #RRGGBBAA.`);
  let hex = match[1];
  if (hex.length <= 4) hex = [...hex].map((c) => c + c).join("");
  const byte = (i: number) => parseInt(hex.slice(i, i + 2), 16);
  return { r: byte(0), g: byte(2), b: byte(4), a: hex.length === 8 ? byte(6) / 255 : 1 };
}

export function toHex({ r, g, b, a }: Rgba): string {
  const part = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}${a < 1 ? part(a * 255) : ""}`.toUpperCase();
}

/** Linear blend of two colors' RGB (`amount` 0 = `from`, 1 = `to`); alpha of `from` is kept. */
export function mix(from: string, to: string, amount: number): string {
  const a = parseColor(from);
  const b = parseColor(to);
  const lerp = (x: number, y: number) => x + (y - x) * amount;
  return toHex({ r: lerp(a.r, b.r), g: lerp(a.g, b.g), b: lerp(a.b, b.b), a: a.a });
}

export function withAlpha(color: string, alpha: number): string {
  return toHex({ ...parseColor(color), a: alpha });
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two opaque colors (1..21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(parseColor(a)), luminance(parseColor(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** White or near-black, whichever reads better on `background`. */
export function readableOn(background: string): string {
  return contrast("#FFFFFF", background) >= contrast("#111111", background) ? "#FFFFFF" : "#111111";
}

/** `foreground` (with its alpha) composited over the opaque `background`. */
export function over(foreground: string, background: string): string {
  const f = parseColor(foreground);
  const b = parseColor(background);
  const blend = (x: number, y: number) => x * f.a + y * (1 - f.a);
  return toHex({ r: blend(f.r, b.r), g: blend(f.g, b.g), b: blend(f.b, b.b), a: 1 });
}

/** The nearest shade of `color`, moving towards `towards`, that reaches `min` contrast on `background`. */
export function ensureContrast(color: string, background: string, min: number, towards: string): string {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, towards, step / 20);
    if (contrast(candidate, background) >= min) return candidate;
  }
  return towards;
}

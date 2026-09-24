/**
 * The vocabulary of a theme. This is the single list of design tokens: the `Theme` type,
 * the CSS variables and the Tailwind classes (`bg-surface-hover`, `rounded-card`,
 * `shadow-overlay`, ...) are all generated from it. To add a token, add it here, give it a
 * default in `define.ts`, and the rest follows.
 */

/** Colors every theme must provide. Any of them may carry alpha (`#RRGGBBAA`) for glass looks. */
export const REQUIRED_COLOR_TOKENS = [
  "canvas",
  "surface",
  "surfaceHover",
  "border",
  "textPrimary",
  "textSecondary",
  "textMuted",
  "accent",
  "success",
  "warning",
  "danger",
] as const;

/** Colors derived from the others when a theme does not set them. */
export const DERIVED_COLOR_TOKENS = ["accentHover", "accentForeground"] as const;

/** The sidebar can have its own look (e.g. a dark sidebar in a light theme). */
export const SIDEBAR_COLOR_TOKENS = [
  "sidebar",
  "sidebarBorder",
  "sidebarText",
  "sidebarTextStrong",
  "sidebarTextActive",
  "sidebarHover",
  "sidebarActive",
] as const;

export const COLOR_TOKENS = [...REQUIRED_COLOR_TOKENS, ...DERIVED_COLOR_TOKENS, ...SIDEBAR_COLOR_TOKENS] as const;

/** Corner radii by role: `control` (buttons, inputs), `tile` (icon tiles, toasts), `card` (panels), `pill` (badges, bars). */
export const RADIUS_TOKENS = ["control", "tile", "card", "pill"] as const;

/**
 * Shadows by role. `control` is a button at rest (a raised bevel), `inset` a pressed button or a
 * text field (a sunken bevel).
 */
export const SHADOW_TOKENS = ["card", "overlay", "control", "inset"] as const;

/** Keyboard-focus outline. */
export const FOCUS_TOKENS = ["width", "offset"] as const;

/** Whole-surface effects: a backdrop filter for surfaces (frosted glass) and the canvas background image. */
export const EFFECT_TOKENS = ["surfaceBackdrop", "canvasImage"] as const;

export const FONT_TOKENS = ["sans", "mono"] as const;

export type RequiredColorToken = (typeof REQUIRED_COLOR_TOKENS)[number];
export type DerivedColorToken = (typeof DERIVED_COLOR_TOKENS)[number];
export type SidebarColorToken = (typeof SIDEBAR_COLOR_TOKENS)[number];
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type RadiusToken = (typeof RADIUS_TOKENS)[number];
export type ShadowToken = (typeof SHADOW_TOKENS)[number];
export type FocusToken = (typeof FOCUS_TOKENS)[number];
export type EffectToken = (typeof EFFECT_TOKENS)[number];
export type FontToken = (typeof FONT_TOKENS)[number];

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Names of the CSS custom properties that carry each token at runtime. */
export const cssVar = {
  color: (token: ColorToken) => `--color-${kebab(token)}`,
  /** Alpha channel of a color (1 unless the color was written with alpha). */
  alpha: (token: ColorToken) => `--alpha-${kebab(token)}`,
  radius: (token: RadiusToken) => `--radius-${token}`,
  shadow: (token: ShadowToken) => `--shadow-${token}`,
  focus: (token: FocusToken) => `--focus-${token}`,
  effect: (token: EffectToken) => `--effect-${kebab(token)}`,
  font: (token: FontToken) => `--font-${token}`,
  borderWidth: "--border-width",
  borderStyle: "--border-style",
  /** Multiplier applied to every spacing value (padding, margin, gap, sizes). */
  density: "--density",
} as const;

/** Tailwind class name for a token (`surfaceHover` -> `surface-hover`). */
export const tailwindName = kebab;

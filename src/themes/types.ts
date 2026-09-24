import type {
  ColorToken,
  DerivedColorToken,
  EffectToken,
  FocusToken,
  FontToken,
  RadiusToken,
  RequiredColorToken,
  ShadowToken,
  SidebarColorToken,
} from "./tokens";

export type ThemeScheme = "light" | "dark";

/** A complete theme: every token has a value. */
export interface Theme {
  /** Unique, stable id (stored in the user's preferences). */
  id: string;
  name: string;
  /** One short line shown in the theme picker. */
  description: string;
  /** Whether it is a light or a dark look: drives native controls and "match system". */
  scheme: ThemeScheme;
  /** `#RRGGBB` or `#RRGGBBAA` colors. */
  colors: Record<ColorToken, string>;
  radius: Record<RadiusToken, string>;
  shadow: Record<ShadowToken, string>;
  /** Width of every border and divider (`0px` for a borderless look). */
  borderWidth: string;
  /** CSS `border-style` of every border and divider (`solid`, `dashed`, ...). */
  borderStyle: string;
  /** Spacing multiplier: below 1 is compact, above 1 is airy. */
  density: number;
  focus: Record<FocusToken, string>;
  effects: Record<EffectToken, string>;
  fonts: Record<FontToken, string>;
}

/**
 * What a theme file provides. Only `colors` (the required ones) matter for a simple theme;
 * everything else falls back to the defaults, and derived/sidebar colors follow from the rest.
 */
export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  scheme: ThemeScheme;
  colors: Record<RequiredColorToken, string> & Partial<Record<DerivedColorToken | SidebarColorToken, string>>;
  radius?: Partial<Record<RadiusToken, string>>;
  shadow?: Partial<Record<ShadowToken, string>>;
  borderWidth?: string;
  borderStyle?: string;
  density?: number;
  focus?: Partial<Record<FocusToken, string>>;
  effects?: Partial<Record<EffectToken, string>>;
  fonts?: Partial<Record<FontToken, string>>;
}

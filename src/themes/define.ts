import { ensureContrast, mix, over, readableOn, withAlpha } from "./color";
import type { Theme, ThemeDefinition } from "./types";

/** Shape, effects and typography shared by every theme unless it overrides them. */
const defaults = {
  radius: {
    control: "0.5rem",
    tile: "0.875rem",
    card: "1.125rem",
    pill: "9999px",
  },
  shadow: {
    card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
    overlay: "0 4px 24px -4px rgb(0 0 0 / 0.12)",
    control: "none",
    inset: "none",
  },
  borderWidth: "1px",
  borderStyle: "solid",
  density: 1,
  focus: { width: "2px", offset: "1px" },
  effects: { surfaceBackdrop: "none", canvasImage: "none" },
  fonts: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"JetBrains Mono", SFMono-Regular, Menlo, Consolas, monospace',
  },
} satisfies Pick<Theme, "radius" | "shadow" | "borderWidth" | "borderStyle" | "density" | "focus" | "effects" | "fonts">;

/** Builds a complete theme from a definition, filling in whatever it does not override. */
export function defineTheme(definition: ThemeDefinition): Theme {
  const c = definition.colors;
  const towards = definition.scheme === "dark" ? "#FFFFFF" : "#000000";
  const sidebar = c.sidebar ?? c.surface;
  const sidebarActive = c.sidebarActive ?? withAlpha(c.accent, 0.1);
  // The active nav label sits on a tint of the accent, so it is nudged until it stays readable.
  const activeBackground = over(sidebarActive, over(sidebar, c.canvas));

  return {
    ...definition,
    colors: {
      ...c,
      accentHover: c.accentHover ?? mix(c.accent, towards, 0.18),
      accentForeground: c.accentForeground ?? readableOn(c.accent),
      sidebar,
      sidebarBorder: c.sidebarBorder ?? c.border,
      sidebarText: c.sidebarText ?? c.textSecondary,
      sidebarTextStrong: c.sidebarTextStrong ?? c.textPrimary,
      sidebarTextActive: c.sidebarTextActive ?? ensureContrast(c.accent, activeBackground, 4.5, towards),
      sidebarHover: c.sidebarHover ?? c.surfaceHover,
      sidebarActive,
    },
    radius: { ...defaults.radius, ...definition.radius },
    shadow: { ...defaults.shadow, ...definition.shadow },
    borderWidth: definition.borderWidth ?? defaults.borderWidth,
    borderStyle: definition.borderStyle ?? defaults.borderStyle,
    density: definition.density ?? defaults.density,
    focus: { ...defaults.focus, ...definition.focus },
    effects: { ...defaults.effects, ...definition.effects },
    fonts: { ...defaults.fonts, ...definition.fonts },
  };
}

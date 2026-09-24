import type { CSSProperties } from "react";
import { parseColor } from "./color";
import {
  COLOR_TOKENS,
  EFFECT_TOKENS,
  FOCUS_TOKENS,
  FONT_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  cssVar,
} from "./tokens";
import type { Theme } from "./types";

/** Every CSS custom property a theme sets, by name. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {
    [cssVar.borderWidth]: theme.borderWidth,
    [cssVar.borderStyle]: theme.borderStyle,
    [cssVar.density]: String(theme.density),
  };
  for (const token of COLOR_TOKENS) {
    const { r, g, b, a } = parseColor(theme.colors[token]);
    vars[cssVar.color(token)] = `${r} ${g} ${b}`;
    vars[cssVar.alpha(token)] = String(Math.round(a * 1000) / 1000);
  }
  for (const token of RADIUS_TOKENS) vars[cssVar.radius(token)] = theme.radius[token];
  for (const token of SHADOW_TOKENS) vars[cssVar.shadow(token)] = theme.shadow[token];
  for (const token of FOCUS_TOKENS) vars[cssVar.focus(token)] = theme.focus[token];
  for (const token of EFFECT_TOKENS) vars[cssVar.effect(token)] = theme.effects[token];
  for (const token of FONT_TOKENS) vars[cssVar.font(token)] = theme.fonts[token];
  return vars;
}

/** Inline style that scopes a theme to one element (used for the live previews). */
export function themeToStyle(theme: Theme): CSSProperties {
  return themeToCssVars(theme) as CSSProperties;
}

/** Makes `theme` the look of the whole app. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(themeToCssVars(theme))) root.style.setProperty(name, value);
  root.dataset.theme = theme.id;
  root.dataset.scheme = theme.scheme;
  root.style.colorScheme = theme.scheme;
}

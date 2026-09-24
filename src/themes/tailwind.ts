import defaultTheme from "tailwindcss/defaultTheme";
import {
  COLOR_TOKENS,
  FONT_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  cssVar,
  tailwindName,
} from "./tokens";

/** Every default spacing step multiplied by the theme's density (`1px` and `0` are left alone). */
function scaledSpacing(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(defaultTheme.spacing as Record<string, string>).map(([key, value]) => [
      key,
      value === "0px" || value === "1px" ? value : `calc(${value} * var(${cssVar.density}))`,
    ])
  );
}

/**
 * Tailwind's `theme.extend`, generated from the tokens: `bg-surface-hover`, `text-text-muted`,
 * `rounded-card`, `shadow-overlay`, `font-mono`, the width of every `border`, and spacing that
 * follows the theme's density. Imported by `tailwind.config.ts`, so it must stay free of
 * browser/React code.
 */
export function tailwindThemeExtension() {
  return {
    // The class' own opacity (`bg-accent/10`) multiplies the alpha the theme gave the color.
    colors: Object.fromEntries(
      COLOR_TOKENS.map((t) => [
        tailwindName(t),
        ({ opacityValue }: { opacityValue?: string }) =>
          `rgb(var(${cssVar.color(t)}) / calc(var(${cssVar.alpha(t)}) * ${opacityValue ?? "1"}))`,
      ])
    ),
    borderRadius: Object.fromEntries(RADIUS_TOKENS.map((t) => [t, `var(${cssVar.radius(t)})`])),
    boxShadow: Object.fromEntries(SHADOW_TOKENS.map((t) => [t, `var(${cssVar.shadow(t)})`])),
    fontFamily: Object.fromEntries(FONT_TOKENS.map((t) => [t, `var(${cssVar.font(t)})`])),
    borderWidth: { DEFAULT: `var(${cssVar.borderWidth})` },
    spacing: scaledSpacing(),
  };
}

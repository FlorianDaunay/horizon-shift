import { themeToCssVars } from "./css";
import type { Theme, ThemeScheme } from "./types";

/**
 * Every file in `./definitions` that default-exports a theme (or an array of themes, for a
 * family such as a light/dark pair) is registered here automatically: adding a theme never
 * requires editing this file.
 */
const modules = import.meta.glob<{ default: Theme | Theme[] }>("./definitions/*.ts", { eager: true });

export const themes: Theme[] = Object.entries(modules)
  .flatMap(([path, module]) => {
    if (!module.default) throw new Error(`Theme file ${path} must default-export a theme (use defineTheme).`);
    return Array.isArray(module.default) ? module.default : [module.default];
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const ids = new Set<string>();
for (const theme of themes) {
  if (ids.has(theme.id)) throw new Error(`Two themes share the id "${theme.id}".`);
  ids.add(theme.id);
  try {
    themeToCssVars(theme); // fails fast on an invalid color
  } catch (error) {
    throw new Error(`Theme "${theme.id}": ${error instanceof Error ? error.message : error}`);
  }
}

/** The themes used when nothing else is chosen, and by "match system" before the user picks. */
export const DEFAULT_THEME_IDS: Record<ThemeScheme, string> = { light: "light", dark: "dark" };

for (const id of Object.values(DEFAULT_THEME_IDS)) {
  if (!ids.has(id)) throw new Error(`The built-in "${id}" theme is missing from src/themes/definitions.`);
}

export const findTheme = (id: string): Theme | undefined => themes.find((t) => t.id === id);

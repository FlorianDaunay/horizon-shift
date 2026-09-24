import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyTheme } from "./css";
import { DEFAULT_THEME_IDS, findTheme } from "./registry";
import type { Theme } from "./types";

const STORAGE_KEY = "horizon-shift-appearance";
const DARK_QUERY = "(prefers-color-scheme: dark)";

interface AppearanceState {
  /** Theme chosen by hand (used when not following the system). */
  themeId: string;
  followSystem: boolean;
  /** Themes used when following the system, for its light and dark modes. */
  lightId: string;
  darkId: string;
  /** Live OS setting; not persisted. */
  systemDark: boolean;
  selectTheme: (id: string) => void;
  setFollowSystem: (follow: boolean) => void;
}

/** The theme currently in effect for a given state. */
export function resolveTheme(state: Pick<AppearanceState, "themeId" | "followSystem" | "lightId" | "darkId" | "systemDark">): Theme {
  const id = state.followSystem ? (state.systemDark ? state.darkId : state.lightId) : state.themeId;
  return findTheme(id) ?? findTheme(DEFAULT_THEME_IDS[state.systemDark ? "dark" : "light"])!;
}

const systemDark = window.matchMedia(DARK_QUERY).matches;

export const useThemeStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      themeId: DEFAULT_THEME_IDS[systemDark ? "dark" : "light"],
      followSystem: true,
      lightId: DEFAULT_THEME_IDS.light,
      darkId: DEFAULT_THEME_IDS.dark,
      systemDark,

      // Picking a theme is an explicit choice: it applies right away and stops following the system.
      selectTheme: (id) => {
        if (!findTheme(id)) return;
        set({ themeId: id, followSystem: false });
      },

      setFollowSystem: (follow) => {
        const state = get();
        const current = resolveTheme(state);
        if (follow) set({ followSystem: true, ...(current.scheme === "dark" ? { darkId: current.id } : { lightId: current.id }) });
        else set({ followSystem: false, themeId: current.id });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: ({ themeId, followSystem, lightId, darkId }) => ({ themeId, followSystem, lightId, darkId }),
    }
  )
);

/** The theme currently in effect, for components that need to display it. */
export const useActiveTheme = (): Theme => useThemeStore(resolveTheme);

const syncDocument = () => applyTheme(resolveTheme(useThemeStore.getState()));

useThemeStore.subscribe(syncDocument);
window
  .matchMedia(DARK_QUERY)
  .addEventListener("change", (event) => useThemeStore.setState({ systemDark: event.matches }));
syncDocument();

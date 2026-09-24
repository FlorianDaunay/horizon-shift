import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, type GameSettings, type GameStats } from "../game";

interface SettingsState {
  settings: GameSettings;
  update: (patch: Partial<GameSettings>) => void;
  reset: () => void;
}

/** Player options, persisted in the browser. The game receives them through `Game.applySettings`. */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      update: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
      reset: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: "horizon-shift-settings",
      version: 1,
      // Options added in later versions fall back to their defaults instead of being undefined.
      merge: (persisted, current) => ({
        ...current,
        settings: { ...DEFAULT_SETTINGS, ...(persisted as Partial<SettingsState> | undefined)?.settings },
      }),
    }
  )
);

interface RuntimeState {
  stats: GameStats | null;
  locked: boolean;
  /** True once the player has entered the world at least once (the menu then says "Resume"). */
  started: boolean;
  /** The latest short message, shown briefly by the HUD. */
  toast: { id: number; text: string } | null;
  /** Set when the game could not start (e.g. WebGL unavailable). */
  error: string | null;
}

/** Live game state pushed by the game; never persisted. */
export const useRuntime = create<RuntimeState>(() => ({ stats: null, locked: false, started: false, toast: null, error: null }));

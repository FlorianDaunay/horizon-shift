import { DEFAULT_SEED } from "./config";
import type { QualityLevel } from "./performance/quality";

export type QualityMode = "auto" | QualityLevel;

/** Player-facing options. Plain data: the UI stores and edits it, the game just applies it. */
export interface GameSettings {
  /** `auto` adapts the level to the frame rate; the others pin it. */
  quality: QualityMode;
  /** Multiplier for camera turning (mouse and, later, sticks). */
  lookSensitivity: number;
  invertY: boolean;
  fov: number;
  /** Real minutes for a full day; 0 freezes the time of day. */
  dayLengthMinutes: number;
  /** 0..1 */
  musicVolume: number;
  /** 0..1: footsteps and other effects. */
  sfxVolume: number;
  showDebug: boolean;
  seed: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  quality: "auto",
  lookSensitivity: 1,
  invertY: false,
  fov: 70,
  dayLengthMinutes: 12,
  musicVolume: 0.45,
  sfxVolume: 0.6,
  showDebug: false,
  seed: DEFAULT_SEED,
};

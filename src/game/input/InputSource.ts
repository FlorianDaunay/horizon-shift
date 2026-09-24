import type { InputSample } from "./actions";

/**
 * A device that turns raw events into game actions (keyboard + mouse today; a gamepad or touch
 * controls tomorrow). Sources are independent and can be active at the same time.
 */
export interface InputSource {
  readonly id: string;
  /**
   * Called once per frame. Adds this device's contribution to `sample`:
   * `sample.axes.x += value`, `sample.buttons.x ||= held`. Never overwrite what other sources wrote.
   * Per-frame deltas (like `lookX`) must already be scaled by `dt` where they come from a held input.
   */
  poll(dt: number, sample: InputSample): void;
  /** Drops any held state (window lost focus, pointer lock released). */
  reset(): void;
  dispose(): void;
}

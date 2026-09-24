import {
  AXIS_ACTIONS,
  BUTTON_ACTIONS,
  createFrame,
  createSample,
  resetSample,
  type InputFrame,
  type InputSample,
} from "./actions";
import type { InputSource } from "./InputSource";

export interface InputPreferences {
  /** Multiplier for `lookX` / `lookY`. */
  lookSensitivity: number;
  invertY: boolean;
}

/** Axes that are clamped to [-1, 1]; the others (look, zoom) are deltas and just add up. */
const UNIT_AXES = new Set(["moveX", "moveY"]);

/**
 * Merges every registered `InputSource` into one `InputFrame` per tick and applies the player's
 * preferences (sensitivity, inverted Y). The frame is reused: do not keep references to its values.
 */
export class InputManager {
  readonly frame: InputFrame = createFrame();
  preferences: InputPreferences = { lookSensitivity: 1, invertY: false };

  private readonly sources: InputSource[] = [];
  private readonly sample: InputSample = createSample();
  private readonly previous: Record<string, boolean> = {};

  register(source: InputSource): this {
    this.sources.push(source);
    return this;
  }

  /** Polls all sources and rebuilds `frame`. Call exactly once per frame, before gameplay. */
  update(dt: number): InputFrame {
    resetSample(this.sample);
    for (const source of this.sources) source.poll(dt, this.sample);

    const { axes, buttons } = this.frame;
    for (const axis of AXIS_ACTIONS) {
      const value = this.sample.axes[axis];
      axes[axis] = UNIT_AXES.has(axis) ? Math.max(-1, Math.min(1, value)) : value;
    }
    axes.lookX *= this.preferences.lookSensitivity;
    axes.lookY *= this.preferences.lookSensitivity * (this.preferences.invertY ? -1 : 1);

    for (const button of BUTTON_ACTIONS) {
      const down = this.sample.buttons[button];
      const was = this.previous[button] ?? false;
      buttons[button].down = down;
      buttons[button].pressed = down && !was;
      buttons[button].released = !down && was;
      this.previous[button] = down;
    }
    return this.frame;
  }

  /** Forgets everything held, e.g. while the game is paused. */
  reset(): void {
    for (const source of this.sources) source.reset();
  }

  dispose(): void {
    for (const source of this.sources) source.dispose();
    this.sources.length = 0;
  }
}

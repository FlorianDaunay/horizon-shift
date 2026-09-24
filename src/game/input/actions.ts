/**
 * The vocabulary between input devices and gameplay. Gameplay code only ever reads these
 * actions; it never sees a key, a mouse or a gamepad. To support a new device, write an
 * `InputSource` that fills an `InputSample` and register it with the `InputManager`.
 */

/** Continuous actions. Ranges are documented per action; every source must respect them. */
export const AXIS_ACTIONS = [
  /** Strafe: -1 (left) .. 1 (right). */
  "moveX",
  /** Walk: -1 (backward) .. 1 (forward). */
  "moveY",
  /** Camera turn this frame, in radians at default sensitivity. Positive turns the view right. */
  "lookX",
  /** Camera tilt this frame, in radians at default sensitivity. Positive tilts the view up. */
  "lookY",
  /** Camera distance change this frame, in "notches". Positive moves the camera further away. */
  "zoom",
] as const;

/** On/off actions. */
export const BUTTON_ACTIONS = ["jump", "sprint", "resetCamera", "toggleMute", "interact", "dive"] as const;

export type AxisAction = (typeof AXIS_ACTIONS)[number];
export type ButtonAction = (typeof BUTTON_ACTIONS)[number];

/** What one source reports for one frame. Sources add to it; the manager merges all sources. */
export interface InputSample {
  axes: Record<AxisAction, number>;
  buttons: Record<ButtonAction, boolean>;
}

export interface ButtonState {
  /** Currently held. */
  down: boolean;
  /** Went down this frame. */
  pressed: boolean;
  /** Went up this frame. */
  released: boolean;
}

/** The merged, per-frame input that gameplay reads. */
export interface InputFrame {
  axes: Record<AxisAction, number>;
  buttons: Record<ButtonAction, ButtonState>;
}

const record = <K extends string, V>(keys: readonly K[], value: () => V) =>
  Object.fromEntries(keys.map((k) => [k, value()])) as Record<K, V>;

export const createSample = (): InputSample => ({
  axes: record(AXIS_ACTIONS, () => 0),
  buttons: record(BUTTON_ACTIONS, () => false),
});

export const createFrame = (): InputFrame => ({
  axes: record(AXIS_ACTIONS, () => 0),
  buttons: record(BUTTON_ACTIONS, () => ({ down: false, pressed: false, released: false })),
});

export const resetSample = (sample: InputSample): void => {
  for (const a of AXIS_ACTIONS) sample.axes[a] = 0;
  for (const b of BUTTON_ACTIONS) sample.buttons[b] = false;
};

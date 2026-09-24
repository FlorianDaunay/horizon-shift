import type { AxisAction, ButtonAction } from "./actions";

/** Two sets of keys that push an axis towards +1 and -1. */
export interface AxisBinding {
  positive: readonly string[];
  negative: readonly string[];
}

export interface KeyBindings {
  axes: Partial<Record<AxisAction, AxisBinding>>;
  buttons: Partial<Record<ButtonAction, readonly string[]>>;
}

/**
 * Default keyboard layout, written with `KeyboardEvent.code` (physical key positions), so
 * "WASD" is the same block of keys on QWERTY, AZERTY (ZQSD) and QWERTZ keyboards.
 * Rebinding = building another `KeyBindings` object; nothing else needs to change.
 */
export const defaultKeyBindings: KeyBindings = {
  axes: {
    moveY: { positive: ["KeyW"], negative: ["KeyS"] },
    moveX: { positive: ["KeyD"], negative: ["KeyA"] },
    lookX: { positive: ["ArrowRight"], negative: ["ArrowLeft"] },
    lookY: { positive: ["ArrowUp"], negative: ["ArrowDown"] },
    zoom: { positive: ["Minus", "NumpadSubtract"], negative: ["Equal", "NumpadAdd"] },
  },
  buttons: {
    jump: ["Space"],
    sprint: ["ShiftLeft", "ShiftRight"],
    resetCamera: ["KeyR"],
    toggleMute: ["KeyM"],
    interact: ["KeyE"],
    dive: ["KeyC"],
  },
};

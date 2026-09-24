import type { InputSample } from "./actions";
import { defaultKeyBindings, type KeyBindings } from "./bindings";
import type { InputSource } from "./InputSource";
import type { PointerLock } from "./PointerLock";

/** Radians of camera rotation per pixel of mouse movement, at sensitivity 1. */
const MOUSE_RADIANS_PER_PIXEL = 0.0022;
/** Camera rotation speed of the arrow keys (rad/s), at sensitivity 1. */
const KEY_LOOK_SPEED = 2.2;
/** Zoom notches per keyboard second, and per wheel "click" (~100 delta units). */
const KEY_ZOOM_SPEED = 4;
const WHEEL_NOTCH = 100;

/** Classic desktop controls: WASD to move, mouse (pointer-locked) to look, wheel to zoom. */
export class KeyboardMouseSource implements InputSource {
  readonly id = "keyboard-mouse";

  private readonly down = new Set<string>();
  /** Keys pressed since the last poll, even if already released: a quick tap on a slow frame is not lost. */
  private readonly tapped = new Set<string>();
  private readonly stopLock: () => void;
  private mouseX = 0;
  private mouseY = 0;
  private wheel = 0;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat) return;
    // Only game keys are captured, and only while playing, so the UI keeps normal keyboard behaviour.
    if (!this.pointerLock.locked) return;
    this.down.add(event.code);
    this.tapped.add(event.code);
    if (this.isBound(event.code)) event.preventDefault();
  };
  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.down.delete(event.code);
  };
  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.pointerLock.locked) return;
    this.mouseX += event.movementX;
    this.mouseY += event.movementY;
  };
  private readonly onWheel = (event: WheelEvent) => {
    if (!this.pointerLock.locked) return;
    this.wheel += event.deltaY;
    event.preventDefault();
  };
  private readonly onBlur = () => this.reset();

  constructor(
    private readonly pointerLock: PointerLock,
    private readonly bindings: KeyBindings = defaultKeyBindings
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("blur", this.onBlur);
    this.stopLock = pointerLock.onChange((locked) => locked || this.reset());
  }

  poll(dt: number, sample: InputSample): void {
    const { axes, buttons } = sample;
    const held = (codes: readonly string[]) => codes.some((code) => this.down.has(code));
    const pressedOrTapped = (codes: readonly string[]) => codes.some((code) => this.down.has(code) || this.tapped.has(code));

    for (const [axis, binding] of Object.entries(this.bindings.axes)) {
      const value = (held(binding.positive) ? 1 : 0) - (held(binding.negative) ? 1 : 0);
      const scale = axis === "lookX" || axis === "lookY" ? KEY_LOOK_SPEED * dt : axis === "zoom" ? KEY_ZOOM_SPEED * dt : 1;
      axes[axis as keyof typeof axes] += value * scale;
    }
    for (const [button, codes] of Object.entries(this.bindings.buttons)) {
      if (pressedOrTapped(codes)) buttons[button as keyof typeof buttons] = true;
    }
    this.tapped.clear();

    axes.lookX += this.mouseX * MOUSE_RADIANS_PER_PIXEL;
    axes.lookY -= this.mouseY * MOUSE_RADIANS_PER_PIXEL; // mouse up = look up
    axes.zoom += this.wheel / WHEEL_NOTCH;
    this.mouseX = this.mouseY = this.wheel = 0;
  }

  reset(): void {
    this.down.clear();
    this.tapped.clear();
    this.mouseX = this.mouseY = this.wheel = 0;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("blur", this.onBlur);
    this.stopLock();
  }

  private isBound(code: string): boolean {
    for (const b of Object.values(this.bindings.axes)) if (b.positive.includes(code) || b.negative.includes(code)) return true;
    for (const codes of Object.values(this.bindings.buttons)) if (codes.includes(code)) return true;
    return false;
  }
}

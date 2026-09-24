import { describe, expect, it } from "vitest";
import type { InputSample } from "../src/game/input/actions";
import type { InputSource } from "../src/game/input/InputSource";
import { InputManager } from "../src/game/input/InputManager";

/** A scriptable device, standing in for a keyboard, a gamepad, touch controls... */
class FakeSource implements InputSource {
  readonly id = "fake";
  constructor(private readonly write: (dt: number, sample: InputSample) => void) {}
  poll(dt: number, sample: InputSample) {
    this.write(dt, sample);
  }
  reset() {}
  dispose() {}
}

describe("InputManager", () => {
  it("merges several sources and clamps movement to the unit range", () => {
    const manager = new InputManager()
      .register(new FakeSource((_, s) => (s.axes.moveY += 0.8)))
      .register(new FakeSource((_, s) => (s.axes.moveY += 0.8)));
    expect(manager.update(0.016).axes.moveY).toBe(1);
  });

  it("does not clamp camera deltas, which add up across devices", () => {
    const manager = new InputManager()
      .register(new FakeSource((_, s) => (s.axes.lookX += 0.4)))
      .register(new FakeSource((_, s) => (s.axes.lookX += 0.3)));
    expect(manager.update(0.016).axes.lookX).toBeCloseTo(0.7);
  });

  it("reports pressed on the first frame only, and released when let go", () => {
    let held = false;
    const manager = new InputManager().register(new FakeSource((_, s) => (s.buttons.jump ||= held)));

    held = true;
    expect(manager.update(0.016).buttons.jump).toEqual({ down: true, pressed: true, released: false });
    expect(manager.update(0.016).buttons.jump).toEqual({ down: true, pressed: false, released: false });
    held = false;
    expect(manager.update(0.016).buttons.jump).toEqual({ down: false, pressed: false, released: true });
    expect(manager.update(0.016).buttons.jump).toEqual({ down: false, pressed: false, released: false });
  });

  it("treats a button as held while any one source holds it", () => {
    const manager = new InputManager()
      .register(new FakeSource((_, s) => (s.buttons.sprint ||= true)))
      .register(new FakeSource((_, s) => (s.buttons.sprint ||= false)));
    expect(manager.update(0.016).buttons.sprint.down).toBe(true);
  });

  it("applies sensitivity to both look axes and inversion to the vertical one", () => {
    const manager = new InputManager().register(
      new FakeSource((_, s) => {
        s.axes.lookX += 0.1;
        s.axes.lookY += 0.1;
      })
    );
    manager.preferences = { lookSensitivity: 2, invertY: true };
    const { axes } = manager.update(0.016);
    expect(axes.lookX).toBeCloseTo(0.2);
    expect(axes.lookY).toBeCloseTo(-0.2);
  });

  it("starts every frame from zero (sources never see stale values)", () => {
    let value = 1;
    const manager = new InputManager().register(new FakeSource((_, s) => (s.axes.moveX += value)));
    expect(manager.update(0.016).axes.moveX).toBe(1);
    value = 0;
    expect(manager.update(0.016).axes.moveX).toBe(0);
  });
});

import { Color, PointLight, type Scene, type Vector3 } from "three";
import { EMITTER_FIRE, EMITTER_LANTERN, EMITTER_MAGIC } from "../world/generation/collision";

/** The part of the world a `LightPool` reads its light spots from. */
export interface EmitterSource {
  nearestEmitters(x: number, y: number, z: number, range: number, out: Float32Array): number;
}

const COLORS: Record<number, Color> = {
  [EMITTER_FIRE]: new Color(0xff8a3a),
  [EMITTER_MAGIC]: new Color(0x5fe8ff),
  [EMITTER_LANTERN]: new Color(0xffc46a),
};
const STRENGTH: Record<number, number> = { [EMITTER_FIRE]: 7, [EMITTER_MAGIC]: 5, [EMITTER_LANTERN]: 6 };
const RANGE = 55;

/**
 * A handful of real point lights that always sit on the nearest torches, campfires, lanterns and
 * crystals. Hundreds of light sources exist in the world, but the renderer only ever pays for
 * `count` lights: the pool hops between them, fading as it goes.
 */
export class LightPool {
  private readonly lights: PointLight[] = [];
  private readonly found: Float32Array;
  private time = 0;

  constructor(private readonly scene: Scene, private readonly source: EmitterSource, count = 2) {
    this.found = new Float32Array(count * 5);
    for (let i = 0; i < count; i++) {
      const light = new PointLight(0xffffff, 0, 22, 1.5);
      this.lights.push(light);
      scene.add(light);
    }
  }

  /** `night` is 0 by day and 1 in the dark; lamps are still faintly lit by day. */
  update(dt: number, focus: Vector3, night: number): void {
    this.time += dt;
    const count = this.source.nearestEmitters(focus.x, focus.y, focus.z, RANGE, this.found);
    const level = 0.12 + night * 0.88;
    for (let i = 0; i < this.lights.length; i++) {
      const light = this.lights[i];
      let target = 0;
      if (i < count) {
        const o = i * 5;
        const type = this.found[o + 3];
        const flicker = type === EMITTER_FIRE ? 1 + Math.sin(this.time * 13 + o) * 0.08 + Math.sin(this.time * 31 + o * 2) * 0.06 : 1;
        target = (STRENGTH[type] ?? 5) * level * flicker;
        if (light.intensity < 0.05) light.position.set(this.found[o], this.found[o + 1], this.found[o + 2]);
        else {
          const k = Math.min(1, dt * 6);
          light.position.x += (this.found[o] - light.position.x) * k;
          light.position.y += (this.found[o + 1] - light.position.y) * k;
          light.position.z += (this.found[o + 2] - light.position.z) * k;
        }
        light.color.copy(COLORS[type] ?? COLORS[EMITTER_FIRE]);
      }
      light.intensity += (target - light.intensity) * Math.min(1, dt * 5);
    }
  }

  dispose(): void {
    for (const light of this.lights) this.scene.remove(light);
  }
}

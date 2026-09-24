import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Object3D, type Scene, type Vector3 } from "three";
import { WATER_LEVEL } from "../config";
import { createFishModel } from "./instances/models";

interface School {
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  phase: number;
  size: number;
  /** Which way this fish turns away from the shore. */
  turn: number;
  alive: boolean;
}

const COLORS: [number, number, number][] = [
  [1.0, 0.55, 0.2],
  [0.35, 0.75, 0.95],
  [1.0, 0.85, 0.35],
  [0.75, 0.55, 0.95],
];

/** Fish live at least this far below the surface... */
const MIN_DEPTH = 1.6;
/** ...and within this range of the player; farther ones are moved to another lake spot. */
const RANGE = 46;

/**
 * A handful of fish that swim in the deep water around the player, turn away from the shore and flee
 * from a swimmer. They are one pooled `InstancedMesh`, moved on the CPU (a few dozen matrices).
 */
export class Fish {
  private readonly mesh: InstancedMesh;
  private readonly fish: School[] = [];
  private readonly dummy = new Object3D();
  private nextRespawn = 0;

  constructor(
    private readonly scene: Scene,
    private readonly heightAt: (x: number, z: number) => number,
    count = 36
  ) {
    const model = createFishModel();
    this.mesh = new InstancedMesh(model.geometry, model.material, count);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      const c = COLORS[i % COLORS.length];
      this.mesh.setColorAt(i, new Color(c[0], c[1], c[2]));
      this.fish.push({ x: 0, y: 0, z: 0, heading: Math.random() * 6.28, speed: 1.1 + Math.random() * 1.1, phase: Math.random() * 6.28, size: 0.7 + Math.random() * 0.7, turn: Math.random() < 0.5 ? -1 : 1, alive: false });
    }
    scene.add(this.mesh);
  }

  update(dt: number, time: number, focus: Vector3, swimmer: boolean): void {
    // Idle fish look for a new spot in deep water, a few per frame.
    let attempts = 4;
    for (let n = 0; n < this.fish.length && attempts > 0; n++) {
      const fish = this.fish[(this.nextRespawn + n) % this.fish.length];
      if (fish.alive) continue;
      attempts--;
      const angle = Math.random() * Math.PI * 2;
      const distance = 6 + Math.random() * (RANGE - 12);
      const x = focus.x + Math.cos(angle) * distance;
      const z = focus.z + Math.sin(angle) * distance;
      const depth = WATER_LEVEL - this.heightAt(x, z);
      if (depth >= MIN_DEPTH + 0.6) {
        Object.assign(fish, { x, z, y: WATER_LEVEL - 0.8 - Math.random() * Math.min(depth - 1, 3), alive: true });
      }
    }
    this.nextRespawn = (this.nextRespawn + 1) % this.fish.length;

    for (let i = 0; i < this.fish.length; i++) {
      const fish = this.fish[i];
      this.dummy.position.set(0, -1000, 0);
      this.dummy.scale.setScalar(0);
      if (fish.alive) {
        this.move(fish, dt, time, focus, swimmer);
        if (fish.alive) {
          this.dummy.position.set(fish.x, fish.y, fish.z);
          this.dummy.rotation.set(0, Math.PI / 2 - fish.heading, 0); // the model looks along +Z
          this.dummy.scale.setScalar(fish.size);
        }
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private move(fish: School, dt: number, time: number, focus: Vector3, swimmer: boolean): void {
    if (Math.hypot(fish.x - focus.x, fish.z - focus.z) > RANGE) {
      fish.alive = false;
      return;
    }
    let speed = fish.speed;
    // Flee from a nearby swimmer.
    const dx = fish.x - focus.x;
    const dz = fish.z - focus.z;
    if (swimmer && dx * dx + dz * dz < 25) {
      const away = Math.atan2(dz, dx);
      fish.heading += Math.atan2(Math.sin(away - fish.heading), Math.cos(away - fish.heading)) * Math.min(1, dt * 5);
      speed *= 2.4;
    }
    fish.heading += Math.sin(time * 0.6 + fish.phase) * 0.5 * dt;

    // Look ahead: turn away from anything shallow.
    const ahead = 3 + speed;
    const depthAhead = WATER_LEVEL - this.heightAt(fish.x + Math.cos(fish.heading) * ahead, fish.z + Math.sin(fish.heading) * ahead);
    if (depthAhead < MIN_DEPTH) fish.heading += fish.turn * 3.2 * dt;

    fish.x += Math.cos(fish.heading) * speed * dt;
    fish.z += Math.sin(fish.heading) * speed * dt;
    const floor = this.heightAt(fish.x, fish.z);
    if (WATER_LEVEL - floor < MIN_DEPTH - 0.4) {
      fish.alive = false; // beached: try somewhere else
      return;
    }
    const target = Math.min(WATER_LEVEL - 0.6, Math.max(floor + 0.5, WATER_LEVEL - 1.2 - Math.sin(time * 0.4 + fish.phase) * 1.2));
    fish.y += (target - fish.y) * Math.min(1, dt * 1.5);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as { dispose(): void }).dispose();
    this.mesh.dispose();
  }
}

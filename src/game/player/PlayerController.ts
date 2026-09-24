import { Vector3 } from "three";
import { WATER_LEVEL } from "../config";
import type { InputFrame } from "../input/actions";

/** Anything that can tell how high the ground is. */
export interface Ground {
  heightAt(x: number, z: number): number;
}

/** What the player walks on and bumps into: terrain plus solid objects (trees, rocks, structures). */
export interface Walkable extends Ground {
  /** Highest standable object surface under (x, z) reachable from `feetY`, or -Infinity. */
  supportAt(x: number, z: number, feetY: number): number;
  /** Pushes a vertical cylinder out of every solid it overlaps. */
  resolveObstacles(position: Vector3, radius: number, height: number): void;
}

export const PLAYER_RADIUS = 0.35;
export const PLAYER_HEIGHT = 1.7;
/** Height of the eyes / top of the head above the feet. */
export const HEAD_HEIGHT = 1.55;
/** Feet height when floating at the surface with the head above water. */
export const SURFACE_LEVEL = WATER_LEVEL - 1.25;

const WALK_SPEED = 5;
const SPRINT_SPEED = 9.5;
const WADE_FACTOR = 0.55;
const SWIM_SPEED = 3.4;
const SWIM_SPRINT_SPEED = 5.8;
const SWIM_VERTICAL = 3.4;
/** Feet this deep under the surface and the player swims instead of wading. */
const SWIM_ENTER_DEPTH = 1.05;
/** Seconds of air while the head is under water. */
const AIR_SECONDS = 30;
const JUMP_SPEED = 9.4;
const GRAVITY = 24;
const GROUND_ACCEL = 12;
const AIR_ACCEL = 3.5;
const GLIDE_ACCEL = 6;
/** Fall speed while gliding (m/s). */
const GLIDE_FALL = 1.7;
/** Steepest climb per meter travelled (~52 degrees) before the terrain acts as a wall. */
const MAX_CLIMB_PER_METER = 1.3;
/** Small ledges the player steps over regardless of slope. */
const STEP_HEIGHT = 0.25;
/** How far above the ground the feet may be and still be pulled down (walking down slopes). */
const GROUND_SNAP = 0.4;
/** Distance walked between two footsteps, and swum between two strokes. */
const STRIDE_WALK = 1.35;
const STRIDE_SPRINT = 1.9;
const STRIDE_SWIM = 1.7;
/** Longest physics step; longer frames are split so nothing is tunnelled through. */
const MAX_SUBSTEP = 1 / 60;

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

const shortestAngle = (from: number, to: number) => {
  const d = (to - from) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
};

/** Things that happened during the last `update`, for sound and effects. Reset at the start of each update. */
export interface PlayerEvents {
  step: boolean;
  jump: boolean;
  /** Vertical speed (m/s, positive) of a landing this frame, or 0. */
  land: number;
  /** Speed (m/s) of entering the water this frame, or 0. */
  splash: number;
  /** A swimming stroke. */
  stroke: boolean;
}

/**
 * Movement on the procedural world: walking, jumping, gliding, swimming and diving. Movement is
 * relative to the camera's yaw, so "forward" always means "away from the camera". Reads only the
 * semantic `InputFrame`.
 */
export class PlayerController {
  /** Feet position. */
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  /** Direction the character faces (rotation around Y; the model looks along +Z at 0). */
  heading = 0;
  grounded = true;
  /** Sprinting is decided on the ground (and in the water) and kept through a jump. */
  sprinting = false;
  /** Wading: feet in water, but not deep enough to swim. */
  inWater = false;
  /** In deep water, floating or diving. */
  swimming = false;
  /** True while standing on an object (a stone, a rock, a plank) rather than on the terrain. */
  onObject = false;
  /** Slowing a fall with the shard-powered glide. */
  gliding = false;
  /** Set by the game: whether the player has the magic to glide. */
  canGlide = false;
  /** Seconds spent gliding since the game last collected it (it turns them into spent shards). */
  glideTime = 0;
  /** 1 = full lungs, 0 = out of air. */
  oxygen = 1;
  /** Out of air: the water lifts the player to the surface. */
  drowning = false;
  readonly events: PlayerEvents = { step: false, jump: false, land: 0, splash: 0, stroke: false };

  private stride = 0;
  /** While positive, swimming cannot start (just hopped out of the water). */
  private swimLock = 0;

  constructor(private readonly ground: Walkable) {}

  /** Horizontal speed in m/s. */
  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  /** The head is below the water surface. */
  get headUnderwater(): boolean {
    return this.position.y + HEAD_HEIGHT < WATER_LEVEL && this.ground.heightAt(this.position.x, this.position.z) < WATER_LEVEL;
  }

  spawn(x: number, z: number): void {
    this.position.set(x, this.ground.heightAt(x, z), z);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.sprinting = false;
    this.swimming = false;
    this.gliding = false;
    this.oxygen = 1;
    this.drowning = false;
  }

  update(dt: number, input: InputFrame, cameraYaw: number): void {
    this.events.step = false;
    this.events.jump = false;
    this.events.land = 0;
    this.events.splash = 0;
    this.events.stroke = false;

    const { moveX, moveY } = input.axes;
    const magnitude = Math.min(1, Math.hypot(moveX, moveY));
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    // Camera-relative directions: forward = (-sin, -cos), right = (cos, -sin).
    let dirX = -sin * moveY + cos * moveX;
    let dirZ = -cos * moveY - sin * moveX;
    const length = Math.hypot(dirX, dirZ);
    if (length > 0) {
      dirX /= length;
      dirZ /= length;
    }

    // Sprinting is decided on the ground (and in the water) and kept through a jump.
    if (this.grounded || this.swimming) this.sprinting = input.buttons.sprint.down && magnitude > 0.1;
    const speedLimit = this.swimming ? (this.sprinting ? SWIM_SPRINT_SPEED : SWIM_SPEED) : this.sprinting ? SPRINT_SPEED : WALK_SPEED;
    let targetSpeed = speedLimit * (this.grounded || this.swimming ? magnitude : Math.max(magnitude, this.sprinting ? 0.6 : 0));
    if (this.inWater && !this.swimming) targetSpeed *= WADE_FACTOR;

    if (input.buttons.jump.pressed && this.grounded && !this.swimming) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
      this.events.jump = true;
    }

    const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.step(h, dirX * targetSpeed, dirZ * targetSpeed, input, i === 0);
    }

    if (magnitude > 0.1) {
      const target = Math.atan2(dirX, dirZ);
      this.heading += shortestAngle(this.heading, target) * (1 - Math.exp(-(this.swimming ? 8 : 14) * dt));
    }
  }

  private step(dt: number, wantX: number, wantZ: number, input: InputFrame, first: boolean): void {
    this.swimLock = Math.max(0, this.swimLock - dt);
    const wasSwimming = this.swimming;
    const feetDepth = WATER_LEVEL - this.position.y;
    const overWater = this.ground.heightAt(this.position.x, this.position.z) < WATER_LEVEL - 0.05;
    this.swimming = this.swimLock === 0 && feetDepth > SWIM_ENTER_DEPTH && overWater;
    if (this.swimming && !wasSwimming) {
      this.events.splash = Math.max(1, -this.velocity.y);
      this.gliding = false;
      this.stride = 0;
    }

    const startX = this.position.x;
    const startZ = this.position.z;
    if (this.swimming) this.swimStep(dt, wantX, wantZ, input, first);
    else this.walkStep(dt, wantX, wantZ, input);

    const moved = Math.hypot(this.position.x - startX, this.position.z - startZ);
    if (this.swimming) {
      this.stride += moved;
      if (this.stride >= STRIDE_SWIM) {
        this.stride = 0;
        this.events.stroke = true;
      }
    } else if (this.grounded) {
      this.stride += moved;
      if (this.stride >= (this.sprinting ? STRIDE_SPRINT : STRIDE_WALK)) {
        this.stride = 0;
        this.events.step = true;
      }
    }
  }

  private walkStep(dt: number, wantX: number, wantZ: number, input: InputFrame): void {
    // Gliding: hold jump while falling and the magic lasts.
    this.gliding = !this.grounded && this.canGlide && input.buttons.jump.down && this.velocity.y < -1.2;
    if (this.gliding) this.glideTime += dt;

    const accel = this.grounded ? GROUND_ACCEL : this.gliding ? GLIDE_ACCEL : AIR_ACCEL;
    const blend = 1 - Math.exp(-accel * dt);
    this.velocity.x += (wantX - this.velocity.x) * blend;
    this.velocity.z += (wantZ - this.velocity.z) * blend;
    this.velocity.y -= GRAVITY * dt;
    if (this.gliding) this.velocity.y = Math.max(this.velocity.y, -GLIDE_FALL);

    this.oxygen = Math.min(1, this.oxygen + dt / 2.5);
    this.drowning = false;
    this.moveHorizontally(dt, false);
    this.ground.resolveObstacles(this.position, PLAYER_RADIUS, PLAYER_HEIGHT);
    this.moveVertically(dt);
  }

  private swimStep(dt: number, wantX: number, wantZ: number, input: InputFrame, first: boolean): void {
    this.grounded = false;
    this.gliding = false;
    this.onObject = false;
    this.inWater = true;
    const blend = 1 - Math.exp(-4 * dt);
    this.velocity.x += (wantX - this.velocity.x) * blend;
    this.velocity.z += (wantZ - this.velocity.z) * blend;

    // Air: the head under water costs it, the surface refills it. Out of air, the water lifts you up.
    if (this.headUnderwater) this.oxygen = Math.max(0, this.oxygen - dt / AIR_SECONDS);
    else this.oxygen = Math.min(1, this.oxygen + dt / 2.5);
    if (this.oxygen <= 0) this.drowning = true;
    else if (this.oxygen > 0.35) this.drowning = false;

    // Pressing jump at the surface hops out of the water (onto a shore, a dock, a boat).
    if (first && input.buttons.jump.pressed && this.position.y > SURFACE_LEVEL - 0.4 && !this.drowning) {
      this.velocity.y = JUMP_SPEED;
      this.swimLock = 0.45;
      this.swimming = false;
      this.grounded = false;
      this.events.jump = true;
      this.walkStep(dt, wantX, wantZ, input);
      return;
    }

    let wantY: number;
    if (this.drowning) wantY = 4.5;
    else if (input.buttons.jump.down) wantY = SWIM_VERTICAL;
    else if (input.buttons.dive.down) wantY = -SWIM_VERTICAL;
    else wantY = clamp((SURFACE_LEVEL - this.position.y) * 2.2, -1.2, 2.2); // float up to the surface
    this.velocity.y += (wantY - this.velocity.y) * (1 - Math.exp(-6 * dt));

    this.moveHorizontally(dt, true);
    this.ground.resolveObstacles(this.position, PLAYER_RADIUS, PLAYER_HEIGHT);

    this.position.y += this.velocity.y * dt;
    if (this.position.y > SURFACE_LEVEL + 0.12) {
      this.position.y = SURFACE_LEVEL + 0.12; // the head stays at the surface, it cannot fly out
      this.velocity.y = Math.min(this.velocity.y, 0);
    }
    const floor = this.standHeight(this.position.x, this.position.z);
    if (this.position.y < floor) {
      this.position.y = floor;
      this.velocity.y = Math.max(this.velocity.y, 0);
    }
  }

  /** Terrain or object surface the feet would rest on at (x, z). */
  private standHeight(x: number, z: number): number {
    return Math.max(this.ground.heightAt(x, z), this.ground.supportAt(x, z, this.position.y));
  }

  /** Swimmers can climb a bank of up to a meter per step; walkers follow the slope limit. */
  private canStandAt(x: number, z: number, stepDistance: number, swimming: boolean): boolean {
    const terrain = this.ground.heightAt(x, z);
    // Object tops are already limited to a reachable height by `supportAt`; only the terrain needs a slope limit.
    if (swimming) return terrain - this.position.y <= 1.0;
    return terrain - this.position.y <= Math.max(STEP_HEIGHT, stepDistance * MAX_CLIMB_PER_METER);
  }

  /** Moves along the velocity; a blocked axis is dropped so the player slides along walls and steep slopes. */
  private moveHorizontally(dt: number, swimming: boolean): void {
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    const { x, z } = this.position;
    const step = Math.hypot(dx, dz);
    if (step === 0) return;

    if (this.canStandAt(x + dx, z + dz, step, swimming)) {
      this.position.x += dx;
      this.position.z += dz;
      return;
    }
    if (dx !== 0 && this.canStandAt(x + dx, z, Math.abs(dx), swimming)) this.position.x += dx;
    else this.velocity.x = 0;
    if (dz !== 0 && this.canStandAt(this.position.x, z + dz, Math.abs(dz), swimming)) this.position.z += dz;
    else this.velocity.z = 0;
  }

  private moveVertically(dt: number): void {
    const wasGrounded = this.grounded;
    const fallSpeed = -this.velocity.y;
    this.position.y += this.velocity.y * dt;
    const terrain = this.ground.heightAt(this.position.x, this.position.z);
    const ground = this.standHeight(this.position.x, this.position.z);
    if (this.velocity.y <= 0 && this.position.y - ground <= (this.grounded ? GROUND_SNAP : 0)) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
      this.gliding = false;
      this.onObject = ground > terrain + 0.05;
      if (!wasGrounded && fallSpeed > 3) this.events.land = fallSpeed;
    } else {
      this.grounded = false;
      this.onObject = false;
    }
    this.inWater = terrain < WATER_LEVEL - 0.05 && this.position.y < WATER_LEVEL + 0.2 && !this.onObject;
  }
}

import { Vector3 } from "three";
import { MAX_WADE_DEPTH, WATER_LEVEL } from "../config";
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

const WALK_SPEED = 5;
const SPRINT_SPEED = 9.5;
const WADE_FACTOR = 0.55;
const JUMP_SPEED = 9.4;
const GRAVITY = 24;
const GROUND_ACCEL = 12;
const AIR_ACCEL = 3.5;
/** Steepest climb per meter travelled (~52 degrees) before the terrain acts as a wall. */
const MAX_CLIMB_PER_METER = 1.3;
/** Small ledges the player steps over regardless of slope. */
const STEP_HEIGHT = 0.25;
/** How far above the ground the feet may be and still be pulled down (walking down slopes). */
const GROUND_SNAP = 0.4;
/** Distance walked between two footsteps. */
const STRIDE_WALK = 1.35;
const STRIDE_SPRINT = 1.9;
/** Longest physics step; longer frames are split so nothing is tunnelled through. */
const MAX_SUBSTEP = 1 / 60;

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
}

/**
 * Walking physics on the procedural terrain. Movement is relative to the camera's yaw, so
 * "forward" always means "away from the camera". Reads only the semantic `InputFrame`.
 */
export class PlayerController {
  /** Feet position. */
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  /** Direction the character faces (rotation around Y; the model looks along +Z at 0). */
  heading = 0;
  grounded = true;
  /** Sprinting is decided on the ground and kept through a jump. */
  sprinting = false;
  inWater = false;
  /** True while standing on an object (a stone, a rock) rather than on the terrain. */
  onObject = false;
  readonly events: PlayerEvents = { step: false, jump: false, land: 0 };

  private stride = 0;

  constructor(private readonly ground: Walkable) {}

  /** Horizontal speed in m/s. */
  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  spawn(x: number, z: number): void {
    this.position.set(x, this.ground.heightAt(x, z), z);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
    this.sprinting = false;
  }

  update(dt: number, input: InputFrame, cameraYaw: number): void {
    this.events.step = false;
    this.events.jump = false;
    this.events.land = 0;

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

    // Decided on the ground, then kept until landing: a sprint jump stays a sprint jump.
    if (this.grounded) this.sprinting = input.buttons.sprint.down && magnitude > 0.1;
    let targetSpeed = (this.sprinting ? SPRINT_SPEED : WALK_SPEED) * (this.grounded ? magnitude : Math.max(magnitude, this.sprinting ? 0.6 : 0));
    if (this.inWater) targetSpeed *= WADE_FACTOR;

    if (input.buttons.jump.pressed && this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
      this.events.jump = true;
    }

    const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h, dirX * targetSpeed, dirZ * targetSpeed);

    if (magnitude > 0.1) {
      const target = Math.atan2(dirX, dirZ);
      this.heading += shortestAngle(this.heading, target) * (1 - Math.exp(-14 * dt));
    }
  }

  private step(dt: number, wantX: number, wantZ: number): void {
    const blend = 1 - Math.exp(-(this.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt);
    this.velocity.x += (wantX - this.velocity.x) * blend;
    this.velocity.z += (wantZ - this.velocity.z) * blend;
    this.velocity.y -= GRAVITY * dt;

    const startX = this.position.x;
    const startZ = this.position.z;
    this.moveHorizontally(dt);
    this.ground.resolveObstacles(this.position, PLAYER_RADIUS, PLAYER_HEIGHT);
    this.moveVertically(dt);

    if (this.grounded) {
      this.stride += Math.hypot(this.position.x - startX, this.position.z - startZ);
      if (this.stride >= (this.sprinting ? STRIDE_SPRINT : STRIDE_WALK)) {
        this.stride = 0;
        this.events.step = true;
      }
    }
  }

  /** Terrain or object surface the feet would rest on at (x, z). */
  private standHeight(x: number, z: number): number {
    return Math.max(this.ground.heightAt(x, z), this.ground.supportAt(x, z, this.position.y));
  }

  private canStandAt(x: number, z: number, stepDistance: number): boolean {
    const terrain = this.ground.heightAt(x, z);
    const support = this.ground.supportAt(x, z, this.position.y);
    if (support <= terrain && terrain < WATER_LEVEL - MAX_WADE_DEPTH) return false; // too deep to wade
    // Object tops are already limited to a reachable height by `supportAt`; only the terrain needs a slope limit.
    return terrain - this.position.y <= Math.max(STEP_HEIGHT, stepDistance * MAX_CLIMB_PER_METER);
  }

  /** Moves along the velocity; a blocked axis is dropped so the player slides along walls and steep slopes. */
  private moveHorizontally(dt: number): void {
    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    const { x, z } = this.position;
    const step = Math.hypot(dx, dz);
    if (step === 0) return;

    if (this.canStandAt(x + dx, z + dz, step)) {
      this.position.x += dx;
      this.position.z += dz;
      return;
    }
    if (dx !== 0 && this.canStandAt(x + dx, z, Math.abs(dx))) this.position.x += dx;
    else this.velocity.x = 0;
    if (dz !== 0 && this.canStandAt(this.position.x, z + dz, Math.abs(dz))) this.position.z += dz;
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
      this.onObject = ground > terrain + 0.05;
      if (!wasGrounded && fallSpeed > 3) this.events.land = fallSpeed;
    } else {
      this.grounded = false;
      this.onObject = false;
    }
    this.inWater = terrain < WATER_LEVEL - 0.05 && this.position.y < WATER_LEVEL + 0.2 && !this.onObject;
  }
}

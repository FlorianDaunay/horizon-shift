import { Vector3 } from "three";
import { MAX_WADE_DEPTH, WATER_LEVEL } from "../config";
import type { InputFrame } from "../input/actions";

/** Anything that can tell how high the ground is. */
export interface Ground {
  heightAt(x: number, z: number): number;
}

const WALK_SPEED = 5;
const SPRINT_SPEED = 9.5;
const WADE_FACTOR = 0.55;
const JUMP_SPEED = 7.5;
const GRAVITY = 24;
const GROUND_ACCEL = 12;
const AIR_ACCEL = 2.5;
/** Steepest climb per meter travelled (~52 degrees) before the terrain acts as a wall. */
const MAX_CLIMB_PER_METER = 1.3;
/** Small ledges the player steps over regardless of slope. */
const STEP_HEIGHT = 0.25;
/** How far above the ground the feet may be and still be pulled down (walking down slopes). */
const GROUND_SNAP = 0.4;

const shortestAngle = (from: number, to: number) => {
  const d = (to - from) % (Math.PI * 2);
  return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
};

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
  sprinting = false;
  inWater = false;

  constructor(private readonly ground: Ground) {}

  /** Horizontal speed in m/s. */
  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  spawn(x: number, z: number): void {
    this.position.set(x, this.ground.heightAt(x, z), z);
    this.velocity.set(0, 0, 0);
    this.grounded = true;
  }

  update(dt: number, input: InputFrame, cameraYaw: number): void {
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

    this.sprinting = input.buttons.sprint.down && magnitude > 0.1 && this.grounded;
    let targetSpeed = (this.sprinting ? SPRINT_SPEED : WALK_SPEED) * magnitude;
    if (this.inWater) targetSpeed *= WADE_FACTOR;

    const blend = 1 - Math.exp(-(this.grounded ? GROUND_ACCEL : AIR_ACCEL) * dt);
    this.velocity.x += (dirX * targetSpeed - this.velocity.x) * blend;
    this.velocity.z += (dirZ * targetSpeed - this.velocity.z) * blend;

    if (input.buttons.jump.pressed && this.grounded) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
    }
    this.velocity.y -= GRAVITY * dt;

    this.moveHorizontally(dt);
    this.moveVertically(dt);

    if (magnitude > 0.1) {
      const target = Math.atan2(dirX, dirZ);
      this.heading += shortestAngle(this.heading, target) * (1 - Math.exp(-14 * dt));
    }
  }

  private canStandAt(x: number, z: number, stepDistance: number): boolean {
    const height = this.ground.heightAt(x, z);
    if (height < WATER_LEVEL - MAX_WADE_DEPTH) return false; // too deep to wade
    return height - this.position.y <= Math.max(STEP_HEIGHT, stepDistance * MAX_CLIMB_PER_METER);
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
    this.position.y += this.velocity.y * dt;
    const ground = this.ground.heightAt(this.position.x, this.position.z);
    if (this.velocity.y <= 0 && this.position.y - ground <= (this.grounded ? GROUND_SNAP : 0)) {
      this.position.y = ground;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }
    this.inWater = ground < WATER_LEVEL - 0.05 && this.position.y < WATER_LEVEL + 0.2;
  }
}

import { PerspectiveCamera, Vector3 } from "three";
import type { InputFrame } from "../input/actions";
import type { Ground } from "./PlayerController";

const MIN_DISTANCE = 2.2;
const MAX_DISTANCE = 16;
const MIN_PITCH = -0.3;
const MAX_PITCH = 1.35;
/** Height above the feet that the camera orbits around (roughly the shoulders). */
const FOCUS_HEIGHT = 1.55;
/** Keep this far above the terrain. */
const GROUND_CLEARANCE = 0.45;
const COLLISION_STEPS = 24;

/**
 * Orbit-follow camera behind the character. Look input rotates it around the player; the boom
 * shortens when the terrain would get between the camera and the player, and never dips underground.
 */
export class ThirdPersonCamera {
  /** Rotation around Y: 0 puts the camera south of the player, looking north (-Z). */
  yaw = 0;
  /** Elevation above the horizon in radians. */
  pitch = 0.35;
  baseFov = 70;

  private desiredDistance = 6.5;
  private distance = 6.5;
  private readonly focus = new Vector3();
  private focusReady = false;
  private fovKick = 0;

  constructor(
    readonly camera: PerspectiveCamera,
    private readonly ground: Ground
  ) {}

  /** Snaps the camera behind a character that faces `heading`. */
  alignBehind(heading: number): void {
    this.yaw = heading + Math.PI;
    this.pitch = 0.35;
  }

  update(dt: number, input: InputFrame, feet: Vector3, sprinting: boolean): void {
    const { lookX, lookY, zoom } = input.axes;
    this.yaw -= lookX;
    this.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, this.pitch - lookY));
    this.desiredDistance = Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, this.desiredDistance + zoom * 0.9));

    // The focus follows exactly horizontally (no swimming feeling) but eases vertically (soft steps and jumps).
    const targetY = feet.y + FOCUS_HEIGHT;
    if (!this.focusReady) {
      this.focus.set(feet.x, targetY, feet.z);
      this.focusReady = true;
    } else {
      this.focus.x = feet.x;
      this.focus.z = feet.z;
      this.focus.y += (targetY - this.focus.y) * (1 - Math.exp(-9 * dt));
    }

    const cosPitch = Math.cos(this.pitch);
    const dirX = Math.sin(this.yaw) * cosPitch;
    const dirY = Math.sin(this.pitch);
    const dirZ = Math.cos(this.yaw) * cosPitch;

    const allowed = this.clearDistance(dirX, dirY, dirZ);
    // Pull in fast when blocked, drift back out gently once the view is clear again.
    const rate = allowed < this.distance ? 30 : 4;
    this.distance += (allowed - this.distance) * (1 - Math.exp(-rate * dt));

    const { camera } = this;
    camera.position.set(this.focus.x + dirX * this.distance, this.focus.y + dirY * this.distance, this.focus.z + dirZ * this.distance);
    const floor = this.ground.heightAt(camera.position.x, camera.position.z) + GROUND_CLEARANCE;
    if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(this.focus);

    this.fovKick += ((sprinting ? 7 : 0) - this.fovKick) * (1 - Math.exp(-6 * dt));
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /** Largest boom length (up to the desired one) that keeps the camera above the terrain. */
  private clearDistance(dirX: number, dirY: number, dirZ: number): number {
    let clear = this.desiredDistance;
    for (let i = 1; i <= COLLISION_STEPS; i++) {
      const t = (i / COLLISION_STEPS) * this.desiredDistance;
      const y = this.focus.y + dirY * t;
      const ground = this.ground.heightAt(this.focus.x + dirX * t, this.focus.z + dirZ * t);
      if (y < ground + GROUND_CLEARANCE) {
        clear = Math.max(0.6, ((i - 1) / COLLISION_STEPS) * this.desiredDistance);
        break;
      }
    }
    return clear;
  }
}

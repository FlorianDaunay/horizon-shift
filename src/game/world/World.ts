import { Mesh, MeshPhongMaterial, PlaneGeometry, type Scene, type Vector3 } from "three";
import { CHUNK_SIZE, DEFAULT_SEED, WATER_LEVEL } from "../config";
import type { QualityProfile } from "../performance/quality";
import { ChunkManager } from "./ChunkManager";
import type { BiomeId } from "./generation/biomes";
import { TerrainSampler } from "./generation/TerrainSampler";
import { windTime } from "./instances/models";

/** The streamed, procedural world: terrain, vegetation, points of interest and water. */
export class World {
  sampler: TerrainSampler;
  private readonly chunks: ChunkManager;
  private readonly water: Mesh;
  private time = 0;
  private profile: QualityProfile;

  constructor(private readonly scene: Scene, profile: QualityProfile, seed = DEFAULT_SEED) {
    this.profile = profile;
    this.sampler = new TerrainSampler(seed);
    this.chunks = new ChunkManager(scene, seed, profile);

    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.water = new Mesh(
      geometry,
      new MeshPhongMaterial({ color: 0x2f6f7d, specular: 0x9ec7d4, shininess: 90, transparent: true, opacity: 0.74, depthWrite: false })
    );
    this.water.receiveShadow = true;
    this.water.frustumCulled = false;
    this.water.renderOrder = 1;
    this.water.position.y = WATER_LEVEL;
    scene.add(this.water);
    this.resizeWater();
  }

  get seed(): number {
    return this.sampler.seed;
  }

  get streamingStats() {
    return this.chunks.stats;
  }

  /** Distance from the camera at which the world fades out entirely (meters). */
  get viewDistance(): number {
    return this.profile.viewRadius * CHUNK_SIZE;
  }

  heightAt(x: number, z: number): number {
    return this.sampler.heightAt(x, z);
  }

  biomeAt(x: number, z: number): BiomeId {
    return this.sampler.biomeAt(x, z);
  }

  nearestPoi(x: number, z: number) {
    return this.chunks.nearestPoi(x, z);
  }

  /** True when the terrain around the focus is loaded well enough to start playing. */
  isReady(): boolean {
    return this.chunks.isReady(2);
  }

  reseed(seed: number): void {
    this.sampler = new TerrainSampler(seed);
    this.chunks.reseed(seed);
  }

  applyQuality(profile: QualityProfile): void {
    this.profile = profile;
    this.chunks.configure(profile);
    this.resizeWater();
  }

  update(dt: number, focus: Vector3): void {
    this.time += dt;
    windTime.value = this.time;
    // Loading is prioritised until the surroundings exist, then throttled to protect frame time.
    this.chunks.update(focus.x, focus.z, this.isReady() ? 2.5 : 8);
    this.water.position.x = focus.x;
    this.water.position.z = focus.z;
  }

  private resizeWater(): void {
    const size = this.viewDistance * 2.4;
    this.water.scale.set(size, 1, size);
  }

  dispose(): void {
    this.chunks.dispose();
    this.scene.remove(this.water);
    this.water.geometry.dispose();
    (this.water.material as MeshPhongMaterial).dispose();
  }
}

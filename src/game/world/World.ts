import { MathUtils, Mesh, MeshPhongMaterial, PlaneGeometry, type Scene, type Vector3 } from "three";
import { CHUNK_SIZE, DEFAULT_SEED, WATER_LEVEL } from "../config";
import type { QualityProfile } from "../performance/quality";
import { ChunkManager } from "./ChunkManager";
import type { BiomeId } from "./generation/biomes";
import { TerrainSampler, type TerrainSample } from "./generation/TerrainSampler";
import { glowLevel, windTime } from "./instances/models";
import { surfaceAt, type Surface } from "./generation/surface";

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

  /** Standable object surface under (x, z) reachable from `feetY` (see `ChunkManager.supportAt`). */
  supportAt(x: number, z: number, feetY: number): number {
    return this.chunks.supportAt(x, z, feetY);
  }

  resolveObstacles(position: Vector3, radius: number, height: number): void {
    this.chunks.resolve(position, radius, height);
  }

  nearestEmitters(x: number, y: number, z: number, range: number, out: Float32Array): number {
    return this.chunks.nearestEmitters(x, y, z, range, out);
  }

  /** What the ground is made of at (x, z). */
  surfaceAt(x: number, z: number): Surface {
    return surfaceAt(this.sampler, x, z);
  }

  /** Biome weights and mountainousness at (x, z), written into `out`. */
  sampleTerrain(x: number, z: number, out: TerrainSample): TerrainSample {
    return this.sampler.sample(x, z, out);
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

  /** `daylight` (0 night .. 1 day) drives how brightly lamps, crystals and mushrooms glow. */
  update(dt: number, focus: Vector3, daylight: number): void {
    this.time += dt;
    windTime.value = this.time;
    glowLevel.value = MathUtils.lerp(1.5, 0.3, daylight);
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

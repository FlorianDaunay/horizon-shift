import { DoubleSide, MathUtils, Mesh, MeshPhongMaterial, PlaneGeometry, type Scene, type Vector3 } from "three";
import { CHUNK_SIZE, DEFAULT_SEED, WATER_LEVEL } from "../config";
import type { QualityProfile } from "../performance/quality";
import { ChunkManager, type InteractHit } from "./ChunkManager";
import type { BiomeId } from "./generation/biomes";
import { TerrainSampler, type TerrainSample } from "./generation/TerrainSampler";
import { glowLevel, windTime } from "./instances/models";
import { surfaceAt, type Surface } from "./generation/surface";

/**
 * The water surface: a translucent Phong material whose normals ripple, so the sun glints on it.
 * It is double-sided, so from below it is the shimmering ceiling of the underwater world.
 */
function createWaterMaterial(): MeshPhongMaterial {
  const material = new MeshPhongMaterial({
    color: 0x2f7f8d,
    specular: 0xbfe2ee,
    shininess: 110,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
    side: DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWaterXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaterXZ = (modelMatrix * vec4(position, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vWaterXZ;\nuniform float uTime;")
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
        vec2 w = vWaterXZ;
        vec3 ripple = vec3(
          sin(w.x * 0.9 + uTime * 1.3) + sin(w.y * 1.3 - uTime * 1.1) + sin((w.x + w.y) * 0.55 + uTime * 0.7),
          0.0,
          cos(w.y * 1.1 + uTime * 1.2) + cos(w.x * 0.7 - uTime * 0.9) + cos((w.x - w.y) * 0.6 - uTime * 0.8)
        ) * 0.035;
        normal = normalize(normal + (viewMatrix * vec4(ripple, 0.0)).xyz);`
      );
  };
  return material;
}

/** The streamed, procedural world: terrain, vegetation, points of interest and water. */
export class World {
  sampler: TerrainSampler;
  private readonly chunks: ChunkManager;
  private readonly water: Mesh;
  private time = 0;
  private profile: QualityProfile;
  /** Interactables already used (crystals taken, chests opened); kept by the game across sessions. */
  readonly taken = new Set<string>();

  constructor(private readonly scene: Scene, profile: QualityProfile, seed = DEFAULT_SEED) {
    this.profile = profile;
    this.sampler = new TerrainSampler(seed);
    this.chunks = new ChunkManager(scene, seed, profile, this.taken);

    const geometry = new PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    this.water = new Mesh(geometry, createWaterMaterial());
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

  nearestInteractable(x: number, y: number, z: number, range: number, out: InteractHit): boolean {
    return this.chunks.nearestInteractable(x, y, z, range, out);
  }

  take(hit: InteractHit): void {
    this.chunks.take(hit);
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

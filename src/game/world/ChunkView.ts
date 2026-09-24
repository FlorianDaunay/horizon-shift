import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
  Sphere,
  type Scene,
} from "three";
import { CHUNK_SIZE, LOD_RESOLUTIONS } from "../config";
import { ObjectPool } from "../core/ObjectPool";
import { chunkIndices, chunkVertexCount } from "./generation/chunkMesh";
import { COLLIDER_STRIDE, EMITTER_STRIDE, INTERACTIONS, INTERACT_STRIDE } from "./generation/collision";
import type { ChunkResult } from "./generation/generateChunk";
import type { Island } from "./generation/islands";
import type { Poi } from "./generation/poi";
import { INSTANCE_CAPACITY, INSTANCE_KINDS, type InstanceKind } from "./instances/kinds";
import { getModel } from "./instances/models";

const terrainMaterial = new MeshLambertMaterial({ vertexColors: true });

/** GPU objects of one chunk: a terrain mesh plus one instanced mesh per kind present. */
export class ChunkView {
  terrain: Mesh | null = null;
  readonly instanced: InstancedMesh[] = [];

  /** Collision circles and light spots in world coordinates (see `generation/collision.ts`). */
  colliders: Float32Array = new Float32Array(0);
  emitters: Float32Array = new Float32Array(0);
  /** Things to interact with, in world coordinates (see `generation/collision.ts`). */
  interactables: Float32Array = new Float32Array(0);
  poi: Poi | null = null;
  /** Used interactables to hide once the instanced meshes exist. */
  pendingHide: (readonly [number, number])[] = [];
  island: Island | null = null;

  constructor(
    readonly cx: number,
    readonly cz: number,
    public lod: number,
    public scatter: number
  ) {}
}

/**
 * Owns the pools of terrain meshes (one pool per LOD) and instanced meshes (one per kind) and
 * fills them from worker results, so streaming chunks in and out allocates no GPU objects.
 */
export class ChunkViewFactory {
  private readonly terrainPools = LOD_RESOLUTIONS.map((res) => {
    const index = new BufferAttribute(chunkIndices(res), 1);
    const vertices = chunkVertexCount(res);
    return new ObjectPool<Mesh>(
      () => {
        const geometry = new BufferGeometry();
        for (const name of ["position", "normal", "color"]) {
          const attribute = new BufferAttribute(new Float32Array(vertices * 3), 3);
          attribute.setUsage(DynamicDrawUsage);
          geometry.setAttribute(name, attribute);
        }
        geometry.setIndex(index);
        geometry.boundingSphere = new Sphere();
        const mesh = new Mesh(geometry, terrainMaterial);
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        return mesh;
      },
      (mesh) => mesh.removeFromParent()
    );
  });

  private readonly instancePools = new Map<InstanceKind, ObjectPool<InstancedMesh>>(
    INSTANCE_KINDS.map((kind) => [
      kind,
      new ObjectPool<InstancedMesh>(
        () => {
          const model = getModel(kind);
          const capacity = INSTANCE_CAPACITY[kind];
          const mesh = new InstancedMesh(model.geometry, model.material, capacity);
          mesh.instanceMatrix.setUsage(DynamicDrawUsage);
          mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
          mesh.boundingSphere = new Sphere();
          mesh.castShadow = model.castShadow;
          mesh.receiveShadow = true;
          mesh.matrixAutoUpdate = false;
          mesh.count = 0;
          return mesh;
        },
        (mesh) => {
          mesh.count = 0;
          mesh.removeFromParent();
        }
      ),
    ])
  );

  /**
   * `isTaken` tells whether an interactable (chunk, kind, instance) has already been used, so it stays
   * gone when the chunk is generated again.
   */
  constructor(
    private readonly scene: Scene,
    private readonly isTaken: (cx: number, cz: number, kindIndex: number, instance: number) => boolean = () => false
  ) {}

  /** Hides one instance (a collected crystal, an opened chest) and turns off its collision, light and prompt. */
  hide(view: ChunkView, kindIndex: number, instance: number): void {
    const kind = INSTANCE_KINDS[kindIndex];
    const mesh = view.instanced.find((m) => m.userData.kind === kind);
    if (mesh && instance < mesh.count) {
      const array = mesh.instanceMatrix.array as Float32Array;
      array[instance * 16] = array[instance * 16 + 5] = array[instance * 16 + 10] = 0; // scale to nothing
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(instance * 16, 16);
      mesh.instanceMatrix.needsUpdate = true;
    }
    const spots = view.interactables;
    for (let i = 0; i < spots.length; i += INTERACT_STRIDE) {
      if (spots[i + 4] !== kindIndex || spots[i + 5] !== instance) continue;
      const [x, y, z] = [spots[i], spots[i + 1], spots[i + 2]];
      spots[i + 3] = -1;
      for (let j = 0; j < view.emitters.length; j += EMITTER_STRIDE) {
        if (Math.abs(view.emitters[j] - x) < 0.01 && Math.abs(view.emitters[j + 1] - y) < 0.01 && Math.abs(view.emitters[j + 2] - z) < 0.01) view.emitters[j + 3] = -1;
      }
      for (let j = 0; j < view.colliders.length; j += COLLIDER_STRIDE) {
        if (Math.abs(view.colliders[j] - x) < 0.01 && Math.abs(view.colliders[j + 1] - z) < 0.01) view.colliders[j + 2] = 0;
      }
    }
  }

  /** Creates the view of a chunk from a worker result. */
  build(result: ChunkResult): ChunkView {
    const view = new ChunkView(result.cx, result.cz, result.lod, result.scatter);
    this.fill(view, result);
    return view;
  }

  /** Puts freshly generated data into `view`, replacing whatever it showed. */
  refill(view: ChunkView, result: ChunkResult): void {
    this.release(view);
    view.lod = result.lod;
    view.scatter = result.scatter;
    this.fill(view, result);
  }

  release(view: ChunkView): void {
    if (view.terrain) this.terrainPools[view.lod].release(view.terrain);
    view.terrain = null;
    for (const mesh of view.instanced) this.instancePools.get(mesh.userData.kind as InstanceKind)!.release(mesh);
    view.instanced.length = 0;
  }

  private fill(view: ChunkView, result: ChunkResult): void {
    const x = result.cx * CHUNK_SIZE;
    const z = result.cz * CHUNK_SIZE;
    // Culling volumes: the terrain, and (larger: trees, towers and floating islands reach high) its instances.
    const centerY = (result.minY + result.maxY) / 2;
    const radius = Math.hypot(CHUNK_SIZE / 2, CHUNK_SIZE / 2, (result.maxY - result.minY) / 2 + 2);
    const top = Math.max(result.maxY + 8, result.instanceMaxY);
    const instanceCenterY = (result.minY + top) / 2;
    const instanceRadius = Math.hypot(CHUNK_SIZE / 2, CHUNK_SIZE / 2, (top - result.minY) / 2);

    // Collision and light data arrive chunk-local; keep them in world coordinates.
    const { colliders, emitters, interactables } = result;
    for (let i = 0; i < interactables.length; i += INTERACT_STRIDE) {
      interactables[i] += x;
      interactables[i + 2] += z;
    }
    view.interactables = interactables;
    for (let i = 0; i < colliders.length; i += COLLIDER_STRIDE) {
      colliders[i] += x;
      colliders[i + 1] += z;
    }
    for (let i = 0; i < emitters.length; i += EMITTER_STRIDE) {
      emitters[i] += x;
      emitters[i + 2] += z;
    }
    view.colliders = colliders;
    view.emitters = emitters;
    view.pendingHide = [];
    view.poi = result.poi;
    view.island = result.island;

    const terrain = this.terrainPools[result.lod].acquire();
    const geometry = terrain.geometry;
    (geometry.getAttribute("position").array as Float32Array).set(result.positions);
    (geometry.getAttribute("normal").array as Float32Array).set(result.normals);
    (geometry.getAttribute("color").array as Float32Array).set(result.colors);
    for (const name of ["position", "normal", "color"]) geometry.getAttribute(name).needsUpdate = true;
    geometry.boundingSphere!.center.set(CHUNK_SIZE / 2, centerY, CHUNK_SIZE / 2);
    geometry.boundingSphere!.radius = radius;
    terrain.position.set(x, 0, z);
    terrain.updateMatrix();
    this.scene.add(terrain);
    view.terrain = terrain;

    for (const batch of result.batches) {
      const mesh = this.instancePools.get(batch.kind)!.acquire();
      mesh.userData.kind = batch.kind;
      (mesh.instanceMatrix.array as Float32Array).set(batch.matrices);
      (mesh.instanceColor!.array as Float32Array).set(batch.tints);
      for (const attribute of [mesh.instanceMatrix, mesh.instanceColor!]) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, batch.count * (attribute === mesh.instanceMatrix ? 16 : 3));
        attribute.needsUpdate = true;
      }
      mesh.count = batch.count;
      if (INTERACTIONS[batch.kind]) {
        const kindIndex = INSTANCE_KINDS.indexOf(batch.kind);
        view.pendingHide.push(...Array.from({ length: batch.count }, (_, i) => i).filter((i) => this.isTaken(result.cx, result.cz, kindIndex, i)).map((i) => [kindIndex, i] as const));
      }
      mesh.boundingSphere!.center.set(CHUNK_SIZE / 2, instanceCenterY, CHUNK_SIZE / 2);
      mesh.boundingSphere!.radius = instanceRadius;
      mesh.position.set(x, 0, z);
      mesh.updateMatrix();
      this.scene.add(mesh);
      view.instanced.push(mesh);
    }
    for (const [kindIndex, instance] of view.pendingHide) this.hide(view, kindIndex, instance);
    view.pendingHide = [];
  }

  /** Frees the GPU memory of every pooled object (used when the game shuts down). */
  dispose(): void {
    this.terrainPools.forEach((pool) => pool.clear((mesh) => mesh.geometry.dispose()));
    this.instancePools.forEach((pool) => pool.clear((mesh) => mesh.dispose()));
  }
}

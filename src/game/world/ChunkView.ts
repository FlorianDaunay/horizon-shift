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
import type { ChunkResult } from "./generation/generateChunk";
import type { Poi } from "./generation/poi";
import { INSTANCE_CAPACITY, INSTANCE_KINDS, type InstanceKind } from "./instances/kinds";
import { getModel } from "./instances/models";

const terrainMaterial = new MeshLambertMaterial({ vertexColors: true });

/** GPU objects of one chunk: a terrain mesh plus one instanced mesh per kind present. */
export class ChunkView {
  terrain: Mesh | null = null;
  readonly instanced: InstancedMesh[] = [];

  constructor(
    readonly cx: number,
    readonly cz: number,
    public lod: number,
    public scatter: number,
    public poi: Poi | null
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

  constructor(private readonly scene: Scene) {}

  /** Creates the view of a chunk from a worker result. */
  build(result: ChunkResult): ChunkView {
    const view = new ChunkView(result.cx, result.cz, result.lod, result.scatter, result.poi);
    this.fill(view, result);
    return view;
  }

  /** Puts freshly generated data into `view`, replacing whatever it showed. */
  refill(view: ChunkView, result: ChunkResult): void {
    this.release(view);
    view.lod = result.lod;
    view.scatter = result.scatter;
    view.poi = result.poi;
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
    const centerY = (result.minY + result.maxY) / 2;
    // Culling volume shared by the terrain and its instances (trees stick out above the surface).
    const radius = Math.hypot(CHUNK_SIZE / 2, CHUNK_SIZE / 2, (result.maxY - result.minY) / 2 + 8);

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
      mesh.boundingSphere!.center.set(CHUNK_SIZE / 2, centerY, CHUNK_SIZE / 2);
      mesh.boundingSphere!.radius = radius;
      mesh.position.set(x, 0, z);
      mesh.updateMatrix();
      this.scene.add(mesh);
      view.instanced.push(mesh);
    }
  }

  /** Frees the GPU memory of every pooled object (used when the game shuts down). */
  dispose(): void {
    this.terrainPools.forEach((pool) => pool.clear((mesh) => mesh.geometry.dispose()));
    this.instancePools.forEach((pool) => pool.clear((mesh) => mesh.dispose()));
  }
}

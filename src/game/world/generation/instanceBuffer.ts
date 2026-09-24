import { INSTANCE_CAPACITY, INSTANCE_KINDS, type InstanceKind } from "../instances/kinds";

/** Instance data of one kind for one chunk, ready to upload: 16 floats (matrix) + 3 floats (tint) per instance. */
export interface InstanceBatch {
  kind: InstanceKind;
  count: number;
  matrices: Float32Array;
  tints: Float32Array;
}

/** Collects instances per kind up to each kind's capacity. Positions are chunk-local. */
export class InstanceCollector {
  private readonly matrices = new Map<InstanceKind, Float32Array>();
  private readonly tints = new Map<InstanceKind, Float32Array>();
  private readonly counts = new Map<InstanceKind, number>();

  has(kind: InstanceKind): boolean {
    return (this.counts.get(kind) ?? 0) < INSTANCE_CAPACITY[kind];
  }

  /** Adds one instance: translation, yaw around Y, non-uniform scale and a color multiplier. */
  add(kind: InstanceKind, x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number, tint: readonly [number, number, number]): boolean {
    const count = this.counts.get(kind) ?? 0;
    if (count >= INSTANCE_CAPACITY[kind]) return false;
    let m = this.matrices.get(kind);
    let t = this.tints.get(kind);
    if (!m || !t) {
      m = new Float32Array(INSTANCE_CAPACITY[kind] * 16);
      t = new Float32Array(INSTANCE_CAPACITY[kind] * 3);
      this.matrices.set(kind, m);
      this.tints.set(kind, t);
    }
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const o = count * 16;
    // Column-major T * Ry * S.
    m[o] = c * sx;
    m[o + 1] = 0;
    m[o + 2] = -s * sx;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = sy;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = s * sz;
    m[o + 9] = 0;
    m[o + 10] = c * sz;
    m[o + 11] = 0;
    m[o + 12] = x;
    m[o + 13] = y;
    m[o + 14] = z;
    m[o + 15] = 1;
    t[count * 3] = tint[0];
    t[count * 3 + 1] = tint[1];
    t[count * 3 + 2] = tint[2];
    this.counts.set(kind, count + 1);
    return true;
  }

  finish(): InstanceBatch[] {
    const batches: InstanceBatch[] = [];
    for (const kind of INSTANCE_KINDS) {
      const count = this.counts.get(kind) ?? 0;
      if (count === 0) continue;
      batches.push({
        kind,
        count,
        matrices: this.matrices.get(kind)!.slice(0, count * 16),
        tints: this.tints.get(kind)!.slice(0, count * 3),
      });
    }
    return batches;
  }
}

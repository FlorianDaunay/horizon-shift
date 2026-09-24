import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Matrix4,
  SphereGeometry,
  Uniform,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { InstanceKind } from "./kinds";

/** Shared clock for foliage sway. */
export const windTime = new Uniform(0);

export interface InstanceModel {
  geometry: BufferGeometry;
  material: Material;
  castShadow: boolean;
}

interface Part {
  geometry: BufferGeometry;
  color: number;
  transform?: Matrix4;
}

/** Bakes a list of colored primitives into one flat-shaded geometry with vertex colors. */
function assemble(parts: Part[]): BufferGeometry {
  const geometries = parts.map(({ geometry, color, transform }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (transform) g.applyMatrix4(transform);
    g.deleteAttribute("uv");
    const count = g.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    const r = ((color >> 16) & 255) / 255;
    const gr = ((color >> 8) & 255) / 255;
    const b = (color & 255) / 255;
    // sRGB hex to linear
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    for (let i = 0; i < count; i++) colors.set([lin(r), lin(gr), lin(b)], i * 3);
    g.setAttribute("color", new BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());
  parts.forEach((p) => p.geometry.dispose());
  return merged;
}

/** Translation, then tilt around X and Z, then scale: a compact way to position a part of a model. */
function place(x: number, y: number, z: number, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1): Matrix4 {
  const m = new Matrix4().makeTranslation(x, y, z);
  if (rx) m.multiply(new Matrix4().makeRotationX(rx));
  if (rz) m.multiply(new Matrix4().makeRotationZ(rz));
  if (sx !== 1 || sy !== 1 || sz !== 1) m.multiply(new Matrix4().makeScale(sx, sy, sz));
  return m;
}

/** Deterministic jitter so rocks are lumpy rather than perfect icosahedra. */
function lumpy(geometry: BufferGeometry, amount: number): BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    const k = 1 + (n - Math.floor(n) - 0.5) * amount;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  geometry.dispose();
  return g;
}

function grassGeometry(): BufferGeometry {
  const blades = 7;
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < blades; i++) {
    const angle = (i / blades) * Math.PI * 2 + i * 0.7;
    const r = 0.05 + (i % 3) * 0.05;
    const cx = Math.cos(angle) * r;
    const cz = Math.sin(angle) * r;
    const height = 0.3 + ((i * 37) % 10) / 45;
    const tx = -Math.sin(angle) * 0.045;
    const tz = Math.cos(angle) * 0.045;
    positions.push(cx - tx, 0, cz - tz, cx + tx, 0, cz + tz, cx + Math.cos(angle) * 0.06, height, cz + Math.sin(angle) * 0.06);
    colors.push(0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.85, 0.85, 0.85);
    normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(normals), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
  return g;
}

/** Lambert material whose vertices sway in the wind, more the higher they are above the base. */
function windMaterial(sway: number, options: { doubleSided?: boolean } = {}): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: options.doubleSided ? DoubleSide : FrontSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 anchor = vec3(instanceMatrix[3]);
        #else
          vec3 anchor = vec3(0.0);
        #endif
        float phase = uTime * 1.7 + anchor.x * 0.37 + anchor.z * 0.29;
        float gust = sin(phase) + 0.5 * sin(phase * 2.3 + 1.3);
        transformed.x += gust * position.y * ${sway.toFixed(3)};
        transformed.z += cos(phase * 0.8) * position.y * ${(sway * 0.6).toFixed(3)};`
      );
  };
  return material;
}

const solid = () => new MeshLambertMaterial({ vertexColors: true, flatShading: true });

const BARK = 0x5b4131;
const factories: Record<InstanceKind, () => InstanceModel> = {
  pine: () => ({
    castShadow: true,
    material: windMaterial(0.006),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.22, 0.34, 2.2, 6), color: BARK, transform: place(0, 1.1, 0) },
      { geometry: new ConeGeometry(1.7, 2.6, 7), color: 0x2f5d3a, transform: place(0, 2.6, 0) },
      { geometry: new ConeGeometry(1.35, 2.4, 7), color: 0x37693f, transform: place(0, 4.1, 0) },
      { geometry: new ConeGeometry(0.95, 2.2, 7), color: 0x3f7745, transform: place(0, 5.5, 0) },
    ]),
  }),
  broadleaf: () => ({
    castShadow: true,
    material: windMaterial(0.005),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.25, 0.4, 2.6, 6), color: BARK, transform: place(0, 1.3, 0) },
      { geometry: new IcosahedronGeometry(1.9, 1), color: 0x4d8a37, transform: place(0, 3.7, 0, 0, 0, 1, 0.9, 1) },
      { geometry: new IcosahedronGeometry(1.3, 1), color: 0x5a9a3f, transform: place(0.9, 4.7, 0.4) },
      { geometry: new IcosahedronGeometry(1.1, 1), color: 0x43792f, transform: place(-0.9, 4.3, -0.6) },
    ]),
  }),
  deadTree: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.1, 0.28, 4, 5), color: 0x6d6153, transform: place(0, 2, 0) },
      { geometry: new CylinderGeometry(0.05, 0.11, 1.8, 4), color: 0x6d6153, transform: place(0.5, 3.1, 0, 0, -0.9) },
      { geometry: new CylinderGeometry(0.04, 0.09, 1.4, 4), color: 0x6d6153, transform: place(-0.4, 2.6, 0.1, 0.2, 0.8) },
    ]),
  }),
  cactus: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.32, 0.36, 3, 8), color: 0x4f8a4a, transform: place(0, 1.5, 0) },
      { geometry: new SphereGeometry(0.32, 8, 5), color: 0x4f8a4a, transform: place(0, 3, 0) },
      { geometry: new CylinderGeometry(0.17, 0.19, 1.1, 6), color: 0x4f8a4a, transform: place(0.65, 1.8, 0, 0, 0) },
      { geometry: new CylinderGeometry(0.17, 0.17, 0.75, 6), color: 0x4f8a4a, transform: place(0.45, 1.25, 0, 0, Math.PI / 2) },
      { geometry: new CylinderGeometry(0.15, 0.17, 0.9, 6), color: 0x4f8a4a, transform: place(-0.6, 2.2, 0) },
      { geometry: new CylinderGeometry(0.15, 0.15, 0.6, 6), color: 0x4f8a4a, transform: place(-0.4, 1.75, 0, 0, Math.PI / 2) },
    ]),
  }),
  rock: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: lumpy(new IcosahedronGeometry(1, 1), 0.55), color: 0x8a847d, transform: place(0, 0.55, 0, 0, 0, 1, 0.75, 1) }]),
  }),
  grass: () => ({ castShadow: false, material: windMaterial(0.5, { doubleSided: true }), geometry: grassGeometry() }),
  ruinBlock: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: new BoxGeometry(1, 1, 1), color: 0x9a948a, transform: place(0, 0.5, 0) }]),
  }),
  ruinPillar: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.5, 0.55, 1, 8), color: 0xa6a094, transform: place(0, 0.5, 0) },
      { geometry: new BoxGeometry(1.5, 0.08, 1.5), color: 0x8f897e, transform: place(0, 1.02, 0) },
    ]),
  }),
  towerBody: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: new CylinderGeometry(0.85, 1, 1, 10), color: 0x9d968b, transform: place(0, 0.5, 0) }]),
  }),
  towerRoof: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: new ConeGeometry(1, 1, 10), color: 0xffffff, transform: place(0, 0.5, 0) }]),
  }),
  caveMouth: () => ({
    castShadow: false,
    material: new MeshBasicMaterial({ color: 0x030304 }),
    geometry: assemble([{ geometry: new SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), color: 0x030304, transform: place(0, 0, 0.2) }]),
  }),
};

const cache = new Map<InstanceKind, InstanceModel>();

/** The (lazily built, shared) geometry and material of an instance kind. */
export function getModel(kind: InstanceKind): InstanceModel {
  let model = cache.get(kind);
  if (!model) cache.set(kind, (model = factories[kind]()));
  return model;
}

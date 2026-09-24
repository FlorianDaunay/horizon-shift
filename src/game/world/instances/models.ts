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
  OctahedronGeometry,
  TorusGeometry,
  SphereGeometry,
  Uniform,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { InstanceKind } from "./kinds";

/** Shared clock for foliage sway. */
export const windTime = new Uniform(0);
/** Brightness of everything that glows: dim by day, strong at night. Driven by the day/night cycle. */
export const glowLevel = new Uniform(0.4);

export interface InstanceModel {
  geometry: BufferGeometry;
  material: Material;
  castShadow: boolean;
}

interface Part {
  geometry: BufferGeometry;
  color: number;
  transform?: Matrix4;
  /** Multiplies the color: above 1 makes a part glow (used with `glowMaterial`). */
  emissive?: number;
  /** Baked ambient occlusion: 1 = none; lower values darken the bottom of the part. */
  shade?: number;
}

const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** Bakes a list of colored primitives into one flat-shaded geometry with vertex colors. */
function assemble(parts: Part[]): BufferGeometry {
  const geometries = parts.map(({ geometry, color, transform, emissive = 1, shade = 1 }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    if (transform) g.applyMatrix4(transform);
    g.deleteAttribute("uv");
    const position = g.getAttribute("position");
    const count = position.count;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < count; i++) {
      minY = Math.min(minY, position.getY(i));
      maxY = Math.max(maxY, position.getY(i));
    }
    const r = linear(((color >> 16) & 255) / 255) * emissive;
    const gr = linear(((color >> 8) & 255) / 255) * emissive;
    const b = linear((color & 255) / 255) * emissive;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const t = maxY > minY ? (position.getY(i) - minY) / (maxY - minY) : 1;
      const ao = shade + (1 - shade) * t;
      colors.set([r * ao, gr * ao, b * ao], i * 3);
    }
    g.setAttribute("color", new BufferAttribute(colors, 3));
    return g;
  });
  const merged = mergeGeometries(geometries, false);
  geometries.forEach((g) => g.dispose());
  parts.forEach((p) => p.geometry.dispose());
  return merged;
}

/** Translation, then tilt around X and Z, then scale: a compact way to position a part of a model. */
function place(x: number, y: number, z: number, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1, ry = 0): Matrix4 {
  const m = new Matrix4().makeTranslation(x, y, z);
  if (ry) m.multiply(new Matrix4().makeRotationY(ry));
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

const flipped = <T extends BufferGeometry>(geometry: T): T => geometry.rotateX(Math.PI);

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

/** Unlit material for light sources: vertex colors above 1 glow, scaled by the day/night `glowLevel`. */
function glowMaterial(): MeshBasicMaterial {
  const material = new MeshBasicMaterial({ vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGlow = glowLevel;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uGlow;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= uGlow;");
  };
  return material;
}

/** Lambert material that spins around the local Z axis (windmill sails). */
function spinMaterial(speed: number): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        float spin = uTime * ${speed.toFixed(3)};
        transformed.xy = mat2(cos(spin), sin(spin), -sin(spin), cos(spin)) * transformed.xy;`
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
      { geometry: new CylinderGeometry(0.22, 0.34, 2.2, 6), color: BARK, transform: place(0, 1.1, 0), shade: 0.7 },
      { geometry: new ConeGeometry(1.7, 2.6, 7), color: 0x2f5d3a, transform: place(0, 2.6, 0), shade: 0.5 },
      { geometry: new ConeGeometry(1.35, 2.4, 7), color: 0x37693f, transform: place(0, 4.1, 0), shade: 0.55 },
      { geometry: new ConeGeometry(0.95, 2.2, 7), color: 0x3f7745, transform: place(0, 5.5, 0), shade: 0.6 },
    ]),
  }),
  broadleaf: () => ({
    castShadow: true,
    material: windMaterial(0.005),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.25, 0.4, 2.6, 6), color: BARK, transform: place(0, 1.3, 0), shade: 0.7 },
      { geometry: new IcosahedronGeometry(1.9, 1), color: 0x4d8a37, transform: place(0, 3.7, 0, 0, 0, 1, 0.9, 1), shade: 0.5 },
      { geometry: new IcosahedronGeometry(1.3, 1), color: 0x5a9a3f, transform: place(0.9, 4.7, 0.4), shade: 0.6 },
      { geometry: new IcosahedronGeometry(1.1, 1), color: 0x43792f, transform: place(-0.9, 4.3, -0.6), shade: 0.6 },
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
      { geometry: new CylinderGeometry(0.32, 0.36, 3, 8), color: 0x4f8a4a, transform: place(0, 1.5, 0), shade: 0.7 },
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
    geometry: assemble([{ geometry: lumpy(new IcosahedronGeometry(1, 1), 0.55), color: 0x8a847d, transform: place(0, 0.55, 0, 0, 0, 1, 0.75, 1), shade: 0.65 }]),
  }),
  grass: () => ({ castShadow: false, material: windMaterial(0.5, { doubleSided: true }), geometry: grassGeometry() }),
  glowShroom: () => ({
    castShadow: false,
    material: glowMaterial(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.04, 0.06, 0.26, 5), color: 0x8d8a7a, transform: place(0, 0.13, 0), emissive: 0.5 },
      { geometry: new SphereGeometry(0.17, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), color: 0x5cf0d0, transform: place(0, 0.26, 0, 0, 0, 1, 0.7, 1), emissive: 2.4 },
      { geometry: new SphereGeometry(0.1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), color: 0xb98cff, transform: place(0.16, 0.12, 0.05, 0, 0, 1, 0.7, 1), emissive: 2.4 },
    ]),
  }),
  ruinBlock: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: new BoxGeometry(1, 1, 1), color: 0x9a948a, transform: place(0, 0.5, 0), shade: 0.75 }]),
  }),
  ruinPillar: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.5, 0.55, 1, 8), color: 0xa6a094, transform: place(0, 0.5, 0), shade: 0.75 },
      { geometry: new BoxGeometry(1.5, 0.08, 1.5), color: 0x8f897e, transform: place(0, 1.02, 0) },
    ]),
  }),
  towerBody: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: new CylinderGeometry(0.85, 1, 1, 10), color: 0x9d968b, transform: place(0, 0.5, 0), shade: 0.8 }]),
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
  menhir: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: lumpy(new CylinderGeometry(0.42, 0.66, 1, 5, 3), 0.18), color: 0x8f929c, transform: place(0, 0.5, 0), shade: 0.7 },
      { geometry: new ConeGeometry(0.42, 0.12, 5), color: 0x7d808a, transform: place(0, 1.05, 0) },
    ]),
  }),
  obelisk: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.42, 0.72, 1, 4), color: 0x3b3e4c, transform: place(0, 0.5, 0, 0, 0, 1, 1, 1, Math.PI / 4), shade: 0.75 },
      { geometry: new ConeGeometry(0.42, 0.06, 4), color: 0x50546a, transform: place(0, 1.03, 0, 0, 0, 1, 1, 1, Math.PI / 4) },
    ]),
  }),
  tent: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new ConeGeometry(1.6, 1.7, 4), color: 0xd9be8a, transform: place(0, 0.85, 0, 0, 0, 1, 1, 1, Math.PI / 4), shade: 0.8 },
      { geometry: new BoxGeometry(0.5, 0.9, 0.06), color: 0x2d2118, transform: place(0, 0.45, 1.12, 0.1) },
      { geometry: new CylinderGeometry(0.03, 0.03, 2.0, 4), color: BARK, transform: place(0, 0.95, 0) },
    ]),
  }),
  campfire: () => ({
    castShadow: false,
    material: glowMaterial(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.08, 0.08, 0.9, 5), color: 0x2a1c12, transform: place(0, 0.1, 0, 0, Math.PI / 2, 1, 1, 1, 0), emissive: 0.6 },
      { geometry: new CylinderGeometry(0.08, 0.08, 0.9, 5), color: 0x2a1c12, transform: place(0, 0.14, 0, 0, Math.PI / 2, 1, 1, 1, 1.05), emissive: 0.6 },
      { geometry: new CylinderGeometry(0.08, 0.08, 0.9, 5), color: 0x2a1c12, transform: place(0, 0.18, 0, 0, Math.PI / 2, 1, 1, 1, 2.1), emissive: 0.6 },
      { geometry: new ConeGeometry(0.32, 0.9, 7), color: 0xff7a24, transform: place(0, 0.6, 0), emissive: 3 },
      { geometry: new ConeGeometry(0.17, 0.62, 6), color: 0xffd27a, transform: place(0.03, 0.5, 0), emissive: 4 },
    ]),
  }),
  torch: () => ({
    castShadow: false,
    material: glowMaterial(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.04, 0.06, 1.4, 5), color: 0x3a2a1c, transform: place(0, 0.7, 0), emissive: 0.6 },
      { geometry: new ConeGeometry(0.14, 0.46, 6), color: 0xff8a2a, transform: place(0, 1.65, 0), emissive: 3 },
      { geometry: new ConeGeometry(0.08, 0.3, 5), color: 0xffd98a, transform: place(0, 1.6, 0), emissive: 4 },
    ]),
  }),
  lantern: () => ({
    castShadow: false,
    material: glowMaterial(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.05, 0.07, 2, 5), color: 0x2b2b30, transform: place(0, 1, 0), emissive: 0.8 },
      { geometry: new CylinderGeometry(0.17, 0.17, 0.36, 6), color: 0xffc46a, transform: place(0, 2.1, 0), emissive: 3.4 },
      { geometry: new ConeGeometry(0.26, 0.2, 6), color: 0x2b2b30, transform: place(0, 2.38, 0), emissive: 0.8 },
    ]),
  }),
  crystal: () => ({
    castShadow: false,
    material: glowMaterial(),
    geometry: assemble([
      { geometry: new OctahedronGeometry(0.5, 0), color: 0x59e8ff, transform: place(0, 0.9, 0, 0, 0, 1, 1.8, 1), emissive: 2.4 },
      { geometry: new OctahedronGeometry(0.3, 0), color: 0xa98bff, transform: place(0.4, 0.4, 0.1, 0, 0.4, 1, 1.7, 1), emissive: 2.4 },
      { geometry: new OctahedronGeometry(0.25, 0), color: 0x7dffe0, transform: place(-0.35, 0.3, -0.1, 0, -0.5, 1, 1.6, 1), emissive: 2.4 },
    ]),
  }),
  floatStone: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: lumpy(new CylinderGeometry(1, 0.85, 0.45, 7), 0.12), color: 0x8f8c86, transform: place(0, -0.225, 0), shade: 0.8 },
      { geometry: lumpy(flipped(new ConeGeometry(0.8, 0.7, 7)), 0.25), color: 0x6b6a67, transform: place(0, -0.8, 0) },
      { geometry: new CylinderGeometry(0.96, 0.96, 0.04, 7), color: 0xb7cdbb, transform: place(0, -0.02, 0) },
    ]),
  }),
  islandBase: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: lumpy(new CylinderGeometry(1, 0.98, 0.35, 22, 1), 0.06), color: 0x5a9a3f, transform: place(0, -0.175, 0) },
      { geometry: lumpy(flipped(new ConeGeometry(0.98, 1.5, 14, 3)), 0.32), color: 0x7a6e60, transform: place(0, -1.1, 0), shade: 0.55 },
      { geometry: flipped(new ConeGeometry(0.16, 0.8, 6)), color: 0x655b50, transform: place(0.38, -1.5, 0.2) },
      { geometry: flipped(new ConeGeometry(0.13, 0.6, 6)), color: 0x655b50, transform: place(-0.4, -1.2, -0.3) },
    ]),
  }),
  plank: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new BoxGeometry(1.6, 0.14, 0.85), color: 0x8f6d47, transform: place(0, -0.07, -0.46) },
      { geometry: new BoxGeometry(1.6, 0.14, 0.85), color: 0x7d5d3d, transform: place(0, -0.07, 0.46) },
    ]),
  }),
  post: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([{ geometry: new CylinderGeometry(0.13, 0.16, 1, 6), color: 0x5b4131, transform: place(0, 0.5, 0), shade: 0.6 }]),
  }),
  cabin: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new BoxGeometry(3.2, 2.2, 3), color: 0xa4834f, transform: place(0, 1.1, 0), shade: 0.75 },
      { geometry: new ConeGeometry(2.7, 1.4, 4), color: 0x7a3f32, transform: place(0, 2.9, 0, 0, 0, 1, 1, 1, Math.PI / 4) },
      { geometry: new BoxGeometry(0.7, 1.4, 0.06), color: 0x2d2118, transform: place(0, 0.7, 1.52) },
      { geometry: new BoxGeometry(0.4, 1.1, 0.4), color: 0x8a857c, transform: place(1, 3.1, -0.6) },
    ]),
  }),
  windmillBlades: () => {
    const arm = (angle: number): Part[] => [
      { geometry: new BoxGeometry(0.08, 3.7, 0.08), color: 0x6b4a2f, transform: new Matrix4().makeRotationZ(angle).multiply(place(0, 1.9, 0)) },
      { geometry: new BoxGeometry(0.75, 3.1, 0.04), color: 0xe9dcc0, transform: new Matrix4().makeRotationZ(angle).multiply(place(0.42, 2.05, 0.06)) },
    ];
    return {
      castShadow: true,
      material: spinMaterial(0.7),
      geometry: assemble([
        ...[0, 1, 2, 3].flatMap((k) => arm((k * Math.PI) / 2)),
        { geometry: new CylinderGeometry(0.2, 0.2, 0.4, 8), color: 0x4a3524, transform: place(0, 0, 0, Math.PI / 2) },
      ]),
    };
  },
  headstone: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new BoxGeometry(0.7, 0.9, 0.15), color: 0x8b8f96, transform: place(0, 0.45, 0), shade: 0.7 },
      { geometry: new CylinderGeometry(0.35, 0.35, 0.15, 10), color: 0x8b8f96, transform: place(0, 0.9, 0, Math.PI / 2) },
    ]),
  }),
  bell: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.12, 0.4, 0.6, 10), color: 0xc9a13b, transform: place(0, 0, 0), shade: 0.75 },
      { geometry: new SphereGeometry(0.09, 8, 6), color: 0x3a2c1c, transform: place(0, -0.34, 0) },
      { geometry: new TorusGeometry(0.08, 0.02, 5, 8), color: 0x3a2c1c, transform: place(0, 0.34, 0, Math.PI / 2) },
    ]),
  }),
  chest: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new BoxGeometry(0.9, 0.5, 0.55), color: 0x7b4f2b, transform: place(0, 0.25, 0), shade: 0.8 },
      { geometry: new BoxGeometry(0.94, 0.14, 0.6), color: 0x6a4223, transform: place(0, 0.57, 0) },
      { geometry: new BoxGeometry(0.12, 0.16, 0.04), color: 0xf2c05a, transform: place(0, 0.5, 0.3) },
      { geometry: new BoxGeometry(0.06, 0.6, 0.58), color: 0x3a3a40, transform: place(-0.3, 0.3, 0) },
      { geometry: new BoxGeometry(0.06, 0.6, 0.58), color: 0x3a3a40, transform: place(0.3, 0.3, 0) },
    ]),
  }),
  boat: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.72, 0.36, 0.6, 8), color: 0x8a5a34, transform: place(0, 0, 0, 0, 0, 1, 1, 2.2), shade: 0.7 },
      { geometry: new CylinderGeometry(0.6, 0.6, 0.02, 8), color: 0x4a3220, transform: place(0, 0.3, 0, 0, 0, 1, 1, 2.05) },
      { geometry: new BoxGeometry(1.1, 0.08, 0.3), color: 0x9a6a3c, transform: place(0, 0.24, -0.2) },
      { geometry: new CylinderGeometry(0.04, 0.04, 1.7, 5), color: 0x5b4131, transform: place(0, 1.1, 0.9) },
    ]),
  }),
  well: () => ({
    castShadow: true,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.95, 1, 0.9, 12), color: 0x8f8b84, transform: place(0, 0.45, 0), shade: 0.7 },
      { geometry: new CylinderGeometry(0.72, 0.72, 0.02, 12), color: 0x0c1a22, transform: place(0, 0.9, 0) },
      { geometry: new CylinderGeometry(0.06, 0.06, 1.9, 5), color: 0x5b4131, transform: place(-0.85, 0.95, 0) },
      { geometry: new CylinderGeometry(0.06, 0.06, 1.9, 5), color: 0x5b4131, transform: place(0.85, 0.95, 0) },
      { geometry: new CylinderGeometry(0.05, 0.05, 1.9, 5), color: 0x5b4131, transform: place(0, 1.85, 0, 0, Math.PI / 2) },
      { geometry: new ConeGeometry(1.35, 0.7, 4), color: 0x7a3f32, transform: place(0, 2.25, 0, 0, 0, 1, 1, 1, Math.PI / 4) },
      { geometry: new CylinderGeometry(0.14, 0.11, 0.22, 7), color: 0x6b4a2f, transform: place(0, 1.2, 0) },
    ]),
  }),
  lilyPad: () => ({
    castShadow: false,
    material: solid(),
    geometry: assemble([
      { geometry: new CylinderGeometry(0.5, 0.5, 0.03, 10), color: 0x3f8f4a, transform: place(0, 0, 0) },
      { geometry: new SphereGeometry(0.1, 6, 4), color: 0xf3a6c8, transform: place(0.1, 0.05, 0.05, 0, 0, 1, 0.7, 1) },
    ]),
  }),
  reed: () => ({
    castShadow: false,
    material: windMaterial(0.1),
    geometry: assemble(
      [[0, 0, 0], [0.15, 0.1, 0.08], [-0.12, 0.05, 0.14], [0.05, -0.1, -0.16], [-0.18, -0.06, -0.06]].flatMap(([x, z, tilt], i) => [
        { geometry: new CylinderGeometry(0.02, 0.035, 1.5 + i * 0.12, 4), color: 0x6b8a3a, transform: place(x, 0.75 + i * 0.06, z, tilt, tilt * 0.6), shade: 0.6 },
        { geometry: new CylinderGeometry(0.05, 0.05, 0.26, 6), color: 0x5a3a24, transform: place(x, 1.5 + i * 0.12, z, tilt, tilt * 0.6) },
      ])
    ),
  }),
};

const cache = new Map<InstanceKind, InstanceModel>();

/** The (lazily built, shared) geometry and material of an instance kind. */
export function getModel(kind: InstanceKind): InstanceModel {
  let model = cache.get(kind);
  if (!model) cache.set(kind, (model = factories[kind]()));
  return model;
}

/** A small fish (nose towards +Z) with a tail that wiggles in the vertex shader. Not a chunk instance kind: see `Fish`. */
export function createFishModel(): InstanceModel {
  const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float seed = instanceMatrix[3].x * 3.0 + instanceMatrix[3].z * 5.0;
        #else
          float seed = 0.0;
        #endif
        transformed.x += sin(uTime * 9.0 + seed) * max(0.0, -position.z - 0.15) * 0.35;`
      );
  };
  return {
    castShadow: false,
    material,
    geometry: assemble([
      { geometry: new SphereGeometry(0.5, 8, 6), color: 0xf2f2f2, transform: place(0, 0, 0, 0, 0, 0.36, 0.32, 1), shade: 0.75 },
      { geometry: new ConeGeometry(0.26, 0.5, 4), color: 0xffffff, transform: place(0, 0, -0.72, -Math.PI / 2, 0, 1, 1, 0.5) },
      { geometry: new ConeGeometry(0.12, 0.4, 3), color: 0xffffff, transform: place(0, 0.24, -0.05, 0, 0, 0.5, 1, 1) },
    ]),
  };
}

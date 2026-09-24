import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCenter;
  uniform float uIntensity;
  uniform float uScale;
  attribute vec3 aSeed;
  varying float vAlpha;

  const vec3 BOX = vec3(46.0, 1.0, 46.0);

  void main() {
    // Every position is a function of time: the swarm lives entirely on the GPU and wraps around the player.
    vec3 drift = vec3(sin(uTime * 0.3 + aSeed.x * 20.0), 0.0, cos(uTime * 0.25 + aSeed.z * 13.0)) * 2.5;
    vec2 p = aSeed.xz * BOX.xz + drift.xz + vec2(uTime * 0.18, uTime * 0.11);
    vec2 rel = mod(p - uCenter.xz + BOX.xz * 0.5, BOX.xz) - BOX.xz * 0.5;
    float height = 0.6 + fract(aSeed.y * 7.3) * 4.5 + sin(uTime * 0.9 + aSeed.x * 30.0) * 0.5;
    vec3 world = vec3(uCenter.x + rel.x, uCenter.y + height, uCenter.z + rel.y);

    float edge = 1.0 - smoothstep(14.0, 22.0, length(rel));
    float blink = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(uTime * 1.7 + aSeed.x * 60.0), 2.0);
    vAlpha = blink * edge * uIntensity;

    vec4 view = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = clamp(uScale * (0.7 + aSeed.z) / -view.z, 1.0, 26.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    if (glow * vAlpha < 0.01) discard;
    // A hot core with a soft halo, in HDR so it blooms through tone mapping.
    vec3 color = vec3(0.75, 1.0, 0.35) * (0.5 + 3.0 * glow * glow);
    gl_FragColor = vec4(color * glow * vAlpha, glow * vAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A swarm of fireflies around the player, drifting and blinking. It costs one draw call and no CPU per frame. */
export class Fireflies {
  readonly points: Points;
  private readonly material: ShaderMaterial;

  constructor(count = 150) {
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3)); // unused, but required
    geometry.setAttribute("aSeed", new BufferAttribute(seeds, 3));
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new Vector3() },
        uIntensity: { value: 0 },
        uScale: { value: 60 },
      },
    });
    this.points = new Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** Point sizes are in pixels, so they follow the render resolution. */
  setPixelRatio(ratio: number): void {
    this.material.uniforms.uScale.value = 55 * ratio;
  }

  /** `intensity` 0 hides the swarm entirely (day, deserts, snow). */
  update(time: number, center: Vector3, intensity: number): void {
    this.points.visible = intensity > 0.01;
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uCenter.value.copy(center);
    u.uIntensity.value = intensity;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}

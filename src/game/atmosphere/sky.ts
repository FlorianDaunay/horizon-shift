import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from "three";

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Pin the dome to the far plane so it is always behind everything else.
    gl_Position = clip.xyww;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uNight;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  }

  void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.5));
    // Below the horizon the sky fades to a darker haze (the ground normally hides it).
    col = mix(col, uHorizon * 0.55, clamp(-d.y * 4.0, 0.0, 1.0));

    // Stars and moon, only visible at night and above the horizon.
    float horizonFade = smoothstep(0.0, 0.25, d.y);
    float star = step(0.9965, hash(floor(d * 320.0)));
    float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + hash(floor(d * 320.0)) * 40.0);
    col += vec3(star * twinkle) * uNight * horizonFade;
    float moon = smoothstep(0.9993, 0.9997, dot(d, -uSunDir));
    col += vec3(0.85, 0.9, 1.0) * moon * uNight * horizonFade;

    // Sun: soft glow plus a bright disc.
    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 90.0) * 0.55);
    col += uSunColor * smoothstep(0.99955, 0.99985, sd) * 8.0;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A gradient sky dome with sun, moon and stars; recolored every frame by the day/night cycle. */
export class SkyDome {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      side: BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uZenith: { value: new Color() },
        uHorizon: { value: new Color() },
        uSunDir: { value: new Vector3(0, 1, 0) },
        uSunColor: { value: new Color(1, 0.9, 0.7) },
        uNight: { value: 0 },
        uTime: { value: 0 },
      },
    });
    this.mesh = new Mesh(new SphereGeometry(1, 32, 16), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }

  update(time: number, zenith: Color, horizon: Color, sunDir: Vector3, sunColor: Color, night: number): void {
    const u = this.material.uniforms;
    u.uZenith.value.copy(zenith);
    u.uHorizon.value.copy(horizon);
    u.uSunDir.value.copy(sunDir);
    u.uSunColor.value.copy(sunColor);
    u.uNight.value = night;
    u.uTime.value = time;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

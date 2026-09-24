import { Color, DirectionalLight, Fog, HemisphereLight, MathUtils, Vector3, type Camera, type Scene } from "three";
import { SkyDome } from "./sky";

interface SkyStop {
  /** Sun elevation (sine of its angle above the horizon). */
  e: number;
  zenith: number;
  horizon: number;
}

const SKY_STOPS: SkyStop[] = [
  { e: -0.3, zenith: 0x02040c, horizon: 0x070b18 },
  { e: -0.08, zenith: 0x0a1230, horizon: 0x1a1f3d },
  { e: 0.0, zenith: 0x2a3a72, horizon: 0xe0784f },
  { e: 0.12, zenith: 0x3b6bc0, horizon: 0xf2b98a },
  { e: 0.4, zenith: 0x2f72d6, horizon: 0xa8cff2 },
  { e: 1, zenith: 0x2467c9, horizon: 0x9ec9f2 },
];

const SHADOW_RADIUS = 70;
const SUN_DISTANCE = 220;

const smooth = (a: number, b: number, x: number) => {
  const t = MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Sky, sun and moon, ambient light and fog. The sun follows a full day/night cycle; the fog color
 * always matches the horizon so distant chunks fade into the sky instead of popping in.
 */
export class Atmosphere {
  /** Hours since midnight, 0..24. */
  hour: number;
  /** Real minutes for a full 24h cycle; 0 freezes time. */
  dayLengthMinutes = 12;

  readonly fog = new Fog(0x9ec9f2, 100, 400);
  readonly sun = new DirectionalLight(0xffffff, 3);
  private readonly moon = new DirectionalLight(0x8fa4ff, 0);
  private readonly hemi = new HemisphereLight(0xbcd8ff, 0x4a4a38, 1);
  private readonly sky = new SkyDome();

  private readonly sunDir = new Vector3();
  private readonly zenith = new Color();
  private readonly horizon = new Color();
  private readonly colorA = new Color();
  private readonly colorB = new Color();
  private readonly sunColor = new Color();
  private readonly warm = new Color(0xff9a55);
  private readonly white = new Color(0xfff4e0);
  private readonly hemiNight = new Color(0x1a2246);
  private readonly hemiDay = new Color(0xbcd8ff);
  private time = 0;
  private shadowSize = 0;

  constructor(private readonly scene: Scene, startHour = 9.5) {
    this.hour = startHour;
    scene.fog = this.fog;
    scene.add(this.sky.mesh, this.sun, this.sun.target, this.moon, this.moon.target, this.hemi);

    this.sun.shadow.camera.left = -SHADOW_RADIUS;
    this.sun.shadow.camera.right = SHADOW_RADIUS;
    this.sun.shadow.camera.top = SHADOW_RADIUS;
    this.sun.shadow.camera.bottom = -SHADOW_RADIUS;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = SUN_DISTANCE * 2.2;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.35;
  }

  /** 0 = deep night, 1 = full day. */
  get daylight(): number {
    return smooth(-0.1, 0.3, this.sunDir.y);
  }

  /** Where fog starts and ends, as a fraction of the view distance. */
  setViewDistance(distance: number): void {
    this.fog.near = distance * 0.3;
    this.fog.far = distance * 0.92;
  }

  /** 0 turns shadows off. */
  setShadowSize(size: number): void {
    this.sun.castShadow = size > 0;
    if (size > 0 && size !== this.shadowSize) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.shadowSize = size;
  }

  update(dt: number, focus: Vector3, camera: Camera): void {
    this.time += dt;
    if (this.dayLengthMinutes > 0) this.hour = (this.hour + (dt / (this.dayLengthMinutes * 60)) * 24) % 24;

    const angle = ((this.hour - 6) / 24) * Math.PI * 2;
    this.sunDir.set(Math.cos(angle), Math.sin(angle), 0.35).normalize();
    const e = this.sunDir.y;

    this.sampleSky(e);
    const night = 1 - smooth(-0.2, 0.05, e);
    this.sunColor.copy(this.warm).lerp(this.white, smooth(0, 0.45, e));
    this.sky.update(this.time, this.zenith, this.horizon, this.sunDir, this.sunColor, night);
    this.sky.mesh.position.copy(camera.position);

    this.fog.color.copy(this.horizon);

    this.sun.color.copy(this.sunColor);
    this.sun.intensity = 2.8 * smooth(-0.02, 0.25, e);
    this.moon.intensity = 0.4 * smooth(0.05, -0.2, e);
    this.moon.position.copy(focus).addScaledVector(this.sunDir, -SUN_DISTANCE);
    this.moon.target.position.copy(focus);
    this.hemi.color.copy(this.zenith).lerp(this.hemiDay, 0.5);
    this.hemi.groundColor.copy(this.hemiNight).lerp(this.warm, 0.25 * smooth(0, 0.4, e));
    this.hemi.intensity = MathUtils.lerp(0.18, 1.45, smooth(-0.15, 0.35, e));

    this.followFocus(focus);
  }

  private sampleSky(e: number): void {
    let i = 0;
    while (i < SKY_STOPS.length - 2 && e > SKY_STOPS[i + 1].e) i++;
    const a = SKY_STOPS[i];
    const b = SKY_STOPS[i + 1];
    const t = MathUtils.clamp((e - a.e) / (b.e - a.e), 0, 1);
    this.zenith.copy(this.colorA.setHex(a.zenith)).lerp(this.colorB.setHex(b.zenith), t);
    this.horizon.copy(this.colorA.setHex(a.horizon)).lerp(this.colorB.setHex(b.horizon), t);
  }

  /** Keeps the shadow frustum around the player, snapped to shadow-map texels so shadows do not shimmer. */
  private followFocus(focus: Vector3): void {
    const dir = this.sunDir;
    const right = new Vector3(0, 1, 0).cross(dir).normalize();
    const up = new Vector3().crossVectors(dir, right);
    const texel = this.shadowSize > 0 ? (SHADOW_RADIUS * 2) / this.shadowSize : 1;
    const a = Math.round(focus.dot(right) / texel) * texel;
    const b = Math.round(focus.dot(up) / texel) * texel;
    const c = focus.dot(dir);
    const target = this.sun.target.position.set(0, 0, 0).addScaledVector(right, a).addScaledVector(up, b).addScaledVector(dir, c);
    this.sun.position.copy(target).addScaledVector(dir, SUN_DISTANCE);
  }

  dispose(): void {
    this.scene.remove(this.sky.mesh, this.sun, this.sun.target, this.moon, this.moon.target, this.hemi);
    this.sky.dispose();
    this.sun.shadow.map?.dispose();
    this.scene.fog = null;
  }
}

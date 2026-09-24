import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Material,
} from "three";
import type { PlayerController } from "./PlayerController";

const INDIGO = 0x2c2d6b;
const TEAL = 0x1c8296;
const GOLD = 0xf2c05a;
const SCARF = 0xff8a3c;
const SCARF_SEGMENTS = 6;

/**
 * The wanderer: a hooded traveler in a flared cloak with a long trailing scarf, glowing eyes and a
 * staff whose lantern lights the way at night. Built from primitives and animated from the
 * controller's state (walk cycle, sprint lean, airborne pose).
 */
export class PlayerAvatar {
  readonly root = new Group();
  /** The lantern's light: only bright at night. */
  readonly light = new PointLight(0xffb45a, 0, 15, 1.6);

  private readonly body = new Group();
  private readonly cloak: Mesh;
  private readonly scarf: Group[] = [];
  private readonly arms: Group[] = [];
  private readonly feet: Mesh[] = [];
  private readonly staff = new Group();
  private readonly lanternGlow: Mesh;
  private readonly disposables: (BufferGeometry | Material)[] = [];
  private phase = 0;
  private time = 0;

  constructor() {
    const lambert = (color: number) => this.track(new MeshLambertMaterial({ color }));
    const basic = (color: number) => this.track(new MeshBasicMaterial({ color, toneMapped: false }));
    const mesh = (geometry: BufferGeometry, material: Material, parent: Group = this.body) => {
      this.disposables.push(geometry);
      const m = new Mesh(geometry, material);
      m.castShadow = true;
      parent.add(m);
      return m;
    };

    // Cloak: a lathe with a hem that flares out, shaded from teal at the bottom to indigo at the shoulders.
    const profile = [
      [0, 0.16], [0.4, 0.16], [0.42, 0.3], [0.34, 0.7], [0.25, 1.05], [0.2, 1.3], [0.13, 1.45], [0, 1.5],
    ].map(([r, y]) => new Vector2(r, y));
    const cloakGeometry = new LatheGeometry(profile, 18);
    const position = cloakGeometry.getAttribute("position");
    const colors = new Float32Array(position.count * 3);
    const low = new Color(TEAL);
    const high = new Color(INDIGO);
    const mixed = new Color();
    for (let i = 0; i < position.count; i++) {
      mixed.copy(low).lerp(high, Math.min(1, Math.max(0, (position.getY(i) - 0.16) / 1.1)));
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
    }
    cloakGeometry.setAttribute("color", new BufferAttribute(colors, 3));
    this.cloak = mesh(cloakGeometry, this.track(new MeshLambertMaterial({ vertexColors: true })));
    const trim = mesh(new TorusGeometry(0.405, 0.022, 6, 24), lambert(GOLD));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 0.19;

    // Hood with a pointed tip, a dark face and two glowing eyes.
    const hood = mesh(new SphereGeometry(0.27, 16, 12), lambert(INDIGO));
    hood.position.set(0, 1.62, 0);
    const tip = mesh(new ConeGeometry(0.15, 0.55, 8), lambert(INDIGO));
    tip.position.set(0, 1.93, -0.16);
    tip.rotation.x = -0.85;
    const face = mesh(new SphereGeometry(0.2, 14, 10), basic(0x090b15));
    face.position.set(0, 1.6, 0.13);
    face.scale.set(1, 1.05, 0.62);
    face.castShadow = false;
    for (const side of [-1, 1]) {
      const eye = mesh(new SphereGeometry(0.036, 8, 6), basic(0x8cf7ff));
      eye.position.set(side * 0.075, 1.62, 0.235);
      eye.castShadow = false;
    }

    // Scarf: a chain of segments, each parented to the previous one, so it whips like cloth.
    const collar = mesh(new TorusGeometry(0.19, 0.055, 6, 16), lambert(SCARF));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.42;
    let parent: Group = this.body;
    for (let i = 0; i < SCARF_SEGMENTS; i++) {
      const segment = new Group();
      segment.position.set(0, i === 0 ? 1.4 : 0, i === 0 ? -0.16 : -0.2);
      parent.add(segment);
      const piece = mesh(new SphereGeometry(0.1, 8, 4), lambert(i % 2 ? SCARF : 0xffb066), segment);
      piece.scale.set(0.9 - i * 0.06, 0.28, 1.15);
      piece.position.z = -0.1;
      this.scarf.push(segment);
      parent = segment;
    }

    // Arms (one raised on the staff), feet, and the staff with its lantern.
    for (const side of [-1, 1]) {
      const arm = new Group();
      arm.position.set(side * 0.3, 1.25, 0);
      mesh(new CylinderGeometry(0.06, 0.045, 0.5, 6), lambert(INDIGO), arm).position.y = -0.25;
      mesh(new SphereGeometry(0.055, 8, 6), lambert(0xe8c9a8), arm).position.y = -0.52;
      this.body.add(arm);
      this.arms.push(arm);

      const foot = mesh(new SphereGeometry(0.1, 8, 6), lambert(0x1a1a26), this.body);
      foot.scale.set(1, 0.7, 1.6);
      foot.position.set(side * 0.13, 0.08, 0.05);
      this.feet.push(foot);
    }

    const pole = mesh(new CylinderGeometry(0.026, 0.03, 1.95, 6), lambert(0x5b4131), this.staff);
    pole.position.y = 0.95;
    const hook = mesh(new TorusGeometry(0.07, 0.014, 5, 10, Math.PI * 1.3), lambert(0x5b4131), this.staff);
    hook.position.set(0, 1.98, 0);
    const lantern = new Group();
    lantern.position.set(0, 1.86, 0);
    this.staff.add(lantern);
    this.lanternGlow = mesh(new CylinderGeometry(0.075, 0.075, 0.17, 6), basic(0xffc266), lantern);
    this.lanternGlow.castShadow = false;
    mesh(new ConeGeometry(0.1, 0.08, 6), lambert(0x2b2b30), lantern).position.y = 0.12;
    lantern.add(this.light);
    this.staff.position.set(-0.4, 0, 0.22);
    this.body.add(this.staff);

    this.root.add(this.body);
  }

  private track<T extends Material>(material: T): T {
    this.disposables.push(material);
    return material;
  }

  /** `night` is 0 by day and 1 in the dark: it lights the lantern. */
  update(dt: number, player: PlayerController, night: number): void {
    this.time += dt;
    this.root.position.copy(player.position);
    this.root.rotation.y = player.heading;

    const speed = player.speed;
    const intensity = Math.min(1, speed / 6);
    this.phase += dt * (3 + speed * 1.15);
    const swing = Math.sin(this.phase) * intensity;
    const air = player.grounded ? 0 : 1;

    // Feet step; the cloak sways and the whole body leans into a sprint.
    this.feet[0].position.z = 0.05 + swing * 0.26 * (1 - air);
    this.feet[1].position.z = 0.05 - swing * 0.26 * (1 - air);
    this.feet[0].position.y = 0.08 + Math.max(0, Math.cos(this.phase)) * 0.09 * intensity + air * 0.12;
    this.feet[1].position.y = 0.08 + Math.max(0, -Math.cos(this.phase)) * 0.09 * intensity + air * 0.12;
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.05 * intensity;
    this.body.rotation.x += ((player.sprinting ? 0.22 : 0.05 * intensity) - this.body.rotation.x) * Math.min(1, dt * 8);
    this.cloak.rotation.z = swing * 0.05;
    this.cloak.scale.set(1 + Math.sin(this.time * 1.6) * 0.012, 1 + air * 0.04, 1 + Math.sin(this.time * 1.6) * 0.012);

    // Arms: free arm swings, the staff arm holds still-ish; both go up in the air.
    this.arms[0].rotation.x = -0.35 + swing * 0.15 - air * 0.9; // the staff arm
    this.arms[1].rotation.x = -swing * 0.6 - air * 1.2;
    this.staff.rotation.x = swing * 0.06 - air * 0.15;

    // Scarf: trails behind, streams out with speed and ripples.
    const streaming = -0.15 - intensity * 0.5 - air * 0.3;
    for (let i = 0; i < this.scarf.length; i++) {
      const wave = Math.sin(this.time * (4 + speed * 0.4) - i * 0.9);
      this.scarf[i].rotation.x = streaming * (i === 0 ? 1.4 : 0.55) + wave * (0.08 + intensity * 0.16);
      this.scarf[i].rotation.y = Math.sin(this.time * 2.3 - i * 0.8) * (0.1 + intensity * 0.18);
    }

    // Lantern: warm at night, flickering.
    const flicker = 1 + Math.sin(this.time * 9) * 0.05 + Math.sin(this.time * 23.7) * 0.04;
    this.light.intensity = (0.15 + night * 7) * flicker;
    (this.lanternGlow.material as MeshBasicMaterial).color.setRGB(1, 0.76, 0.4).multiplyScalar(0.7 + night * 1.2);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

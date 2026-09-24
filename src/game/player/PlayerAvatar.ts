import { BoxGeometry, Group, Mesh, MeshLambertMaterial, SphereGeometry, type BufferGeometry, type Material } from "three";
import type { PlayerController } from "./PlayerController";

const material = (color: number) => new MeshLambertMaterial({ color, flatShading: true });

/** A small low-poly explorer built from primitives, animated from the controller's state. */
export class PlayerAvatar {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly legs: Group[] = [];
  private readonly arms: Group[] = [];
  private readonly disposables: (BufferGeometry | Material)[] = [];
  private phase = 0;

  constructor() {
    const jacket = material(0x2f7f9c);
    const pants = material(0x3a3f55);
    const skin = material(0xf0c8a4);
    const pack = material(0x8a5a36);
    const hair = material(0x3b2a20);

    const box = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, parent: Group = this.body) => {
      const geometry = new BoxGeometry(w, h, d);
      const mesh = new Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      this.disposables.push(geometry);
      return mesh;
    };

    box(0.5, 0.7, 0.3, jacket, 0, 1.15, 0);
    box(0.36, 0.5, 0.18, pack, 0, 1.2, -0.24);
    const headGeometry = new SphereGeometry(0.19, 10, 8);
    const head = new Mesh(headGeometry, skin);
    head.position.set(0, 1.72, 0);
    head.castShadow = true;
    this.body.add(head);
    box(0.4, 0.14, 0.4, hair, 0, 1.86, -0.02);
    this.disposables.push(headGeometry);

    // Limbs pivot at the hip / shoulder so rotating them swings the whole limb.
    for (const side of [-1, 1]) {
      const leg = new Group();
      leg.position.set(side * 0.13, 0.8, 0);
      box(0.2, 0.8, 0.22, pants, 0, -0.4, 0, leg);
      this.body.add(leg);
      this.legs.push(leg);

      const arm = new Group();
      arm.position.set(side * 0.35, 1.45, 0);
      box(0.16, 0.6, 0.18, jacket, 0, -0.3, 0, arm);
      box(0.15, 0.14, 0.16, skin, 0, -0.66, 0, arm);
      this.body.add(arm);
      this.arms.push(arm);
    }

    this.disposables.push(jacket, pants, skin, pack, hair);
    this.root.add(this.body);
  }

  update(dt: number, player: PlayerController): void {
    this.root.position.copy(player.position);
    this.root.rotation.y = player.heading;

    const speed = player.speed;
    const intensity = Math.min(1, speed / 6);
    this.phase += dt * (3 + speed * 1.25);
    const swing = Math.sin(this.phase) * 0.9 * intensity;
    const airborne = player.grounded ? 0 : 1;

    this.legs[0].rotation.x = swing * (1 - airborne) - airborne * 0.5;
    this.legs[1].rotation.x = -swing * (1 - airborne) + airborne * 0.4;
    this.arms[0].rotation.x = -swing * 0.8 - airborne * 1.4;
    this.arms[1].rotation.x = swing * 0.8 - airborne * 1.4;
    this.body.position.y = Math.abs(Math.sin(this.phase)) * 0.06 * intensity;
    this.body.rotation.x = player.sprinting ? 0.18 : 0;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

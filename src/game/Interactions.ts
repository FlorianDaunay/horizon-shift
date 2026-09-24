import type { AudioEngine } from "./audio/AudioEngine";
import type { Atmosphere } from "./atmosphere/Atmosphere";
import type { InputFrame } from "./input/actions";
import type { PlayerController } from "./player/PlayerController";
import type { Progress } from "./Progress";
import { createInteractHit } from "./world/ChunkManager";
import { INTERACT_COLLECT, INTERACT_OPEN, INTERACT_REST, INTERACT_RING } from "./world/generation/collision";
import type { World } from "./world/World";

/** How close (m) the player must be to an item to interact with it. */
const RANGE = 2.7;
/** Hours of time that pass per second while resting. */
const REST_SPEED = 7;

const LABELS: Record<number, string> = {
  [INTERACT_COLLECT]: "Collect crystal shard",
  [INTERACT_OPEN]: "Open chest",
  [INTERACT_RING]: "Ring the bell",
  [INTERACT_REST]: "Rest by the fire",
};

/**
 * The "press E" layer: finds the nearest thing the player can use, offers it as a prompt and does
 * what it says: collect crystals, open chests, ring bells, rest by a campfire until dusk or dawn.
 */
export class Interactions {
  /** What pressing the interact key would do right now, for the HUD. */
  prompt: string | null = null;

  private readonly hit = createInteractHit();
  private restTarget: number | null = null;
  private restRemaining = 0;

  constructor(
    private readonly world: World,
    private readonly player: PlayerController,
    private readonly audio: AudioEngine,
    private readonly atmosphere: Atmosphere,
    private readonly progress: Progress,
    private readonly seed: () => number,
    private readonly toast: (message: string) => void
  ) {}

  /** The player is resting: the game freezes the controls while time flies. */
  get resting(): boolean {
    return this.restTarget !== null;
  }

  update(dt: number, playing: boolean, input: InputFrame): void {
    if (this.restTarget !== null) {
      this.rest(dt);
      this.prompt = null;
      return;
    }
    const { position } = this.player;
    const canUse = playing && !this.player.swimming;
    if (!canUse || !this.world.nearestInteractable(position.x, position.y + 1, position.z, RANGE, this.hit)) {
      this.prompt = null;
      return;
    }
    this.prompt = LABELS[this.hit.type] ?? null;
    if (input.buttons.interact.pressed) this.perform();
  }

  private perform(): void {
    const { hit } = this;
    switch (hit.type) {
      case INTERACT_COLLECT: {
        this.world.take(hit);
        this.progress.add(1);
        this.audio.pickup();
        this.toast("+1 crystal shard");
        break;
      }
      case INTERACT_OPEN: {
        this.world.take(hit);
        const gained = this.progress.add(2);
        this.audio.chest();
        this.toast(gained > 0 ? `Chest opened: +${gained} crystal shard${gained > 1 ? "s" : ""}` : "Chest opened (your shards are full)");
        break;
      }
      case INTERACT_RING:
        this.audio.bell();
        break;
      case INTERACT_REST:
        this.startRest();
        return;
      default:
        return;
    }
    this.progress.save(this.seed());
  }

  /** Time flies to the next dusk or dawn, whichever is coming. */
  private startRest(): void {
    const hour = this.atmosphere.hour;
    const isDay = hour >= 6.5 && hour < 18;
    this.restTarget = isDay ? 19.5 : 7;
    this.restRemaining = (((this.restTarget - hour) % 24) + 24) % 24;
    this.toast("You rest by the fire...");
  }

  private rest(dt: number): void {
    const advance = Math.min(this.restRemaining, REST_SPEED * dt);
    this.atmosphere.setHour(this.atmosphere.hour + advance);
    this.restRemaining -= advance;
    if (this.restRemaining <= 0) {
      this.toast(this.restTarget === 7 ? "A new day begins" : "Dusk falls");
      this.restTarget = null;
    }
  }
}

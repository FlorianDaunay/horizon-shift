export interface AdaptiveOptions {
  /** Drop a quality level when the measured FPS stays below this. */
  minFps: number;
  /** Consider raising quality when FPS stays at or above this. */
  goodFps: number;
  /** Seconds to ignore at the start and after every change (streaming and shader compilation cause hitches). */
  settleSeconds: number;
  /** Consecutive 1-second windows below `minFps` before dropping. */
  dropAfter: number;
  /** Consecutive 1-second windows at or above `goodFps` before raising. */
  raiseAfter: number;
  /** After a raise is followed by a drop within this many seconds, raising is blocked for `raiseBlockSeconds`. */
  flapSeconds: number;
  raiseBlockSeconds: number;
}

export const DEFAULT_ADAPTIVE_OPTIONS: AdaptiveOptions = {
  minFps: 50,
  goodFps: 57,
  settleSeconds: 4,
  dropAfter: 2,
  raiseAfter: 10,
  flapSeconds: 30,
  raiseBlockSeconds: 90,
};

/**
 * Chooses a quality level from measured frame rate. Fast to degrade (two slow seconds), slow to
 * recover (ten good seconds), and it stops retrying a level that keeps failing, so it never oscillates.
 * Level 0 is the best; higher indices are cheaper. It knows nothing about what a level means.
 */
export class AdaptiveQuality {
  private windowTime = 0;
  private frames = 0;
  private settle: number;
  private slowStreak = 0;
  private goodStreak = 0;
  private clock = 0;
  private lastRaiseAt = -Infinity;
  private raiseBlockedUntil = 0;

  constructor(
    private level: number,
    private readonly levels: number,
    private readonly options: AdaptiveOptions = DEFAULT_ADAPTIVE_OPTIONS
  ) {
    this.settle = options.settleSeconds;
  }

  get current(): number {
    return this.level;
  }

  /** Forces a level (e.g. the user picked one) and restarts measuring. */
  set(level: number): void {
    this.level = Math.min(this.levels - 1, Math.max(0, level));
    this.restart();
  }

  /** Forget the current measurements and wait for things to settle again. */
  restart(): void {
    this.settle = this.options.settleSeconds;
    this.windowTime = 0;
    this.frames = 0;
    this.slowStreak = 0;
    this.goodStreak = 0;
  }

  /** Feed one frame. Returns the new level when it changed, otherwise `null`. */
  update(dt: number): number | null {
    this.clock += dt;
    if (dt > 0.5) {
      // A stall (background tab, debugger, heavy load) says nothing about steady-state speed.
      this.restart();
      return null;
    }
    if (this.settle > 0) {
      this.settle -= dt;
      return null;
    }

    this.windowTime += dt;
    this.frames++;
    if (this.windowTime < 1) return null;

    const fps = this.frames / this.windowTime;
    this.windowTime = 0;
    this.frames = 0;
    const { options } = this;

    if (fps < options.minFps) {
      this.goodStreak = 0;
      if (++this.slowStreak >= options.dropAfter && this.level < this.levels - 1) {
        if (this.clock - this.lastRaiseAt < options.flapSeconds) this.raiseBlockedUntil = this.clock + options.raiseBlockSeconds;
        this.level++;
        this.restart();
        return this.level;
      }
    } else if (fps >= options.goodFps) {
      this.slowStreak = 0;
      if (++this.goodStreak >= options.raiseAfter && this.level > 0 && this.clock >= this.raiseBlockedUntil) {
        this.level--;
        this.lastRaiseAt = this.clock;
        this.restart();
        return this.level;
      }
    } else {
      this.slowStreak = 0;
      this.goodStreak = 0;
    }
    return null;
  }
}

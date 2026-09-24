const MAX_SHARDS = 9;
/** Seconds of gliding that one crystal shard pays for. */
export const GLIDE_SECONDS_PER_SHARD = 4;

interface Saved {
  shards: number;
  taken: string[];
}

/**
 * What the player has collected in this world: crystal shards (they fuel the glide) and which
 * crystals and chests have been used, so they stay gone. Saved in the browser, per world seed.
 */
export class Progress {
  shards = 0;
  private glideDebt = 0;

  /** `taken` is shared with the world, which hides those items when their chunks are built. */
  constructor(private readonly taken: Set<string>) {}

  private key(seed: number) {
    return `horizon-shift-progress-${seed}`;
  }

  load(seed: number): void {
    this.shards = 0;
    this.glideDebt = 0;
    this.taken.clear();
    try {
      const raw = localStorage.getItem(this.key(seed));
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Saved>;
      this.shards = Math.min(MAX_SHARDS, Math.max(0, Math.floor(saved.shards ?? 0)));
      for (const item of saved.taken ?? []) this.taken.add(item);
    } catch {
      // A corrupt or unavailable save just means starting fresh.
    }
  }

  save(seed: number): void {
    try {
      localStorage.setItem(this.key(seed), JSON.stringify({ shards: this.shards, taken: [...this.taken] } satisfies Saved));
    } catch {
      // Storage may be full or disabled; progress then lasts for the session.
    }
  }

  add(count: number): number {
    const before = this.shards;
    this.shards = Math.min(MAX_SHARDS, this.shards + count);
    return this.shards - before;
  }

  /** Turns seconds of gliding into spent shards. Returns true when a shard was used up. */
  spendGlide(seconds: number): boolean {
    this.glideDebt += seconds;
    let spent = false;
    while (this.glideDebt >= GLIDE_SECONDS_PER_SHARD && this.shards > 0) {
      this.glideDebt -= GLIDE_SECONDS_PER_SHARD;
      this.shards--;
      spent = true;
    }
    if (this.shards === 0) this.glideDebt = 0;
    return spent;
  }
}

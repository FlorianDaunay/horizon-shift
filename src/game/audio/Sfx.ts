import type { Surface } from "../world/generation/surface";

interface Hit {
  filter: BiquadFilterType;
  frequency: number;
  q: number;
  /** Seconds. */
  attack: number;
  decay: number;
  level: number;
  /** Extra low thump (Hz), 0 for none. */
  thump?: number;
  /** A second, delayed crunch (snow). */
  echo?: number;
}

/** How each surface sounds underfoot. Kept quiet on purpose: steps are texture, not the main event. */
const STEPS: Record<Surface, Hit> = {
  grass: { filter: "bandpass", frequency: 2300, q: 0.7, attack: 0.006, decay: 0.09, level: 0.34, thump: 95 },
  sand: { filter: "bandpass", frequency: 4200, q: 0.5, attack: 0.02, decay: 0.17, level: 0.24 },
  snow: { filter: "bandpass", frequency: 3100, q: 1.8, attack: 0.004, decay: 0.05, level: 0.34, thump: 80, echo: 0.035 },
  mud: { filter: "lowpass", frequency: 720, q: 3, attack: 0.01, decay: 0.17, level: 0.5, thump: 70 },
  rock: { filter: "highpass", frequency: 3400, q: 0.7, attack: 0.002, decay: 0.045, level: 0.3, thump: 160 },
  stone: { filter: "highpass", frequency: 3000, q: 0.7, attack: 0.002, decay: 0.05, level: 0.32, thump: 190 },
  water: { filter: "bandpass", frequency: 900, q: 1, attack: 0.012, decay: 0.26, level: 0.5, echo: 0.05 },
};

/** Footsteps, jumps and landings synthesised from filtered noise and short tones. */
export class Sfx {
  constructor(
    private readonly ctx: AudioContext,
    private readonly output: AudioNode,
    private readonly noise: AudioBuffer
  ) {}

  step(surface: Surface, sprinting: boolean): void {
    const hit = STEPS[surface];
    const now = this.ctx.currentTime;
    const boost = (sprinting ? 1.25 : 1) * (0.85 + Math.random() * 0.3);
    this.burst(hit, now, boost);
    if (hit.echo) this.burst(hit, now + hit.echo, boost * 0.6);
    if (hit.thump) this.thump(hit.thump * (0.9 + Math.random() * 0.2), now, hit.level * 0.5 * boost, 0.09);
  }

  jump(surface: Surface): void {
    const hit = STEPS[surface];
    this.burst({ ...hit, decay: hit.decay * 1.3 }, this.ctx.currentTime, 0.7);
  }

  land(surface: Surface, speed: number): void {
    const hit = STEPS[surface];
    const force = Math.min(1.6, 0.5 + speed / 12);
    const now = this.ctx.currentTime;
    this.burst({ ...hit, decay: hit.decay * 1.5 }, now, force);
    this.thump((hit.thump ?? 90) * 0.8, now, 0.32 * force, 0.16);
  }

  private burst(hit: Hit, when: number, boost: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = hit.filter;
    filter.frequency.value = hit.frequency * (0.9 + Math.random() * 0.25);
    filter.Q.value = hit.q;
    const gain = this.ctx.createGain();
    const level = hit.level * boost;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + hit.attack);
    gain.gain.exponentialRampToValueAtTime(0.0005, when + hit.attack + hit.decay);
    source.connect(filter).connect(gain).connect(this.output);
    source.start(when, Math.random() * 1.6);
    source.stop(when + hit.attack + hit.decay + 0.03);
  }

  private thump(frequency: number, when: number, level: number, length: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(frequency * 1.6, when);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.7, when + length);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.0005, when + length);
    osc.connect(gain).connect(this.output);
    osc.start(when);
    osc.stop(when + length + 0.02);
  }
}

import type { Surface } from "../world/generation/surface";
import { Ambience } from "./Ambience";
import { LofiMusic } from "./LofiMusic";
import { Sfx } from "./Sfx";

export interface AudioVolumes {
  /** 0..1 */
  music: number;
  sfx: number;
  muted: boolean;
}

/** What the sound layer needs to know about the world each frame. */
export interface AudioMood {
  /** 0 night .. 1 day. */
  daylight: number;
  /** Player height above sea level. */
  altitude: number;
  /** 0..1: how exposed and windy the place is. */
  windiness: number;
  /** Menu open: everything is muffled and quieter. */
  paused: boolean;
}

/**
 * All sound is synthesised with the Web Audio API: no audio files to download, so the game stays a
 * small static site. Three buses (music, effects, ambience) share one master with a soft limiter.
 * The context can only start after a user gesture, so nothing sounds until `start()` is called.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master!: GainNode;
  private muffle!: BiquadFilterNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private music: LofiMusic | null = null;
  private ambience: Ambience | null = null;
  private sfx: Sfx | null = null;
  private volumes: AudioVolumes = { music: 0.4, sfx: 0.6, muted: false };
  private paused = true;
  private underwater = false;

  /** Creates (or resumes) the audio context. Call from a click or key press. */
  start(): void {
    if (!this.context) {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      const ctx = new Context();
      this.context = ctx;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14;
      limiter.ratio.value = 6;
      this.master = ctx.createGain();
      this.muffle = ctx.createBiquadFilter();
      this.muffle.type = "lowpass";
      this.muffle.frequency.value = 20000;
      this.master.connect(this.muffle).connect(limiter).connect(ctx.destination);

      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      const ambienceBus = ctx.createGain();
      ambienceBus.gain.value = 0.8;
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      ambienceBus.connect(this.master);

      const noise = createNoise(ctx);
      this.music = new LofiMusic(ctx, this.musicBus, noise);
      this.ambience = new Ambience(ctx, ambienceBus, noise);
      this.sfx = new Sfx(ctx, this.sfxBus, noise);
      this.applyVolumes();
    }
    void this.context.resume();
  }

  setVolumes(volumes: Partial<AudioVolumes>): void {
    this.volumes = { ...this.volumes, ...volumes };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.context) return;
    const t = this.context.currentTime;
    const { music, sfx, muted } = this.volumes;
    this.musicBus.gain.setTargetAtTime(muted ? 0 : music * 0.9, t, 0.15);
    this.sfxBus.gain.setTargetAtTime(muted ? 0 : sfx, t, 0.05);
    this.master.gain.setTargetAtTime(this.paused ? 0.55 : 1, t, 0.3);
    this.muffle.frequency.setTargetAtTime(this.paused ? 900 : this.underwater ? 520 : 20000, t, 0.2);
  }

  update(dt: number, mood: AudioMood): void {
    if (!this.context) return;
    if (mood.paused !== this.paused) {
      this.paused = mood.paused;
      this.applyVolumes();
    }
    this.music?.setMood(mood.daylight);
    this.ambience?.update(dt, mood);
  }

  /** Head under water: everything turns dull and distant. */
  setUnderwater(underwater: boolean): void {
    if (underwater === this.underwater) return;
    this.underwater = underwater;
    this.applyVolumes();
  }

  splash(speed: number): void {
    this.sfx?.splash(speed);
  }

  stroke(): void {
    this.sfx?.stroke();
  }

  pickup(): void {
    this.sfx?.pickup();
  }

  chest(): void {
    this.sfx?.chest();
  }

  bell(): void {
    this.sfx?.bell();
  }

  footstep(surface: Surface, sprinting: boolean): void {
    this.sfx?.step(surface, sprinting);
  }

  land(surface: Surface, speed: number): void {
    this.sfx?.land(surface, speed);
  }

  jump(surface: Surface): void {
    this.sfx?.jump(surface);
  }

  dispose(): void {
    this.music?.dispose();
    this.ambience?.dispose();
    void this.context?.close();
    this.context = null;
  }
}

/** Two seconds of white noise, shared by every noise-based sound. */
function createNoise(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

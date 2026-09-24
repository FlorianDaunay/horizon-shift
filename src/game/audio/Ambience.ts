import type { AudioMood } from "./AudioEngine";

/** Wind: filtered noise whose pitch and loudness drift slowly and grow with altitude and exposure. */
export class Ambience {
  private readonly rumble: GainNode;
  private readonly whistle: GainNode;
  private readonly whistleFilter: BiquadFilterNode;
  private readonly rumbleFilter: BiquadFilterNode;
  private readonly sources: AudioBufferSourceNode[] = [];
  private time = 0;

  constructor(ctx: AudioContext, output: AudioNode, noise: AudioBuffer) {
    const layer = (type: BiquadFilterType, frequency: number, q: number) => {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      source.playbackRate.value = 0.8 + Math.random() * 0.4;
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = frequency;
      filter.Q.value = q;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(output);
      source.start(0, Math.random() * 2);
      this.sources.push(source);
      return { filter, gain };
    };
    const low = layer("lowpass", 260, 0.5);
    const high = layer("bandpass", 800, 4);
    this.rumble = low.gain;
    this.rumbleFilter = low.filter;
    this.whistle = high.gain;
    this.whistleFilter = high.filter;
  }

  update(dt: number, mood: AudioMood): void {
    this.time += dt;
    // Two slow, unrelated waves make the gusts feel natural rather than periodic.
    const gust = 0.5 + 0.5 * Math.sin(this.time * 0.23) * Math.sin(this.time * 0.11 + 1.3);
    const wind = Math.min(1, 0.18 + mood.windiness + Math.max(0, mood.altitude - 6) / 90);
    const t = this.rumble.context.currentTime;
    this.rumble.gain.setTargetAtTime(0.06 + wind * 0.22 * (0.5 + gust), t, 0.5);
    this.whistle.gain.setTargetAtTime(wind * wind * 0.045 * gust, t, 0.6);
    this.rumbleFilter.frequency.setTargetAtTime(180 + 260 * gust * wind, t, 0.6);
    this.whistleFilter.frequency.setTargetAtTime(650 + 500 * gust, t, 0.5);
  }

  dispose(): void {
    for (const source of this.sources) source.stop();
  }
}

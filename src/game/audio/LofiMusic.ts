/**
 * Endless, relaxed lo-fi: warm pads, a soft electric-piano that plays random notes of the current
 * chord, a gentle bass, a dusty beat and vinyl crackle, over the progression Cmaj7 - Am7 - Dm9 - G13.
 * Everything is scheduled a fraction of a second ahead so it stays in time even if a frame is slow.
 */
const BPM = 68;
const BEAT = 60 / BPM;
const SWING = 0.16;
const LOOKAHEAD = 0.7;
const BARS_PER_CHORD = 2;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

interface Chord {
  bass: number;
  pad: number[];
  /** Notes the electric piano may play (one octave above the pad). */
  scale: number[];
}

const CHORDS: Chord[] = [
  { bass: 36, pad: [48, 52, 55, 59, 64], scale: [64, 67, 71, 72, 74, 76] }, // Cmaj7
  { bass: 33, pad: [45, 48, 52, 55, 60], scale: [64, 67, 69, 72, 76, 79] }, // Am7
  { bass: 38, pad: [50, 53, 57, 60, 64], scale: [65, 69, 72, 74, 76, 77] }, // Dm9
  { bass: 31, pad: [43, 47, 53, 57, 64], scale: [65, 67, 69, 71, 74, 77] }, // G13
];

export class LofiMusic {
  private readonly input: GainNode;
  private readonly delay: DelayNode;
  private readonly timer: number;
  private nextStep = 0;
  private step = 0;
  private cutoff = 1300;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
    private readonly noise: AudioBuffer
  ) {
    // Tape-ish tone: everything passes a gentle low-pass, and the piano feeds a soft echo.
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    this.input = ctx.createGain();
    this.input.connect(tone).connect(output);

    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.36;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = "lowpass";
    echoTone.frequency.value = 1700;
    this.delay.connect(echoTone).connect(feedback).connect(this.delay);
    echoTone.connect(this.input);

    this.crackle();
    this.nextStep = ctx.currentTime + 0.2;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  /** Darker and softer at night. */
  setMood(daylight: number): void {
    this.cutoff = 750 + daylight * 700;
  }

  dispose(): void {
    window.clearInterval(this.timer);
  }

  private schedule(): void {
    if (this.ctx.state !== "running") {
      this.nextStep = this.ctx.currentTime + 0.1;
      return;
    }
    while (this.nextStep < this.ctx.currentTime + LOOKAHEAD) {
      const eighth = this.step % 8; // eighth notes in a bar
      const bar = Math.floor(this.step / 8);
      const chord = CHORDS[Math.floor(bar / BARS_PER_CHORD) % CHORDS.length];
      const swing = eighth % 2 === 1 ? SWING * BEAT * 0.5 : 0;
      const when = this.nextStep + swing;

      if (this.step % (8 * BARS_PER_CHORD) === 0) this.pad(chord, when);
      if (eighth === 0) this.bass(chord.bass, when, 1.6);
      if (eighth === 5) this.bass(chord.bass + (bar % 2 ? 7 : 0), when, 1);
      this.drums(eighth, when);
      this.piano(chord, eighth, when);

      this.nextStep += BEAT / 2;
      this.step++;
    }
  }

  private pad(chord: Chord, when: number): void {
    const length = BEAT * 4 * BARS_PER_CHORD;
    const lowpass = this.ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = this.cutoff;
    lowpass.Q.value = 0.4;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.05, when + 1.4);
    gain.gain.setValueAtTime(0.05, when + length - 1.6);
    gain.gain.linearRampToValueAtTime(0, when + length + 1.2);
    lowpass.connect(gain).connect(this.input);
    for (const note of chord.pad) {
      for (const cents of [-7, 7]) {
        const osc = this.ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = midi(note);
        osc.detune.value = cents;
        osc.connect(lowpass);
        osc.start(when);
        osc.stop(when + length + 1.3);
      }
    }
  }

  private bass(note: number, when: number, beats: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midi(note);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.16, when + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, when + beats * BEAT);
    osc.connect(gain).connect(this.input);
    osc.start(when);
    osc.stop(when + beats * BEAT + 0.05);
  }

  private piano(chord: Chord, eighth: number, when: number): void {
    const onBeat = eighth % 2 === 0;
    if (Math.random() > (onBeat ? 0.5 : 0.22)) return;
    const note = chord.scale[Math.floor(Math.random() * chord.scale.length)];
    const velocity = 0.5 + Math.random() * 0.5;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(0.06 * velocity, when + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0005, when + 1.7);
    const send = this.ctx.createGain();
    send.gain.value = 0.55;
    gain.connect(this.input);
    gain.connect(send).connect(this.delay);
    // A soft "tine": a sine plus a quiet octave-and-a-bit overtone.
    for (const [ratio, level] of [[1, 1], [2.01, 0.22], [4.02, 0.06]]) {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = midi(note) * ratio;
      const partial = this.ctx.createGain();
      partial.gain.value = level;
      osc.connect(partial).connect(gain);
      osc.start(when);
      osc.stop(when + 1.8);
    }
  }

  private drums(eighth: number, when: number): void {
    if (eighth === 0 || eighth === 4) this.kick(when);
    if (eighth === 2 || eighth === 6) this.snare(when);
    this.hat(when, eighth % 2 === 1 ? 0.016 : 0.009);
  }

  private kick(when: number): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.setValueAtTime(115, when);
    osc.frequency.exponentialRampToValueAtTime(42, when + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    osc.connect(gain).connect(this.input);
    osc.start(when);
    osc.stop(when + 0.26);
  }

  private snare(when: number): void {
    this.noiseHit(when, 0.13, "bandpass", 1700, 0.05);
  }

  private hat(when: number, level: number): void {
    this.noiseHit(when, 0.045, "highpass", 7500, level);
  }

  private noiseHit(when: number, length: number, type: BiquadFilterType, frequency: number, level: number): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.0005, when + length);
    source.connect(filter).connect(gain).connect(this.input);
    source.start(when, Math.random() * 1.5);
    source.stop(when + length + 0.02);
  }

  /** Vinyl dust: a looped noise bed plus sparse clicks. */
  private crackle(): void {
    const ctx = this.ctx;
    const length = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.02; // hiss
      if (Math.random() < 0.0004) data[i] += (Math.random() * 2 - 1) * 0.9; // pop
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.value = 0.35;
    source.connect(filter).connect(gain).connect(this.input);
    source.start();
  }
}

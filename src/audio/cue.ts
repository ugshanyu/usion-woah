import type { Verdict } from '../game/types';
import { scheduleProceduralStep, SoundtrackPlayer, type SoundtrackMode } from './soundtrack';

export const COUNTDOWN_OFFSETS_MS = [-3000, -2000, -1000, 0] as const;
export const SYNTH_WOAH_DURATION_MS = 760;

export class CuePlayer {
  private context: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private soundtrack: SoundtrackPlayer | null = null;

  get soundtrackMode(): SoundtrackMode {
    return this.soundtrack?.mode ?? 'silent';
  }

  get soundtrackDurationSeconds(): number | null {
    return this.soundtrack?.durationSeconds ?? null;
  }

  async unlock(): Promise<void> {
    this.context ??= new AudioContext({ latencyHint: 'interactive' });
    this.noiseBuffer ??= this.createNoiseBuffer(this.context);
    if (this.context.state === 'suspended') await this.context.resume();
    this.soundtrack ??= new SoundtrackPlayer(this.context, (step, when, output) => {
      scheduleProceduralStep(step, when, output, {
        kick: (at, volume, node) => this.kick(at, volume, node),
        snare: (at, node) => this.snare(at, node),
        hat: (at, duration, open, node) => this.hat(at, duration, open, node),
        bass: (frequency, at, node) => this.bass(frequency, at, node),
        lead: (frequency, at, node) => this.lead(frequency, at, node),
        chord: (frequencies, at, node) => this.chord(frequencies, at, node),
      });
    });
    void this.soundtrack.prepare();
  }

  startSoundtrack(): void {
    this.soundtrack?.start();
  }

  stopSoundtrack(): void {
    this.soundtrack?.stop();
  }

  scheduleCountdown(targetPerfMs: number): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const target = context.currentTime + Math.max(0, targetPerfMs - performance.now()) / 1000;
    this.soundtrack?.duckForCountdown(target);
    COUNTDOWN_OFFSETS_MS.slice(0, 3).forEach((offset, index) => {
      const when = target + offset / 1000;
      if (when <= context.currentTime + 0.01) return;
      this.countdownHit(when, index);
      if (index === 2) this.riser(when, 0.92);
    });
    this.kick(target, 0.34, context.destination);
    this.subDrop(target, context.destination);
    this.synthWoah(target, context.destination);
  }

  playResult(verdict: Verdict, gameover: boolean): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const start = context.currentTime + 0.02;
    const notes = gameover
      ? [440, 554.37, 659.25, 880]
      : verdict === 'hit'
        ? [440, 659.25, 880]
        : verdict === 'dodge'
          ? [523.25, 392, 293.66]
          : verdict === 'penalty' ? [196, 146.83] : [330, 330];
    notes.forEach((frequency, index) => this.tone(frequency, start + index * 0.11, 0.16, gameover ? 0.18 : 0.13, verdict === 'penalty' ? 'sawtooth' : 'triangle'));
  }

  close(): void {
    this.stopSoundtrack();
    void this.context?.close();
    this.context = null;
    this.noiseBuffer = null;
    this.soundtrack = null;
  }

  private countdownHit(when: number, index: number): void {
    const context = this.context;
    if (!context) return;
    this.kick(when, 0.2 + index * 0.035, context.destination);
    this.tone(330 + index * 110, when, 0.11, 0.095, 'square');
    this.hat(when + 0.12, 0.06, index === 2, context.destination);
  }

  private kick(when: number, volume: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(155, when);
    oscillator.frequency.exponentialRampToValueAtTime(44, when + 0.16);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.23);
    oscillator.connect(gain).connect(output);
    oscillator.start(when);
    oscillator.stop(when + 0.25);
  }

  private snare(when: number, output: AudioNode): void {
    this.noiseHit(when, 0.16, 0.085, 1400, output);
    this.tone(185, when, 0.09, 0.045, 'triangle', undefined, output);
  }

  private hat(when: number, duration: number, open: boolean, output: AudioNode): void {
    this.noiseHit(when, duration, open ? 0.035 : 0.022, open ? 5200 : 6800, output);
  }

  private noiseHit(when: number, duration: number, volume: number, highpass: number, output: AudioNode): void {
    const context = this.context;
    if (!context || !this.noiseBuffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(highpass, when);
    gain.gain.setValueAtTime(Math.max(0.0001, volume), when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter).connect(gain).connect(output);
    source.start(when);
    source.stop(when + duration + 0.01);
  }

  private bass(frequency: number, when: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(frequency, when);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, when);
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.065, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    oscillator.connect(filter).connect(gain).connect(output);
    oscillator.start(when);
    oscillator.stop(when + 0.24);
  }

  private lead(frequency: number, when: number, output: AudioNode): void {
    this.tone(frequency, when, 0.105, 0.025, 'square', frequency * 0.985, output);
  }

  private chord(frequencies: number[], when: number, output: AudioNode): void {
    frequencies.forEach((frequency, index) => this.tone(frequency, when + index * 0.006, 0.32, 0.014, 'triangle', undefined, output));
  }

  private riser(when: number, duration: number): void {
    const context = this.context;
    if (!context || !this.noiseBuffer) return;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(450, when);
    filter.frequency.exponentialRampToValueAtTime(7600, when + duration);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.075, when + duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(when);
    source.stop(when + duration + 0.01);
  }

  private subDrop(when: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(82, when);
    oscillator.frequency.exponentialRampToValueAtTime(38, when + 0.55);
    gain.gain.setValueAtTime(0.24, when);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.62);
    oscillator.connect(gain).connect(output);
    oscillator.start(when);
    oscillator.stop(when + 0.65);
  }

  private synthWoah(when: number, output: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const duration = SYNTH_WOAH_DURATION_MS / 1000;
    const master = context.createGain();
    const delay = context.createDelay(0.5);
    const echo = context.createGain();
    master.gain.setValueAtTime(0.0001, when);
    master.gain.exponentialRampToValueAtTime(0.2, when + 0.045);
    master.gain.setValueAtTime(0.18, when + duration * 0.45);
    master.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    delay.delayTime.value = 0.19;
    echo.gain.value = 0.22;
    master.connect(output);
    master.connect(delay).connect(echo).connect(output);

    const formants = [
      { start: 520, end: 360, q: 7, weight: 1 },
      { start: 920, end: 760, q: 9, weight: 0.48 },
      { start: 2400, end: 2100, q: 11, weight: 0.19 },
    ];
    const filters = formants.map((formant) => {
      const filter = context.createBiquadFilter();
      const weight = context.createGain();
      filter.type = 'bandpass';
      filter.Q.value = formant.q;
      filter.frequency.setValueAtTime(formant.start, when);
      filter.frequency.exponentialRampToValueAtTime(formant.end, when + duration * 0.72);
      weight.gain.value = formant.weight;
      filter.connect(weight).connect(master);
      return filter;
    });
    [-9, 9].forEach((detune) => {
      const voice = context.createOscillator();
      voice.type = 'sawtooth';
      voice.detune.value = detune;
      voice.frequency.setValueAtTime(178, when);
      voice.frequency.exponentialRampToValueAtTime(112, when + duration * 0.82);
      filters.forEach((filter) => voice.connect(filter));
      voice.start(when);
      voice.stop(when + duration + 0.02);
    });
    this.noiseHit(when, 0.07, 0.035, 900, master);
  }

  private tone(frequency: number, when: number, duration: number, volume: number, type: OscillatorType, endFrequency?: number, output?: AudioNode): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, when);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, when + duration * 0.8);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    oscillator.connect(gain).connect(output ?? context.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.5), context.sampleRate);
    const data = buffer.getChannelData(0);
    let state = 0x6d2b79f5;
    for (let index = 0; index < data.length; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      data[index] = (state >>> 0) / 0x80000000 - 1;
    }
    return buffer;
  }
}

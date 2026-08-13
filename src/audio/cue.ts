import type { Verdict } from '../game/types';

export const COUNTDOWN_OFFSETS_MS = [-3000, -2000, -1000, 0] as const;

const MELODY = [220, 277.18, 329.63, 277.18, 246.94, 329.63, 369.99, 329.63];

export class CuePlayer {
  private context: AudioContext | null = null;
  private musicTimer: number | null = null;
  private nextMusicNote = 0;
  private musicStep = 0;

  async unlock(): Promise<void> {
    this.context ??= new AudioContext({ latencyHint: 'interactive' });
    if (this.context.state === 'suspended') await this.context.resume();
  }

  startSoundtrack(): void {
    this.startMusic();
  }

  stopSoundtrack(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  scheduleCountdown(targetPerfMs: number): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const target = context.currentTime + Math.max(0, targetPerfMs - performance.now()) / 1000;
    COUNTDOWN_OFFSETS_MS.slice(0, 3).forEach((offset, index) => {
      const when = target + offset / 1000;
      if (when > context.currentTime + 0.01) this.tone(440 + index * 110, when, 0.09, 0.12, 'square');
    });
    this.tone(220, target, 0.2, 0.28, 'sawtooth', 880);
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
  }

  private startMusic(): void {
    const context = this.context;
    if (!context || this.musicTimer !== null) return;
    this.musicStep = 0;
    this.nextMusicNote = context.currentTime + 0.05;
    this.scheduleMusic();
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 400);
  }

  private scheduleMusic(): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    while (this.nextMusicNote < context.currentTime + 1.2) {
      const frequency = MELODY[this.musicStep % MELODY.length];
      this.tone(frequency, this.nextMusicNote, 0.24, 0.018, 'triangle');
      if (this.musicStep % 4 === 0) this.tone(82.41, this.nextMusicNote, 0.12, 0.035, 'sine', 55);
      this.musicStep += 1;
      this.nextMusicNote += 0.3;
    }
  }

  private tone(frequency: number, when: number, duration: number, volume: number, type: OscillatorType, endFrequency?: number): void {
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
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }
}

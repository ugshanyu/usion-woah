import { midiToFrequency, TRACK_STEP_SECONDS, trackStepAt, type TrackStep } from './original-track';

export const SOUNDTRACK_SHA256 = '8FE25C5D5854494299593B6D7FCB98874B71B755A939AD7044E45B05B2C1D167';
export const SOUNDTRACK_URL = '/audio/krypto9095-woah-feat-d3mstreet-8fe25c5d.mp3';
export const SOUNDTRACK_VOLUME = 0.28;
export type SoundtrackMode = 'silent' | 'bundled-song' | 'procedural-fallback';

type StepScheduler = (step: TrackStep, when: number, output: AudioNode) => void;

export async function decodeSoundtrack(
  context: BaseAudioContext,
  url = SOUNDTRACK_URL,
  fetcher: typeof fetch = fetch,
): Promise<AudioBuffer | null> {
  try {
    const response = await fetcher(url, { cache: 'force-cache', credentials: 'same-origin' });
    if (!response.ok) return null;
    return await context.decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
}

export class SoundtrackPlayer {
  private buffer: AudioBuffer | null = null;
  private preparation: Promise<boolean> | null = null;
  private requested = false;
  private songSource: AudioBufferSourceNode | null = null;
  private songGain: GainNode | null = null;
  private fallbackGain: GainNode | null = null;
  private fallbackTimer: number | null = null;
  private nextFallbackNote = 0;
  private fallbackStep = 0;

  constructor(private readonly context: AudioContext, private readonly scheduleStep: StepScheduler) {}

  get mode(): SoundtrackMode {
    if (this.songSource) return 'bundled-song';
    if (this.fallbackTimer !== null) return 'procedural-fallback';
    return 'silent';
  }

  get durationSeconds(): number | null {
    return this.buffer?.duration ?? null;
  }

  prepare(): Promise<boolean> {
    this.preparation ??= decodeSoundtrack(this.context).then((buffer) => {
      this.buffer = buffer;
      if (buffer && this.requested) this.startSong();
      return Boolean(buffer);
    });
    return this.preparation;
  }

  start(): void {
    this.requested = true;
    if (!this.startSong()) this.startFallback();
    void this.prepare();
  }

  stop(): void {
    this.requested = false;
    this.stopSong();
    this.stopFallback();
  }

  duckForCountdown(targetTime: number): void {
    const gain = this.songGain?.gain;
    if (!gain) return;
    const start = Math.max(this.context.currentTime + 0.01, targetTime - 2.95);
    gain.cancelScheduledValues(start);
    gain.setValueAtTime(SOUNDTRACK_VOLUME, start);
    gain.linearRampToValueAtTime(0.1, Math.max(start + 0.02, targetTime - 0.75));
    gain.setValueAtTime(0.1, targetTime + 0.42);
    gain.linearRampToValueAtTime(SOUNDTRACK_VOLUME, targetTime + 1.05);
  }

  private startSong(): boolean {
    if (!this.buffer) return false;
    if (this.songSource) return true;
    this.stopFallback();
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(SOUNDTRACK_VOLUME, this.context.currentTime + 0.35);
    source.connect(gain).connect(this.context.destination);
    source.onended = () => {
      if (this.songSource === source) {
        this.songSource = null;
        this.songGain = null;
      }
      source.disconnect();
      gain.disconnect();
    };
    this.songSource = source;
    this.songGain = gain;
    source.start(this.context.currentTime + 0.02);
    return true;
  }

  private stopSong(): void {
    const source = this.songSource;
    const gain = this.songGain;
    this.songSource = null;
    this.songGain = null;
    if (!source || !gain) return;
    gain.gain.cancelScheduledValues(this.context.currentTime);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.08);
    try { source.stop(this.context.currentTime + 0.1); } catch { /* already stopped */ }
  }

  private startFallback(): void {
    if (this.fallbackTimer !== null) return;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.72, this.context.currentTime + 0.35);
    gain.connect(this.context.destination);
    this.fallbackGain = gain;
    this.fallbackStep = 0;
    this.nextFallbackNote = this.context.currentTime + 0.05;
    this.scheduleFallback();
    this.fallbackTimer = window.setInterval(() => this.scheduleFallback(), 250);
  }

  private scheduleFallback(): void {
    const output = this.fallbackGain;
    if (!output || this.context.state !== 'running') return;
    while (this.nextFallbackNote < this.context.currentTime + 0.8) {
      this.scheduleStep(trackStepAt(this.fallbackStep), this.nextFallbackNote, output);
      this.fallbackStep += 1;
      this.nextFallbackNote += TRACK_STEP_SECONDS;
    }
  }

  private stopFallback(): void {
    if (this.fallbackTimer !== null) window.clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
    const gain = this.fallbackGain;
    this.fallbackGain = null;
    if (!gain) return;
    gain.gain.cancelScheduledValues(this.context.currentTime);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + 0.08);
  }
}

export function scheduleProceduralStep(step: TrackStep, when: number, output: AudioNode, schedule: {
  kick: (when: number, volume: number, output: AudioNode) => void;
  snare: (when: number, output: AudioNode) => void;
  hat: (when: number, duration: number, open: boolean, output: AudioNode) => void;
  bass: (frequency: number, when: number, output: AudioNode) => void;
  lead: (frequency: number, when: number, output: AudioNode) => void;
  chord: (frequencies: number[], when: number, output: AudioNode) => void;
}): void {
  if (step.kick) schedule.kick(when, 0.16, output);
  if (step.snare) schedule.snare(when, output);
  if (step.closedHat) schedule.hat(when, 0.035, false, output);
  if (step.openHat) schedule.hat(when, 0.12, true, output);
  if (step.bassMidi !== null) schedule.bass(midiToFrequency(step.bassMidi), when, output);
  if (step.leadMidi !== null) schedule.lead(midiToFrequency(step.leadMidi), when, output);
  if (step.chordMidi) schedule.chord(step.chordMidi.map(midiToFrequency), when, output);
}

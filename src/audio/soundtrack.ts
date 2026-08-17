export const SOUNDTRACK_SHA256 = '8FE25C5D5854494299593B6D7FCB98874B71B755A939AD7044E45B05B2C1D167';
export const SOUNDTRACK_URL = '/audio/krypto9095-woah-feat-d3mstreet-8fe25c5d.mp3';
export const SOUNDTRACK_VOLUME = 0.42;
export const ROUND_CUE_LEAD_SECONDS = 3;
export const ROUND_CUE_AUDIBLE_LEAD_SECONDS = 2.45;
export const ROUND_CUE_TAIL_SECONDS = 1.2;

// Verified twice with independent word-timestamp passes over this exact file hash.
export const ROUND_WOAH_ONSETS_SECONDS = [
  13.68, 16.72, 20.12, 23.44, 26.76,
  30.22, 33.36, 36.8, 40.18, 43.48,
] as const;

export type SoundtrackMode = 'silent' | 'loading' | 'bundled-song-ready' | 'bundled-song' | 'procedural-fallback';

export type RoundCueWindow = {
  roundId: number;
  vocalOnsetSeconds: number;
  sourceOffsetSeconds: number;
  durationSeconds: number;
};

type SoundtrackLoader = (context: BaseAudioContext) => Promise<AudioBuffer | null>;
type CueNodes = { source: AudioBufferSourceNode; gain: GainNode };

export function roundCueWindow(roundId: number): RoundCueWindow {
  if (!Number.isInteger(roundId) || roundId < 1 || roundId > ROUND_WOAH_ONSETS_SECONDS.length) {
    throw new Error('invalid_audio_round');
  }
  const vocalOnsetSeconds = ROUND_WOAH_ONSETS_SECONDS[roundId - 1];
  return {
    roundId,
    vocalOnsetSeconds,
    sourceOffsetSeconds: vocalOnsetSeconds - ROUND_CUE_LEAD_SECONDS,
    durationSeconds: ROUND_CUE_LEAD_SECONDS + ROUND_CUE_TAIL_SECONDS,
  };
}

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
  private unavailable = false;
  private readonly activeCues = new Set<CueNodes>();

  constructor(private readonly context: AudioContext, private readonly loader: SoundtrackLoader = decodeSoundtrack) {}

  get mode(): SoundtrackMode {
    if (this.activeCues.size > 0) return 'bundled-song';
    if (this.requested && this.buffer) return 'bundled-song-ready';
    if (this.requested && this.unavailable) return 'procedural-fallback';
    if (this.requested) return 'loading';
    return 'silent';
  }

  get durationSeconds(): number | null {
    return this.buffer?.duration ?? null;
  }

  prepare(): Promise<boolean> {
    this.preparation ??= this.loader(this.context).then((buffer) => {
      this.buffer = buffer;
      this.unavailable = !buffer;
      return Boolean(buffer);
    });
    return this.preparation;
  }

  start(): void {
    this.requested = true;
    void this.prepare();
  }

  scheduleRoundCue(targetTime: number, roundId: number): boolean {
    if (!this.requested || !this.buffer || !Number.isFinite(targetTime)) return false;
    const cue = roundCueWindow(roundId);
    const startTime = targetTime - ROUND_CUE_LEAD_SECONDS;
    if (startTime < this.context.currentTime + 0.05) return false;
    if (cue.sourceOffsetSeconds + cue.durationSeconds > this.buffer.duration) return false;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const nodes = { source, gain };
    source.buffer = this.buffer;
    gain.gain.setValueAtTime(0.0001, startTime);
    // The hook repeats about every 3.3 s. Keep the preceding WHOA tail muted,
    // then open the excerpt after a verified clean gap before this round's word.
    gain.gain.setValueAtTime(0.0001, targetTime - ROUND_CUE_AUDIBLE_LEAD_SECONDS);
    gain.gain.exponentialRampToValueAtTime(SOUNDTRACK_VOLUME, targetTime - ROUND_CUE_AUDIBLE_LEAD_SECONDS + 0.12);
    gain.gain.setValueAtTime(SOUNDTRACK_VOLUME, targetTime + 0.72);
    gain.gain.exponentialRampToValueAtTime(0.0001, targetTime + ROUND_CUE_TAIL_SECONDS);
    source.connect(gain);
    gain.connect(this.context.destination);
    source.onended = () => this.release(nodes);
    this.activeCues.add(nodes);
    try {
      source.start(startTime, cue.sourceOffsetSeconds, cue.durationSeconds);
      return true;
    } catch {
      this.release(nodes);
      return false;
    }
  }

  stop(): void {
    this.requested = false;
    for (const nodes of [...this.activeCues]) {
      try { nodes.source.stop(this.context.currentTime + 0.02); } catch { /* already stopped */ }
      this.release(nodes);
    }
  }

  private release(nodes: CueNodes): void {
    if (!this.activeCues.delete(nodes)) return;
    nodes.source.onended = null;
    nodes.source.disconnect();
    nodes.gain.disconnect();
  }
}

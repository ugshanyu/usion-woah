import { describe, expect, it, vi } from 'vitest';
import {
  decodeSoundtrack,
  ROUND_CUE_AUDIBLE_LEAD_SECONDS,
  ROUND_CUE_LEAD_SECONDS,
  ROUND_CUE_TAIL_SECONDS,
  ROUND_WOAH_ONSETS_SECONDS,
  roundCueWindow,
  SOUNDTRACK_SHA256,
  SOUNDTRACK_URL,
  SOUNDTRACK_VOLUME,
  SoundtrackPlayer,
} from './soundtrack';

describe('bundled soundtrack', () => {
  it('decodes the exact same-origin MP3', async () => {
    const bytes = new ArrayBuffer(12);
    const decoded = { duration: 123.414 } as AudioBuffer;
    const decodeAudioData = vi.fn(async () => decoded);
    const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes } as Response));

    await expect(decodeSoundtrack({ decodeAudioData } as unknown as BaseAudioContext, SOUNDTRACK_URL, fetcher as unknown as typeof fetch)).resolves.toBe(decoded);
    expect(fetcher).toHaveBeenCalledWith(SOUNDTRACK_URL, { cache: 'force-cache', credentials: 'same-origin' });
    expect(decodeAudioData).toHaveBeenCalledWith(bytes);
    expect(SOUNDTRACK_URL.toLowerCase()).toContain(SOUNDTRACK_SHA256.slice(0, 8).toLowerCase());
    expect(SOUNDTRACK_SHA256).toMatch(/^[A-F0-9]{64}$/);
  });

  it('maps all ten rounds to verified vocal markers with exactly three seconds of lead', () => {
    expect(ROUND_WOAH_ONSETS_SECONDS).toEqual([
      13.68, 16.72, 20.12, 23.44, 26.76,
      30.22, 33.36, 36.8, 40.18, 43.48,
    ]);
    expect(ROUND_CUE_LEAD_SECONDS).toBe(3);
    expect(ROUND_CUE_AUDIBLE_LEAD_SECONDS).toBe(2.45);
    expect(ROUND_CUE_TAIL_SECONDS).toBe(1.2);
    for (let roundId = 1; roundId <= 10; roundId += 1) {
      const cue = roundCueWindow(roundId);
      expect(cue.vocalOnsetSeconds - cue.sourceOffsetSeconds).toBeCloseTo(3, 8);
      expect(cue.durationSeconds).toBeCloseTo(4.2, 8);
    }
    expect(() => roundCueWindow(0)).toThrow('invalid_audio_round');
    expect(() => roundCueWindow(11)).toThrow('invalid_audio_round');
    expect(() => roundCueWindow(1.5)).toThrow('invalid_audio_round');
  });

  it('mutes every preceding WHOA before opening the next round excerpt', () => {
    const verifiedEnds = [14.16, 17.44, 20.82, 24.1, 27.44, 30.7, 33.92, 37.22, 40.76];
    for (let roundId = 2; roundId <= 10; roundId += 1) {
      const audibleFileStart = roundCueWindow(roundId).vocalOnsetSeconds - ROUND_CUE_AUDIBLE_LEAD_SECONDS;
      expect(audibleFileStart).toBeGreaterThanOrEqual(verifiedEnds[roundId - 2] + 0.1);
    }
  });

  it('schedules the decoded source so the real vocal lands on the host-clock target', async () => {
    const { context, source, gain } = fakeAudioContext(10, 123.414);
    const decoded = { duration: 123.414 } as AudioBuffer;
    const player = new SoundtrackPlayer(context, async () => decoded);
    player.start();
    await expect(player.prepare()).resolves.toBe(true);
    expect(player.mode).toBe('bundled-song-ready');

    expect(player.scheduleRoundCue(20, 3)).toBe(true);
    const cue = roundCueWindow(3);
    expect(source.start).toHaveBeenCalledWith(17, cue.sourceOffsetSeconds, cue.durationSeconds);
    expect(17 + (cue.vocalOnsetSeconds - cue.sourceOffsetSeconds)).toBeCloseTo(20, 8);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.0001, 20 - ROUND_CUE_AUDIBLE_LEAD_SECONDS);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(SOUNDTRACK_VOLUME, 20.72);
    expect(player.mode).toBe('bundled-song');

    source.onended?.(new Event('ended'));
    expect(player.mode).toBe('bundled-song-ready');
  });

  it('rejects a late cue instead of shifting the vocal away from T=0', async () => {
    const { context, source } = fakeAudioContext(10, 123.414);
    const player = new SoundtrackPlayer(context, async () => ({ duration: 123.414 } as AudioBuffer));
    player.start();
    await player.prepare();
    expect(player.scheduleRoundCue(13.04, 1)).toBe(false);
    expect(source.start).not.toHaveBeenCalled();
  });

  it('exposes the synthetic fallback when fetch or decode fails', async () => {
    const failedFetch = vi.fn(async () => ({ ok: false } as Response));
    const context = { decodeAudioData: vi.fn() } as unknown as BaseAudioContext;
    await expect(decodeSoundtrack(context, SOUNDTRACK_URL, failedFetch as unknown as typeof fetch)).resolves.toBeNull();
    expect(context.decodeAudioData).not.toHaveBeenCalled();

    const fake = fakeAudioContext(10, 123.414);
    const player = new SoundtrackPlayer(fake.context, async () => null);
    player.start();
    await expect(player.prepare()).resolves.toBe(false);
    expect(player.mode).toBe('procedural-fallback');
    expect(player.scheduleRoundCue(20, 1)).toBe(false);
  });
});

function fakeAudioContext(currentTime: number, duration: number) {
  const audioParam = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  const source = {
    buffer: null as AudioBuffer | null,
    onended: null as ((event: Event) => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const gain = { gain: audioParam, connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    currentTime,
    destination: {},
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    decodeAudioData: vi.fn(async () => ({ duration } as AudioBuffer)),
  } as unknown as AudioContext;
  return { context, source, gain };
}

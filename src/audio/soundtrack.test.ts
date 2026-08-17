import { describe, expect, it, vi } from 'vitest';
import { decodeSoundtrack, SOUNDTRACK_SHA256, SOUNDTRACK_URL, SOUNDTRACK_VOLUME } from './soundtrack';

describe('bundled soundtrack', () => {
  it('decodes the same-origin MP3 without changing the critical cue clock', async () => {
    const bytes = new ArrayBuffer(12);
    const decoded = { duration: 188.5 } as AudioBuffer;
    const decodeAudioData = vi.fn(async () => decoded);
    const fetcher = vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes } as Response));

    await expect(decodeSoundtrack({ decodeAudioData } as unknown as BaseAudioContext, SOUNDTRACK_URL, fetcher as unknown as typeof fetch)).resolves.toBe(decoded);
    expect(fetcher).toHaveBeenCalledWith(SOUNDTRACK_URL, { cache: 'force-cache', credentials: 'same-origin' });
    expect(decodeAudioData).toHaveBeenCalledWith(bytes);
    expect(SOUNDTRACK_URL).toMatch(/^\/audio\/.+\.mp3$/);
    expect(SOUNDTRACK_URL.toLowerCase()).toContain(SOUNDTRACK_SHA256.slice(0, 8).toLowerCase());
    expect(SOUNDTRACK_SHA256).toMatch(/^[A-F0-9]{64}$/);
    expect(SOUNDTRACK_VOLUME).toBeGreaterThan(0);
    expect(SOUNDTRACK_VOLUME).toBeLessThan(0.5);
  });

  it('returns null so playback can fall back when fetch or decode fails', async () => {
    const failedFetch = vi.fn(async () => ({ ok: false } as Response));
    const context = { decodeAudioData: vi.fn() } as unknown as BaseAudioContext;
    await expect(decodeSoundtrack(context, SOUNDTRACK_URL, failedFetch as unknown as typeof fetch)).resolves.toBeNull();
    expect(context.decodeAudioData).not.toHaveBeenCalled();

    const rejectedDecode = { decodeAudioData: vi.fn(async () => { throw new Error('bad_mp3'); }) } as unknown as BaseAudioContext;
    const okFetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) } as Response));
    await expect(decodeSoundtrack(rejectedDecode, SOUNDTRACK_URL, okFetch as unknown as typeof fetch)).resolves.toBeNull();
  });
});

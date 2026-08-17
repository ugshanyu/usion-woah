import { describe, expect, it } from 'vitest';
import { ROUND_ANNOUNCE_LEAD_MS } from '../game/timing';
import { COUNTDOWN_OFFSETS_MS, SYNTH_WOAH_DURATION_MS } from './cue';

describe('synchronized audio countdown', () => {
  it('places WOAH exactly at the zero-time boundary', () => {
    expect(COUNTDOWN_OFFSETS_MS).toEqual([-3000, -2000, -1000, 0]);
    expect(COUNTDOWN_OFFSETS_MS.at(-1)).toBe(0);
    expect(SYNTH_WOAH_DURATION_MS).toBeGreaterThanOrEqual(700);
    expect(SYNTH_WOAH_DURATION_MS).toBeLessThan(1000);
  });

  it('announces each round before the three-second decoded excerpt must start', () => {
    expect(ROUND_ANNOUNCE_LEAD_MS + COUNTDOWN_OFFSETS_MS[0]).toBe(500);
  });
});

import { describe, expect, it } from 'vitest';
import { COUNTDOWN_OFFSETS_MS } from './cue';

describe('synchronized audio countdown', () => {
  it('places WOAH exactly at the zero-time boundary', () => {
    expect(COUNTDOWN_OFFSETS_MS).toEqual([-3000, -2000, -1000, 0]);
    expect(COUNTDOWN_OFFSETS_MS.at(-1)).toBe(0);
  });
});

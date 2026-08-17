import { describe, expect, it } from 'vitest';
import { midiToFrequency, TRACK_BAR_SECONDS, TRACK_STEP_SECONDS, TRACK_STEPS_PER_BAR, TRACK_TEMPO_BPM, trackStepAt } from './original-track';

describe('original WOAH soundtrack pattern', () => {
  it('uses a deterministic 120 BPM two-second bar', () => {
    expect(TRACK_TEMPO_BPM).toBe(120);
    expect(TRACK_STEP_SECONDS).toBe(0.125);
    expect(TRACK_STEPS_PER_BAR).toBe(16);
    expect(TRACK_BAR_SECONDS).toBe(2);
    expect(Array.from({ length: 16 }, (_, step) => trackStepAt(step + 16))).toEqual(
      Array.from({ length: 16 }, (_, step) => trackStepAt(step)),
    );
  });

  it('has a complete club/trap rhythm and an original melodic contour', () => {
    const bar = Array.from({ length: 16 }, (_, step) => trackStepAt(step));
    expect(bar.filter((step) => step.kick)).toHaveLength(6);
    expect(bar[4].snare).toBe(true);
    expect(bar[12].snare).toBe(true);
    expect(bar.filter((step) => step.closedHat)).toHaveLength(8);
    expect(bar.filter((step) => step.openHat)).toHaveLength(2);
    expect(bar.filter((step) => step.bassMidi !== null).length).toBeGreaterThanOrEqual(6);
    expect(new Set(bar.flatMap((step) => step.leadMidi ?? [])).size).toBeGreaterThanOrEqual(4);
    expect(bar.filter((step) => step.chordMidi !== null)).toHaveLength(3);
  });

  it('converts equal-tempered MIDI notes accurately and rejects fractional steps', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(57)).toBe(220);
    expect(() => trackStepAt(1.5)).toThrow('invalid_track_step');
  });
});

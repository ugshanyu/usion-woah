import { describe, expect, it } from 'vitest';
import type { DirectionSample, GestureSummary, SwipeGesture } from './types';
import { judgeRound, summarizeHeadGesture, summarizeSwipe } from './rules';

function sample(time: number, direction: DirectionSample['direction'], frameSeq: number): DirectionSample {
  return { frameSeq, generation: 1, capturePerfMs: time, direction, confidence: 0.9, quality: 0.9 };
}

function summary(role: GestureSummary['role'], direction: GestureSummary['direction'], onset = 1000): GestureSummary {
  return { roundId: 1, role, direction, onsetHostMs: onset, peakHostMs: onset + 30, confidence: 0.9, clockSigmaMs: 10, frameSeq: 1, generation: 1 };
}

describe('round rules', () => {
  it('requires neutral rearm and uses source capture timestamps', () => {
    const samples = [sample(720, 'neutral', 1), sample(800, 'neutral', 2), sample(1040, 'right', 3), sample(1100, 'right', 4)];
    const result = summarizeHeadGesture(samples, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time + 100, clockSigmaMs: 10 });
    expect(result?.direction).toBe('right');
    expect(result?.onsetHostMs).toBe(1140);
  });

  it('voids held head turns, low clock quality, and mismatched timing', () => {
    const held = [sample(720, 'right', 1), sample(800, 'right', 2), sample(1040, 'right', 3), sample(1100, 'right', 4)];
    expect(summarizeHeadGesture(held, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time, clockSigmaMs: 10 })).toBeNull();
    expect(judgeRound(1, summary('pointer', 'left'), summary('looker', 'right', 1181)).verdict).toBe('void');
    expect(judgeRound(1, { ...summary('pointer', 'left'), clockSigmaMs: 51 }, summary('looker', 'right')).verdict).toBe('void');
  });

  it('accepts one timestamped swipe only inside the WOAH window', () => {
    const swipe: SwipeGesture = { direction: 'left', onsetLocalMs: 1080, peakLocalMs: 1080, confidence: 0.9, sequence: 4 };
    const window = { roundId: 1, role: 'pointer' as const, generation: 1, targetLocalMs: 1000, toHostTime: (time: number) => time + 25, clockSigmaMs: 10 };
    expect(summarizeSwipe(swipe, window)).toMatchObject({ direction: 'left', onsetHostMs: 1105, frameSeq: 4 });
    expect(summarizeSwipe({ ...swipe, onsetLocalMs: 1221 }, window)).toBeNull();
    expect(summarizeSwipe({ ...swipe, onsetLocalMs: 919 }, window)).toBeNull();
  });

  it('awards hit for a match and dodge for a different direction', () => {
    expect(judgeRound(1, summary('pointer', 'up'), summary('looker', 'up')).verdict).toBe('hit');
    expect(judgeRound(1, summary('pointer', 'up'), summary('looker', 'left')).verdict).toBe('dodge');
  });

  it('uses an inclusive 180ms fairness boundary', () => {
    expect(judgeRound(1, summary('pointer', 'up', 1000), summary('looker', 'left', 1180)).verdict).toBe('dodge');
    expect(judgeRound(1, summary('pointer', 'up', 1000), summary('looker', 'left', 1181)).verdict).toBe('void');
  });
});

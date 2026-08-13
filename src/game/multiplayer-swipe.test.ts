import { describe, expect, it } from 'vitest';
import { judgeRound, summarizeHeadGesture, summarizeSwipe } from './rules';
import type { Direction, DirectionSample, SwipeGesture } from './types';

function headSample(at: number, direction: Direction, frameSeq: number): DirectionSample {
  return { capturePerfMs: at, direction, frameSeq, generation: 9, confidence: 0.92, quality: 0.9 };
}

describe('two-client synchronized swipe vs head flow', () => {
  it('converts both device clocks to host time before judging a hit', () => {
    const pointerSwipe: SwipeGesture = { direction: 'right', onsetLocalMs: 1040, peakLocalMs: 1040, confidence: 0.95, sequence: 3 };
    const pointer = summarizeSwipe(pointerSwipe, {
      roundId: 4, role: 'pointer', generation: 9, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 12,
    });
    const looker = summarizeHeadGesture([
      headSample(520, 'neutral', 1), headSample(620, 'neutral', 2),
      headSample(840, 'right', 3), headSample(900, 'right', 4),
    ], {
      roundId: 4, role: 'looker', generation: 9, targetLocalMs: 800,
      toHostTime: (localMs) => localMs + 200, clockSigmaMs: 14,
    });

    expect(pointer?.onsetHostMs).toBe(1040);
    expect(looker?.onsetHostMs).toBe(1040);
    expect(judgeRound(4, pointer, looker)).toMatchObject({ verdict: 'hit', reason: 'same_direction' });
  });

  it('awards a dodge from capture timestamps regardless of message arrival order', () => {
    const pointer = summarizeSwipe({ direction: 'up', onsetLocalMs: 1080, peakLocalMs: 1080, confidence: 0.95, sequence: 7 }, {
      roundId: 5, role: 'pointer', generation: 10, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 10,
    });
    const looker = summarizeHeadGesture([
      headSample(720, 'neutral', 1), headSample(800, 'neutral', 2),
      headSample(1050, 'left', 3), headSample(1110, 'left', 4),
    ], {
      roundId: 5, role: 'looker', generation: 10, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 10,
    });

    expect(judgeRound(5, pointer, looker)).toMatchObject({ verdict: 'dodge', reason: 'different_direction' });
  });
});

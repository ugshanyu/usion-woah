import { describe, expect, it } from 'vitest';
import { judgeRound, summarizeDirectionChoice, summarizeHeadGesture } from './rules';
import type { Direction, DirectionChoice, DirectionSample } from './types';

function headSample(at: number, direction: Direction, frameSeq: number, generation = 9): DirectionSample {
  return { capturePerfMs: at, direction, frameSeq, generation, confidence: 0.92, quality: 0.9 };
}

describe('two-client synchronized direction-button vs head flow', () => {
  it('converts device clocks while keeping a pre-WOAH guess valid for a hit', () => {
    const pointerChoice: DirectionChoice = { direction: 'right', selectedLocalMs: 600, confidence: 1, sequence: 3 };
    const pointer = summarizeDirectionChoice(pointerChoice, {
      roundId: 4, role: 'pointer', generation: 9, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 12,
    });
    const looker = summarizeHeadGesture([
      headSample(-700, 'neutral', 1), headSample(-500, 'neutral', 2),
      headSample(840, 'right', 3), headSample(900, 'right', 4), headSample(960, 'right', 5),
    ], {
      roundId: 4, role: 'looker', generation: 9, targetLocalMs: 800,
      toHostTime: (localMs) => localMs + 200, clockSigmaMs: 14,
    });

    expect(pointer?.onsetHostMs).toBe(600);
    expect(looker?.onsetHostMs).toBe(1040);
    expect(judgeRound(4, pointer, looker)).toMatchObject({ verdict: 'hit', reason: 'same_direction' });
  });

  it('judges a miss from capture timestamps regardless of message arrival order', () => {
    const pointer = summarizeDirectionChoice({ direction: 'up', selectedLocalMs: 700, confidence: 1, sequence: 7 }, {
      roundId: 5, role: 'pointer', generation: 10, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 10,
    });
    const looker = summarizeHeadGesture([
      headSample(-500, 'neutral', 1, 10), headSample(-300, 'neutral', 2, 10),
      headSample(1050, 'left', 3, 10), headSample(1110, 'left', 4, 10), headSample(1170, 'left', 5, 10),
    ], {
      roundId: 5, role: 'looker', generation: 10, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 10,
    });

    expect(judgeRound(5, pointer, looker)).toMatchObject({ verdict: 'dodge', reason: 'different_direction' });
  });

  it('never awards a hit when the button is down and the detected face is up', () => {
    const pointer = summarizeDirectionChoice({ direction: 'down', selectedLocalMs: 700, confidence: 1, sequence: 8 }, {
      roundId: 6, role: 'pointer', generation: 11, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 10,
    });
    const looker = summarizeHeadGesture([
      headSample(-500, 'neutral', 1, 11), headSample(-300, 'neutral', 2, 11),
      headSample(1020, 'up', 3, 11), headSample(1120, 'up', 4, 11), headSample(1220, 'up', 5, 11),
    ], {
      roundId: 6, role: 'looker', generation: 11, targetLocalMs: 1000,
      toHostTime: (localMs) => localMs, clockSigmaMs: 10,
    });

    expect(judgeRound(6, pointer, looker)).toMatchObject({ verdict: 'dodge', reason: 'different_direction' });
  });
});

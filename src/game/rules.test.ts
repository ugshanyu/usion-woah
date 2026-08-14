import { describe, expect, it } from 'vitest';
import type { DirectionChoice, DirectionSample, GestureSummary } from './types';
import { chooseFirstPointer, judgeRound, nextPointerForResult, scoreRound, summarizeDirectionChoice, summarizeHeadGesture } from './rules';

function sample(time: number, direction: DirectionSample['direction'], frameSeq: number, overrides: Partial<DirectionSample> = {}): DirectionSample {
  return { frameSeq, generation: 1, capturePerfMs: time, direction, confidence: 0.9, quality: 0.9, ...overrides };
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

  it('accepts a movement after valid pre-beat face frames drift outside the narrow neutral class', () => {
    const samples = [
      sample(720, 'unknown', 1, { facePresent: true, quality: 0 }),
      sample(800, 'unknown', 2, { facePresent: true, quality: 0 }),
      sample(1040, 'right', 3),
      sample(1100, 'right', 4),
    ];
    const result = summarizeHeadGesture(samples, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time, clockSigmaMs: 10 });
    expect(result?.direction).toBe('right');
  });

  it('reads local vision samples independently from the shared protocol generation', () => {
    const samples = [
      sample(720, 'neutral', 1, { generation: 7 }),
      sample(800, 'neutral', 2, { generation: 7 }),
      sample(1040, 'down', 3, { generation: 7 }),
      sample(1100, 'down', 4, { generation: 7 }),
    ];
    const result = summarizeHeadGesture(samples, {
      roundId: 1,
      role: 'looker',
      generation: 1,
      sampleGeneration: 7,
      targetLocalMs: 1000,
      toHostTime: (time) => time,
      clockSigmaMs: 10,
    });
    expect(result).toMatchObject({ direction: 'down', generation: 1 });
  });

  it('does not use missing-face frames to rearm a round', () => {
    const samples = [
      sample(720, 'unknown', 1, { facePresent: false, quality: 0 }),
      sample(800, 'unknown', 2, { facePresent: false, quality: 0 }),
      sample(1040, 'right', 3),
      sample(1100, 'right', 4),
    ];
    expect(summarizeHeadGesture(samples, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time, clockSigmaMs: 10 })).toBeNull();
  });

  it('accepts two stable direction frames at the slow-device cadence', () => {
    const samples = [
      sample(500, 'neutral', 1),
      sample(670, 'neutral', 2),
      sample(1080, 'right', 3, { confidence: 0.32 }),
      sample(1280, 'right', 4, { confidence: 0.34 }),
    ];
    const result = summarizeHeadGesture(samples, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time, clockSigmaMs: 10 });
    expect(result).toMatchObject({ direction: 'right', confidence: 0.32 });
    expect(judgeRound(1, summary('pointer', 'right'), result).verdict).toBe('hit');
  });

  it('rejects direction frames outside the supported stability gap or 0–3 second post-WOAH window', () => {
    const neutral = [sample(500, 'neutral', 1), sample(670, 'neutral', 2)];
    const window = { roundId: 1, role: 'looker' as const, generation: 1, targetLocalMs: 1000, toHostTime: (time: number) => time, clockSigmaMs: 10 };
    expect(summarizeHeadGesture([...neutral, sample(1000, 'up', 3), sample(1241, 'up', 4)], window)).toBeNull();
    expect(summarizeHeadGesture([...neutral, sample(900, 'up', 3), sample(950, 'up', 4)], window)).toBeNull();
    expect(summarizeHeadGesture([...neutral, sample(3900, 'up', 3), sample(4001, 'up', 4)], window)).toBeNull();
  });

  it('accepts stable face evidence immediately or at the exact 3 second boundary', () => {
    const neutral = [sample(500, 'neutral', 1), sample(670, 'neutral', 2)];
    const window = { roundId: 1, role: 'looker' as const, generation: 1, targetLocalMs: 1000, toHostTime: (time: number) => time, clockSigmaMs: 10 };
    expect(summarizeHeadGesture([...neutral, sample(1000, 'left', 3), sample(1080, 'left', 4)], window)?.direction).toBe('left');
    expect(summarizeHeadGesture([...neutral, sample(3900, 'down', 5), sample(4000, 'down', 6)], window)?.direction).toBe('down');
  });

  it('locks the first stable direction instead of a stronger later direction', () => {
    const samples = [
      sample(500, 'neutral', 1), sample(670, 'neutral', 2),
      sample(1020, 'right', 3, { confidence: 0.25 }), sample(1080, 'right', 4, { confidence: 0.25 }),
      sample(1140, 'up', 5, { confidence: 0.7 }), sample(1240, 'up', 6, { confidence: 0.8 }), sample(1340, 'up', 7, { confidence: 0.85 }),
    ];
    const result = summarizeHeadGesture(samples, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time, clockSigmaMs: 10 });
    expect(result?.direction).toBe('right');
  });

  it('locks the earliest competing direction and rejects stale vision generations', () => {
    const window = { roundId: 1, role: 'looker' as const, generation: 2, targetLocalMs: 1000, toHostTime: (time: number) => time, clockSigmaMs: 10 };
    const stale = [sample(500, 'neutral', 1), sample(670, 'neutral', 2), sample(1040, 'left', 3), sample(1120, 'left', 4)];
    expect(summarizeHeadGesture(stale, window)).toBeNull();
    const ambiguous = [
      sample(500, 'neutral', 1, { generation: 2 }), sample(670, 'neutral', 2, { generation: 2 }),
      sample(1040, 'left', 3, { generation: 2, confidence: 0.7 }), sample(1140, 'left', 4, { generation: 2, confidence: 0.7 }),
      sample(1240, 'up', 5, { generation: 2, confidence: 0.72 }), sample(1340, 'up', 6, { generation: 2, confidence: 0.72 }),
    ];
    expect(summarizeHeadGesture(ambiguous, window)?.direction).toBe('left');
  });

  it('voids held head turns and low clock quality', () => {
    const held = [sample(720, 'right', 1), sample(800, 'right', 2), sample(1040, 'right', 3), sample(1100, 'right', 4)];
    expect(summarizeHeadGesture(held, { roundId: 1, role: 'looker', generation: 1, targetLocalMs: 1000, toHostTime: (time) => time, clockSigmaMs: 10 })).toBeNull();
    expect(judgeRound(1, { ...summary('pointer', 'left'), clockSigmaMs: 51 }, summary('looker', 'right')).verdict).toBe('void');
  });

  it('accepts one timestamped guess during the countdown and closes at WOAH', () => {
    const choice: DirectionChoice = { direction: 'left', selectedLocalMs: 800, confidence: 1, sequence: 4 };
    const window = { roundId: 1, role: 'pointer' as const, generation: 1, targetLocalMs: 1000, toHostTime: (time: number) => time + 25, clockSigmaMs: 10 };
    expect(summarizeDirectionChoice(choice, window)).toMatchObject({ direction: 'left', onsetHostMs: 825, frameSeq: 4 });
    expect(summarizeDirectionChoice({ ...choice, selectedLocalMs: 1000 }, window)).not.toBeNull();
    expect(summarizeDirectionChoice({ ...choice, selectedLocalMs: 1001 }, window)).toBeNull();
    expect(summarizeDirectionChoice({ ...choice, selectedLocalMs: -2501 }, window)).toBeNull();
  });

  it('awards hit for a match and dodge for a different direction', () => {
    expect(judgeRound(1, summary('pointer', 'up'), summary('looker', 'up')).verdict).toBe('hit');
    expect(judgeRound(1, summary('pointer', 'up'), summary('looker', 'left')).verdict).toBe('dodge');
  });

  it('compares directions without treating an earlier guess as a late camera gesture', () => {
    expect(judgeRound(1, summary('pointer', 'up', 7000), summary('looker', 'up', 10_000)).verdict).toBe('hit');
    expect(judgeRound(1, summary('pointer', 'up', 7000), summary('looker', 'left', 10_000)).verdict).toBe('dodge');
  });

  it('keeps the turn and scores only for a correct guess', () => {
    const hit = judgeRound(1, summary('pointer', 'up'), summary('looker', 'up'));
    const miss = judgeRound(2, summary('pointer', 'up'), summary('looker', 'left'));
    expect(scoreRound({ pointer: 1, looker: 2 }, hit, 'pointer', 'looker')).toEqual({ pointer: 2, looker: 2 });
    expect(scoreRound({ pointer: 1, looker: 2 }, miss, 'pointer', 'looker')).toEqual({ pointer: 1, looker: 2 });
    expect(nextPointerForResult(hit, 'pointer', 'looker')).toBe('pointer');
    expect(nextPointerForResult(miss, 'pointer', 'looker')).toBe('looker');
  });

  it('penalizes missing movement without allowing negative scores', () => {
    const pointerTimeout = judgeRound(1, null, summary('looker', 'up'), 'missing', 'ok');
    const lookerTimeout = judgeRound(2, summary('pointer', 'up'), null, 'ok', 'missing');
    const bothTimeout = judgeRound(3, null, null, 'missing', 'missing');
    expect(pointerTimeout).toMatchObject({ verdict: 'penalty', reason: 'pointer_timeout' });
    expect(lookerTimeout).toMatchObject({ verdict: 'penalty', reason: 'looker_timeout' });
    expect(scoreRound({ pointer: 0, looker: 2 }, pointerTimeout, 'pointer', 'looker')).toEqual({ pointer: 0, looker: 2 });
    expect(scoreRound({ pointer: 1, looker: 2 }, lookerTimeout, 'pointer', 'looker')).toEqual({ pointer: 1, looker: 1 });
    expect(scoreRound({ pointer: 1, looker: 1 }, bothTimeout, 'pointer', 'looker')).toEqual({ pointer: 0, looker: 0 });
  });

  it('does not penalize a clock-uncertain observation and replays the same turn', () => {
    const replay = judgeRound(1, null, summary('looker', 'up'), 'clock-uncertain', 'ok');
    expect(replay).toMatchObject({ verdict: 'void', reason: 'clock_uncertain' });
    expect(scoreRound({ pointer: 2, looker: 1 }, replay, 'pointer', 'looker')).toEqual({ pointer: 2, looker: 1 });
    expect(nextPointerForResult(replay, 'pointer', 'looker')).toBe('pointer');
  });

  it('chooses either player deterministically from the host random value', () => {
    expect(chooseFirstPointer(['host', 'guest'], 4)).toBe('host');
    expect(chooseFirstPointer(['host', 'guest'], 5)).toBe('guest');
    expect(() => chooseFirstPointer(['host'], 1)).toThrow('two_players_required');
  });
});

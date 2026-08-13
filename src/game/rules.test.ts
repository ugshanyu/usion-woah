import { describe, expect, it } from 'vitest';
import type { DirectionChoice, DirectionSample, GestureSummary } from './types';
import { chooseFirstPointer, judgeRound, nextPointerForResult, scoreRound, summarizeDirectionChoice, summarizeHeadGesture } from './rules';

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

  it('accepts one timestamped direction button only inside the WOAH window', () => {
    const choice: DirectionChoice = { direction: 'left', selectedLocalMs: 1080, confidence: 1, sequence: 4 };
    const window = { roundId: 1, role: 'pointer' as const, generation: 1, targetLocalMs: 1000, toHostTime: (time: number) => time + 25, clockSigmaMs: 10 };
    expect(summarizeDirectionChoice(choice, window)).toMatchObject({ direction: 'left', onsetHostMs: 1105, frameSeq: 4 });
    expect(summarizeDirectionChoice({ ...choice, selectedLocalMs: 1221 }, window)).toBeNull();
    expect(summarizeDirectionChoice({ ...choice, selectedLocalMs: 919 }, window)).toBeNull();
  });

  it('awards hit for a match and dodge for a different direction', () => {
    expect(judgeRound(1, summary('pointer', 'up'), summary('looker', 'up')).verdict).toBe('hit');
    expect(judgeRound(1, summary('pointer', 'up'), summary('looker', 'left')).verdict).toBe('dodge');
  });

  it('uses an inclusive 180ms fairness boundary', () => {
    expect(judgeRound(1, summary('pointer', 'up', 1000), summary('looker', 'left', 1180)).verdict).toBe('dodge');
    expect(judgeRound(1, summary('pointer', 'up', 1000), summary('looker', 'left', 1181)).verdict).toBe('void');
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

import type { DirectionSample, GestureSummary, Role, RoundResult, Score, SwipeGesture } from './types';

const CARDINAL = new Set(['up', 'down', 'left', 'right']);

export type GestureWindow = {
  roundId: number;
  role: Role;
  generation: number;
  targetLocalMs: number;
  toHostTime: (localMs: number) => number;
  clockSigmaMs: number;
};

export function summarizeHeadGesture(samples: DirectionSample[], window: GestureWindow): GestureSummary | null {
  if (window.role !== 'looker' || window.clockSigmaMs > 50) return null;
  const neutral = samples.filter((sample) => sample.capturePerfMs >= window.targetLocalMs - 300 && sample.capturePerfMs <= window.targetLocalMs - 80 && sample.direction === 'neutral' && sample.quality >= 0.6);
  if (neutral.length < 2) return null;
  const active = samples.filter((sample) => sample.capturePerfMs >= window.targetLocalMs - 80 && sample.capturePerfMs <= window.targetLocalMs + 220 && CARDINAL.has(sample.direction) && sample.confidence >= 0.65 && sample.quality >= 0.6);
  if (active.length < 2) return null;

  for (let index = 0; index < active.length - 1; index += 1) {
    const first = active[index];
    const second = active[index + 1];
    if (first.direction !== second.direction || second.capturePerfMs - first.capturePerfMs > 140) continue;
    const same = active.filter((sample) => sample.direction === first.direction && sample.capturePerfMs >= first.capturePerfMs && sample.capturePerfMs <= first.capturePerfMs + 120);
    const peak = same.sort((a, b) => b.confidence - a.confidence)[0] ?? second;
    return {
      roundId: window.roundId,
      role: window.role,
      direction: first.direction,
      onsetHostMs: window.toHostTime(first.capturePerfMs),
      peakHostMs: window.toHostTime(peak.capturePerfMs),
      confidence: Math.min(first.confidence, second.confidence),
      clockSigmaMs: window.clockSigmaMs,
      frameSeq: peak.frameSeq,
      generation: window.generation,
    };
  }
  return null;
}

export function summarizeSwipe(gesture: SwipeGesture | null, window: GestureWindow): GestureSummary | null {
  if (!gesture || window.role !== 'pointer' || window.clockSigmaMs > 50 || gesture.confidence < 0.75) return null;
  if (gesture.onsetLocalMs < window.targetLocalMs - 80 || gesture.onsetLocalMs > window.targetLocalMs + 220) return null;
  return {
    roundId: window.roundId,
    role: 'pointer',
    direction: gesture.direction,
    onsetHostMs: window.toHostTime(gesture.onsetLocalMs),
    peakHostMs: window.toHostTime(gesture.peakLocalMs),
    confidence: gesture.confidence,
    clockSigmaMs: window.clockSigmaMs,
    frameSeq: gesture.sequence,
    generation: window.generation,
  };
}

export function judgeRound(roundId: number, pointer: GestureSummary | null, looker: GestureSummary | null): RoundResult {
  if (!pointer || !looker || pointer.role !== 'pointer' || looker.role !== 'looker') {
    return { roundId, verdict: 'void', reason: 'invalid_sample', pointer, looker };
  }
  if (!CARDINAL.has(pointer.direction) || !CARDINAL.has(looker.direction) || pointer.confidence < 0.65 || looker.confidence < 0.65) {
    return { roundId, verdict: 'void', reason: 'invalid_sample', pointer, looker };
  }
  if (pointer.clockSigmaMs > 50 || looker.clockSigmaMs > 50) {
    return { roundId, verdict: 'void', reason: 'clock_uncertain', pointer, looker };
  }
  if (Math.abs(pointer.onsetHostMs - looker.onsetHostMs) > 180) {
    return { roundId, verdict: 'void', reason: 'timing_mismatch', pointer, looker };
  }
  const hit = pointer.direction === looker.direction;
  return {
    roundId,
    verdict: hit ? 'hit' : 'dodge',
    reason: hit ? 'same_direction' : 'different_direction',
    pointer,
    looker,
  };
}

export function scoreRound(score: Score, result: RoundResult, pointerId: string, lookerId: string): Score {
  if (result.verdict === 'void') return score;
  const winnerId = result.verdict === 'hit' ? pointerId : lookerId;
  return { ...score, [winnerId]: (score[winnerId] ?? 0) + 1 };
}

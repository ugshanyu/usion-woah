import type { DirectionChoice, DirectionSample, GestureSummary, ObservationStatus, Role, RoundResult, Score } from './types';

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

export function summarizeDirectionChoice(choice: DirectionChoice | null, window: GestureWindow): GestureSummary | null {
  if (!choice || window.role !== 'pointer' || window.clockSigmaMs > 50 || choice.confidence < 0.75) return null;
  if (choice.selectedLocalMs < window.targetLocalMs - 80 || choice.selectedLocalMs > window.targetLocalMs + 220) return null;
  return {
    roundId: window.roundId,
    role: 'pointer',
    direction: choice.direction,
    onsetHostMs: window.toHostTime(choice.selectedLocalMs),
    peakHostMs: window.toHostTime(choice.selectedLocalMs),
    confidence: choice.confidence,
    clockSigmaMs: window.clockSigmaMs,
    frameSeq: choice.sequence,
    generation: window.generation,
  };
}

export function judgeRound(roundId: number, pointer: GestureSummary | null, looker: GestureSummary | null, pointerStatus: ObservationStatus = pointer ? 'ok' : 'missing', lookerStatus: ObservationStatus = looker ? 'ok' : 'missing'): RoundResult {
  if (pointerStatus === 'clock-uncertain' || lookerStatus === 'clock-uncertain') {
    return { roundId, verdict: 'void', reason: 'clock_uncertain', pointer, looker };
  }
  if (pointerStatus === 'missing' || lookerStatus === 'missing') {
    const reason = pointerStatus === 'missing' && lookerStatus === 'missing'
      ? 'both_timeout'
      : pointerStatus === 'missing' ? 'pointer_timeout' : 'looker_timeout';
    return { roundId, verdict: 'penalty', reason, pointer, looker };
  }
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
  if (result.verdict === 'hit') return { ...score, [pointerId]: (score[pointerId] ?? 0) + 1 };
  if (result.verdict !== 'penalty') return { ...score };
  const next = { ...score };
  if (result.reason === 'pointer_timeout' || result.reason === 'both_timeout') next[pointerId] = Math.max(0, (next[pointerId] ?? 0) - 1);
  if (result.reason === 'looker_timeout' || result.reason === 'both_timeout') next[lookerId] = Math.max(0, (next[lookerId] ?? 0) - 1);
  return next;
}

export function nextPointerForResult(result: RoundResult, pointerId: string, lookerId: string): string {
  if (result.verdict === 'hit' || result.verdict === 'void') return pointerId;
  return lookerId;
}

export function chooseFirstPointer(playerIds: string[], randomValue: number): string {
  if (playerIds.length !== 2) throw new Error('two_players_required');
  const index = Math.abs(Math.trunc(randomValue)) % playerIds.length;
  return playerIds[index];
}

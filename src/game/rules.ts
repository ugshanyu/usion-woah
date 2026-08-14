import type { DirectionChoice, DirectionSample, GestureSummary, ObservationStatus, Role, RoundResult, Score } from './types';
import { HEAD_ACTIVE_END_MS, HEAD_ACTIVE_START_MS, HEAD_NEUTRAL_END_MS, HEAD_NEUTRAL_START_MS, HEAD_PEAK_WINDOW_MS, HEAD_STABLE_MAX_GAP_MS } from './timing';

const CARDINAL = new Set(['up', 'down', 'left', 'right']);
export const POINTER_GUESS_LEAD_MS = 3500;

export type GestureWindow = {
  roundId: number;
  role: Role;
  generation: number;
  sampleGeneration?: number;
  targetLocalMs: number;
  toHostTime: (localMs: number) => number;
  clockSigmaMs: number;
};

export function summarizeHeadGesture(samples: DirectionSample[], window: GestureWindow): GestureSummary | null {
  if (window.role !== 'looker' || window.clockSigmaMs > 50) return null;
  const currentGeneration = samples.filter((sample) => sample.generation === (window.sampleGeneration ?? window.generation));
  const preBeat = currentGeneration
    .filter((sample) => sample.capturePerfMs >= window.targetLocalMs + HEAD_NEUTRAL_START_MS
      && sample.capturePerfMs <= window.targetLocalMs + HEAD_NEUTRAL_END_MS
      && (sample.facePresent ?? sample.direction !== 'unknown'))
    .slice(-3);
  if (preBeat.length < 2) return null;
  const active = currentGeneration.filter((sample) => sample.capturePerfMs >= window.targetLocalMs + HEAD_ACTIVE_START_MS && sample.capturePerfMs <= window.targetLocalMs + HEAD_ACTIVE_END_MS && CARDINAL.has(sample.direction) && sample.quality >= 0.6);
  const candidates = [...CARDINAL].map((direction) => {
    if (preBeat.filter((sample) => sample.direction !== direction).length < 2) return null;
    const support = active.filter((sample) => sample.direction === direction);
    const pair = support.flatMap((first, index) => support.slice(index + 1).map((second) => [first, second] as const))
      .find(([first, second]) => second.capturePerfMs - first.capturePerfMs <= HEAD_STABLE_MAX_GAP_MS);
    if (!pair) return null;
    const averageConfidence = support.reduce((sum, sample) => sum + sample.confidence, 0) / support.length;
    return { direction, support, pair, averageConfidence, recognizedAt: pair[1].capturePerfMs };
  }).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((left, right) => left.recognizedAt - right.recognizedAt
      || left.pair[0].capturePerfMs - right.pair[0].capturePerfMs
      || right.averageConfidence - left.averageConfidence);
  const winner = candidates[0];
  if (!winner) return null;

  const [first, second] = winner.pair;
  const peak = winner.support
    .filter((sample) => sample.capturePerfMs >= first.capturePerfMs && sample.capturePerfMs <= first.capturePerfMs + HEAD_PEAK_WINDOW_MS)
    .sort((left, right) => right.confidence - left.confidence)[0] ?? second;
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

export function summarizeDirectionChoice(choice: DirectionChoice | null, window: GestureWindow): GestureSummary | null {
  if (!choice || window.role !== 'pointer' || window.clockSigmaMs > 50 || choice.confidence < 0.75) return null;
  if (!isDirectionChoiceInWindow(choice, window.targetLocalMs)) return null;
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

export function isDirectionChoiceInWindow(choice: DirectionChoice, targetLocalMs: number): boolean {
  return Number.isFinite(choice.selectedLocalMs)
    && choice.selectedLocalMs >= targetLocalMs - POINTER_GUESS_LEAD_MS
    && choice.selectedLocalMs <= targetLocalMs;
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
  if (!CARDINAL.has(pointer.direction) || !CARDINAL.has(looker.direction)) {
    return { roundId, verdict: 'void', reason: 'invalid_sample', pointer, looker };
  }
  if (pointer.clockSigmaMs > 50 || looker.clockSigmaMs > 50) {
    return { roundId, verdict: 'void', reason: 'clock_uncertain', pointer, looker };
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

export function chooseFirstPointer(playerIds: string[], randomValue: number): string {
  if (playerIds.length !== 2) throw new Error('two_players_required');
  const index = Math.abs(Math.trunc(randomValue)) % playerIds.length;
  return playerIds[index];
}

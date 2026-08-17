import type { DirectionChoice, DirectionSample, GestureSummary, ObservationStatus, Role, RoundResult, Score } from './types';
import { HEAD_ACTIVE_END_MS, HEAD_ACTIVE_START_MS, HEAD_NEUTRAL_END_MS, HEAD_NEUTRAL_START_MS, HEAD_PEAK_WINDOW_MS, HEAD_STABLE_MAX_GAP_MS, HEAD_STABLE_SAMPLE_COUNT } from './timing';

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
  const active = currentGeneration
    .filter((sample) => sample.capturePerfMs >= window.targetLocalMs + HEAD_ACTIVE_START_MS && sample.capturePerfMs <= window.targetLocalMs + HEAD_ACTIVE_END_MS)
    .sort((left, right) => left.capturePerfMs - right.capturePerfMs || left.frameSeq - right.frameSeq);
  let run: DirectionSample[] = [];
  let committedDirection: DirectionSample['direction'] | null = null;
  let winner: { direction: DirectionSample['direction']; support: DirectionSample[] } | null = null;
  for (const sample of active) {
    const previous = run.at(-1);
    if (!CARDINAL.has(sample.direction) || sample.quality < 0.6) {
      run = [];
      continue;
    }
    run = previous?.direction === sample.direction && sample.capturePerfMs - previous.capturePerfMs <= HEAD_STABLE_MAX_GAP_MS
      ? [...run, sample]
      : [sample];
    const rearmed = preBeat.filter((item) => item.direction !== sample.direction).length >= 2;
    if (!committedDirection && rearmed && run.length >= HEAD_STABLE_SAMPLE_COUNT - 1) committedDirection = sample.direction;
    if (rearmed && committedDirection === sample.direction && run.length >= HEAD_STABLE_SAMPLE_COUNT) {
      winner = { direction: sample.direction, support: run };
      break;
    }
  }
  if (!winner) return null;

  const first = winner.support[0];
  const stable = winner.support.slice(0, HEAD_STABLE_SAMPLE_COUNT);
  const peak = winner.support
    .filter((sample) => sample.capturePerfMs >= first.capturePerfMs && sample.capturePerfMs <= first.capturePerfMs + HEAD_PEAK_WINDOW_MS)
    .sort((left, right) => right.confidence - left.confidence)[0] ?? stable.at(-1)!;
  return {
    roundId: window.roundId,
    role: window.role,
    direction: first.direction,
    onsetHostMs: window.toHostTime(first.capturePerfMs),
    peakHostMs: window.toHostTime(peak.capturePerfMs),
    confidence: Math.min(...stable.map((sample) => sample.confidence)),
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

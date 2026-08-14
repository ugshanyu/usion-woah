import type { GestureSummary, ObservationStatus, RoundResult, Score } from '../game/types';

export type RtcSignal = {
  ns: 'woah.rtc.v1';
  to: string;
  matchId: string;
  hostEpoch: string;
  pcGeneration: number;
  signalSeq: number;
  kind: 'offer' | 'answer' | 'ice' | 'ice-complete';
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

export type ReadyEvent = {
  ns: 'woah.control.v1';
  kind: 'ready';
  eventId: string;
  playerId: string;
  playerName: string;
  calibrated: boolean;
  cameraReady: boolean;
};

export type SessionEvent = {
  ns: 'woah.control.v1';
  kind: 'session';
  eventId: string;
  matchId: string;
  hostEpoch: string;
  hostId: string;
  guestId: string;
  firstPointerId: string;
};

export type RoundArmEvent = {
  ns: 'woah.control.v1';
  kind: 'round';
  eventId: string;
  matchId: string;
  hostEpoch: string;
  roundId: number;
  generation: number;
  pointerId: string;
  lookerId: string;
  targetHostMs: number;
  deadlineHostMs: number;
};

export type ObservationEvent = {
  ns: 'woah.control.v1';
  kind: 'observation';
  eventId: string;
  matchId: string;
  hostEpoch: string;
  summary: GestureSummary | null;
  status: ObservationStatus;
  roundId: number;
  generation: number;
};

export type VerdictEvent = {
  ns: 'woah.control.v1';
  kind: 'verdict';
  eventId: string;
  matchId: string;
  hostEpoch: string;
  result: RoundResult;
  score: Score;
  nextPointerId: string;
};

export type ControlEvent = ReadyEvent | SessionEvent | RoundArmEvent | ObservationEvent | VerdictEvent;

export class EventDeduper {
  private readonly seen = new Map<string, string>();

  constructor(private readonly maxSize = 256) {}

  accept(event: ControlEvent): boolean {
    if (!event.eventId || event.eventId.length > 100) return false;
    const serialized = JSON.stringify(event);
    const previous = this.seen.get(event.eventId);
    if (previous !== undefined) return false;
    this.seen.set(event.eventId, serialized);
    while (this.seen.size > this.maxSize) this.seen.delete(this.seen.keys().next().value!);
    return true;
  }
}

export function isRtcSignal(value: unknown): value is RtcSignal {
  if (!value || typeof value !== 'object') return false;
  const signal = value as Partial<RtcSignal>;
  if (signal.ns !== 'woah.rtc.v1' || !bounded(signal.to, 128) || !bounded(signal.matchId, 128) || !bounded(signal.hostEpoch, 128)) return false;
  if (!safeCounter(signal.pcGeneration) || !safeCounter(signal.signalSeq) || !['offer', 'answer', 'ice', 'ice-complete'].includes(signal.kind ?? '')) return false;
  if (signal.kind === 'offer' || signal.kind === 'answer') {
    return signal.description?.type === signal.kind && bounded(signal.description.sdp, 100_000);
  }
  if (signal.kind === 'ice') return Boolean(signal.candidate && bounded(signal.candidate.candidate, 8_192));
  return true;
}

export function isControlEvent(value: unknown): value is ControlEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Record<string, unknown>;
  if (event.ns !== 'woah.control.v1' || !bounded(event.eventId, 100) || !['ready', 'session', 'round', 'observation', 'verdict'].includes(String(event.kind ?? ''))) return false;
  if (event.kind === 'ready') return bounded(event.playerId, 128) && bounded(event.playerName, 100) && event.calibrated === true && event.cameraReady === true;
  if (event.kind === 'session') return bounded(event.matchId, 128) && bounded(event.hostEpoch, 128) && bounded(event.hostId, 128) && bounded(event.guestId, 128) && bounded(event.firstPointerId, 128) && event.hostId !== event.guestId && (event.firstPointerId === event.hostId || event.firstPointerId === event.guestId);
  if (!bounded(event.matchId, 128) || !bounded(event.hostEpoch, 128)) return false;
  if (event.kind === 'round') {
    return safeCounter(event.roundId) && safeCounter(event.generation) && bounded(event.pointerId, 128) && bounded(event.lookerId, 128) && event.pointerId !== event.lookerId && finiteTime(event.targetHostMs) && finiteTime(event.deadlineHostMs) && event.deadlineHostMs! > event.targetHostMs!;
  }
  if (event.kind === 'observation') return safeCounter(event.roundId) && safeCounter(event.generation) && ['ok', 'missing', 'clock-uncertain'].includes(String(event.status ?? '')) && (event.summary === null || isGestureSummary(event.summary)) && (event.status === 'ok') === (event.summary !== null);
  return isRoundResult(event.result) && isScore(event.score) && bounded(event.nextPointerId, 128);
}

function bounded(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function safeCounter(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000_000;
}

function finiteTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1_000_000_000_000;
}

function isGestureSummary(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Partial<GestureSummary>;
  return safeCounter(summary.roundId) && ['pointer', 'looker'].includes(summary.role ?? '') && ['up', 'down', 'left', 'right'].includes(summary.direction ?? '') && finiteTime(summary.onsetHostMs) && finiteTime(summary.peakHostMs) && typeof summary.confidence === 'number' && summary.confidence >= 0 && summary.confidence <= 1 && typeof summary.clockSigmaMs === 'number' && summary.clockSigmaMs >= 0 && summary.clockSigmaMs <= 10_000 && safeCounter(summary.frameSeq) && safeCounter(summary.generation);
}

function isRoundResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<RoundResult>;
  return safeCounter(result.roundId) && ['hit', 'dodge', 'penalty', 'void'].includes(result.verdict ?? '') && ['same_direction', 'different_direction', 'pointer_timeout', 'looker_timeout', 'both_timeout', 'invalid_sample', 'timing_mismatch', 'clock_uncertain'].includes(result.reason ?? '') && (result.pointer === null || isGestureSummary(result.pointer)) && (result.looker === null || isGestureSummary(result.looker));
}

function isScore(value: unknown): value is Score {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  return entries.length <= 2 && entries.every(([playerId, points]) => bounded(playerId, 128) && safeCounter(points) && points <= 5);
}

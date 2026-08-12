import { median } from '../game/math';

export type ClockSample = {
  id: string;
  offsetMs: number;
  rttMs: number;
  capturedAtMs: number;
};

export type ClockProbe = { ns: 'woah.clock.v1'; kind: 'probe'; probeId: string; g0: number };
export type ClockReply = { ns: 'woah.clock.v1'; kind: 'reply'; probeId: string; g0: number; h1: number; h2: number };
export type ClockReady = { ns: 'woah.clock.v1'; kind: 'ready'; uncertaintyMs: number };
export type ClockMessage = ClockProbe | ClockReply | ClockReady;

export class ClockSync {
  private readonly samples: ClockSample[] = [];
  private pending = new Map<string, number>();

  constructor(private readonly isHost: boolean, private readonly now: () => number = () => performance.now()) {}

  createProbe(): ClockProbe {
    const probeId = crypto.randomUUID();
    const g0 = this.now();
    this.pending.set(probeId, g0);
    while (this.pending.size > 24) this.pending.delete(this.pending.keys().next().value!);
    return { ns: 'woah.clock.v1', kind: 'probe', probeId, g0 };
  }

  answer(probe: ClockProbe): ClockReply {
    const h1 = this.now();
    const h2 = this.now();
    return { ns: 'woah.clock.v1', kind: 'reply', probeId: probe.probeId, g0: probe.g0, h1, h2 };
  }

  accept(reply: ClockReply): ClockSample | null {
    const sentAt = this.pending.get(reply.probeId);
    if (sentAt === undefined || sentAt !== reply.g0) return null;
    this.pending.delete(reply.probeId);
    const g3 = this.now();
    const rttMs = (g3 - reply.g0) - (reply.h2 - reply.h1);
    if (!Number.isFinite(rttMs) || rttMs < 0 || rttMs > 2000) return null;
    const sample = {
      id: reply.probeId,
      offsetMs: ((reply.h1 - reply.g0) + (reply.h2 - g3)) / 2,
      rttMs,
      capturedAtMs: g3,
    };
    this.samples.push(sample);
    if (this.samples.length > 24) this.samples.shift();
    return sample;
  }

  get offsetMs(): number {
    if (this.isHost) return 0;
    const best = [...this.samples].sort((a, b) => a.rttMs - b.rttMs).slice(0, 5);
    return best.length ? median(best.map((sample) => sample.offsetMs)) : Number.NaN;
  }

  get uncertaintyMs(): number {
    if (this.isHost) return 0;
    const best = [...this.samples].sort((a, b) => a.rttMs - b.rttMs).slice(0, 5);
    if (best.length < 3) return Number.POSITIVE_INFINITY;
    const offset = median(best.map((sample) => sample.offsetMs));
    const spread = median(best.map((sample) => Math.abs(sample.offsetMs - offset)));
    return Math.max(spread * 1.4826, best[0].rttMs / 2);
  }

  get sampleAgeMs(): number {
    if (this.isHost) return 0;
    return this.samples.length ? this.now() - this.samples.at(-1)!.capturedAtMs : Number.POSITIVE_INFINITY;
  }

  get ready(): boolean {
    return this.uncertaintyMs <= 50 && this.sampleAgeMs <= 3000;
  }

  localToHost(localMs: number): number {
    return localMs + (this.isHost ? 0 : this.offsetMs);
  }

  hostToLocal(hostMs: number): number {
    return hostMs - (this.isHost ? 0 : this.offsetMs);
  }

  reset(): void {
    this.samples.length = 0;
    this.pending.clear();
  }
}

export function isClockMessage(value: unknown): value is ClockMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  if (message.ns !== 'woah.clock.v1' || !['probe', 'reply', 'ready'].includes(String(message.kind ?? ''))) return false;
  if (message.kind === 'ready') return typeof message.uncertaintyMs === 'number' && Number.isFinite(message.uncertaintyMs) && message.uncertaintyMs >= 0;
  if (typeof message.probeId !== 'string' || message.probeId.length < 1 || message.probeId.length > 100 || typeof message.g0 !== 'number' || !Number.isFinite(message.g0)) return false;
  return message.kind === 'probe' || (typeof message.h1 === 'number' && Number.isFinite(message.h1) && typeof message.h2 === 'number' && Number.isFinite(message.h2));
}

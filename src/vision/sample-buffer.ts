import type { Direction, DirectionSample } from '../game/types';

export class SampleBuffer {
  private readonly samples: DirectionSample[] = [];

  constructor(private readonly retentionMs = 2000) {}

  push(sample: DirectionSample): void {
    const previous = this.samples.at(-1);
    if (previous && (sample.frameSeq <= previous.frameSeq || sample.capturePerfMs <= previous.capturePerfMs)) return;
    this.samples.push(sample);
    const cutoff = sample.capturePerfMs - this.retentionMs;
    while (this.samples[0] && this.samples[0].capturePerfMs < cutoff) this.samples.shift();
  }

  clear(): void {
    this.samples.length = 0;
  }

  latest(): DirectionSample | null {
    return this.samples.at(-1) ?? null;
  }

  between(startPerfMs: number, endPerfMs: number): DirectionSample[] {
    return this.samples.filter((sample) => sample.capturePerfMs >= startPerfMs && sample.capturePerfMs <= endPerfMs);
  }

  stableDirection(endPerfMs: number, windowMs = 140): DirectionSample | null {
    const candidates = this.samples.filter((sample) => sample.capturePerfMs >= endPerfMs - windowMs && sample.capturePerfMs <= endPerfMs && sample.confidence >= 0.65 && sample.quality >= 0.6);
    if (candidates.length < 2) return null;
    const counts = new Map<Direction, number>();
    for (const sample of candidates) counts.set(sample.direction, (counts.get(sample.direction) ?? 0) + 1);
    const [direction, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['unknown', 0];
    if (direction === 'unknown' || direction === 'neutral' || count < 2 || count / candidates.length < 2 / 3) return null;
    return [...candidates].reverse().find((sample) => sample.direction === direction) ?? null;
  }
}

import type { DirectionSample } from '../game/types';

export class SampleBuffer {
  private readonly samples: DirectionSample[] = [];

  // Keep the pre-WOAH neutral samples until the full 3 s recognition window
  // closes. At 20 Hz this remains a tiny, bounded buffer.
  constructor(private readonly retentionMs = 5000) {}

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
}

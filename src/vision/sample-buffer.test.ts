import { describe, expect, it } from 'vitest';
import type { DirectionSample } from '../game/types';
import { SampleBuffer } from './sample-buffer';

function sample(at: number, frameSeq: number, direction: DirectionSample['direction'] = 'neutral'): DirectionSample {
  return { frameSeq, generation: 1, capturePerfMs: at, direction, confidence: 0.9, quality: 0.9 };
}

describe('SampleBuffer', () => {
  it('retains pre-WOAH neutral evidence through the full 3 second recognition window', () => {
    const buffer = new SampleBuffer();
    buffer.push(sample(400, 1));
    buffer.push(sample(4000, 2, 'up'));
    expect(buffer.between(400, 4000).map((item) => item.frameSeq)).toEqual([1, 2]);
  });

  it('remains bounded after the recognition horizon', () => {
    const buffer = new SampleBuffer();
    buffer.push(sample(100, 1));
    buffer.push(sample(7200, 2, 'right'));
    expect(buffer.between(0, 8000).map((item) => item.frameSeq)).toEqual([2]);
  });
});

import { describe, expect, it } from 'vitest';
import { advanceDirectionLatch, EMPTY_DIRECTION_LATCH } from './direction-latch';

describe('runtime direction hysteresis latch', () => {
  it('requires two independent entry frames before lowering the stay threshold', () => {
    const first = advanceDirectionLatch(EMPTY_DIRECTION_LATCH, 'right');
    expect(first).toMatchObject({ stableDirection: 'neutral', candidateDirection: 'right', candidateFrames: 1 });
    expect(advanceDirectionLatch(first, 'right')).toMatchObject({ stableDirection: 'right', candidateDirection: null, candidateFrames: 0 });
  });

  it('does not latch a one-frame side artifact while returning from a vertical turn', () => {
    const down = advanceDirectionLatch(advanceDirectionLatch(EMPTY_DIRECTION_LATCH, 'down'), 'down');
    const sideArtifact = advanceDirectionLatch(down, 'right');
    expect(sideArtifact.stableDirection).toBe('down');
    expect(advanceDirectionLatch(sideArtifact, 'down').stableDirection).toBe('down');
    expect(advanceDirectionLatch(sideArtifact, 'neutral')).toEqual(EMPTY_DIRECTION_LATCH);
  });
});

import { describe, expect, it } from 'vitest';
import { classifySwipe, SwipeTracker } from './swipe';

describe('swipe input', () => {
  it.each([
    [100, 0, 'right'], [-100, 0, 'left'], [0, -100, 'up'], [0, 100, 'down'],
  ] as const)('maps a cardinal displacement to %s', (x, y, direction) => {
    expect(classifySwipe({ x: 0, y: 0, at: 10 }, { x, y, at: 20 })?.direction).toBe(direction);
  });

  it('rejects short and diagonal gestures', () => {
    expect(classifySwipe({ x: 0, y: 0, at: 0 }, { x: 30, y: 0, at: 10 })).toBeNull();
    expect(classifySwipe({ x: 0, y: 0, at: 0 }, { x: 80, y: 75, at: 10 })).toBeNull();
  });

  it('emits once at the first threshold crossing and rearms after release', () => {
    const tracker = new SwipeTracker();
    tracker.begin(7, 0, 0, 100);
    expect(tracker.move(7, 20, 0, 110, 1)).toBeNull();
    expect(tracker.move(7, 50, 0, 120, 2)).toMatchObject({ direction: 'right', onsetLocalMs: 120, sequence: 2 });
    expect(tracker.move(7, 90, 0, 130, 3)).toBeNull();
    tracker.end(7);
    tracker.begin(8, 0, 0, 200);
    expect(tracker.move(8, 0, -50, 220, 4)?.direction).toBe('up');
  });
});

import type { CardinalDirection, SwipeGesture } from '../game/types';

type Point = { x: number; y: number; at: number };

export class SwipeTracker {
  private pointerId: number | null = null;
  private start: Point | null = null;
  private emitted = false;

  begin(pointerId: number, x: number, y: number, at: number): void {
    this.pointerId = pointerId;
    this.start = { x, y, at };
    this.emitted = false;
  }

  move(pointerId: number, x: number, y: number, at: number, sequence: number): SwipeGesture | null {
    if (pointerId !== this.pointerId || !this.start || this.emitted) return null;
    const classification = classifySwipe(this.start, { x, y, at });
    if (!classification) return null;
    this.emitted = true;
    return {
      ...classification,
      onsetLocalMs: at,
      peakLocalMs: at,
      sequence,
    };
  }

  end(pointerId: number): void {
    if (pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.start = null;
    this.emitted = false;
  }
}

export function classifySwipe(start: Point, current: Point, minDistance = 44): { direction: CardinalDirection; confidence: number } | null {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  const major = Math.max(horizontal, vertical);
  const minor = Math.min(horizontal, vertical);
  if (major < minDistance || major < minor * 1.35) return null;
  const direction: CardinalDirection = horizontal > vertical
    ? dx < 0 ? 'left' : 'right'
    : dy < 0 ? 'up' : 'down';
  const dominance = major / Math.max(major + minor, 1);
  const distance = Math.min(1, major / (minDistance * 2));
  return { direction, confidence: Math.min(1, 0.65 + dominance * 0.2 + distance * 0.15) };
}

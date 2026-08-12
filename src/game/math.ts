import type { Direction } from './types';

export type Vec2 = { x: number; y: number };

export const CARDINALS: Record<Exclude<Direction, 'neutral' | 'unknown'>, Vec2> = {
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
};

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}
export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, amount: number): Vec2 {
  return { x: a.x * amount, y: a.y * amount };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function normalize(a: Vec2): Vec2 | null {
  const size = length(a);
  return size > 1e-6 ? scale(a, 1 / size) : null;
}

export function distance(a: Vec2, b: Vec2): number {
  return length(sub(a, b));
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function medianVec(values: Vec2[]): Vec2 {
  return {
    x: median(values.map((value) => value.x)),
    y: median(values.map((value) => value.y)),
  };
}

export function elbowAngle(shoulder: Vec2, elbow: Vec2, endpoint: Vec2): number {
  const a = normalize(sub(shoulder, elbow));
  const b = normalize(sub(endpoint, elbow));
  if (!a || !b) return 0;
  return Math.acos(clamp(dot(a, b), -1, 1)) * 180 / Math.PI;
}

export function winningCardinal(vector: Vec2): { direction: Direction; cosine: number; runnerUp: number } {
  const n = normalize(vector);
  if (!n) return { direction: 'unknown', cosine: 0, runnerUp: 0 };
  const ranked = Object.entries(CARDINALS)
    .map(([direction, axis]) => ({ direction: direction as Direction, score: dot(n, axis) }))
    .sort((a, b) => b.score - a.score);
  return { direction: ranked[0].direction, cosine: ranked[0].score, runnerUp: ranked[1].score };
}

import { clamp, dot, median, medianVec, normalize, scale, sub, type Vec2 } from '../game/math';
import type { Direction, HeadCalibration, HeadFeature } from '../game/types';

export type HeadClassification = { direction: Direction; confidence: number; quality: number };

const UNKNOWN: HeadClassification = { direction: 'unknown', confidence: 0, quality: 0 };

function project(feature: HeadFeature, calibration: HeadCalibration): Vec2 {
  const delta = sub(feature, calibration.neutral);
  return {
    x: dot(delta, calibration.rightAxis),
    y: dot(delta, calibration.upAxis),
  };
}

export function buildHeadCalibration(prompts: Record<'neutral' | 'left' | 'right' | 'up' | 'down', HeadFeature[]>): HeadCalibration | null {
  if (Object.values(prompts).some((samples) => samples.length < 5)) return null;
  const maxSpread = 4 * Math.PI / 180;
  if (Object.values(prompts).some((samples) => {
    const center = medianVec(samples);
    return median(samples.map((sample) => Math.hypot(sample.x - center.x, sample.y - center.y))) > maxSpread;
  })) return null;
  const medians = Object.fromEntries(Object.entries(prompts).map(([key, samples]) => [key, {
    ...samples[Math.floor(samples.length / 2)],
    ...medianVec(samples),
  }])) as Record<keyof typeof prompts, HeadFeature>;

  const rightAxis = normalize(sub(medians.right, medians.left));
  if (!rightAxis) return null;
  const upRaw = sub(medians.up, medians.down);
  const upAxis = normalize(sub(upRaw, scale(rightAxis, dot(upRaw, rightAxis))));
  if (!upAxis) return null;
  const right = dot(sub(medians.right, medians.neutral), rightAxis);
  const left = -dot(sub(medians.left, medians.neutral), rightAxis);
  const up = dot(sub(medians.up, medians.neutral), upAxis);
  const down = -dot(sub(medians.down, medians.neutral), upAxis);
  if (Math.min(left, right) < 15 * Math.PI / 180 || Math.min(up, down) < 10 * Math.PI / 180) return null;

  return {
    neutral: medians.neutral,
    rightAxis,
    upAxis,
    scale: { left, right, up, down },
    neutralRoll: medians.neutral.roll,
  };
}

export function classifyHead(feature: HeadFeature, calibration: HeadCalibration, previous: Direction = 'neutral'): HeadClassification {
  if (!feature.finite || feature.clipped || feature.faceWidth < 0.16 || feature.faceWidth > 0.75) return UNKNOWN;
  const rollDelta = Math.abs(feature.roll - calibration.neutralRoll);
  if (rollDelta > 15 * Math.PI / 180) return UNKNOWN;
  const projected = project(feature, calibration);
  const scores: Record<'left' | 'right' | 'up' | 'down', number> = {
    right: Math.max(0, projected.x) / calibration.scale.right,
    left: Math.max(0, -projected.x) / calibration.scale.left,
    up: Math.max(0, projected.y) / calibration.scale.up,
    down: Math.max(0, -projected.y) / calibration.scale.down,
  };
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]) as [Exclude<Direction, 'neutral' | 'unknown'>, number][];
  const [direction, winner] = ranked[0];
  const runnerUp = ranked[1][1];
  const threshold = previous === direction ? 0.32 : 0.45;
  const absolute = direction === 'left' || direction === 'right' ? Math.abs(projected.x) : Math.abs(projected.y);
  const minimum = (direction === 'left' || direction === 'right' ? 8 : 7) * Math.PI / 180;
  if (winner < threshold) return winner < 0.22 ? { direction: 'neutral', confidence: 1 - winner / 0.22, quality: 1 } : UNKNOWN;
  if (absolute < minimum) return UNKNOWN;
  if (runnerUp > winner * 0.65) return UNKNOWN;
  return {
    direction,
    confidence: clamp((winner - threshold) / Math.max(0.2, 1 - threshold) * 0.7 + (1 - runnerUp / Math.max(winner, 0.001)) * 0.3),
    quality: clamp(1 - rollDelta / (15 * Math.PI / 180)),
  };
}

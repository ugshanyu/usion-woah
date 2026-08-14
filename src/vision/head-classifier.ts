import { clamp, dot, median, medianVec, type Vec2 } from '../game/math';
import type { Direction, HeadCalibration, HeadFeature } from '../game/types';

export type HeadClassification = { direction: Direction; confidence: number; quality: number };

const UNKNOWN: HeadClassification = { direction: 'unknown', confidence: 0, quality: 0 };
export const MIN_FACE_WIDTH = 0.1;
export const MAX_FACE_WIDTH = 0.9;
export const AUTOMATIC_YAW_RANGE_RAD = 24 * Math.PI / 180;
export const AUTOMATIC_PITCH_RANGE_RAD = 18 * Math.PI / 180;

export function isUsableHeadFeature(feature: HeadFeature): boolean {
  return feature.finite && !feature.clipped && feature.faceWidth >= MIN_FACE_WIDTH && feature.faceWidth <= MAX_FACE_WIDTH;
}

function angleDistance(left: number, right: number): number {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

function signedAngleDelta(value: number, baseline: number): number {
  return Math.atan2(Math.sin(value - baseline), Math.cos(value - baseline));
}

function project(feature: HeadFeature, calibration: HeadCalibration): Vec2 {
  const delta = {
    x: signedAngleDelta(feature.x, calibration.neutral.x),
    y: signedAngleDelta(feature.y, calibration.neutral.y),
  };
  return {
    x: dot(delta, calibration.rightAxis),
    y: dot(delta, calibration.upAxis),
  };
}

export function buildNeutralHeadCalibration(samples: HeadFeature[]): HeadCalibration | null {
  if (samples.length < 5 || samples.some((sample) => !isUsableHeadFeature(sample))) return null;
  const maxSpread = 4 * Math.PI / 180;
  const center = medianVec(samples);
  if (median(samples.map((sample) => Math.hypot(signedAngleDelta(sample.x, center.x), signedAngleDelta(sample.y, center.y)))) > maxSpread) return null;
  const neutralRoll = median(samples.map((sample) => sample.roll));
  if (median(samples.map((sample) => angleDistance(sample.roll, neutralRoll))) > maxSpread) return null;
  const neutral: HeadFeature = {
    ...samples[Math.floor(samples.length / 2)],
    ...center,
    roll: neutralRoll,
    faceWidth: median(samples.map((sample) => sample.faceWidth)),
  };

  return {
    neutral,
    rightAxis: { x: 1, y: 0 },
    upAxis: { x: 0, y: 1 },
    scale: {
      left: AUTOMATIC_YAW_RANGE_RAD,
      right: AUTOMATIC_YAW_RANGE_RAD,
      up: AUTOMATIC_PITCH_RANGE_RAD,
      down: AUTOMATIC_PITCH_RANGE_RAD,
    },
    neutralRoll,
  };
}

export function classifyHead(feature: HeadFeature, calibration: HeadCalibration, previous: Direction = 'neutral'): HeadClassification {
  if (!isUsableHeadFeature(feature)) return UNKNOWN;
  const rollDelta = angleDistance(feature.roll, calibration.neutralRoll);
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

import { add, clamp, distance, dot, elbowAngle, length, normalize, scale, sub, winningCardinal, type Vec2 } from '../game/math';
import type { Direction, Landmark } from '../game/types';

type Arm = { shoulder: number; elbow: number; wrist: number; index: number };

const ARMS: Arm[] = [
  { shoulder: 11, elbow: 13, wrist: 15, index: 19 },
  { shoulder: 12, elbow: 14, wrist: 16, index: 20 },
];

export type PoseClassification = {
  direction: Direction;
  confidence: number;
  quality: number;
  arm: 'left' | 'right' | null;
};

const UNKNOWN: PoseClassification = { direction: 'unknown', confidence: 0, quality: 0, arm: null };

function visible(point: Landmark | undefined): number {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? point.visibility ?? 1 : 0;
}

function point(landmark: Landmark): Vec2 {
  return { x: landmark.x, y: landmark.y };
}

function classifyArm(
  landmarks: Landmark[],
  arm: Arm,
  bodyRight: Vec2,
  bodyUp: Vec2,
  shoulderWidth: number,
): PoseClassification {
  const shoulder = landmarks[arm.shoulder];
  const elbow = landmarks[arm.elbow];
  const wrist = landmarks[arm.wrist];
  const index = landmarks[arm.index];
  const qualities = [visible(shoulder), visible(elbow), visible(wrist)];
  const minQuality = Math.min(...qualities);
  const meanQuality = qualities.reduce((sum, value) => sum + value, 0) / qualities.length;
  if (minQuality < 0.6 || meanQuality < 0.72) return UNKNOWN;

  const endpointLandmark = visible(index) >= 0.6 ? index : wrist;
  if (!endpointLandmark) return UNKNOWN;
  if (endpointLandmark.x < 0.02 || endpointLandmark.x > 0.98 || endpointLandmark.y < 0.02 || endpointLandmark.y > 0.98) return UNKNOWN;

  const s = point(shoulder);
  const e = point(elbow);
  const end = point(endpointLandmark);
  const ray = sub(end, s);
  const radius = length(ray) / shoulderWidth;
  const chain = distance(s, e) + distance(e, end);
  const straightness = chain > 0 ? distance(s, end) / chain : 0;
  const angle = elbowAngle(s, e, end);
  if (radius < 0.8 || straightness < 0.72 || angle < 135) return UNKNOWN;

  const projected = { x: dot(ray, bodyRight), y: dot(ray, bodyUp) };
  const cardinal = winningCardinal(projected);
  if (cardinal.cosine < 0.78) return UNKNOWN;

  const quality = clamp((meanQuality - 0.6) / 0.4);
  const extension = clamp((radius - 0.8) / 1.2) * 0.45 + clamp((straightness - 0.72) / 0.28) * 0.3 + clamp((angle - 135) / 45) * 0.25;
  const directionMargin = clamp((cardinal.cosine - 0.78) / 0.22);
  const confidence = clamp(quality * 0.4 + extension * 0.35 + directionMargin * 0.25);
  return {
    direction: cardinal.direction,
    confidence,
    quality,
    arm: arm.shoulder === 11 ? 'left' : 'right',
  };
}

export function classifyPointingPose(landmarks: Landmark[]): PoseClassification {
  if (landmarks.length < 25) return UNKNOWN;
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  if ([leftShoulder, rightShoulder, leftHip, rightHip].some((landmark) => visible(landmark) < 0.6)) return UNKNOWN;

  // MediaPipe's LEFT/RIGHT labels are anatomical. The body-right axis runs
  // from the player's left shoulder to the player's right shoulder.
  const bodyRight = normalize(sub(point(rightShoulder), point(leftShoulder)));
  const shoulderMid = scale(add(point(leftShoulder), point(rightShoulder)), 0.5);
  const hipMid = scale(add(point(leftHip), point(rightHip)), 0.5);
  const shoulderWidth = distance(point(leftShoulder), point(rightShoulder));
  if (!bodyRight || shoulderWidth < 0.14) return UNKNOWN;
  const upCandidate = sub(shoulderMid, hipMid);
  const bodyUp = normalize(sub(upCandidate, scale(bodyRight, dot(upCandidate, bodyRight))));
  if (!bodyUp) return UNKNOWN;

  const candidates = ARMS.map((arm) => classifyArm(landmarks, arm, bodyRight, bodyUp, shoulderWidth))
    .filter((candidate) => candidate.direction !== 'unknown')
    .sort((a, b) => b.confidence - a.confidence);
  if (!candidates.length) return { direction: 'neutral', confidence: 0.8, quality: 0.8, arm: null };
  if (candidates.length === 1) return candidates[0];
  if (candidates[0].direction === candidates[1].direction) {
    return { ...candidates[0], confidence: clamp(candidates[0].confidence + 0.08) };
  }
  return candidates[0].confidence - candidates[1].confidence >= 0.15 ? candidates[0] : UNKNOWN;
}

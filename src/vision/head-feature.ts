import type { FaceLandmark, HeadFeature } from '../game/types';

type Matrix = { rows: number; columns: number; data: number[] };
type Vec3 = [number, number, number];

function normalize3(vector: Vec3): Vec3 | null {
  const magnitude = Math.hypot(...vector);
  return magnitude > 1e-6 ? vector.map((value) => value / magnitude) as Vec3 : null;
}

function dot3(left: Vec3, right: Vec3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross(left: Vec3, right: Vec3): Vec3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function fallbackAngles(landmarks: FaceLandmark[]): { x: number; y: number; roll: number } | null {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const nose = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  if (![leftEye, rightEye, nose, forehead, chin].every(Boolean)) return null;
  const eyeDx = rightEye.x - leftEye.x;
  const eyeDy = rightEye.y - leftEye.y;
  const eyeDistance = Math.hypot(eyeDx, eyeDy);
  const faceHeight = Math.hypot(chin.x - forehead.x, chin.y - forehead.y);
  if (eyeDistance < 0.01 || faceHeight < 0.01) return null;
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  return {
    x: (nose.x - eyeMidX) / eyeDistance,
    y: (eyeMidY - nose.y) / faceHeight,
    roll: Math.atan2(eyeDy, eyeDx),
  };
}

function matrixAngles(matrix: Matrix | undefined): { x: number; y: number; roll: number } | null {
  if (!matrix || matrix.rows !== 4 || matrix.columns !== 4 || matrix.data.length !== 16 || !matrix.data.every(Number.isFinite)) return null;
  const m = matrix.data;
  const basisX = normalize3([m[0], m[1], m[2]]);
  if (!basisX) return null;
  const rawY: Vec3 = [m[4], m[5], m[6]];
  const basisY = normalize3(rawY.map((value, index) => value - basisX[index] * dot3(rawY, basisX)) as Vec3);
  if (!basisY) return null;
  let forward = normalize3(cross(basisX, basisY));
  if (!forward) return null;
  const rawForward: Vec3 = [m[8], m[9], m[10]];
  if (dot3(forward, rawForward) < 0) forward = forward.map((value) => -value) as Vec3;
  const [forwardX, forwardY, forwardZ] = forward;
  const horizontal = Math.hypot(forwardX, forwardZ);
  return {
    x: Math.atan2(forwardX, forwardZ),
    y: Math.atan2(-forwardY, Math.max(horizontal, 1e-6)),
    roll: Math.atan2(basisX[1], basisX[0]),
  };
}

export function extractHeadFeature(matrix: Matrix | undefined, landmarks: FaceLandmark[]): HeadFeature {
  const xs = landmarks.map((landmark) => landmark.x).filter(Number.isFinite);
  const ys = landmarks.map((landmark) => landmark.y).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { x: 0, y: 0, roll: 0, faceWidth: 0, clipped: true, finite: false };
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const fallback = fallbackAngles(landmarks);
  const matrixFeature = matrixAngles(matrix);
  const angles = matrixFeature ? { ...matrixFeature, roll: fallback?.roll ?? matrixFeature.roll } : fallback;
  return {
    x: angles?.x ?? 0,
    y: angles?.y ?? 0,
    roll: angles?.roll ?? 0,
    faceWidth: maxX - minX,
    clipped: minX < 0.01 || maxX > 0.99 || minY < 0.01 || maxY > 0.99,
    finite: Boolean(angles) && [angles?.x, angles?.y, angles?.roll, maxX - minX].every(Number.isFinite),
  };
}

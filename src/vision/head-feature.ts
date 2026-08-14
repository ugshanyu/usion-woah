import type { FaceLandmark, HeadFeature } from '../game/types';

type Matrix = { rows: number; columns: number; data: number[] };
type Vec3 = [number, number, number];
type Angles = { x: number; y: number; roll: number };
type MatrixAngles = Angles & { quality: number };

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

function fallbackAngles(landmarks: FaceLandmark[]): Angles | null {
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
    // Raw camera x grows toward the photographed player's anatomical left.
    x: -(nose.x - eyeMidX) / eyeDistance,
    y: (eyeMidY - nose.y) / faceHeight,
    roll: Math.atan2(eyeDy, eyeDx),
  };
}

function matrixAngles(matrix: Matrix | undefined): MatrixAngles | null {
  if (!matrix || matrix.rows !== 4 || matrix.columns !== 4 || matrix.data.length !== 16 || !matrix.data.every(Number.isFinite)) return null;
  const m = matrix.data;
  // MatrixData is column-major. Each group below is one basis column of the
  // canonical-face-to-runtime-face transform; the final column is translation.
  const rawX: Vec3 = [m[0], m[1], m[2]];
  const rawY: Vec3 = [m[4], m[5], m[6]];
  const rawForward: Vec3 = [m[8], m[9], m[10]];
  const scaleX = Math.hypot(...rawX);
  const scaleY = Math.hypot(...rawY);
  const scaleZ = Math.hypot(...rawForward);
  const minScale = Math.min(scaleX, scaleY, scaleZ);
  const maxScale = Math.max(scaleX, scaleY, scaleZ);
  if (minScale < 1e-6 || maxScale / minScale > 1.15) return null;

  const basisX = normalize3(rawX);
  if (!basisX) return null;
  const basisY = normalize3(rawY.map((value, index) => value - basisX[index] * dot3(rawY, basisX)) as Vec3);
  if (!basisY) return null;
  const forward = normalize3(cross(basisX, basisY));
  if (!forward) return null;
  const normalizedRawForward = normalize3(rawForward);
  if (!normalizedRawForward) return null;
  const handedness = dot3(forward, normalizedRawForward);
  if (handedness < 0.88) return null;
  const [forwardX, forwardY, forwardZ] = forward;
  const horizontal = Math.hypot(forwardX, forwardZ);
  return {
    // Expose player-centric yaw: positive is the photographed player's right.
    x: -Math.atan2(forwardX, forwardZ),
    // The canonical face points toward +Z and metric +Y is up. Looking up
    // therefore produces a positive Y component in the transformed face normal.
    y: Math.atan2(forwardY, Math.max(horizontal, 1e-6)),
    roll: Math.atan2(basisX[1], basisX[0]),
    quality: 0.75 + 0.25 * Math.max(0, Math.min(1, (handedness - 0.88) / 0.12)),
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
    landmarkX: fallback?.x,
    landmarkY: fallback?.y,
    source: matrixFeature ? 'matrix' : 'landmarks',
    orientationQuality: matrixFeature?.quality ?? (fallback ? 0.75 : 0),
    faceWidth: maxX - minX,
    clipped: minX < 0.01 || maxX > 0.99 || minY < 0.01 || maxY > 0.99,
    finite: Boolean(angles) && [angles?.x, angles?.y, angles?.roll, maxX - minX].every(Number.isFinite),
  };
}

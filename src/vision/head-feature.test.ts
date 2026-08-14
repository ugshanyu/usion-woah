import { describe, expect, it } from 'vitest';
import type { FaceLandmark } from '../game/types';
import { buildNeutralHeadCalibration, classifyHead } from './head-classifier';
import { extractHeadFeature } from './head-feature';

function landmarks(noseX = 0.5, noseY = 0.55): FaceLandmark[] {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
  points[0] = { x: 0.34, y: 0.5 };
  points[2] = { x: 0.66, y: 0.5 };
  points[33] = { x: 0.4, y: 0.45 };
  points[263] = { x: 0.6, y: 0.45 };
  points[1] = { x: noseX, y: noseY };
  points[10] = { x: 0.5, y: 0.3 };
  points[152] = { x: 0.5, y: 0.7 };
  return points;
}

function yawMatrix(angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return { rows: 4, columns: 4, data: [
    cosine, 0, sine, 0,
    0, 1, 0, 0,
    -sine, 0, cosine, 0,
    0, 0, 0, 1,
  ] };
}

function pitchMatrix(angle: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  // MediaPipe MatrixData is column-major. Positive player pitch means that
  // the canonical +Z face normal rotates toward metric +Y (looking up).
  return { rows: 4, columns: 4, data: [
    1, 0, 0, 0,
    0, cosine, -sine, 0,
    0, sine, cosine, 0,
    0, 0, 0, 1,
  ] };
}

describe('canonical player-centric head features', () => {
  it('maps landmark fallback yaw to the photographed player, not the viewer', () => {
    const neutral = extractHeadFeature(undefined, landmarks());
    const playerRight = extractHeadFeature(undefined, landmarks(0.46));
    const playerLeft = extractHeadFeature(undefined, landmarks(0.54));
    expect(playerRight.x).toBeGreaterThan(neutral.x);
    expect(playerLeft.x).toBeLessThan(neutral.x);
  });

  it('maps the bundled column-major transform onto player-centric positive axes', () => {
    expect(extractHeadFeature(yawMatrix(0.25), landmarks()).x).toBeCloseTo(0.25, 5);
    expect(extractHeadFeature(pitchMatrix(0.2), landmarks(0.5, 0.52)).y).toBeCloseTo(0.2, 5);
    expect(extractHeadFeature(pitchMatrix(-0.2), landmarks(0.5, 0.58)).y).toBeCloseTo(-0.2, 5);
  });

  it('does not confuse the translation column with rotation', () => {
    const translated = yawMatrix(0.2);
    translated.data[12] = 4;
    translated.data[13] = -3;
    translated.data[14] = -25;
    expect(extractHeadFeature(translated, landmarks(0.47)).x).toBeCloseTo(0.2, 5);
  });

  it('rejects a non-rigid transformation matrix and falls back to landmarks', () => {
    const malformed = pitchMatrix(0.2);
    malformed.data[0] = 3;
    const extracted = extractHeadFeature(malformed, landmarks(0.5, 0.52));
    expect(extracted.source).toBe('landmarks');
    expect(extracted.y).toBeGreaterThan(extractHeadFeature(undefined, landmarks()).y);
  });

  it('keeps fallback pitch relative to the captured neutral face', () => {
    const neutral = extractHeadFeature(undefined, landmarks(0.5, 0.55));
    const up = extractHeadFeature(undefined, landmarks(0.5, 0.52));
    const down = extractHeadFeature(undefined, landmarks(0.5, 0.58));
    expect(up.y).toBeGreaterThan(neutral.y);
    expect(down.y).toBeLessThan(neutral.y);
  });

  it('classifies real-convention pitch end to end while treating opposite landmark evidence as lower confidence', () => {
    const neutral = extractHeadFeature(pitchMatrix(0), landmarks());
    const calibration = buildNeutralHeadCalibration(Array.from({ length: 8 }, () => ({ ...neutral })))!;
    const agreed = classifyHead(extractHeadFeature(pitchMatrix(0.2), landmarks(0.5, 0.52)), calibration);
    const contradicted = classifyHead(extractHeadFeature(pitchMatrix(0.2), landmarks(0.5, 0.58)), calibration);
    expect(agreed.direction).toBe('up');
    expect(classifyHead(extractHeadFeature(pitchMatrix(-0.2), landmarks(0.5, 0.58)), calibration).direction).toBe('down');
    expect(contradicted.direction).toBe('up');
    expect(contradicted.confidence).toBeLessThan(agreed.confidence);
    expect(contradicted.quality).toBeGreaterThanOrEqual(0.6);
  });
});

import { describe, expect, it } from 'vitest';
import type { HeadFeature } from '../game/types';
import { AUTOMATIC_PITCH_RANGE_RAD, AUTOMATIC_YAW_RANGE_RAD, buildNeutralHeadCalibration, classifyHead } from './head-classifier';

function feature(x: number, y: number, overrides: Partial<HeadFeature> = {}): HeadFeature {
  return { x, y, roll: 0, landmarkX: x, landmarkY: y, source: 'matrix', orientationQuality: 1, faceWidth: 0.32, clipped: false, finite: true, ...overrides };
}

function repeated(value: HeadFeature): HeadFeature[] {
  return Array.from({ length: 8 }, () => ({ ...value }));
}

describe('automatic neutral head calibration and classification', () => {
  const calibration = buildNeutralHeadCalibration(repeated(feature(0.08, -0.04)))!;

  it('uses fixed canonical yaw and pitch ranges without directional prompts', () => {
    expect(calibration.rightAxis).toEqual({ x: 1, y: 0 });
    expect(calibration.upAxis).toEqual({ x: 0, y: 1 });
    expect(calibration.scale).toEqual({
      left: AUTOMATIC_YAW_RANGE_RAD,
      right: AUTOMATIC_YAW_RANGE_RAD,
      up: AUTOMATIC_PITCH_RANGE_RAD,
      down: AUTOMATIC_PITCH_RANGE_RAD,
    });
  });

  for (const [direction, sample] of Object.entries({
    left: feature(-0.17, -0.04),
    right: feature(0.33, -0.04),
    up: feature(0.08, 0.14),
    down: feature(0.08, -0.22),
  })) {
    it(`classifies canonical ${direction} from the neutral baseline`, () => {
      expect(classifyHead(sample, calibration).direction).toBe(direction);
    });
  }

  it('uses neutral and rejects diagonal, clipped, and rolled faces', () => {
    expect(classifyHead(feature(0.09, -0.03), calibration).direction).toBe('neutral');
    expect(classifyHead(feature(0.3, 0.2), calibration).direction).toBe('unknown');
    expect(classifyHead(feature(0.3, -0.04, { clipped: true }), calibration).direction).toBe('unknown');
    expect(classifyHead(feature(0.3, -0.04, { roll: Math.PI / 4 }), calibration).direction).toBe('unknown');
  });

  it('keeps the 3D matrix direction when the lower-fidelity image landmark proxy disagrees', () => {
    const agreed = classifyHead(feature(0.08, 0.16), calibration);
    const contradicted = classifyHead(feature(0.08, 0.16, { landmarkY: -0.2 }), calibration);
    expect(contradicted.direction).toBe('up');
    expect(contradicted.confidence).toBeLessThan(agreed.confidence);
    expect(contradicted.quality).toBeLessThan(agreed.quality);
    expect(contradicted.quality).toBeGreaterThanOrEqual(0.6);
  });

  it('keeps a naturally tilted but valid movement above the round quality gate', () => {
    const result = classifyHead(feature(0.08, 0.16, { roll: 10 * Math.PI / 180 }), calibration);
    expect(result.direction).toBe('up');
    expect(result.quality).toBeGreaterThanOrEqual(0.6);
  });

  it('rejects switching between matrix and landmark-only angle scales mid-session', () => {
    expect(classifyHead(feature(0.33, -0.04, { source: 'landmarks' }), calibration).direction).toBe('unknown');
  });

  it('accepts a smaller complete face and rejects one that is too small', () => {
    expect(classifyHead(feature(0.33, -0.04, { faceWidth: 0.11 }), calibration).direction).toBe('right');
    expect(classifyHead(feature(0.33, -0.04, { faceWidth: 0.09 }), calibration).direction).toBe('unknown');
  });

  it('handles yaw across the minus-pi/pi boundary', () => {
    const wrapped = buildNeutralHeadCalibration(repeated(feature(3.12, 0)))!;
    expect(classifyHead(feature(-2.95, 0, { landmarkX: undefined }), wrapped).direction).toBe('right');
  });

  it('rejects insufficient, unusable, and unstable neutral samples', () => {
    expect(buildNeutralHeadCalibration(repeated(feature(0, 0)).slice(0, 4))).toBeNull();
    expect(buildNeutralHeadCalibration(repeated(feature(0, 0, { clipped: true })))).toBeNull();
    const noisy = repeated(feature(0, 0));
    noisy[0] = feature(-0.4, 0.3);
    noisy[1] = feature(0.4, -0.3);
    noisy[2] = feature(-0.35, 0.25);
    noisy[3] = feature(0.35, -0.25);
    expect(buildNeutralHeadCalibration(noisy)).toBeNull();
  });
});

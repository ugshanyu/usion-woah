import { describe, expect, it } from 'vitest';
import type { HeadFeature } from '../game/types';
import { buildHeadCalibration, classifyHead } from './head-classifier';

function feature(x: number, y: number, overrides: Partial<HeadFeature> = {}): HeadFeature {
  return { x, y, roll: 0, faceWidth: 0.32, clipped: false, finite: true, ...overrides };
}

function repeated(value: HeadFeature): HeadFeature[] {
  return Array.from({ length: 8 }, () => ({ ...value }));
}

describe('head calibration and classification', () => {
  const calibration = buildHeadCalibration({
    neutral: repeated(feature(0, 0)), left: repeated(feature(-0.4, 0)), right: repeated(feature(0.5, 0)), up: repeated(feature(0, 0.35)), down: repeated(feature(0, -0.3)),
  })!;

  for (const [direction, sample] of Object.entries({ left: feature(-0.3, 0), right: feature(0.35, 0), up: feature(0, 0.25), down: feature(0, -0.23) })) {
    it(`uses guided axes to classify ${direction}`, () => expect(classifyHead(sample, calibration).direction).toBe(direction));
  }

  it('uses neutral and rejects diagonal, clipped, and rolled faces', () => {
    expect(classifyHead(feature(0.01, 0.01), calibration).direction).toBe('neutral');
    expect(classifyHead(feature(0.3, 0.3), calibration).direction).toBe('unknown');
    expect(classifyHead(feature(0.3, 0, { clipped: true }), calibration).direction).toBe('unknown');
    expect(classifyHead(feature(0.3, 0, { roll: Math.PI / 4 }), calibration).direction).toBe('unknown');
  });

  it('accepts a smaller but complete face and rejects one that is too small', () => {
    expect(classifyHead(feature(0.35, 0, { faceWidth: 0.11 }), calibration).direction).toBe('right');
    expect(classifyHead(feature(0.35, 0, { faceWidth: 0.09 }), calibration).direction).toBe('unknown');
  });

  it('rejects calibration without enough motion', () => {
    expect(buildHeadCalibration({ neutral: repeated(feature(0, 0)), left: repeated(feature(-0.01, 0)), right: repeated(feature(0.01, 0)), up: repeated(feature(0, 0.01)), down: repeated(feature(0, -0.01)) })).toBeNull();
  });

  it('rejects an unstable guided calibration prompt', () => {
    const noisy = repeated(feature(-0.4, 0));
    noisy[0] = feature(-0.15, 0.25);
    noisy[1] = feature(-0.65, -0.25);
    noisy[2] = feature(-0.1, 0.2);
    noisy[3] = feature(-0.7, -0.2);
    expect(buildHeadCalibration({ neutral: repeated(feature(0, 0)), left: noisy, right: repeated(feature(0.5, 0)), up: repeated(feature(0, 0.35)), down: repeated(feature(0, -0.3)) })).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { HeadFeature } from '../game/types';
import { CalibrationSession, type CalibrationFeedback, type CalibrationStage } from './calibration';
import type { VisionInference } from './inference';

function feature(x: number, y: number, overrides: Partial<HeadFeature> = {}): HeadFeature {
  return { x, y, roll: 0, faceWidth: 0.32, clipped: false, finite: true, ...overrides };
}

describe('neutral-only automatic face calibration', () => {
  it('completes after eight stable forward-facing samples without direction prompts', () => {
    const inference = { beginWindow: vi.fn(), setHeadCalibration: vi.fn() } as unknown as VisionInference;
    const session = new CalibrationSession(inference);
    let stage: CalibrationStage = 'neutral';
    let feedback: CalibrationFeedback = 'searching';
    let progress = 0;
    const completed = vi.fn();
    session.onStage = (nextStage, nextProgress, nextFeedback) => {
      stage = nextStage;
      progress = nextProgress;
      feedback = nextFeedback;
    };
    session.onComplete = completed;

    session.start();
    session.acceptHead(feature(0, 0, { finite: false }));
    expect(feedback).toBe('searching');
    for (let index = 0; index < 7; index += 1) session.acceptHead(feature(0.02, -0.01));
    expect(stage).toBe('neutral');
    expect(progress).toBe(0.875);

    session.acceptHead(feature(0.02, -0.01));
    expect(stage).toBe('complete');
    expect(completed).toHaveBeenCalledOnce();
    expect(inference.beginWindow).toHaveBeenCalledOnce();
    expect(inference.setHeadCalibration).toHaveBeenCalledOnce();
  });

  it('resets neutral progress when the face moves before baseline capture', () => {
    const inference = { beginWindow: vi.fn(), setHeadCalibration: vi.fn() } as unknown as VisionInference;
    const session = new CalibrationSession(inference);
    let progress = 0;
    session.onStage = (_stage, nextProgress) => { progress = nextProgress; };
    session.start();
    for (let index = 0; index < 4; index += 1) session.acceptHead(feature(0, 0));
    expect(progress).toBe(0.5);
    session.acceptHead(feature(0.2, 0.2));
    expect(progress).toBe(0.125);
  });
});

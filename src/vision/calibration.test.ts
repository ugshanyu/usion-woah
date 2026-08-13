import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HeadFeature } from '../game/types';
import { CalibrationSession, type CalibrationFeedback, type CalibrationStage } from './calibration';
import type { VisionInference } from './inference';

function feature(x: number, y: number, overrides: Partial<HeadFeature> = {}): HeadFeature {
  return { x, y, roll: 0, faceWidth: 0.32, clipped: false, finite: true, ...overrides };
}

describe('recognition-driven face calibration', () => {
  afterEach(() => vi.useRealTimers());

  it('advances only after the prompted face direction is stable', () => {
    vi.useFakeTimers();
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
    vi.advanceTimersByTime(10_000);
    expect(stage).toBe('neutral');
    expect(progress).toBe(0);

    session.acceptHead(feature(0, 0, { finite: false }));
    expect(feedback).toBe('searching');
    acceptStable(session, feature(0, 0));
    expect(feedback).toBe('recognized');
    vi.advanceTimersByTime(350);
    expect(stage).toBe('left');

    acceptStable(session, feature(0, 0));
    expect(stage).toBe('left');
    expect(feedback).toBe('move-more');
    acceptStable(session, feature(-0.4, 0));
    vi.advanceTimersByTime(350);
    expect(stage).toBe('right');

    acceptStable(session, feature(-0.4, 0));
    expect(stage).toBe('right');
    expect(feedback).toBe('move-more');
    acceptStable(session, feature(0.4, 0));
    vi.advanceTimersByTime(350);
    expect(stage).toBe('up');

    acceptStable(session, feature(0, 0.3));
    vi.advanceTimersByTime(350);
    expect(stage).toBe('down');
    acceptStable(session, feature(0, -0.3));

    expect(stage).toBe('complete');
    expect(completed).toHaveBeenCalledOnce();
    expect(inference.setHeadCalibration).toHaveBeenCalledOnce();
  });

  it('resets progress when the face moves before recognition', () => {
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

function acceptStable(session: CalibrationSession, value: HeadFeature): void {
  for (let index = 0; index < 8; index += 1) session.acceptHead({ ...value });
}

import type { HeadCalibration, HeadFeature } from '../game/types';
import { median, medianVec } from '../game/math';
import { buildNeutralHeadCalibration, isUsableHeadFeature } from './head-classifier';
import type { VisionInference } from './inference';

export type CalibrationStage = 'neutral' | 'complete';
export type CalibrationFeedback = 'searching' | 'hold' | 'recognized' | 'restart';

const REQUIRED_STABLE_SAMPLES = 8;
const MAX_STABLE_DELTA = 4 * Math.PI / 180;
const MAX_NEUTRAL_ROLL = 25 * Math.PI / 180;

export class CalibrationSession {
  private candidate: HeadFeature[] = [];
  private accepting = false;
  calibration: HeadCalibration | null = null;
  onStage: ((stage: CalibrationStage, progress: number, feedback: CalibrationFeedback) => void) | null = null;
  onComplete: ((calibration: HeadCalibration) => void) | null = null;

  constructor(private readonly inference: VisionInference) {}

  start(): void {
    this.cancel();
    this.calibration = null;
    this.accepting = true;
    this.inference.beginWindow();
    this.onStage?.('neutral', 0, 'searching');
  }

  acceptHead(feature: HeadFeature): void {
    if (!this.accepting) return;
    if (!isUsableHeadFeature(feature) || Math.abs(feature.roll) > MAX_NEUTRAL_ROLL) {
      this.resetCandidate('searching');
      return;
    }
    const center = this.candidate.length ? medianFeature(this.candidate) : null;
    if (center && (Math.hypot(angleDistance(feature.x, center.x), angleDistance(feature.y, center.y)) > MAX_STABLE_DELTA || angleDistance(feature.roll, center.roll) > MAX_STABLE_DELTA)) {
      this.candidate = [feature];
    } else {
      this.candidate.push(feature);
    }
    const progress = Math.min(1, this.candidate.length / REQUIRED_STABLE_SAMPLES);
    this.onStage?.('neutral', progress, 'hold');
    if (this.candidate.length >= REQUIRED_STABLE_SAMPLES) this.finish();
  }

  cancel(): void {
    this.accepting = false;
    this.candidate = [];
  }

  private finish(): void {
    const calibration = buildNeutralHeadCalibration(this.candidate);
    if (!calibration) {
      this.resetCandidate('restart');
      return;
    }
    this.accepting = false;
    this.candidate = [];
    this.calibration = calibration;
    this.inference.setHeadCalibration(calibration);
    this.onStage?.('complete', 1, 'recognized');
    this.onComplete?.(calibration);
  }

  private resetCandidate(feedback: CalibrationFeedback): void {
    if (!this.candidate.length && feedback === 'searching') {
      this.onStage?.('neutral', 0, feedback);
      return;
    }
    this.candidate = [];
    this.onStage?.('neutral', 0, feedback);
  }
}

function medianFeature(features: HeadFeature[]): HeadFeature | null {
  if (!features.length) return null;
  const center = medianVec(features);
  return {
    ...features[Math.floor(features.length / 2)],
    ...center,
    roll: median(features.map((feature) => feature.roll)),
    faceWidth: median(features.map((feature) => feature.faceWidth)),
  };
}

function angleDistance(left: number, right: number): number {
  return Math.abs(Math.atan2(Math.sin(left - right), Math.cos(left - right)));
}

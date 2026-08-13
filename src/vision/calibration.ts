import type { CalibrationPrompt, HeadCalibration, HeadFeature } from '../game/types';
import { median, medianVec } from '../game/math';
import { buildHeadCalibration, isUsableHeadFeature } from './head-classifier';
import type { VisionInference } from './inference';

export type CalibrationStage = CalibrationPrompt | 'complete';
export type CalibrationFeedback = 'searching' | 'move-more' | 'hold' | 'recognized' | 'restart';

const STAGES: CalibrationPrompt[] = ['neutral', 'left', 'right', 'up', 'down'];
const REQUIRED_STABLE_SAMPLES = 8;
const MAX_STABLE_DELTA = 4 * Math.PI / 180;
const MIN_YAW = 15 * Math.PI / 180;
const MIN_PITCH = 10 * Math.PI / 180;
const MAX_CALIBRATION_ROLL = 20 * Math.PI / 180;
const MAX_NEUTRAL_ROLL = 25 * Math.PI / 180;

export class CalibrationSession {
  private index = 0;
  private transitionTimer: number | null = null;
  private candidate: HeadFeature[] = [];
  private accepting = false;
  private readonly heads: Record<CalibrationPrompt, HeadFeature[]> = { neutral: [], left: [], right: [], up: [], down: [] };
  calibration: HeadCalibration | null = null;
  onStage: ((stage: CalibrationStage, progress: number, feedback: CalibrationFeedback) => void) | null = null;
  onComplete: ((calibration: HeadCalibration) => void) | null = null;

  constructor(private readonly inference: VisionInference) {}

  start(): void {
    this.cancel();
    this.index = 0;
    for (const samples of Object.values(this.heads)) samples.length = 0;
    this.calibration = null;
    this.beginStage();
  }

  acceptHead(feature: HeadFeature): void {
    const stage = STAGES[this.index];
    if (!this.accepting || !stage) return;
    if (!isUsableHeadFeature(feature)) {
      this.resetCandidate(stage, 'searching');
      return;
    }
    if (!this.matchesPrompt(stage, feature)) {
      this.resetCandidate(stage, 'move-more');
      return;
    }
    const center = this.candidate.length ? medianFeature(this.candidate) : null;
    if (center && (Math.hypot(feature.x - center.x, feature.y - center.y) > MAX_STABLE_DELTA || angleDistance(feature.roll, center.roll) > MAX_STABLE_DELTA)) {
      this.candidate = [feature];
    } else {
      this.candidate.push(feature);
    }
    const progress = Math.min(1, this.candidate.length / REQUIRED_STABLE_SAMPLES);
    this.onStage?.(stage, progress, 'hold');
    if (this.candidate.length >= REQUIRED_STABLE_SAMPLES) this.finishStage(stage);
  }

  cancel(): void {
    this.accepting = false;
    this.candidate = [];
    if (this.transitionTimer !== null) globalThis.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
  }

  private beginStage(feedback: CalibrationFeedback = 'searching'): void {
    if (this.transitionTimer !== null) globalThis.clearTimeout(this.transitionTimer);
    this.transitionTimer = null;
    const stage = STAGES[this.index];
    if (!stage) return;
    this.candidate = [];
    this.accepting = true;
    this.inference.beginWindow();
    this.onStage?.(stage, 0, feedback);
  }

  private finishStage(stage: CalibrationPrompt): void {
    this.accepting = false;
    this.heads[stage] = [...this.candidate];
    this.candidate = [];
    this.onStage?.(stage, 1, 'recognized');
    this.index += 1;
    if (this.index < STAGES.length) {
      this.transitionTimer = globalThis.setTimeout(() => {
        this.transitionTimer = null;
        this.beginStage();
      }, 350);
      return;
    }
    const calibration = buildHeadCalibration(this.heads);
    if (!calibration) {
      this.transitionTimer = globalThis.setTimeout(() => {
        this.transitionTimer = null;
        this.index = 0;
        for (const samples of Object.values(this.heads)) samples.length = 0;
        this.beginStage('restart');
      }, 500);
      return;
    }
    this.calibration = calibration;
    this.inference.setHeadCalibration(calibration);
    this.onStage?.('complete', 1, 'recognized');
    this.onComplete?.(calibration);
  }

  private resetCandidate(stage: CalibrationPrompt, feedback: CalibrationFeedback): void {
    if (!this.candidate.length && feedback === 'searching') {
      this.onStage?.(stage, 0, feedback);
      return;
    }
    this.candidate = [];
    this.onStage?.(stage, 0, feedback);
  }

  private matchesPrompt(stage: CalibrationPrompt, feature: HeadFeature): boolean {
    if (stage === 'neutral') return Math.abs(feature.roll) <= MAX_NEUTRAL_ROLL;
    const neutral = medianFeature(this.heads.neutral);
    if (!neutral || angleDistance(feature.roll, neutral.roll) > MAX_CALIBRATION_ROLL) return false;
    const dx = feature.x - neutral.x;
    const dy = feature.y - neutral.y;
    if (stage === 'left' || stage === 'right') {
      if (Math.abs(dx) < MIN_YAW || Math.abs(dx) < Math.abs(dy) * 1.15) return false;
      if (stage === 'right') {
        const left = medianFeature(this.heads.left);
        if (!left || dx * (left.x - neutral.x) >= 0) return false;
      }
      return true;
    }
    if (Math.abs(dy) < MIN_PITCH || Math.abs(dy) < Math.abs(dx) * 1.05) return false;
    if (stage === 'down') {
      const up = medianFeature(this.heads.up);
      if (!up || dy * (up.y - neutral.y) >= 0) return false;
    }
    return true;
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

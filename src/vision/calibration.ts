import type { CalibrationPrompt, DirectionSample, HeadCalibration, HeadFeature } from '../game/types';
import { buildHeadCalibration } from './head-classifier';
import type { VisionInference } from './inference';

export type CalibrationStage = CalibrationPrompt | 'point-left' | 'point-right' | 'point-up' | 'point-down' | 'complete';

const STAGES: CalibrationStage[] = ['neutral', 'left', 'right', 'up', 'down', 'point-left', 'point-right', 'point-up', 'point-down'];

export class CalibrationSession {
  private index = 0;
  private stageStartedAt = 0;
  private timer: number | null = null;
  private transitionTimer: number | null = null;
  private readonly heads: Record<CalibrationPrompt, HeadFeature[]> = { neutral: [], left: [], right: [], up: [], down: [] };
  private poseSamples: DirectionSample[] = [];
  calibration: HeadCalibration | null = null;
  onStage: ((stage: CalibrationStage, progress: number, retry?: boolean) => void) | null = null;
  onComplete: ((calibration: HeadCalibration) => void) | null = null;

  constructor(private readonly inference: VisionInference, private readonly now: () => number = () => performance.now()) {}

  start(): void {
    this.cancel();
    this.index = 0;
    for (const samples of Object.values(this.heads)) samples.length = 0;
    this.poseSamples = [];
    this.calibration = null;
    this.beginStage();
  }

  acceptHead(feature: HeadFeature): void {
    const stage = STAGES[this.index];
    if (!['neutral', 'left', 'right', 'up', 'down'].includes(stage)) return;
    if (feature.finite && !feature.clipped && feature.faceWidth >= 0.16 && feature.faceWidth <= 0.75) this.heads[stage as CalibrationPrompt].push(feature);
  }

  acceptPose(sample: DirectionSample): void {
    if (STAGES[this.index].startsWith('point-')) this.poseSamples.push(sample);
  }

  cancel(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    if (this.transitionTimer !== null) window.clearTimeout(this.transitionTimer);
    this.timer = null;
    this.transitionTimer = null;
  }

  private beginStage(retry = false): void {
    this.cancel();
    const stage = STAGES[this.index];
    this.stageStartedAt = this.now();
    this.poseSamples = [];
    this.inference.setMode(stage.startsWith('point-') ? 'pose' : 'head');
    this.onStage?.(stage, 0, retry);
    this.timer = window.setInterval(() => {
      const progress = Math.min(1, (this.now() - this.stageStartedAt) / 1000);
      this.onStage?.(stage, progress, retry);
      if (progress >= 1) this.finishStage(stage);
    }, 50);
  }

  private finishStage(stage: CalibrationStage): void {
    this.cancel();
    if (stage.startsWith('point-')) {
      const expected = stage.replace('point-', '');
      const valid = this.poseSamples.filter((sample) => sample.direction === expected && sample.confidence >= 0.55 && sample.quality >= 0.6);
      if (valid.length < 2) {
        this.beginStage(true);
        return;
      }
    } else if (this.heads[stage as CalibrationPrompt].length < 5) {
      this.heads[stage as CalibrationPrompt].length = 0;
      this.beginStage(true);
      return;
    }

    this.index += 1;
    if (this.index < STAGES.length) {
      this.transitionTimer = window.setTimeout(() => {
        this.transitionTimer = null;
        this.beginStage();
      }, 250);
      return;
    }
    const calibration = buildHeadCalibration(this.heads);
    if (!calibration) {
      this.index = 0;
      for (const samples of Object.values(this.heads)) samples.length = 0;
      this.beginStage(true);
      return;
    }
    this.calibration = calibration;
    this.inference.setHeadCalibration(calibration);
    this.onStage?.('complete', 1);
    this.onComplete?.(calibration);
  }
}

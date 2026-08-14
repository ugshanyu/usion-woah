import type { DirectionSample, HeadCalibration, HeadFeature } from '../game/types';
import { VISION_MAX_INTERVAL_MS, VISION_MIN_INTERVAL_MS, VISION_SLOW_P95_MS } from '../game/timing';
import { classifyHead } from './head-classifier';

type WorkerResult = {
  type: 'result';
  frameSeq: number;
  generation: number;
  capturePerfMs: number;
  inferenceMs: number;
  feature: HeadFeature;
};

export class VisionInference {
  private readonly worker = new Worker(new URL('./vision.worker.ts', import.meta.url));
  private video: HTMLVideoElement | null = null;
  private generation = 0;
  private frameSeq = 0;
  private busy = false;
  private running = false;
  private lastSubmittedAt = 0;
  private intervalMs = 66;
  private previousDirection: DirectionSample['direction'] = 'neutral';
  private calibration: HeadCalibration | null = null;
  private previousHeadFeature: HeadFeature | null = null;
  private readonly inferenceHistory: number[] = [];
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private readyTimer: number | null = null;

  onSample: ((sample: DirectionSample) => void) | null = null;
  onHeadFeature: ((feature: HeadFeature, capturePerfMs: number) => void) | null = null;
  onStatus: ((status: 'loading' | 'ready' | 'slow' | 'error', detail?: string) => void) | null = null;

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerResult | { type: 'ready' | 'error' | 'frame-error'; message?: string }>) => {
      if (event.data.type === 'ready') {
        this.clearReadyTimer();
        this.onStatus?.('ready');
        this.resolveReady?.();
        this.resolveReady = null;
        this.rejectReady = null;
        return;
      }
      if (event.data.type === 'error') {
        this.clearReadyTimer();
        this.onStatus?.('error', event.data.message);
        this.rejectReady?.(new Error(event.data.message || 'vision_init_failed'));
        this.resolveReady = null;
        this.rejectReady = null;
        return;
      }
      if (event.data.type === 'frame-error') {
        this.busy = false;
        return;
      }
      if (event.data.type === 'result') this.handleResult(event.data);
    };
    this.worker.onerror = (event) => {
      this.failInitialization(event.message || 'vision_worker_failed');
    };
  }

  initialize(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;
    this.onStatus?.('loading');
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.readyTimer = window.setTimeout(() => this.failInitialization('vision_init_timeout'), 30_000);
    this.worker.postMessage({ type: 'init' });
    return this.readyPromise;
  }

  setHeadCalibration(calibration: HeadCalibration): void {
    this.calibration = calibration;
  }

  beginWindow(): number {
    this.generation += 1;
    this.previousDirection = 'neutral';
    this.previousHeadFeature = null;
    return this.generation;
  }

  start(video: HTMLVideoElement): void {
    this.video = video;
    this.running = true;
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    this.video = null;
    this.busy = false;
    this.generation += 1;
  }

  destroy(): void {
    this.stop();
    this.clearReadyTimer();
    this.worker.terminate();
  }

  private failInitialization(message: string): void {
    if (!this.rejectReady) return;
    this.clearReadyTimer();
    this.onStatus?.('error', message);
    this.rejectReady(new Error(message));
    this.resolveReady = null;
    this.rejectReady = null;
  }

  private clearReadyTimer(): void {
    if (this.readyTimer !== null) window.clearTimeout(this.readyTimer);
    this.readyTimer = null;
  }

  private scheduleFrame(): void {
    const video = this.video;
    if (!video || !this.running) return;
    const callback = (now: number, metadata?: VideoFrameCallbackMetadata) => {
      if (!this.running || this.video !== video) return;
      const captureTime = (metadata as VideoFrameCallbackMetadata & { captureTime?: number } | undefined)?.captureTime;
      void this.capture(video, Number.isFinite(captureTime) ? captureTime! : now);
      this.scheduleFrame();
    };
    if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(callback);
    else requestAnimationFrame(callback);
  }

  private async capture(video: HTMLVideoElement, capturePerfMs: number): Promise<void> {
    if (this.busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || capturePerfMs - this.lastSubmittedAt < this.intervalMs) return;
    this.busy = true;
    this.lastSubmittedAt = capturePerfMs;
    try {
      const frame = await createImageBitmap(video);
      this.worker.postMessage({ type: 'infer', frame, frameSeq: ++this.frameSeq, generation: this.generation, capturePerfMs }, [frame]);
    } catch {
      this.busy = false;
    }
  }

  private handleResult(result: WorkerResult): void {
    this.busy = false;
    if (result.generation !== this.generation) return;
    this.inferenceHistory.push(result.inferenceMs);
    if (this.inferenceHistory.length > 30) this.inferenceHistory.shift();
    const sorted = [...this.inferenceHistory].sort((left, right) => left - right);
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
    this.intervalMs = Math.max(VISION_MIN_INTERVAL_MS, Math.min(VISION_MAX_INTERVAL_MS, p95 * 1.5));
    if (p95 > VISION_SLOW_P95_MS) {
      this.onStatus?.('slow');
    }
    this.onHeadFeature?.(result.feature, result.capturePerfMs);
    const previous = this.previousHeadFeature;
    this.previousHeadFeature = result.feature;
    if (previous && Math.hypot(result.feature.x - previous.x, result.feature.y - previous.y) > 25 * Math.PI / 180) {
      this.onSample?.({ ...result, direction: 'unknown', confidence: 0, quality: 0 });
      return;
    }
    const classification = this.calibration ? classifyHead(result.feature, this.calibration, this.previousDirection) : null;
    if (!classification) return;
    this.previousDirection = classification.direction;
    this.onSample?.({ ...result, direction: classification.direction, confidence: classification.confidence, quality: classification.quality });
  }
}

/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractHeadFeature } from './head-feature';

type InferMessage = {
  type: 'infer';
  frame: ImageBitmap;
  frameSeq: number;
  generation: number;
  capturePerfMs: number;
};
let face: FaceLandmarker | null = null;
let initializing: Promise<void> | null = null;

async function initialize(): Promise<void> {
  if (face) return;
  if (initializing) return initializing;
  initializing = (async () => {
    const wasm = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    face = await FaceLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.6,
      minFacePresenceConfidence: 0.6,
      minTrackingConfidence: 0.6,
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
    });
  })();
  return initializing;
}

self.onmessage = async (event: MessageEvent<{ type: 'init' } | InferMessage>) => {
  if (event.data.type === 'init') {
    try {
      await initialize();
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  const { frame, frameSeq, generation, capturePerfMs } = event.data;
  const started = performance.now();
  try {
    await initialize();
    const result = face!.detectForVideo(frame, capturePerfMs);
    const feature = result.faceLandmarks.length === 1
      ? extractHeadFeature(result.facialTransformationMatrixes[0], result.faceLandmarks[0])
      : { x: 0, y: 0, roll: 0, faceWidth: 0, clipped: true, finite: false };
    self.postMessage({ type: 'result', frameSeq, generation, capturePerfMs, inferenceMs: performance.now() - started, feature });
  } catch (error) {
    self.postMessage({ type: 'frame-error', frameSeq, generation, message: error instanceof Error ? error.message : String(error) });
  } finally {
    frame.close();
  }
};

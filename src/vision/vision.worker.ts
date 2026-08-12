/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { classifyPointingPose } from './pose-classifier';
import { extractHeadFeature } from './head-feature';

type InferMessage = {
  type: 'infer';
  frame: ImageBitmap;
  mode: 'pose' | 'head';
  frameSeq: number;
  generation: number;
  capturePerfMs: number;
};
let pose: PoseLandmarker | null = null;
let face: FaceLandmarker | null = null;
let initializing: Promise<void> | null = null;

async function initialize(): Promise<void> {
  if (pose && face) return;
  if (initializing) return initializing;
  initializing = (async () => {
    const wasm = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
    [pose, face] = await Promise.all([
      PoseLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.6,
        minPosePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputSegmentationMasks: false,
      }),
      FaceLandmarker.createFromOptions(wasm, {
        baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate: 'CPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.6,
        minFacePresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      }),
    ]);
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

  const { frame, mode, frameSeq, generation, capturePerfMs } = event.data;
  const started = performance.now();
  try {
    await initialize();
    if (mode === 'pose') {
      const result = pose!.detectForVideo(frame, capturePerfMs);
      const classification = result.landmarks.length === 1
        ? classifyPointingPose(result.landmarks[0])
        : { direction: 'unknown', confidence: 0, quality: 0, arm: null };
      self.postMessage({ type: 'result', mode, frameSeq, generation, capturePerfMs, inferenceMs: performance.now() - started, classification });
    } else {
      const result = face!.detectForVideo(frame, capturePerfMs);
      const feature = result.faceLandmarks.length === 1
        ? extractHeadFeature(result.facialTransformationMatrixes[0], result.faceLandmarks[0])
        : { x: 0, y: 0, roll: 0, faceWidth: 0, clipped: true, finite: false };
      self.postMessage({ type: 'result', mode, frameSeq, generation, capturePerfMs, inferenceMs: performance.now() - started, feature });
    }
  } catch (error) {
    self.postMessage({ type: 'frame-error', frameSeq, generation, message: error instanceof Error ? error.message : String(error) });
  } finally {
    frame.close();
  }
};

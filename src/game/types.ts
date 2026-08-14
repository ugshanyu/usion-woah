export type Direction = 'up' | 'down' | 'left' | 'right' | 'neutral' | 'unknown';
export type CardinalDirection = Exclude<Direction, 'neutral' | 'unknown'>;

export type Role = 'pointer' | 'looker';

export type FaceLandmark = {
  x: number;
  y: number;
  z?: number;
};

export type DirectionSample = {
  frameSeq: number;
  generation: number;
  capturePerfMs: number;
  direction: Direction;
  confidence: number;
  quality: number;
};

export type DirectionChoice = {
  direction: CardinalDirection;
  selectedLocalMs: number;
  confidence: number;
  sequence: number;
};

export type GestureSummary = {
  roundId: number;
  role: Role;
  direction: Direction;
  onsetHostMs: number;
  peakHostMs: number;
  confidence: number;
  clockSigmaMs: number;
  frameSeq: number;
  generation: number;
};

export type HeadFeature = {
  x: number;
  y: number;
  roll: number;
  landmarkX?: number;
  landmarkY?: number;
  source?: 'matrix' | 'landmarks';
  orientationQuality?: number;
  faceWidth: number;
  clipped: boolean;
  finite: boolean;
};

export type HeadCalibration = {
  neutral: HeadFeature;
  rightAxis: { x: number; y: number };
  upAxis: { x: number; y: number };
  scale: { left: number; right: number; up: number; down: number };
  neutralRoll: number;
};

export type Verdict = 'hit' | 'dodge' | 'penalty' | 'void';

export type ObservationStatus = 'ok' | 'missing' | 'clock-uncertain';

export type RoundResult = {
  roundId: number;
  verdict: Verdict;
  reason: 'same_direction' | 'different_direction' | 'pointer_timeout' | 'looker_timeout' | 'both_timeout' | 'invalid_sample' | 'timing_mismatch' | 'clock_uncertain';
  pointer: GestureSummary | null;
  looker: GestureSummary | null;
};

export type Score = Record<string, number>;

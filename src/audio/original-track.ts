export const TRACK_TEMPO_BPM = 120;
export const TRACK_STEPS_PER_BEAT = 4;
export const TRACK_STEPS_PER_BAR = 16;
export const TRACK_STEP_SECONDS = 60 / TRACK_TEMPO_BPM / TRACK_STEPS_PER_BEAT;
export const TRACK_BAR_SECONDS = TRACK_STEP_SECONDS * TRACK_STEPS_PER_BAR;

const KICK_STEPS = new Set([0, 3, 7, 8, 11, 14]);
const SNARE_STEPS = new Set([4, 12]);
const CLOSED_HAT_STEPS = new Set([0, 2, 4, 6, 8, 10, 12, 14]);
const OPEN_HAT_STEPS = new Set([7, 15]);
const BASS_MIDI = [41, null, null, 41, null, 44, null, null, 36, null, 36, null, 39, null, 44, null] as const;
const LEAD_MIDI = [null, 68, null, 72, 75, null, 72, null, null, 65, null, 68, 72, null, 68, null] as const;
const CHORDS = new Map<number, readonly number[]>([
  [0, [53, 56, 60]],
  [8, [49, 53, 56]],
  [12, [51, 55, 58]],
]);

export type TrackStep = {
  kick: boolean;
  snare: boolean;
  closedHat: boolean;
  openHat: boolean;
  bassMidi: number | null;
  leadMidi: number | null;
  chordMidi: readonly number[] | null;
};

export function trackStepAt(absoluteStep: number): TrackStep {
  const step = normalizedStep(absoluteStep);
  return {
    kick: KICK_STEPS.has(step),
    snare: SNARE_STEPS.has(step),
    closedHat: CLOSED_HAT_STEPS.has(step),
    openHat: OPEN_HAT_STEPS.has(step),
    bassMidi: BASS_MIDI[step],
    leadMidi: LEAD_MIDI[step],
    chordMidi: CHORDS.get(step) ?? null,
  };
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

function normalizedStep(absoluteStep: number): number {
  if (!Number.isInteger(absoluteStep)) throw new Error('invalid_track_step');
  return ((absoluteStep % TRACK_STEPS_PER_BAR) + TRACK_STEPS_PER_BAR) % TRACK_STEPS_PER_BAR;
}

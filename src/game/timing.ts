export const VISION_MIN_INTERVAL_MS = 50;
export const VISION_MAX_INTERVAL_MS = 160;
export const VISION_SLOW_P95_MS = 160;

// All offsets are relative to the capture-time WOAH beat.
export const HEAD_NEUTRAL_START_MS = -600;
export const HEAD_NEUTRAL_END_MS = -100;
export const HEAD_ACTIVE_START_MS = -100;
export const HEAD_ACTIVE_END_MS = 360;

// The detector may intentionally sample every 160 ms on a slower phone.
// Leave one video-frame/scheduling margin before rejecting stable evidence.
export const HEAD_STABLE_MAX_GAP_MS = VISION_MAX_INTERVAL_MS + 80;
export const HEAD_PEAK_WINDOW_MS = 180;

// Wait for the last in-window frame to finish inference before summarizing it.
export const HEAD_OBSERVATION_DELAY_MS = 600;
export const OBSERVATION_NETWORK_GRACE_MS = 250;

export const VISION_MIN_INTERVAL_MS = 50;
export const VISION_MAX_INTERVAL_MS = 160;
export const VISION_SLOW_P95_MS = 160;

// Announce before the three-second audio excerpt starts so both peers can
// schedule the same AudioBuffer source despite ordinary signaling latency.
export const ROUND_ANNOUNCE_LEAD_MS = 3500;

// All offsets are relative to the capture-time WOAH beat.
// Rearm before the visible "1" so a held pose cannot become a fresh gesture.
export const HEAD_NEUTRAL_START_MS = -1600;
export const HEAD_NEUTRAL_END_MS = -1100;
// The visible "1" begins one second before WOAH. Recognition opens with it.
export const HEAD_ACTIVE_START_MS = -1000;
export const HEAD_ACTIVE_END_MS = 3000;

// The detector may intentionally sample every 160 ms on a slower phone.
// Leave one video-frame/scheduling margin before rejecting stable evidence.
export const HEAD_STABLE_MAX_GAP_MS = VISION_MAX_INTERVAL_MS + 80;
export const HEAD_PEAK_WINDOW_MS = 180;

// The visible "1" opens recognition and WOAH leaves three more seconds. The
// first stable direction wins. The drain lets the final captured frame finish;
// capture timestamps after HEAD_ACTIVE_END_MS are still rejected by the rules.
export const HEAD_RECOGNITION_TIMEOUT_MS = HEAD_ACTIVE_END_MS;
export const HEAD_INFERENCE_DRAIN_MS = VISION_MAX_INTERVAL_MS * 2;
export const OBSERVATION_NETWORK_GRACE_MS = 250;

import { describe, expect, it } from 'vitest';
import { EventDeduper, isControlEvent, isRtcSignal, type ReadyEvent } from './protocol';

describe('network protocol guards', () => {
  it('validates complete targeted RTC signals', () => {
    expect(isRtcSignal({ ns: 'woah.rtc.v1', to: 'b', matchId: 'm', hostEpoch: 'e', pcGeneration: 0, signalSeq: 1, kind: 'ice-complete' })).toBe(true);
    expect(isRtcSignal({ ns: 'woah.rtc.v1', to: 'b', matchId: 'm', hostEpoch: 'e', pcGeneration: 0, signalSeq: 1, kind: 'offer', description: { type: 'offer', sdp: 'v=0' } })).toBe(true);
    expect(isRtcSignal({ ns: 'woah.rtc.v1', to: 'b', kind: 'offer' })).toBe(false);
    expect(isRtcSignal({ ns: 'woah.rtc.v1', to: 'b', matchId: 'm', hostEpoch: 'e', pcGeneration: 0, signalSeq: 1, kind: 'offer', description: { type: 'answer', sdp: 'v=0' } })).toBe(false);
  });

  it('deduplicates dual-path reliable control events', () => {
    const event: ReadyEvent = { ns: 'woah.control.v1', kind: 'ready', eventId: 'same', playerId: 'a', playerName: 'A', calibrated: true, cameraReady: true };
    const deduper = new EventDeduper();
    expect(deduper.accept(event)).toBe(true);
    expect(deduper.accept(event)).toBe(false);
    expect(isControlEvent(event)).toBe(true);
    expect(isControlEvent({ ...event, calibrated: false })).toBe(false);
  });
});

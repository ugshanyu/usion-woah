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

  it('requires a valid randomized first pointer and explicit observation status', () => {
    const session = { ns: 'woah.control.v1', kind: 'session', eventId: 'session', matchId: 'm', hostEpoch: 'e', hostId: 'host', guestId: 'guest', firstPointerId: 'guest' };
    expect(isControlEvent(session)).toBe(true);
    expect(isControlEvent({ ...session, firstPointerId: 'outsider' })).toBe(false);
    const observation = { ns: 'woah.control.v1', kind: 'observation', eventId: 'observation', matchId: 'm', hostEpoch: 'e', roundId: 1, generation: 1, summary: null, status: 'missing' };
    expect(isControlEvent(observation)).toBe(true);
    expect(isControlEvent({ ...observation, status: 'ok' })).toBe(false);
  });

  it('accepts the five-point match maximum and rejects impossible scores', () => {
    const verdict = {
      ns: 'woah.control.v1', kind: 'verdict', eventId: 'verdict', matchId: 'm', hostEpoch: 'e', nextPointerId: 'guest',
      result: { roundId: 10, verdict: 'dodge', reason: 'different_direction', pointer: null, looker: null },
      score: { host: 5, guest: 4 },
    };
    expect(isControlEvent(verdict)).toBe(true);
    expect(isControlEvent({ ...verdict, score: { host: 6, guest: 4 } })).toBe(false);
  });
});

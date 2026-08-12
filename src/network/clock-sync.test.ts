import { describe, expect, it, vi } from 'vitest';
import { ClockSync, isClockMessage } from './clock-sync';

describe('ClockSync', () => {
  it('estimates host-minus-guest offset from the lowest RTT samples', () => {
    vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });
    let guestNow = 1000;
    let hostNow = 1090;
    const guest = new ClockSync(false, () => guestNow);
    const host = new ClockSync(true, () => hostNow);
    for (const travel of [20, 18, 22, 50]) {
      const probe = guest.createProbe();
      hostNow = probe.g0 + 90 + travel / 2;
      const reply = host.answer(probe);
      guestNow = probe.g0 + travel;
      guest.accept(reply);
      guestNow += 100;
    }
    expect(guest.offsetMs).toBeCloseTo(90, 4);
    expect(guest.localToHost(2000)).toBeCloseTo(2090, 4);
    expect(guest.ready).toBe(true);
    vi.unstubAllGlobals();
  });

  it('refuses to claim synchronization from too few samples', () => {
    const guest = new ClockSync(false, () => 1000);
    expect(guest.ready).toBe(false);
    expect(guest.uncertaintyMs).toBe(Number.POSITIVE_INFINITY);
  });

  it('rejects malformed peer clock messages', () => {
    expect(isClockMessage({ ns: 'woah.clock.v1', kind: 'ready', uncertaintyMs: 40 })).toBe(true);
    expect(isClockMessage({ ns: 'woah.clock.v1', kind: 'ready', uncertaintyMs: -1 })).toBe(false);
    expect(isClockMessage({ ns: 'woah.clock.v1', kind: 'probe', probeId: 'p', g0: 10 })).toBe(true);
    expect(isClockMessage({ ns: 'woah.clock.v1', kind: 'reply', probeId: 'p', g0: 10 })).toBe(false);
  });
});

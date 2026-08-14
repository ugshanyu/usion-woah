import { describe, expect, it, vi } from 'vitest';
import type { UsionRoom } from '../platform/room';
import type { VisionInference } from '../vision/inference';
import { SampleBuffer } from '../vision/sample-buffer';
import { MatchController, type MatchView } from './match-controller';
import type { RoundArmEvent } from '../network/protocol';
import type { DirectionChoice } from './types';

function createMatch() {
  const room = {
    state: {
      config: { userId: 'host', serviceId: 'service' },
      myId: 'host', myName: 'Host', roomId: null, roster: ['host'], hostId: 'host', connection: 'idle',
    },
  } as unknown as UsionRoom;
  const inference = {} as VisionInference;
  return new MatchController(room, inference, new SampleBuffer());
}

describe('MatchController connection lifecycle', () => {
  it('does not show reconnecting for the initial disconnected placeholder', () => {
    const match = createMatch();
    const onView = vi.fn<(view: MatchView) => void>();
    match.onView = onView;

    match.handleConnection('disconnected');

    expect(onView).not.toHaveBeenCalled();
  });

  it('pauses only after an established platform connection is lost', () => {
    const match = createMatch();
    const views: MatchView[] = [];
    match.onView = (view) => views.push(view);

    match.handleConnection('connected');
    match.handleConnection('rejoining');
    match.handleConnection('disconnected');

    expect(views).toHaveLength(1);
    expect(views[0].phase).toBe('reconnecting');
  });

  it('locks the first pre-WOAH guess and rejects later button presses', () => {
    const match = createMatch();
    const internals = match as unknown as {
      currentRound: RoundArmEvent;
      currentChoice: DirectionChoice | null;
      clock: { hostToLocal: (time: number) => number; uncertaintyMs: number };
    };
    internals.currentRound = {
      ns: 'woah.control.v1', kind: 'round', eventId: 'round-1', matchId: 'match', hostEpoch: 'epoch',
      roundId: 1, generation: 1, pointerId: 'host', lookerId: 'guest', targetHostMs: 4000, deadlineHostMs: 4500,
    };
    internals.clock = { hostToLocal: (time) => time, uncertaintyMs: 10 };

    expect(match.submitDirection({ direction: 'left', selectedLocalMs: 1500, confidence: 1, sequence: 1 })).toBe(true);
    expect(match.submitDirection({ direction: 'right', selectedLocalMs: 2000, confidence: 1, sequence: 2 })).toBe(false);
    expect(internals.currentChoice?.direction).toBe('left');
  });

  it('rejects a first guess after the WOAH deadline', () => {
    const match = createMatch();
    const internals = match as unknown as {
      currentRound: RoundArmEvent;
      clock: { hostToLocal: (time: number) => number; uncertaintyMs: number };
    };
    internals.currentRound = {
      ns: 'woah.control.v1', kind: 'round', eventId: 'round-2', matchId: 'match', hostEpoch: 'epoch',
      roundId: 2, generation: 2, pointerId: 'host', lookerId: 'guest', targetHostMs: 4000, deadlineHostMs: 4500,
    };
    internals.clock = { hostToLocal: (time) => time, uncertaintyMs: 10 };

    expect(match.submitDirection({ direction: 'up', selectedLocalMs: 4001, confidence: 1, sequence: 1 })).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { UsionRoom } from '../platform/room';
import type { VisionInference } from '../vision/inference';
import { SampleBuffer } from '../vision/sample-buffer';
import { MatchController, type MatchView } from './match-controller';

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
});

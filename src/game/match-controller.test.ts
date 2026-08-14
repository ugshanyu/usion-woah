import { describe, expect, it, vi } from 'vitest';
import type { UsionRoom } from '../platform/room';
import type { VisionInference } from '../vision/inference';
import { SampleBuffer } from '../vision/sample-buffer';
import { MatchController, type MatchView } from './match-controller';
import type { ObservationEvent, RoundArmEvent, SessionEvent } from '../network/protocol';
import type { DirectionChoice, DirectionSample } from './types';

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

function directionSample(at: number, direction: DirectionSample['direction'], frameSeq: number, generation = 1): DirectionSample {
  return { capturePerfMs: at, direction, frameSeq, generation, confidence: 0.9, quality: 0.9 };
}

function createRecognitionMatch() {
  const sendControl = vi.fn().mockResolvedValue(undefined);
  const room = {
    state: {
      config: { userId: 'host', serviceId: 'service' },
      myId: 'host', myName: 'Host', roomId: 'room', roster: ['host', 'guest'], hostId: 'host', connection: 'connected',
    },
    sendControl,
    reportResult: vi.fn().mockResolvedValue(undefined),
  } as unknown as UsionRoom;
  const inference = { beginWindow: vi.fn(() => 1) } as unknown as VisionInference;
  const samples = new SampleBuffer();
  const match = new MatchController(room, inference, samples);
  const round: RoundArmEvent = {
    ns: 'woah.control.v1', kind: 'round', eventId: 'round-recognition', matchId: 'match', hostEpoch: 'epoch',
    roundId: 1, generation: 1, pointerId: 'guest', lookerId: 'host', targetHostMs: 1000, deadlineHostMs: 6320,
  };
  const session: SessionEvent = {
    ns: 'woah.control.v1', kind: 'session', eventId: 'session', matchId: 'match', hostEpoch: 'epoch', hostId: 'host', guestId: 'guest', firstPointerId: 'guest',
  };
  const internals = match as unknown as {
    currentRound: RoundArmEvent | null;
    currentVisionGeneration: number | null;
    currentChoice: DirectionChoice | null;
    localObservationSent: boolean;
    session: SessionEvent | null;
    clock: { hostToLocal: (time: number) => number; localToHost: (time: number) => number; uncertaintyMs: number } | null;
    trySendLookerObservation: (event: RoundArmEvent, targetLocalMs: number, timedOut: boolean) => void;
    openObservationWindow: (event: RoundArmEvent, role: 'pointer' | 'looker', targetLocalMs: number) => void;
    acceptObservation: (event: ObservationEvent, senderId: string) => void;
    finalizeRound: ReturnType<typeof vi.fn>;
    pauseForRtcRecovery: () => void;
  };
  internals.currentRound = round;
  internals.currentVisionGeneration = 1;
  internals.session = session;
  internals.clock = { hostToLocal: (time) => time, localToHost: (time) => time, uncertaintyMs: 10 };
  return { match, samples, sendControl, round, internals };
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

  it('sends the looker observation immediately when stable post-WOAH evidence arrives', () => {
    const { match, samples, sendControl } = createRecognitionMatch();
    for (const item of [directionSample(500, 'neutral', 1), directionSample(670, 'neutral', 2), directionSample(1080, 'up', 3)]) {
      samples.push(item);
      match.handleVisionSample(item);
    }
    expect(sendControl).not.toHaveBeenCalled();

    const recognized = directionSample(1200, 'up', 4);
    samples.push(recognized);
    match.handleVisionSample(recognized);
    expect(sendControl).toHaveBeenCalledTimes(1);
    expect(sendControl.mock.calls[0][0]).toMatchObject({ kind: 'observation', status: 'ok', summary: { role: 'looker', direction: 'up' } });

    const duplicate = directionSample(1300, 'up', 5);
    samples.push(duplicate);
    match.handleVisionSample(duplicate);
    expect(sendControl).toHaveBeenCalledTimes(1);
  });

  it('uses the device-local vision generation while stamping the shared round generation', () => {
    const { match, samples, sendControl, internals } = createRecognitionMatch();
    internals.currentVisionGeneration = 7;
    for (const item of [
      directionSample(500, 'neutral', 1, 7),
      directionSample(670, 'neutral', 2, 7),
      directionSample(1080, 'left', 3, 7),
      directionSample(1180, 'left', 4, 7),
    ]) {
      samples.push(item);
      match.handleVisionSample(item);
    }
    expect(sendControl).toHaveBeenCalledTimes(1);
    expect(sendControl.mock.calls[0][0]).toMatchObject({
      generation: 1,
      status: 'ok',
      summary: { generation: 1, direction: 'left' },
    });
  });

  it('sends the locked pointer choice at WOAH without fabricating a face verdict', () => {
    const { sendControl, round, internals } = createRecognitionMatch();
    round.pointerId = 'host';
    round.lookerId = 'guest';
    internals.currentChoice = { direction: 'down', selectedLocalMs: 900, confidence: 1, sequence: 7 };
    internals.openObservationWindow(round, 'pointer', 1000);
    expect(sendControl).toHaveBeenCalledTimes(1);
    expect(sendControl.mock.calls[0][0]).toMatchObject({ kind: 'observation', status: 'ok', summary: { role: 'pointer', direction: 'down' } });
  });

  it('accepts delayed evidence at 5 seconds and times out only after the recognition window', () => {
    const delayed = createRecognitionMatch();
    for (const item of [directionSample(500, 'neutral', 1), directionSample(670, 'neutral', 2), directionSample(5900, 'right', 3), directionSample(6000, 'right', 4)]) {
      delayed.samples.push(item);
      delayed.match.handleVisionSample(item);
    }
    expect(delayed.sendControl.mock.calls[0][0]).toMatchObject({ status: 'ok', summary: { direction: 'right', onsetHostMs: 5900 } });

    const missing = createRecognitionMatch();
    missing.samples.push(directionSample(500, 'neutral', 1));
    missing.samples.push(directionSample(670, 'neutral', 2));
    missing.internals.trySendLookerObservation(missing.round, 1000, false);
    expect(missing.sendControl).not.toHaveBeenCalled();
    missing.internals.trySendLookerObservation(missing.round, 1000, true);
    expect(missing.sendControl.mock.calls[0][0]).toMatchObject({ kind: 'observation', status: 'missing', summary: null });
  });

  it('does not finalize after one player; it waits for both observations', () => {
    const { match, samples, internals, round } = createRecognitionMatch();
    const finalize = vi.fn();
    internals.finalizeRound = finalize;
    for (const item of [directionSample(500, 'neutral', 1), directionSample(670, 'neutral', 2), directionSample(1100, 'left', 3), directionSample(1200, 'left', 4)]) {
      samples.push(item);
      match.handleVisionSample(item);
    }
    expect(finalize).not.toHaveBeenCalled();

    internals.acceptObservation({
      ns: 'woah.control.v1', kind: 'observation', eventId: 'pointer-observation', matchId: 'match', hostEpoch: 'epoch', roundId: 1, generation: 1,
      status: 'ok', summary: { roundId: 1, role: 'pointer', direction: 'down', onsetHostMs: 900, peakHostMs: 900, confidence: 1, clockSigmaMs: 10, frameSeq: 1, generation: 1 },
    }, 'guest');
    expect(finalize).toHaveBeenCalledOnce();
    expect(finalize).toHaveBeenCalledWith(round);
  });

  it('cancels pending recognition when transport recovery pauses the round', () => {
    const { match, samples, sendControl, internals } = createRecognitionMatch();
    internals.pauseForRtcRecovery();
    const item = directionSample(1200, 'down', 4);
    samples.push(item);
    match.handleVisionSample(item);
    expect(sendControl).not.toHaveBeenCalled();
  });
});

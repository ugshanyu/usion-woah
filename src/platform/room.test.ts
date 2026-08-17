import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsionRoom } from './room';

describe('UsionRoom', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('adopts a room assigned by Share and lets the SDK perform the automatic join', async () => {
    vi.useFakeTimers();
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const connect = vi.fn(async () => undefined);
    const join = vi.fn(async () => ({ player_ids: ['host', 'guest'] }));
    const handler = (name: string) => (callback: (...args: never[]) => void) => { callbacks[name] = callback; };
    const usion = {
      config: {},
      init: vi.fn(async () => {
        expect(callbacks.roomAssigned).toBeTypeOf('function');
        return { userId: 'host', userName: 'Host', serviceId: 'service' };
      }),
      getTheme: () => 'dark', getLanguage: () => 'mn',
      getLaunchParams: () => ({ roomId: null, mode: 'single' }), log: vi.fn(), exit: vi.fn(),
      user: { getId: () => 'host', getName: () => 'Host', getAvatar: () => null, getToken: () => 'token' },
      game: {
        connect, join, leave: vi.fn(), realtime: vi.fn(), action: vi.fn(), forfeit: vi.fn(),
        onRoomAssigned: handler('roomAssigned'), onJoined: handler('joined'), onPlayerJoined: handler('playerJoined'),
        onPlayerLeft: handler('playerLeft'), onPlayerConnection: handler('playerConnection'), onRealtime: handler('realtime'),
        onAction: handler('action'), onConnectionState: handler('connection'), onReconnected: handler('reconnected'), onError: handler('error'),
      },
    };
    vi.stubGlobal('Usion', usion);
    const room = new UsionRoom();
    await room.initialize();
    callbacks.roomAssigned({ roomId: 'room-1' } as never);
    expect(room.state?.roomId).toBe('room-1');
    expect(room.state?.connection).toBe('connecting');
    expect(connect).not.toHaveBeenCalled();
    expect(join).not.toHaveBeenCalled();

    callbacks.joined({ player_ids: ['host', 'guest'] } as never);
    expect(room.state?.roster).toEqual(['host', 'guest']);
    expect(room.state?.connection).toBe('connected');
  });

  it('retries a Share auto-join only when the SDK has not joined after the grace period', async () => {
    vi.useFakeTimers();
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const connect = vi.fn(async () => undefined);
    const join = vi.fn(async () => ({ player_ids: ['host'] }));
    const handler = (name: string) => (callback: (...args: never[]) => void) => { callbacks[name] = callback; };
    vi.stubGlobal('Usion', {
      config: {}, init: async () => ({ userId: 'host', serviceId: 'service' }), getTheme: () => 'dark', getLanguage: () => 'en',
      getLaunchParams: () => ({ roomId: null, mode: 'single' }), log: vi.fn(), exit: vi.fn(),
      user: { getId: () => 'host', getName: () => 'Host', getAvatar: () => null, getToken: () => null },
      game: { connect, join, leave: vi.fn(), realtime: vi.fn(), action: vi.fn(), forfeit: vi.fn(),
        onRoomAssigned: handler('roomAssigned'), onJoined: handler('joined'), onPlayerJoined: handler('playerJoined'), onPlayerLeft: handler('playerLeft'),
        onPlayerConnection: handler('playerConnection'), onRealtime: handler('realtime'), onAction: handler('action'), onConnectionState: handler('connection'), onReconnected: handler('reconnected'), onError: handler('error') },
    });
    const room = new UsionRoom();
    await room.initialize();
    callbacks.roomAssigned({ roomId: 'room-2' } as never);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(connect).toHaveBeenCalledOnce();
    expect(join).toHaveBeenCalledWith('room-2');
  });

  it('reports a departing peer before replacing the roster', async () => {
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const handler = (name: string) => (callback: (...args: never[]) => void) => { callbacks[name] = callback; };
    vi.stubGlobal('Usion', {
      config: {}, init: async () => ({ userId: 'host', playerIds: ['host', 'guest'] }), getTheme: () => 'dark', getLanguage: () => 'en',
      getLaunchParams: () => ({ roomId: null, mode: 'single' }), log: vi.fn(), exit: vi.fn(),
      user: { getId: () => 'host', getName: () => 'Host', getAvatar: () => null, getToken: () => null },
      game: { connect: vi.fn(), join: vi.fn(), leave: vi.fn(), realtime: vi.fn(), action: vi.fn(), forfeit: vi.fn(),
        onRoomAssigned: handler('roomAssigned'), onJoined: handler('joined'), onPlayerJoined: handler('playerJoined'), onPlayerLeft: handler('playerLeft'),
        onPlayerConnection: handler('playerConnection'), onRealtime: handler('realtime'), onAction: handler('action'), onConnectionState: handler('connection'), onReconnected: handler('reconnected'), onError: handler('error') },
    });
    const room = new UsionRoom();
    await room.initialize();
    let rosterAtCallback: string[] = [];
    room.onPeerGone = () => { rosterAtCallback = [...(room.state?.roster ?? [])]; };
    callbacks.playerLeft({ player_id: 'guest', player_ids: ['host'] } as never);
    expect(rosterAtCallback).toEqual(['host', 'guest']);
    expect(room.state?.roster).toEqual(['host']);
  });

  it('sends WebRTC signals on the reliable action channel and accepts them from it', async () => {
    const callbacks: Record<string, (...args: never[]) => void> = {};
    const handler = (name: string) => (callback: (...args: never[]) => void) => { callbacks[name] = callback; };
    const realtime = vi.fn();
    const action = vi.fn(async () => ({ success: true }));
    vi.stubGlobal('Usion', {
      config: {}, init: async () => ({ userId: 'host', serviceId: 'service' }), getTheme: () => 'dark', getLanguage: () => 'en',
      getLaunchParams: () => ({ roomId: null, mode: 'single' }), log: vi.fn(), exit: vi.fn(),
      user: { getId: () => 'host', getName: () => 'Host', getAvatar: () => null, getToken: () => null },
      game: { connect: vi.fn(), join: vi.fn(), leave: vi.fn(), realtime, action, forfeit: vi.fn(),
        onRoomAssigned: handler('roomAssigned'), onJoined: handler('joined'), onPlayerJoined: handler('playerJoined'), onPlayerLeft: handler('playerLeft'),
        onPlayerConnection: handler('playerConnection'), onRealtime: handler('realtime'), onAction: handler('action'), onConnectionState: handler('connection'), onReconnected: handler('reconnected'), onError: handler('error') },
    });
    const room = new UsionRoom();
    await room.initialize();
    const signal = {
      ns: 'woah.rtc.v1', to: 'guest', matchId: 'm1', hostEpoch: 'e1', pcGeneration: 0, signalSeq: 1,
      kind: 'answer', description: { type: 'answer', sdp: 'v=0' },
    } as never;

    room.sendSignal(signal);
    expect(action).toHaveBeenCalledWith('woah_rtc', signal);
    expect(realtime).toHaveBeenCalledWith('signal', signal);

    const received: unknown[] = [];
    room.onSignal = (incoming, senderId) => received.push([incoming, senderId]);
    callbacks.action({ action_type: 'woah_rtc', action_data: signal, player_id: 'guest' } as never);
    expect(received).toEqual([[signal, 'guest']]);
  });
});

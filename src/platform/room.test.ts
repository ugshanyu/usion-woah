import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsionRoom } from './room';

describe('UsionRoom', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('registers handlers before init and joins a room assigned by Share', async () => {
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
    await vi.waitFor(() => expect(join).toHaveBeenCalledWith('room-1'));
    expect(connect).toHaveBeenCalledOnce();
    expect(room.state?.roster).toEqual(['host', 'guest']);
    expect(room.state?.connection).toBe('connected');
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
});

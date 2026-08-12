export function installDevUsionMock(): void {
  const handlers = new Map<string, (data: never) => void>();
  const register = (name: string) => (callback: (data: never) => void) => { handlers.set(name, callback); };
  const config: UsionInitConfig = {
    userId: 'dev-player', userName: 'Dev Player', serviceId: 'woah-challenge',
    serviceName: 'WOAH', theme: 'dark', language: 'mn', playerIds: ['dev-player'], mode: 'single',
  };
  window.Usion = {
    config,
    init: async () => config,
    getTheme: () => 'dark', getLanguage: () => 'mn',
    getLaunchParams: () => ({ roomId: null, mode: 'single' }),
    log: (message: string) => console.info(`[Usion mock] ${message}`), exit: () => undefined,
    user: { getId: () => config.userId, getName: () => config.userName ?? null, getAvatar: () => null, getToken: () => null },
    game: {
      connect: async () => undefined, join: async () => ({ player_ids: ['dev-player'] }), leave: () => undefined,
      realtime: () => undefined, action: async () => undefined, forfeit: async () => undefined,
      onRoomAssigned: register('roomAssigned'), onJoined: register('joined'), onPlayerJoined: register('playerJoined'),
      onPlayerLeft: register('playerLeft'), onPlayerConnection: register('playerConnection'), onRealtime: register('realtime'),
      onAction: register('action'), onConnectionState: register('connection'), onReconnected: register('reconnected'), onError: register('error'),
    },
  };
}

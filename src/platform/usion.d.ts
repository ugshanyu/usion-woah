declare global {
type UsionGameMessage = {
  player_id: string;
  action_type: string;
  action_data: unknown;
  sequence?: number;
};

type UsionInitConfig = {
  userId: string;
  userName?: string;
  userAvatar?: string;
  authToken?: string;
  theme?: 'light' | 'dark';
  language?: string;
  roomId?: string;
  playerIds?: string[];
  serviceId?: string;
  serviceName?: string;
  apiUrl?: string;
  mode?: 'single' | 'multiplayer';
};

type UsionGlobal = {
  config: UsionInitConfig;
  init(options?: { timeout?: number }): Promise<UsionInitConfig>;
  getTheme(): 'light' | 'dark';
  getLanguage(): string;
  getLaunchParams(): { roomId: string | null; mode: 'single' | 'multiplayer' };
  log(message: string): void;
  exit(): void;
  user: {
    getId(): string | null;
    getName(): string | null;
    getAvatar(): string | null;
    getToken(): string | null;
  };
  game: {
    connect(): Promise<void>;
    join(roomId: string): Promise<unknown>;
    leave(): void;
    realtime(type: string, data?: unknown): void;
    action(type: string, data?: unknown): Promise<unknown>;
    forfeit(): Promise<unknown>;
    reportResult?(result: { winnerId?: string; draw?: boolean; scores?: Record<string, number>; matchId?: string }): Promise<unknown>;
    onJoined(callback: (data: { player_id?: string; player_ids?: string[] }) => void): (() => void) | void;
    onPlayerJoined(callback: (data: { player_id: string; player_ids?: string[] }) => void): (() => void) | void;
    onPlayerLeft(callback: (data: { player_id: string; player_ids?: string[] }) => void): (() => void) | void;
    onPlayerConnection(callback: (data: { player_id: string; state: string }) => void): (() => void) | void;
    onRoomAssigned(callback: (data: { roomId: string }) => void): (() => void) | void;
    onRealtime(callback: (message: UsionGameMessage) => void): (() => void) | void;
    onAction(callback: (message: UsionGameMessage) => void): (() => void) | void;
    onConnectionState(callback: (state: string) => void): (() => void) | void;
    onReconnected(callback: () => void): (() => void) | void;
    onError(callback: (error: { code?: string; message?: string }) => void): (() => void) | void;
  };
};

  interface Window { Usion: UsionGlobal }
  const Usion: UsionGlobal;
}

export {};

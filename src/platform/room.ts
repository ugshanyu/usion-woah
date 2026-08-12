import { isControlEvent, isRtcSignal, type ControlEvent, type RtcSignal } from '../network/protocol';

export type RoomState = {
  config: UsionInitConfig;
  myId: string;
  myName: string;
  roomId: string | null;
  roster: string[];
  hostId: string | null;
  connection: string;
};

export class UsionRoom {
  private assignedRoomId: string | null = null;
  state: RoomState | null = null;
  onState: ((state: RoomState) => void) | null = null;
  onSignal: ((signal: RtcSignal, senderId: string) => void) | null = null;
  onControl: ((event: ControlEvent, senderId: string) => void) | null = null;
  onPeerGone: ((peerId: string) => void) | null = null;
  onReconnected: (() => void) | null = null;

  async initialize(): Promise<RoomState> {
    this.registerHandlers();
    const config = await Usion.init({ timeout: 8000 });
    const myId = Usion.user.getId() || config.userId;
    if (!myId) throw new Error('missing_user');
    const launch = Usion.getLaunchParams();
    this.state = {
      config,
      myId,
      myName: Usion.user.getName() || config.userName || 'Player',
      roomId: launch.roomId,
      roster: config.playerIds ?? [myId],
      hostId: config.playerIds?.[0] ?? myId,
      connection: 'disconnected',
    };
    this.emit();
    const roomId = launch.roomId || this.assignedRoomId;
    if ((launch.mode === 'multiplayer' || this.assignedRoomId) && roomId) await this.join(roomId);
    return this.state;
  }

  async join(roomId: string): Promise<void> {
    if (!this.state) throw new Error('room_not_initialized');
    this.state.roomId = roomId;
    await Usion.game.connect();
    const joined = await Usion.game.join(roomId) as { player_ids?: string[] } | undefined;
    if (joined?.player_ids) this.updateRoster(joined.player_ids);
    this.state.connection = 'connected';
    this.emit();
  }

  sendSignal(signal: RtcSignal): void {
    Usion.game.realtime('signal', signal);
  }

  async sendControl(event: ControlEvent): Promise<void> {
    await Usion.game.action(`woah_${event.kind}`, event);
  }

  async reportResult(winnerId: string, scores: Record<string, number>, matchId: string): Promise<void> {
    if (Usion.game.reportResult) await Usion.game.reportResult({ winnerId, scores, matchId });
  }

  private registerHandlers(): void {
    Usion.game.onRoomAssigned(({ roomId }) => {
      this.assignedRoomId = roomId;
      if (!this.state) return;
      this.state.roomId = roomId;
      this.emit();
      void this.join(roomId).catch((error) => Usion.log(`Woah join failed: ${error instanceof Error ? error.message : String(error)}`));
    });
    Usion.game.onJoined((data) => {
      if (!this.state) return;
      if (data.player_ids) this.updateRoster(data.player_ids);
      this.state.connection = 'connected';
      this.emit();
    });
    Usion.game.onPlayerJoined((data) => {
      if (data.player_ids) this.updateRoster(data.player_ids);
    });
    Usion.game.onPlayerLeft((data) => {
      this.onPeerGone?.(data.player_id);
      if (data.player_ids) this.updateRoster(data.player_ids);
    });
    Usion.game.onPlayerConnection((data) => {
      if (data.state === 'gone') this.onPeerGone?.(data.player_id);
    });
    Usion.game.onRealtime((message) => {
      if (message.action_type !== 'signal' || !isRtcSignal(message.action_data)) return;
      this.onSignal?.(message.action_data, message.player_id);
    });
    Usion.game.onAction((message) => {
      if (isControlEvent(message.action_data)) this.onControl?.(message.action_data, message.player_id);
    });
    Usion.game.onConnectionState((connection) => {
      if (!this.state) return;
      this.state.connection = connection;
      this.emit();
    });
    Usion.game.onReconnected(() => this.onReconnected?.());
    Usion.game.onError((error) => Usion.log(`Woah room error ${error.code ?? ''}: ${error.message ?? 'unknown'}`));
  }

  private updateRoster(roster: string[]): void {
    if (!this.state || !Array.isArray(roster)) return;
    const clean = [...new Set(roster.filter((id) => typeof id === 'string' && id))].slice(0, 2);
    if (!clean.includes(this.state.myId)) clean.unshift(this.state.myId);
    this.state.roster = clean;
    this.state.hostId = clean[0] ?? this.state.myId;
    this.emit();
  }

  private emit(): void {
    if (this.state) this.onState?.({ ...this.state, roster: [...this.state.roster] });
  }
}

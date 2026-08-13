import { CuePlayer } from '../audio/cue';
import { fetchIceServers } from '../network/ice';
import { ClockSync, isClockMessage, type ClockMessage, type ClockReady } from '../network/clock-sync';
import { P2PCamera } from '../network/p2p';
import { EventDeduper, isControlEvent, type ControlEvent, type ObservationEvent, type ReadyEvent, type RoundArmEvent, type RtcSignal, type SessionEvent, type VerdictEvent } from '../network/protocol';
import type { UsionRoom } from '../platform/room';
import type { VisionInference } from '../vision/inference';
import { SampleBuffer } from '../vision/sample-buffer';
import type { MatchView } from './match-view';
import { chooseFirstPointer, judgeRound, nextPointerForResult, scoreRound, summarizeDirectionChoice, summarizeHeadGesture } from './rules';
import { TimerBag } from './timer-bag';
import type { DirectionChoice, GestureSummary, ObservationStatus, Role } from './types';

export type { MatchPhase, MatchView } from './match-view';

export class MatchController {
  private readonly deduper = new EventDeduper();
  private readonly ready = new Map<string, ReadyEvent>();
  private readonly cue = new CuePlayer();
  private localStream: MediaStream | null = null;
  private p2p: P2PCamera | null = null;
  private clock: ClockSync | null = null;
  private session: SessionEvent | null = null;
  private pendingSignals: RtcSignal[] = [];
  private observations = new Map<string, { summary: GestureSummary | null; status: ObservationStatus }>();
  private readonly timers = new TimerBag();
  private clockTimer: number | null = null;
  private remoteClockReady = false;
  private currentRound: RoundArmEvent | null = null;
  private currentVisionGeneration: number | null = null;
  private currentChoice: DirectionChoice | null = null;
  private nextPointerId: string | null = null;
  private nextRoundNotBefore = 0;
  private view: MatchView = { phase: 'waiting', peerName: null, localReady: false, peerReady: false, role: null, targetLocalMs: null, roundId: 0, score: {}, result: null, rtcState: 'new', clockUncertaintyMs: Number.POSITIVE_INFINITY };

  onView: ((view: MatchView) => void) | null = null;
  onRemoteStream: ((stream: MediaStream) => void) | null = null;

  constructor(private readonly room: UsionRoom, private readonly inference: VisionInference, private readonly samples: SampleBuffer) {}

  async unlockAudio(): Promise<void> {
    await this.cue.unlock();
  }

  startSoundtrack(): void {
    this.cue.startSoundtrack();
  }

  stopSoundtrack(): void {
    this.cue.stopSoundtrack();
  }

  submitDirection(choice: DirectionChoice): boolean {
    const round = this.currentRound;
    const room = this.requireRoom();
    if (!round || !this.clock || room.myId !== round.pointerId || this.currentChoice) return false;
    const targetLocalMs = this.clock.hostToLocal(round.targetHostMs);
    if (this.clock.uncertaintyMs > 50 || choice.selectedLocalMs < targetLocalMs - 80 || choice.selectedLocalMs > targetLocalMs + 220) return false;
    this.currentChoice = choice;
    return true;
  }

  async markLocalReady(stream: MediaStream): Promise<void> {
    const room = this.requireRoom();
    this.localStream = stream;
    const event: ReadyEvent = { ns: 'woah.control.v1', kind: 'ready', eventId: crypto.randomUUID(), playerId: room.myId, playerName: room.myName, calibrated: true, cameraReady: true };
    await this.sendEssential(event);
    this.updateReadyView();
    await this.tryCreateSession();
  }

  handleSignal(signal: RtcSignal, senderId: string): void {
    const room = this.requireRoom();
    if (senderId !== this.peerId() || signal.to !== room.myId || signal.description?.sdp && signal.description.sdp.length > 100_000) return;
    if (!this.p2p) this.pendingSignals.push(signal);
    else void this.p2p.handleSignal(signal);
  }

  handleControl(event: ControlEvent, senderId: string): void {
    if (!this.deduper.accept(event)) return;
    const room = this.requireRoom();
    if (!room.roster.includes(senderId)) return;
    if (event.kind === 'ready') {
      if (event.playerId !== senderId) return;
      this.ready.set(senderId, event);
      this.updateReadyView();
      void this.tryCreateSession();
      return;
    }
    if (event.kind === 'session') {
      if (senderId !== room.hostId || event.hostId !== senderId || !room.roster.includes(event.guestId)) return;
      this.session = event;
      this.view.score = Object.fromEntries(room.roster.map((id) => [id, 0]));
      this.nextPointerId = event.firstPointerId;
      this.emit({ phase: 'connecting' });
      void this.setupP2P().catch(() => this.emit({ phase: 'network-error', rtcState: 'unavailable' }));
      return;
    }
    if (!this.session || ('matchId' in event && event.matchId !== this.session.matchId) || ('hostEpoch' in event && event.hostEpoch !== this.session.hostEpoch)) return;
    if (event.kind !== 'observation' && senderId !== room.hostId) return;
    if (event.kind === 'round') this.armRound(event);
    else if (event.kind === 'observation') this.acceptObservation(event, senderId);
    else if (event.kind === 'verdict') this.acceptVerdict(event, senderId);
  }

  handleConnection(connection: string): void {
    if (['disconnected', 'rejoining'].includes(connection)) {
      this.timers.clear();
      this.emit({ phase: 'reconnecting', targetLocalMs: null });
    }
  }

  async handleReconnected(): Promise<void> {
    this.resetTransport();
    this.ready.clear();
    this.emit({ phase: 'waiting' });
    if (this.localStream) await this.markLocalReady(this.localStream);
  }

  handlePeerGone(peerId: string): void {
    if (peerId !== this.peerId()) return;
    this.timers.clear();
    this.emit({ phase: 'gameover', result: null, rtcState: 'closed' });
  }

  suspend(): void {
    this.resetTransport();
    this.ready.clear();
    this.localStream = null;
    this.cue.stopSoundtrack();
    this.emit({ phase: 'waiting', localReady: false, peerReady: false, role: null, targetLocalMs: null });
  }

  destroy(): void {
    this.suspend();
    this.cue.close();
  }

  private async tryCreateSession(): Promise<void> {
    const room = this.requireRoom();
    if (room.hostId !== room.myId || room.roster.length !== 2 || room.roster.some((id) => !this.ready.get(id)?.calibrated) || this.session) return;
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    const session: SessionEvent = { ns: 'woah.control.v1', kind: 'session', eventId: crypto.randomUUID(), matchId: crypto.randomUUID(), hostEpoch: crypto.randomUUID(), hostId: room.myId, guestId: room.roster.find((id) => id !== room.myId)!, firstPointerId: chooseFirstPointer(room.roster, randomValue) };
    await this.sendEssential(session);
  }

  private async setupP2P(): Promise<void> {
    const room = this.requireRoom();
    const session = this.session;
    const peerId = this.peerId();
    if (!session || !peerId || !room.roomId || !room.config.serviceId || !this.localStream || this.p2p) return;
    const iceServers = await fetchIceServers(room.roomId, room.config.serviceId);
    this.clock = new ClockSync(room.myId === session.hostId);
    const p2p = new P2PCamera({ myId: room.myId, peerId, isHost: room.myId === session.hostId, matchId: session.matchId, hostEpoch: session.hostEpoch, iceServers, localStream: this.localStream, sendSignal: (signal) => this.room.sendSignal(signal) });
    this.p2p = p2p;
    p2p.onRemoteStream = (stream) => this.onRemoteStream?.(stream);
    p2p.onControl = (message) => this.handleP2PMessage(message);
    p2p.onState = (state) => {
      this.emit({ rtcState: state });
      if (state === 'channel-open') this.startClockSync();
      if (state === 'failed') this.emit({ phase: 'reconnecting' });
      if (state === 'unavailable') this.emit({ phase: 'network-error', targetLocalMs: null });
    };
    await p2p.start();
    for (const signal of this.pendingSignals.splice(0)) await p2p.handleSignal(signal);
  }

  private startClockSync(): void {
    const room = this.requireRoom();
    if (!this.clock || !this.session) return;
    this.emit({ phase: 'syncing' });
    if (room.myId !== this.session.hostId) {
      let sent = 0;
      this.clockTimer = window.setInterval(() => {
        if (!this.clock || !this.p2p) return;
        this.p2p.sendControl(this.clock.createProbe());
        sent += 1;
        if (sent >= 12 && this.clock.ready) {
          this.p2p.sendControl({ ns: 'woah.clock.v1', kind: 'ready', uncertaintyMs: this.clock.uncertaintyMs } satisfies ClockReady);
          if (this.clockTimer !== null) window.clearInterval(this.clockTimer);
          this.clockTimer = window.setInterval(() => {
            if (this.clock && this.p2p) this.p2p.sendControl(this.clock.createProbe());
          }, 1500);
        }
      }, 100);
    }
  }

  private handleP2PMessage(message: unknown): void {
    if (isClockMessage(message)) {
      this.handleClock(message);
      return;
    }
    if (isControlEvent(message)) this.handleControl(message, this.peerId() ?? '');
  }

  private handleClock(message: ClockMessage): void {
    const room = this.requireRoom();
    if (!this.clock || !this.session || !this.p2p) return;
    if (message.kind === 'probe' && room.myId === this.session.hostId) this.p2p.sendControl(this.clock.answer(message));
    else if (message.kind === 'reply' && room.myId !== this.session.hostId) {
      this.clock.accept(message);
      this.emit({ clockUncertaintyMs: this.clock.uncertaintyMs });
      this.p2p.sendControl({ ns: 'woah.clock.v1', kind: 'ready', uncertaintyMs: this.clock.uncertaintyMs } satisfies ClockReady);
    } else if (message.kind === 'ready' && room.myId === this.session.hostId) {
      this.remoteClockReady = message.uncertaintyMs <= 50;
      if (this.remoteClockReady) void this.scheduleNextRound();
    }
  }

  private async scheduleNextRound(): Promise<void> {
    const room = this.requireRoom();
    const session = this.session;
    if (!session || room.myId !== session.hostId || !this.remoteClockReady || this.currentRound || performance.now() < this.nextRoundNotBefore) return;
    const pointerId = this.nextPointerId ?? session.hostId;
    const lookerId = room.roster.find((id) => id !== pointerId)!;
    const targetHostMs = performance.now() + 3200;
    const event: RoundArmEvent = { ns: 'woah.control.v1', kind: 'round', eventId: crypto.randomUUID(), matchId: session.matchId, hostEpoch: session.hostEpoch, roundId: this.view.roundId + 1, generation: this.view.roundId + 1, pointerId, lookerId, targetHostMs, deadlineHostMs: targetHostMs + 500 };
    await this.sendEssential(event);
  }

  private armRound(event: RoundArmEvent): void {
    const room = this.requireRoom();
    if (!this.clock || !this.session || event.hostEpoch !== this.session.hostEpoch || ![event.pointerId, event.lookerId].includes(room.myId) || event.roundId <= this.view.roundId) return;
    this.currentRound = event;
    this.currentChoice = null;
    this.observations.clear();
    const role: Role = room.myId === event.pointerId ? 'pointer' : 'looker';
    this.currentVisionGeneration = role === 'looker' ? this.inference.beginWindow() : null;
    this.samples.clear();
    const targetLocalMs = this.clock.hostToLocal(event.targetHostMs);
    this.cue.scheduleCountdown(targetLocalMs);
    this.emit({ phase: 'countdown', role, targetLocalMs, roundId: event.roundId, result: null });
    this.timers.add(() => this.captureObservation(event, role, targetLocalMs), Math.max(0, targetLocalMs + 500 - performance.now()));
    if (room.myId === this.session.hostId) this.timers.add(() => this.finalizeRound(event), Math.max(0, event.deadlineHostMs + 300 - performance.now()));
  }

  private captureObservation(event: RoundArmEvent, role: Role, targetLocalMs: number): void {
    if (!this.clock || !this.session || this.currentRound?.eventId !== event.eventId) return;
    this.emit({ phase: 'judging' });
    const window = { roundId: event.roundId, role, generation: event.generation, targetLocalMs, toHostTime: (time: number) => this.clock!.localToHost(time), clockSigmaMs: this.clock.uncertaintyMs };
    const summary = role === 'pointer'
      ? summarizeDirectionChoice(this.currentChoice, window)
      : summarizeHeadGesture(this.samples.between(targetLocalMs - 350, targetLocalMs + 250).filter((sample) => sample.generation === this.currentVisionGeneration), window);
    const status: ObservationStatus = this.clock.uncertaintyMs > 50 ? 'clock-uncertain' : summary ? 'ok' : 'missing';
    const observation: ObservationEvent = { ns: 'woah.control.v1', kind: 'observation', eventId: crypto.randomUUID(), matchId: this.session.matchId, hostEpoch: this.session.hostEpoch, summary, status, roundId: event.roundId, generation: event.generation };
    void this.sendEssential(observation);
  }

  private acceptObservation(event: ObservationEvent, senderId: string): void {
    const round = this.currentRound;
    if (!round || event.roundId !== round.roundId || event.generation !== round.generation || ![round.pointerId, round.lookerId].includes(senderId)) return;
    const expectedRole: Role = senderId === round.pointerId ? 'pointer' : 'looker';
    if (event.summary && (event.summary.role !== expectedRole || event.summary.roundId !== round.roundId)) return;
    this.observations.set(senderId, { summary: event.summary, status: event.status });
    if (this.requireRoom().myId === this.session?.hostId && this.observations.size === 2) this.finalizeRound(round);
  }

  private finalizeRound(round: RoundArmEvent): void {
    if (this.currentRound?.eventId !== round.eventId || !this.session) return;
    const pointer = this.observations.get(round.pointerId) ?? { summary: null, status: 'missing' as const };
    const looker = this.observations.get(round.lookerId) ?? { summary: null, status: 'missing' as const };
    const result = judgeRound(round.roundId, pointer.summary, looker.summary, pointer.status, looker.status);
    const score = scoreRound(this.view.score, result, round.pointerId, round.lookerId);
    const nextPointerId = nextPointerForResult(result, round.pointerId, round.lookerId);
    const verdict: VerdictEvent = { ns: 'woah.control.v1', kind: 'verdict', eventId: crypto.randomUUID(), matchId: this.session.matchId, hostEpoch: this.session.hostEpoch, result, score, nextPointerId };
    void this.sendEssential(verdict);
  }

  private acceptVerdict(event: VerdictEvent, senderId: string): void {
    if (!this.session || senderId !== this.session.hostId || event.hostEpoch !== this.session.hostEpoch || event.result.roundId !== this.currentRound?.roundId) return;
    this.currentRound = null;
    this.currentVisionGeneration = null;
    this.currentChoice = null;
    this.nextPointerId = event.nextPointerId;
    const winner = Object.values(event.score).some((points) => points >= 3);
    const role: Role = this.requireRoom().myId === event.nextPointerId ? 'pointer' : 'looker';
    this.cue.playResult(event.result.verdict, winner);
    this.emit({ phase: winner ? 'gameover' : 'result', score: event.score, result: event.result, role, targetLocalMs: null });
    if (winner && this.requireRoom().myId === this.session.hostId) {
      const winnerId = Object.entries(event.score).find(([, points]) => points >= 3)?.[0];
      if (winnerId) void this.room.reportResult(winnerId, event.score, this.session.matchId).catch(() => undefined);
    }
    if (!winner && this.requireRoom().myId === this.session.hostId) {
      const delay = event.result.verdict === 'void' ? 1000 : 1600;
      this.nextRoundNotBefore = performance.now() + delay;
      this.timers.add(() => void this.scheduleNextRound(), delay);
    }
  }

  private async sendEssential(event: ControlEvent): Promise<void> {
    this.handleControl(event, this.requireRoom().myId);
    this.p2p?.sendControl(event);
    await this.room.sendControl(event).catch(() => undefined);
  }

  private updateReadyView(): void {
    const room = this.requireRoom();
    const peer = this.peerId();
    this.emit({ localReady: Boolean(this.ready.get(room.myId)), peerReady: Boolean(peer && this.ready.get(peer)), peerName: peer ? this.ready.get(peer)?.playerName ?? null : null });
  }

  private peerId(): string | null {
    const room = this.requireRoom();
    return room.roster.find((id) => id !== room.myId) ?? null;
  }

  private requireRoom() {
    if (!this.room.state) throw new Error('room_not_ready');
    return this.room.state;
  }

  private resetTransport(): void {
    this.timers.clear();
    if (this.clockTimer !== null) window.clearInterval(this.clockTimer);
    this.clockTimer = null;
    this.p2p?.close();
    this.p2p = null;
    this.clock?.reset();
    this.clock = null;
    this.session = null;
    this.currentRound = null;
    this.currentVisionGeneration = null;
    this.currentChoice = null;
    this.remoteClockReady = false;
    this.nextRoundNotBefore = 0;
    this.pendingSignals = [];
  }

  private emit(update: Partial<MatchView>): void {
    this.view = { ...this.view, ...update };
    this.onView?.({ ...this.view, score: { ...this.view.score } });
  }
}

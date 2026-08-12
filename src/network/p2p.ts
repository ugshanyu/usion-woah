import type { RtcSignal } from './protocol';

type P2POptions = {
  myId: string;
  peerId: string;
  isHost: boolean;
  matchId: string;
  hostEpoch: string;
  iceServers: RTCIceServer[];
  localStream: MediaStream;
  sendSignal: (signal: RtcSignal) => void;
};

export type P2PState = RTCPeerConnectionState | 'channel-open' | 'unavailable';

const CONNECT_TIMEOUT_MS = 15_000;

export class P2PCamera {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private signalSeq = 0;
  private lastRemoteSignalSeq = 0;
  private generation = 0;
  private pendingIce: RTCIceCandidateInit[] = [];
  private disconnectTimer: number | null = null;
  private connectionTimer: number | null = null;
  private readonly options: P2POptions;

  remoteStream = new MediaStream();
  onRemoteStream: ((stream: MediaStream) => void) | null = null;
  onControl: ((message: unknown) => void) | null = null;
  onState: ((state: P2PState) => void) | null = null;

  constructor(options: P2POptions) {
    this.options = options;
  }

  get connected(): boolean {
    return this.pc?.connectionState === 'connected' && this.channel?.readyState === 'open';
  }

  async start(): Promise<void> {
    this.closePeer();
    const pc = new RTCPeerConnection({ iceServers: this.options.iceServers, bundlePolicy: 'max-bundle' });
    this.pc = pc;
    this.options.localStream.getVideoTracks().forEach((track) => pc.addTrack(track, this.options.localStream));
    pc.ontrack = (event) => {
      for (const track of event.streams[0]?.getTracks() ?? [event.track]) {
        if (!this.remoteStream.getTracks().some((candidate) => candidate.id === track.id)) this.remoteStream.addTrack(track);
      }
      this.onRemoteStream?.(this.remoteStream);
    };
    pc.onicecandidate = (event) => this.sendSignal(event.candidate ? 'ice' : 'ice-complete', event.candidate?.toJSON());
    pc.onconnectionstatechange = () => this.handleConnectionState();
    this.connectionTimer = globalThis.setTimeout(() => {
      if (this.connected) return;
      this.onState?.('unavailable');
      this.closePeer();
    }, CONNECT_TIMEOUT_MS);

    if (this.options.isHost) {
      this.bindChannel(pc.createDataChannel('woah-control', { ordered: true }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal('offer', undefined, pc.localDescription ?? offer);
    } else {
      pc.ondatachannel = (event) => this.bindChannel(event.channel);
    }
  }

  async handleSignal(signal: RtcSignal): Promise<void> {
    if (signal.matchId !== this.options.matchId || signal.hostEpoch !== this.options.hostEpoch || signal.to !== this.options.myId || signal.signalSeq <= this.lastRemoteSignalSeq) return;
    if (!this.options.isHost && signal.kind === 'offer' && signal.pcGeneration >= this.generation) this.generation = signal.pcGeneration;
    if (signal.pcGeneration !== this.generation) return;
    if (!this.pc) await this.start();
    this.lastRemoteSignalSeq = signal.signalSeq;
    const pc = this.pc!;
    if (signal.kind === 'offer' && !this.options.isHost && signal.description) {
      await pc.setRemoteDescription(signal.description);
      await this.flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal('answer', undefined, pc.localDescription ?? answer);
    } else if (signal.kind === 'answer' && this.options.isHost && signal.description) {
      await pc.setRemoteDescription(signal.description);
      await this.flushIce();
    } else if (signal.kind === 'ice' && signal.candidate) {
      if (!pc.remoteDescription) this.pendingIce.push(signal.candidate);
      else await pc.addIceCandidate(signal.candidate).catch(() => undefined);
    }
  }

  sendControl(message: unknown): boolean {
    if (this.channel?.readyState !== 'open' || this.channel.bufferedAmount > 128_000) return false;
    this.channel.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    this.closePeer();
    this.remoteStream.getTracks().forEach((track) => track.stop());
    this.remoteStream = new MediaStream();
  }

  private bindChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => {
      this.clearConnectionTimer();
      this.onState?.('channel-open');
    };
    channel.onmessage = (event) => {
      try { this.onControl?.(JSON.parse(String(event.data))); } catch { /* ignore malformed peer data */ }
    };
    channel.onerror = () => this.onState?.('failed');
  }

  private sendSignal(kind: RtcSignal['kind'], candidate?: RTCIceCandidateInit, description?: RTCSessionDescriptionInit): void {
    this.options.sendSignal({ ns: 'woah.rtc.v1', to: this.options.peerId, matchId: this.options.matchId, hostEpoch: this.options.hostEpoch, pcGeneration: this.generation, signalSeq: ++this.signalSeq, kind, candidate, description });
  }

  private async flushIce(): Promise<void> {
    const pending = this.pendingIce.splice(0);
    for (const candidate of pending) await this.pc?.addIceCandidate(candidate).catch(() => undefined);
  }

  private handleConnectionState(): void {
    const state = this.pc?.connectionState;
    if (!state) return;
    this.onState?.(state);
    if (this.disconnectTimer !== null) window.clearTimeout(this.disconnectTimer);
    if ((state === 'failed' || state === 'disconnected') && this.options.isHost) {
      this.disconnectTimer = window.setTimeout(() => void this.restart(), state === 'failed' ? 0 : 3000);
    }
  }

  private async restart(): Promise<void> {
    if (!this.pc || !this.options.isHost) return;
    this.generation += 1;
    this.pendingIce = [];
    this.pc.restartIce();
    const offer = await this.pc.createOffer({ iceRestart: true });
    await this.pc.setLocalDescription(offer);
    this.sendSignal('offer', undefined, this.pc.localDescription ?? offer);
  }

  private closePeer(): void {
    this.clearConnectionTimer();
    if (this.disconnectTimer !== null) window.clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    try { this.channel?.close(); } catch { /* noop */ }
    try { this.pc?.close(); } catch { /* noop */ }
    this.channel = null;
    this.pc = null;
    this.pendingIce = [];
    this.lastRemoteSignalSeq = 0;
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer !== null) globalThis.clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }
}

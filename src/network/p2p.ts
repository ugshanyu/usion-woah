import { diag } from './diag';
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
const RECOVERY_TIMEOUT_MS = 12_000;

export class P2PCamera {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private signalSeq = 0;
  private readonly seenRemoteSignals = new Set<string>();
  private generation = 0;
  private pendingIce: RTCIceCandidateInit[] = [];
  private disconnectTimer: number | null = null;
  private connectionTimer: number | null = null;
  private recoveryTimer: number | null = null;
  private offerRetryTimer: number | null = null;
  private lastAnswer: RTCSessionDescriptionInit | null = null;
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
    pc.onicecandidateerror = (event) => {
      const failure = event as RTCPeerConnectionIceErrorEvent;
      diag('ice-cand-error', { code: failure.errorCode, url: failure.url, text: String(failure.errorText ?? '').slice(0, 80) });
    };
    pc.oniceconnectionstatechange = () => diag('ice-state', { state: pc.iceConnectionState });
    pc.onicegatheringstatechange = () => diag('ice-gathering', { state: pc.iceGatheringState });
    pc.onconnectionstatechange = () => this.handleConnectionState();
    this.connectionTimer = globalThis.setTimeout(() => {
      if (this.connected) return;
      void this.reportFailureStats('connect-timeout');
      this.onState?.('unavailable');
      this.closePeer();
    }, CONNECT_TIMEOUT_MS);

    if (this.options.isHost) {
      this.bindChannel(pc.createDataChannel('woah-control', { ordered: true }));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal('offer', undefined, pc.localDescription ?? offer);
      this.armOfferRetry();
    } else {
      pc.ondatachannel = (event) => this.bindChannel(event.channel);
    }
  }

  // Re-offer until the peer's answer lands. Signaling rides a relay; if any
  // hop drops the offer (or our answer never arrives), the retransmit —
  // paired with the guest re-sending its answer on a duplicate offer —
  // recovers the handshake instead of timing the match out.
  private armOfferRetry(): void {
    this.clearOfferRetry();
    let retries = 0;
    this.offerRetryTimer = globalThis.setInterval(() => {
      if (!this.pc || this.pc.signalingState !== 'have-local-offer' || retries >= 4) {
        this.clearOfferRetry();
        return;
      }
      retries += 1;
      if (this.pc.localDescription) this.sendSignal('offer', undefined, this.pc.localDescription);
    }, 2500);
  }

  private clearOfferRetry(): void {
    if (this.offerRetryTimer !== null) globalThis.clearInterval(this.offerRetryTimer);
    this.offerRetryTimer = null;
  }

  async handleSignal(signal: RtcSignal): Promise<void> {
    if (signal.matchId !== this.options.matchId || signal.hostEpoch !== this.options.hostEpoch || signal.to !== this.options.myId) {
      diag('sig-drop', { why: 'scope', kind: signal.kind, seq: signal.signalSeq, toMe: signal.to === this.options.myId, match: signal.matchId === this.options.matchId });
      return;
    }
    if (!this.options.isHost && signal.kind === 'offer' && signal.pcGeneration >= this.generation) this.generation = signal.pcGeneration;
    if (signal.pcGeneration !== this.generation) {
      diag('sig-drop', { why: 'gen', kind: signal.kind, seq: signal.signalSeq, got: signal.pcGeneration, want: this.generation });
      return;
    }
    if (!this.pc) await this.start();
    const signalKey = `${signal.pcGeneration}:${signal.signalSeq}`;
    if (this.seenRemoteSignals.has(signalKey)) return;
    this.seenRemoteSignals.add(signalKey);
    while (this.seenRemoteSignals.size > 512) this.seenRemoteSignals.delete(this.seenRemoteSignals.values().next().value!);
    const pc = this.pc!;
    if (signal.kind === 'offer' && !this.options.isHost && signal.description) {
      if (pc.remoteDescription?.sdp === signal.description.sdp && this.lastAnswer) {
        // Retransmitted offer we already answered — the answer was likely
        // lost in transit. Re-send it instead of renegotiating.
        this.sendSignal('answer', undefined, this.lastAnswer);
        return;
      }
      await pc.setRemoteDescription(signal.description);
      await this.flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.lastAnswer = pc.localDescription ?? answer;
      this.sendSignal('answer', undefined, this.lastAnswer);
    } else if (signal.kind === 'answer' && this.options.isHost && signal.description) {
      // A re-sent answer after ours already applied would throw in 'stable'.
      if (pc.signalingState !== 'have-local-offer') return;
      this.clearOfferRetry();
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
      this.clearRecoveryTimer();
      this.onState?.('channel-open');
    };
    channel.onmessage = (event) => {
      try { this.onControl?.(JSON.parse(String(event.data))); } catch { /* ignore malformed peer data */ }
    };
    channel.onerror = () => this.handleChannelFailure();
    channel.onclose = () => this.handleChannelFailure();
  }

  private sendSignal(kind: RtcSignal['kind'], candidate?: RTCIceCandidateInit, description?: RTCSessionDescriptionInit): void {
    // pc.localDescription is an RTCSessionDescription platform object.
    // postMessage structured-clone cannot serialize it (DataCloneError), and
    // the throw is swallowed in async signal handlers — the message silently
    // never leaves the iframe. Always send plain JSON copies.
    const plainDescription = description ? { type: description.type, sdp: description.sdp } : undefined;
    const plainCandidate = candidate ? JSON.parse(JSON.stringify(candidate)) as RTCIceCandidateInit : undefined;
    this.options.sendSignal({ ns: 'woah.rtc.v1', to: this.options.peerId, matchId: this.options.matchId, hostEpoch: this.options.hostEpoch, pcGeneration: this.generation, signalSeq: ++this.signalSeq, kind, candidate: plainCandidate, description: plainDescription });
  }

  private async flushIce(): Promise<void> {
    const pending = this.pendingIce.splice(0);
    for (const candidate of pending) await this.pc?.addIceCandidate(candidate).catch(() => undefined);
  }

  private handleConnectionState(): void {
    const state = this.pc?.connectionState;
    if (!state) return;
    this.onState?.(state);
    if (this.disconnectTimer !== null) globalThis.clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    if (state === 'connected') {
      this.clearRecoveryTimer();
      return;
    }
    if ((state === 'failed' || state === 'disconnected') && this.options.isHost) {
      this.disconnectTimer = globalThis.setTimeout(() => void this.restart(), state === 'failed' ? 0 : 3000);
    }
    if (state === 'failed' || state === 'disconnected') this.armRecoveryTimer();
  }

  private async restart(): Promise<void> {
    if (!this.pc || !this.options.isHost) return;
    try {
      this.generation += 1;
      this.pendingIce = [];
      this.pc.restartIce();
      const offer = await this.pc.createOffer({ iceRestart: true });
      await this.pc.setLocalDescription(offer);
      this.sendSignal('offer', undefined, this.pc.localDescription ?? offer);
      this.armOfferRetry();
    } catch {
      this.onState?.('unavailable');
      this.closePeer();
    }
  }

  private closePeer(): void {
    this.clearConnectionTimer();
    this.clearRecoveryTimer();
    this.clearOfferRetry();
    this.lastAnswer = null;
    if (this.disconnectTimer !== null) globalThis.clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
    if (this.channel) {
      this.channel.onopen = null;
      this.channel.onmessage = null;
      this.channel.onerror = null;
      this.channel.onclose = null;
    }
    if (this.pc) this.pc.onconnectionstatechange = null;
    try { this.channel?.close(); } catch { /* noop */ }
    try { this.pc?.close(); } catch { /* noop */ }
    this.channel = null;
    this.pc = null;
    this.pendingIce = [];
    this.seenRemoteSignals.clear();
  }

  private clearConnectionTimer(): void {
    if (this.connectionTimer !== null) globalThis.clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }

  private handleChannelFailure(): void {
    if (!this.pc || this.pc.connectionState === 'closed') return;
    this.onState?.('failed');
    this.armRecoveryTimer();
    if (this.options.isHost) {
      if (this.disconnectTimer !== null) globalThis.clearTimeout(this.disconnectTimer);
      this.disconnectTimer = globalThis.setTimeout(() => void this.restart(), 0);
    }
  }

  private armRecoveryTimer(): void {
    if (this.recoveryTimer !== null) return;
    this.recoveryTimer = globalThis.setTimeout(() => {
      this.recoveryTimer = null;
      if (this.connected) return;
      void this.reportFailureStats('recovery-timeout');
      this.onState?.('unavailable');
      this.closePeer();
    }, RECOVERY_TIMEOUT_MS);
  }

  // One condensed snapshot of why ICE went nowhere: how many candidates of
  // each type we gathered, what the peer sent us, and every checked pair.
  private async reportFailureStats(reason: string): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    diag('rtc-fail', { reason, conn: pc.connectionState, ice: pc.iceConnectionState, gather: pc.iceGatheringState, signaling: pc.signalingState, remoteSet: Boolean(pc.remoteDescription) });
    try {
      const stats = await pc.getStats();
      const local: Record<string, number> = {};
      const remote: Record<string, number> = {};
      const pairs: string[] = [];
      stats.forEach((report) => {
        if (report.type === 'local-candidate') local[report.candidateType] = (local[report.candidateType] ?? 0) + 1;
        else if (report.type === 'remote-candidate') remote[report.candidateType] = (remote[report.candidateType] ?? 0) + 1;
        else if (report.type === 'candidate-pair' && pairs.length < 6) pairs.push(`${report.state}${report.nominated ? '*' : ''}`);
      });
      diag('rtc-fail-stats', { local, remote, pairs });
    } catch { /* stats are best-effort */ }
  }

  private clearRecoveryTimer(): void {
    if (this.recoveryTimer !== null) globalThis.clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
  }
}

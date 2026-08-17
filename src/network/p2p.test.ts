import { afterEach, describe, expect, it, vi } from 'vitest';
import { P2PCamera } from './p2p';
import type { RtcSignal } from './protocol';

class FakeStream {
  private tracks: unknown[] = [];
  getVideoTracks() { return this.tracks; }
  getTracks() { return this.tracks; }
  addTrack(track: unknown) { this.tracks.push(track); }
}

class FakePeer {
  static latest: FakePeer;
  connectionState = 'new';
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  onicecandidate: ((event: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: unknown) => void) | null = null;
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => { this.remoteDescription = description; });
  setLocalDescription = vi.fn(async (description: RTCSessionDescriptionInit) => { this.localDescription = description; });
  createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'answer' }));
  createOffer = vi.fn(async () => ({ type: 'offer' as const, sdp: 'offer' }));
  addIceCandidate = vi.fn(async () => undefined);
  restartIce = vi.fn();
  channel = new FakeChannel();
  constructor() { FakePeer.latest = this; }
  addTrack() { return {}; }
  createDataChannel() { return this.channel; }
  close() { this.connectionState = 'closed'; }
}

class FakeChannel {
  readyState = 'connecting';
  bufferedAmount = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close() { this.readyState = 'closed'; }
}

describe('P2PCamera signaling', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('processes the first offer once when it creates the guest peer lazily', async () => {
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    const sent: RtcSignal[] = [];
    const camera = new P2PCamera({
      myId: 'guest', peerId: 'host', isHost: false, matchId: 'match', hostEpoch: 'epoch',
      iceServers: [], localStream: new FakeStream() as unknown as MediaStream, sendSignal: (signal) => sent.push(signal),
    });
    const offer: RtcSignal = { ns: 'woah.rtc.v1', to: 'guest', matchId: 'match', hostEpoch: 'epoch', pcGeneration: 0, signalSeq: 1, kind: 'offer', description: { type: 'offer', sdp: 'offer' } };
    await camera.handleSignal(offer);
    await camera.handleSignal(offer);
    expect(FakePeer.latest.setRemoteDescription).toHaveBeenCalledOnce();
    expect(sent.filter((signal) => signal.kind === 'answer')).toHaveLength(1);
  });

  it('processes an offer that arrives after a higher-sequence ICE candidate', async () => {
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    const sent: RtcSignal[] = [];
    const camera = new P2PCamera({
      myId: 'guest', peerId: 'host', isHost: false, matchId: 'match', hostEpoch: 'epoch',
      iceServers: [], localStream: new FakeStream() as unknown as MediaStream, sendSignal: (signal) => sent.push(signal),
    });
    await camera.start();
    const candidate: RtcSignal = {
      ns: 'woah.rtc.v1', to: 'guest', matchId: 'match', hostEpoch: 'epoch', pcGeneration: 0,
      signalSeq: 2, kind: 'ice', candidate: { candidate: 'candidate:1 1 UDP 1 127.0.0.1 9999 typ host' },
    };
    const offer: RtcSignal = {
      ns: 'woah.rtc.v1', to: 'guest', matchId: 'match', hostEpoch: 'epoch', pcGeneration: 0,
      signalSeq: 1, kind: 'offer', description: { type: 'offer', sdp: 'offer' },
    };

    await camera.handleSignal(candidate);
    await camera.handleSignal(offer);
    await camera.handleSignal(candidate);

    expect(FakePeer.latest.setRemoteDescription).toHaveBeenCalledOnce();
    expect(FakePeer.latest.addIceCandidate).toHaveBeenCalledOnce();
    expect(sent.filter((signal) => signal.kind === 'answer')).toHaveLength(1);
  });

  it('reports an incompatible network when direct P2P cannot connect', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    const camera = new P2PCamera({
      myId: 'guest', peerId: 'host', isHost: false, matchId: 'match', hostEpoch: 'epoch',
      iceServers: [{ urls: 'stun:stun.example:3478' }], localStream: new FakeStream() as unknown as MediaStream, sendSignal: () => undefined,
    });
    const states: string[] = [];
    camera.onState = (state) => states.push(state);

    await camera.start();
    await vi.advanceTimersByTimeAsync(15_000);

    expect(states).toContain('unavailable');
    expect(FakePeer.latest.connectionState).toBe('closed');
  });

  it('restarts ICE after an established connection fails and cancels the recovery timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('MediaStream', FakeStream);
    vi.stubGlobal('RTCPeerConnection', FakePeer);
    const states: string[] = [];
    const signals: RtcSignal[] = [];
    const camera = new P2PCamera({
      myId: 'host', peerId: 'guest', isHost: true, matchId: 'match', hostEpoch: 'epoch',
      iceServers: [], localStream: new FakeStream() as unknown as MediaStream, sendSignal: (signal) => signals.push(signal),
    });
    camera.onState = (state) => states.push(state);

    await camera.start();
    const peer = FakePeer.latest;
    peer.connectionState = 'connected';
    peer.channel.readyState = 'open';
    peer.onconnectionstatechange?.();
    peer.channel.onopen?.();
    peer.connectionState = 'failed';
    peer.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(peer.restartIce).toHaveBeenCalledOnce();
    expect(signals.some((signal) => signal.kind === 'offer' && signal.pcGeneration === 1)).toBe(true);

    peer.connectionState = 'connected';
    peer.onconnectionstatechange?.();
    await vi.advanceTimersByTimeAsync(12_000);
    expect(states.at(-1)).toBe('connected');
    expect(states).not.toContain('unavailable');
  });
});

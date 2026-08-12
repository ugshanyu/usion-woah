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
  ontrack = null; onicecandidate = null; onconnectionstatechange = null; ondatachannel = null;
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => { this.remoteDescription = description; });
  setLocalDescription = vi.fn(async (description: RTCSessionDescriptionInit) => { this.localDescription = description; });
  createAnswer = vi.fn(async () => ({ type: 'answer' as const, sdp: 'answer' }));
  addIceCandidate = vi.fn(async () => undefined);
  constructor() { FakePeer.latest = this; }
  addTrack() { return {}; }
  close() { this.connectionState = 'closed'; }
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
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraController } from './camera';

function fakeMedia() {
  const stop = vi.fn();
  const track = { addEventListener: vi.fn(), stop } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stop, stream };
}

function fakeVideo(play = vi.fn().mockResolvedValue(undefined)) {
  return { srcObject: null, muted: false, playsInline: false, play } as unknown as HTMLVideoElement;
}

afterEach(() => vi.unstubAllGlobals());

describe('CameraController', () => {
  it('keeps permission denial distinct from device failures', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')) },
    });
    const camera = new CameraController();

    await expect(camera.start(fakeVideo())).rejects.toThrow('blocked');

    expect(camera.state).toBe('denied');
  });

  it('stops an acquired stream when video playback fails', async () => {
    const { stop, stream } = fakeMedia();
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    const video = fakeVideo(vi.fn().mockRejectedValue(new Error('play failed')));
    const camera = new CameraController();

    await expect(camera.start(video)).rejects.toThrow('play failed');

    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    expect(camera.stream).toBeNull();
    expect(camera.state).toBe('error');
  });
});

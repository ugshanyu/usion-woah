export type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'ended' | 'error';

export class CameraController {
  stream: MediaStream | null = null;
  state: CameraState = 'idle';
  onState: ((state: CameraState, error?: string) => void) | null = null;

  async start(video: HTMLVideoElement): Promise<MediaStream> {
    this.stop();
    this.setState('requesting');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera_unsupported');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('camera_missing_track');
      track.addEventListener('ended', () => this.setState('ended'), { once: true });
      track.addEventListener('mute', () => this.setState('ended'), { once: true });
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      this.stream = stream;
      this.setState('ready');
      return stream;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      this.setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.state !== 'idle') this.setState('idle');
  }

  private setState(state: CameraState, error?: string): void {
    this.state = state;
    this.onState?.(state, error);
  }
}

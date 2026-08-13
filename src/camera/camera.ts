export type CameraState = 'idle' | 'requesting' | 'ready' | 'denied' | 'ended' | 'error';

export class CameraController {
  stream: MediaStream | null = null;
  state: CameraState = 'idle';
  onState: ((state: CameraState, error?: string) => void) | null = null;
  private video: HTMLVideoElement | null = null;

  async start(video: HTMLVideoElement): Promise<MediaStream> {
    this.stop();
    this.setState('requesting');
    let acquired: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera_unsupported');
      acquired = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 24, max: 30 },
        },
        audio: false,
      });
      const track = acquired.getVideoTracks()[0];
      if (!track) throw new Error('camera_missing_track');
      track.addEventListener('ended', () => this.setState('ended'), { once: true });
      track.addEventListener('mute', () => this.setState('ended'), { once: true });
      video.srcObject = acquired;
      video.muted = true;
      video.playsInline = true;
      this.video = video;
      await video.play();
      this.stream = acquired;
      this.setState('ready');
      return acquired;
    } catch (error) {
      acquired?.getTracks().forEach((track) => track.stop());
      if (video.srcObject === acquired) video.srcObject = null;
      if (this.video === video) this.video = null;
      this.stream = null;
      const name = error instanceof DOMException ? error.name : '';
      this.setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  stop(): void {
    const stream = this.stream;
    stream?.getTracks().forEach((track) => track.stop());
    if (this.video?.srcObject === stream) this.video.srcObject = null;
    this.video = null;
    this.stream = null;
    if (this.state !== 'idle') this.setState('idle');
  }

  private setState(state: CameraState, error?: string): void {
    this.state = state;
    this.onState?.(state, error);
  }
}

export class CuePlayer {
  private context: AudioContext | null = null;

  async unlock(): Promise<void> {
    this.context ??= new AudioContext({ latencyHint: 'interactive' });
    if (this.context.state === 'suspended') await this.context.resume();
  }

  schedule(targetPerfMs: number): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const when = context.currentTime + Math.max(0, targetPerfMs - performance.now()) / 1000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(220, when);
    oscillator.frequency.exponentialRampToValueAtTime(880, when + 0.09);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.35, when + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + 0.2);
  }

  close(): void {
    void this.context?.close();
    this.context = null;
  }
}

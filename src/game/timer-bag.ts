export class TimerBag {
  private readonly timers = new Set<number>();

  add(callback: () => void, delay: number): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay);
    this.timers.add(timer);
  }

  clear(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
  }
}

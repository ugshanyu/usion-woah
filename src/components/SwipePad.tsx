import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { SwipeGesture } from '../game/types';
import type { MessageKey } from '../i18n';
import { SwipeTracker } from '../input/swipe';

const arrows = { left: '←', right: '→', up: '↑', down: '↓' } as const;

export function SwipePad({ roundId, onSwipe, t }: { roundId: number; onSwipe: (gesture: SwipeGesture) => boolean; t: (key: MessageKey) => string }) {
  const tracker = useRef(new SwipeTracker());
  const sequence = useRef(0);
  const [accepted, setAccepted] = useState<SwipeGesture['direction'] | null>(null);
  const [feedback, setFeedback] = useState<'idle' | 'accepted' | 'timing'>('idle');

  useEffect(() => {
    setAccepted(null);
    setFeedback('idle');
  }, [roundId]);

  function begin(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    tracker.current.begin(event.pointerId, event.clientX, event.clientY, performance.now());
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const gesture = tracker.current.move(event.pointerId, event.clientX, event.clientY, performance.now(), ++sequence.current);
    if (!gesture) return;
    if (onSwipe(gesture)) {
      setAccepted(gesture.direction);
      setFeedback('accepted');
    } else {
      setAccepted(null);
      setFeedback('timing');
    }
  }

  function end(event: PointerEvent<HTMLDivElement>) {
    tracker.current.end(event.pointerId);
  }

  return (
    <div className="swipe-pad" role="application" aria-label={t('swipeArea')} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div className={`swipe-feedback ${feedback}`} aria-live="polite">
        <strong>{accepted ? arrows[accepted] : '↕'}</strong>
        <span>{feedback === 'accepted' ? t('swipeAccepted') : feedback === 'timing' ? t('swipeTiming') : t('swipeHint')}</span>
      </div>
    </div>
  );
}

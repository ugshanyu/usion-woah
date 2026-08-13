import { useEffect, useRef, useState } from 'react';
import type { CardinalDirection, DirectionChoice } from '../game/types';
import type { MessageKey } from '../i18n';

const controls: Array<{ direction: CardinalDirection; arrow: string; label: MessageKey; className: string }> = [
  { direction: 'up', arrow: '↑', label: 'arrowUp', className: 'up' },
  { direction: 'left', arrow: '←', label: 'arrowLeft', className: 'left' },
  { direction: 'right', arrow: '→', label: 'arrowRight', className: 'right' },
  { direction: 'down', arrow: '↓', label: 'arrowDown', className: 'down' },
];

export function DirectionPad({ roundId, onChoose, t }: { roundId: number; onChoose: (choice: DirectionChoice) => boolean; t: (key: MessageKey) => string }) {
  const sequence = useRef(0);
  const [accepted, setAccepted] = useState<CardinalDirection | null>(null);
  const [tooEarlyOrLate, setTooEarlyOrLate] = useState(false);

  useEffect(() => {
    setAccepted(null);
    setTooEarlyOrLate(false);
  }, [roundId]);

  function choose(direction: CardinalDirection): void {
    if (accepted) return;
    const choice: DirectionChoice = { direction, selectedLocalMs: performance.now(), confidence: 1, sequence: ++sequence.current };
    if (onChoose(choice)) {
      setAccepted(direction);
      setTooEarlyOrLate(false);
    } else {
      setTooEarlyOrLate(true);
    }
  }

  return (
    <section className="direction-control" aria-label={t('directionControl')}>
      <p aria-live="polite">{accepted ? t('directionLocked') : tooEarlyOrLate ? t('directionTiming') : t('directionHint')}</p>
      <div className="direction-grid">
        {controls.map((control) => (
          <button
            key={control.direction}
            type="button"
            className={`${control.className} ${accepted === control.direction ? 'selected' : ''}`}
            disabled={Boolean(accepted)}
            aria-label={t(control.label)}
            onPointerDown={(event) => { event.preventDefault(); choose(control.direction); }}
          >
            {control.arrow}
          </button>
        ))}
      </div>
    </section>
  );
}

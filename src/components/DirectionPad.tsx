import { useEffect, useRef, useState } from 'react';
import type { CardinalDirection, DirectionChoice } from '../game/types';
import type { MessageKey } from '../i18n';

const controls: Array<{ direction: CardinalDirection; arrow: string; label: MessageKey; className: string }> = [
  { direction: 'up', arrow: '↑', label: 'arrowUp', className: 'up' },
  { direction: 'left', arrow: '←', label: 'arrowLeft', className: 'left' },
  { direction: 'right', arrow: '→', label: 'arrowRight', className: 'right' },
  { direction: 'down', arrow: '↓', label: 'arrowDown', className: 'down' },
];

export function DirectionPad({ roundId, expired, onChoose, t }: { roundId: number; expired: boolean; onChoose: (choice: DirectionChoice) => boolean; t: (key: MessageKey) => string }) {
  const sequence = useRef(0);
  const [selected, setSelected] = useState<CardinalDirection | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    setSelected(null);
    setAccepted(false);
  }, [roundId]);

  function choose(direction: CardinalDirection): void {
    if (selected || expired) return;
    setSelected(direction);
    const choice: DirectionChoice = { direction, selectedLocalMs: performance.now(), confidence: 1, sequence: ++sequence.current };
    setAccepted(onChoose(choice));
  }

  const selectedArrow = controls.find((control) => control.direction === selected)?.arrow;

  return (
    <section className="direction-control" aria-label={t('directionControl')}>
      <p aria-live="polite">{accepted ? `${t('directionLocked')} ${selectedArrow}` : selected || expired ? t('directionTiming') : t('directionHint')}</p>
      <div className="direction-grid">
        {controls.map((control) => (
          <button
            key={control.direction}
            type="button"
            className={`${control.className} ${selected === control.direction ? 'selected' : ''}`}
            disabled={Boolean(selected) || expired}
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

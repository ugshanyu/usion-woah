import { describe, expect, it } from 'vitest';
import type { GestureSummary, RoundResult } from './types';
import { focusedCamera, resultDirectionComparison } from './match-view';

function gesture(role: GestureSummary['role'], direction: GestureSummary['direction']): GestureSummary {
  return { roundId: 1, role, direction, onsetHostMs: 1000, peakHostMs: 1020, confidence: 0.9, clockSigmaMs: 10, frameSeq: 1, generation: 1 };
}

describe('turn camera focus', () => {
  it('shows the looker full-screen and the pointer in picture-in-picture', () => {
    expect(focusedCamera('pointer')).toBe('remote');
    expect(focusedCamera('looker')).toBe('local');
    expect(focusedCamera(null)).toBe('local');
  });

  it('renders unmistakable guess-versus-face evidence for the verdict', () => {
    const hit: RoundResult = { roundId: 1, verdict: 'hit', reason: 'same_direction', pointer: gesture('pointer', 'right'), looker: gesture('looker', 'right') };
    const miss: RoundResult = { roundId: 2, verdict: 'dodge', reason: 'different_direction', pointer: gesture('pointer', 'up'), looker: gesture('looker', 'left') };
    expect(resultDirectionComparison(hit)).toEqual({ guess: '→', face: '→', operator: '=' });
    expect(resultDirectionComparison(miss)).toEqual({ guess: '↑', face: '←', operator: '≠' });
  });
});

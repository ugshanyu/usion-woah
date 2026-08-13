import { describe, expect, it } from 'vitest';
import { focusedCamera } from './match-view';

describe('turn camera focus', () => {
  it('shows the looker full-screen and the pointer in picture-in-picture', () => {
    expect(focusedCamera('pointer')).toBe('remote');
    expect(focusedCamera('looker')).toBe('local');
    expect(focusedCamera(null)).toBe('local');
  });
});

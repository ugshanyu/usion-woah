import { describe, expect, it } from 'vitest';
import { matchOutcome, pointerForRound, ROUNDS_PER_POINTER, TOTAL_ROUNDS, winningPlayerId } from './match-format';

describe('ten-round match format', () => {
  it('gives each player one fixed block of five pointer rounds', () => {
    expect(ROUNDS_PER_POINTER).toBe(5);
    expect(TOTAL_ROUNDS).toBe(10);
    expect(Array.from({ length: 5 }, (_, index) => pointerForRound(index + 1, 'first', 'second'))).toEqual(Array(5).fill('first'));
    expect(Array.from({ length: 5 }, (_, index) => pointerForRound(index + 6, 'first', 'second'))).toEqual(Array(5).fill('second'));
    expect(() => pointerForRound(0, 'first', 'second')).toThrow('invalid_round');
    expect(() => pointerForRound(11, 'first', 'second')).toThrow('invalid_round');
  });

  it('chooses the higher score after ten rounds and supports a draw', () => {
    expect(winningPlayerId({ a: 4, b: 2 }, ['a', 'b'])).toBe('a');
    expect(winningPlayerId({ a: 3, b: 3 }, ['a', 'b'])).toBeNull();
    expect(matchOutcome({ me: 4, peer: 2 }, 'me', 'peer')).toBe('win');
    expect(matchOutcome({ me: 1, peer: 3 }, 'me', 'peer')).toBe('lose');
    expect(matchOutcome({ me: 2, peer: 2 }, 'me', 'peer')).toBe('draw');
  });
});

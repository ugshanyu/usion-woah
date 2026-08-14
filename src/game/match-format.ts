import type { Score } from './types';

export const ROUNDS_PER_POINTER = 5;
export const TOTAL_ROUNDS = ROUNDS_PER_POINTER * 2;

export function pointerForRound(roundId: number, firstPointerId: string, secondPointerId: string): string {
  if (!Number.isInteger(roundId) || roundId < 1 || roundId > TOTAL_ROUNDS) throw new Error('invalid_round');
  return roundId <= ROUNDS_PER_POINTER ? firstPointerId : secondPointerId;
}

export function winningPlayerId(score: Score, playerIds: [string, string]): string | null {
  const [first, second] = playerIds;
  const firstScore = score[first] ?? 0;
  const secondScore = score[second] ?? 0;
  if (firstScore === secondScore) return null;
  return firstScore > secondScore ? first : second;
}

export function matchOutcome(score: Score, myId: string, peerId: string): 'win' | 'lose' | 'draw' {
  const winnerId = winningPlayerId(score, [myId, peerId]);
  return winnerId === null ? 'draw' : winnerId === myId ? 'win' : 'lose';
}

import type { Role, RoundResult, Score } from './types';

export type MatchPhase = 'waiting' | 'connecting' | 'syncing' | 'countdown' | 'judging' | 'result' | 'gameover' | 'reconnecting' | 'network-error';

export type MatchView = {
  phase: MatchPhase;
  peerName: string | null;
  localReady: boolean;
  peerReady: boolean;
  role: Role | null;
  targetLocalMs: number | null;
  roundId: number;
  score: Score;
  result: RoundResult | null;
  rtcState: string;
  clockUncertaintyMs: number;
  rematchLocalReady: boolean;
  rematchPeerReady: boolean;
};

export function focusedCamera(role: Role | null): 'local' | 'remote' {
  return role === 'pointer' ? 'remote' : 'local';
}

const DIRECTION_ARROWS = { up: '↑', down: '↓', left: '←', right: '→' } as const;

export function resultDirectionComparison(result: RoundResult | null): { guess: string; face: string; operator: '=' | '≠' } | null {
  if (!result?.pointer && !result?.looker) return null;
  return {
    guess: result.pointer ? DIRECTION_ARROWS[result.pointer.direction as keyof typeof DIRECTION_ARROWS] ?? '?' : '?',
    face: result.looker ? DIRECTION_ARROWS[result.looker.direction as keyof typeof DIRECTION_ARROWS] ?? '?' : '?',
    operator: result.verdict === 'hit' ? '=' : '≠',
  };
}

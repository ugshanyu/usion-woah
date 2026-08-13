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
};

export function focusedCamera(role: Role | null): 'local' | 'remote' {
  return role === 'pointer' ? 'remote' : 'local';
}

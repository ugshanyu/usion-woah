import type { CardinalDirection, Direction } from '../game/types';

export type DirectionLatchState = {
  stableDirection: Direction;
  candidateDirection: CardinalDirection | null;
  candidateFrames: number;
};

export const EMPTY_DIRECTION_LATCH: DirectionLatchState = {
  stableDirection: 'neutral',
  candidateDirection: null,
  candidateFrames: 0,
};

export function advanceDirectionLatch(state: DirectionLatchState, classified: Direction): DirectionLatchState {
  if (!isCardinal(classified)) return { ...EMPTY_DIRECTION_LATCH, stableDirection: classified };
  if (classified === state.stableDirection) return { stableDirection: classified, candidateDirection: null, candidateFrames: 0 };
  const candidateFrames = classified === state.candidateDirection ? state.candidateFrames + 1 : 1;
  if (candidateFrames >= 2) return { stableDirection: classified, candidateDirection: null, candidateFrames: 0 };
  return { stableDirection: state.stableDirection, candidateDirection: classified, candidateFrames };
}

function isCardinal(direction: Direction): direction is CardinalDirection {
  return direction === 'up' || direction === 'down' || direction === 'left' || direction === 'right';
}

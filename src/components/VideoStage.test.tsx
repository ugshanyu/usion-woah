import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resultDirectionComparison } from '../game/match-view';
import type { GestureSummary, RoundResult } from '../game/types';
import { PLAYER_FACING_CAMERA_TRANSFORM, VideoStage } from './VideoStage';

function rightGesture(role: GestureSummary['role']): GestureSummary {
  return { roundId: 1, role, direction: 'right', onsetHostMs: 1000, peakHostMs: 1020, confidence: 0.9, clockSigmaMs: 10, frameSeq: 1, generation: 1 };
}

describe('player-facing camera direction presentation', () => {
  it('mirrors local and remote video identically so visible directions match arrows', () => {
    const markup = renderToStaticMarkup(
      <VideoStage
        localRef={createRef<HTMLVideoElement>()}
        remoteRef={createRef<HTMLVideoElement>()}
        showRemote
        localLabel="You"
        remoteLabel="Opponent"
      />,
    );

    expect(PLAYER_FACING_CAMERA_TRANSFORM).toBe('scaleX(-1)');
    expect(markup.match(/style="transform:scaleX\(-1\)"/g)).toHaveLength(2);
    expect(markup).toContain('video-tile local');
    expect(markup).toContain('video-tile remote');
    const rightHit: RoundResult = { roundId: 1, verdict: 'hit', reason: 'same_direction', pointer: rightGesture('pointer'), looker: rightGesture('looker') };
    expect(resultDirectionComparison(rightHit)).toEqual({ guess: '→', face: '→', operator: '=' });
  });
});

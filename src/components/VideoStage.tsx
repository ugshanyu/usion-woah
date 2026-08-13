import type { RefObject } from 'react';

export function VideoStage({ localRef, remoteRef, showRemote, focus = 'local', localLabel, remoteLabel, badge }: { localRef: RefObject<HTMLVideoElement | null>; remoteRef: RefObject<HTMLVideoElement | null>; showRemote: boolean; focus?: 'local' | 'remote'; localLabel: string; remoteLabel: string; badge?: string }) {
  return (
    <div className={`video-stage ${showRemote ? 'duel' : 'solo'} focus-${focus}`}>
      <figure className={`video-tile local ${!showRemote || focus === 'local' ? 'main' : 'pip'}`}>
        <video ref={localRef} autoPlay muted playsInline aria-label={localLabel} />
        <figcaption>{localLabel}</figcaption>
        {badge && <span className="vision-badge">{badge}</span>}
      </figure>
      {showRemote && (
        <figure className={`video-tile remote ${focus === 'remote' ? 'main' : 'pip'}`}>
          <video ref={remoteRef} autoPlay playsInline aria-label={remoteLabel} />
          <figcaption>{remoteLabel}</figcaption>
        </figure>
      )}
    </div>
  );
}

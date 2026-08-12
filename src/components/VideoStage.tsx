import type { RefObject } from 'react';

export function VideoStage({ localRef, remoteRef, showRemote, localLabel, remoteLabel, badge }: { localRef: RefObject<HTMLVideoElement | null>; remoteRef: RefObject<HTMLVideoElement | null>; showRemote: boolean; localLabel: string; remoteLabel: string; badge?: string }) {
  return (
    <div className={`video-stage ${showRemote ? 'duel' : 'solo'}`}>
      <figure className="video-tile local">
        <video ref={localRef} autoPlay muted playsInline aria-label={localLabel} />
        <figcaption>{localLabel}</figcaption>
        {badge && <span className="vision-badge">{badge}</span>}
      </figure>
      {showRemote && (
        <figure className="video-tile remote">
          <video ref={remoteRef} autoPlay playsInline aria-label={remoteLabel} />
          <figcaption>{remoteLabel}</figcaption>
        </figure>
      )}
    </div>
  );
}

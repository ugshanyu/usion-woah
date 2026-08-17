import { createRef, useEffect, useRef, useState } from 'react';
import { CuePlayer } from '../audio/cue';
import { DirectionPad } from '../components/DirectionPad';
import { Scoreboard } from '../components/Scoreboard';
import { VideoStage } from '../components/VideoStage';
import type { MatchView } from '../game/match-view';
import { translator } from '../i18n';

const localVideo = createRef<HTMLVideoElement>();
const remoteVideo = createRef<HTMLVideoElement>();
const t = translator('mn');

export function MatchPreview() {
  const audio = useRef<CuePlayer | null>(null);
  const [audioStatus, setAudioStatus] = useState('Play bundled song');
  const role = new URLSearchParams(location.search).get('role') === 'looker' ? 'looker' : 'pointer';
  const view: MatchView = {
    phase: 'countdown', peerName: 'Найз', localReady: true, peerReady: true, role,
    targetLocalMs: performance.now() + 1700, roundId: 3, score: { me: 2, peer: 1 },
    result: null, rtcState: 'channel-open', clockUncertaintyMs: 12,
  };
  useEffect(() => () => audio.current?.close(), []);

  async function previewAudio() {
    audio.current ??= new CuePlayer();
    await audio.current.unlock();
    audio.current.startSoundtrack();
    audio.current.scheduleCountdown(performance.now() + 3200);
    setAudioStatus('Loading bundled song...');
    window.setTimeout(() => {
      const mode = audio.current?.soundtrackMode;
      const duration = audio.current?.soundtrackDurationSeconds;
      setAudioStatus(mode === 'bundled-song' ? `Bundled song running (${duration?.toFixed(1)}s)` : 'Procedural fallback running');
    }, 2500);
  }

  return (
    <main className="app-shell dev-preview">
      <Scoreboard view={view} myId="me" peerId="peer" t={t} />
      <VideoStage localRef={localVideo} remoteRef={remoteVideo} showRemote focus={role === 'pointer' ? 'remote' : 'local'} localLabel={t('you')} remoteLabel="Найз" />
      <div className="cue"><strong>{role === 'pointer' ? t('pointer') : t('looker')}</strong><span>2</span><p>{role === 'pointer' ? t('pointerHint') : t('lookerHint')}</p><div className="countdown-track"><i style={{ transform: 'scaleX(.56)' }} /></div></div>
      {role === 'pointer' && <DirectionPad roundId={3} expired={false} onChoose={() => true} t={t} />}
      <button className="audio-preview" type="button" onClick={() => void previewAudio()}>{audioStatus}</button>
    </main>
  );
}

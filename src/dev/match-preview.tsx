import { createRef, useEffect, useRef, useState } from 'react';
import { CuePlayer } from '../audio/cue';
import { DirectionPad } from '../components/DirectionPad';
import { RematchControl } from '../components/RematchControl';
import { Scoreboard } from '../components/Scoreboard';
import { VideoStage } from '../components/VideoStage';
import type { MatchView } from '../game/match-view';
import { translator } from '../i18n';

const localVideo = createRef<HTMLVideoElement>();
const remoteVideo = createRef<HTMLVideoElement>();
const t = translator('mn');

export function MatchPreview() {
  const audio = useRef<CuePlayer | null>(null);
  const [audioStatus, setAudioStatus] = useState('Test real WHOA cue');
  const [rematchLocalReady, setRematchLocalReady] = useState(false);
  const parameters = new URLSearchParams(location.search);
  const role = parameters.get('role') === 'looker' ? 'looker' : 'pointer';
  const gameover = parameters.get('state') === 'gameover';
  const view: MatchView = {
    phase: gameover ? 'gameover' : 'countdown', peerName: 'Найз', localReady: true, peerReady: true, role,
    targetLocalMs: gameover ? null : performance.now() + 1700, roundId: gameover ? 10 : 3, score: { me: 4, peer: 3 },
    result: gameover ? { roundId: 10, verdict: 'hit', reason: 'same_direction', pointer: null, looker: null } : null,
    rtcState: 'channel-open', clockUncertaintyMs: 12, rematchLocalReady, rematchPeerReady: !rematchLocalReady,
  };
  useEffect(() => () => audio.current?.close(), []);

  async function previewAudio() {
    audio.current ??= new CuePlayer();
    await audio.current.unlock();
    audio.current.startSoundtrack();
    const ready = await audio.current.prepareSoundtrack();
    audio.current.scheduleCountdown(performance.now() + 3200, 3);
    setAudioStatus(ready ? 'Real WHOA cue scheduled...' : 'Synthetic fallback scheduled...');
    window.setTimeout(() => {
      const mode = audio.current?.soundtrackMode;
      const duration = audio.current?.soundtrackDurationSeconds;
      setAudioStatus(mode === 'bundled-song' ? `Round 3 real WHOA cue running (${duration?.toFixed(1)}s file)` : 'Synthetic fallback running');
    }, 2500);
  }

  return (
    <main className="app-shell dev-preview">
      <Scoreboard view={view} myId="me" peerId="peer" t={t} />
      <VideoStage localRef={localVideo} remoteRef={remoteVideo} showRemote focus={role === 'pointer' ? 'remote' : 'local'} localLabel={t('you')} remoteLabel="Найз" />
      {gameover ? <div className="result-card hit"><h2>{t('youWin')}</h2><div className="gameover-label">{t('gameover')}</div><p>{t('hitDetail')}</p><RematchControl localReady={rematchLocalReady} peerReady={!rematchLocalReady} onRematch={() => { setRematchLocalReady(true); return true; }} t={t} /></div> : <><div className="cue"><strong>{role === 'pointer' ? t('pointer') : t('looker')}</strong><span>2</span><p>{role === 'pointer' ? t('pointerHint') : t('lookerHint')}</p><div className="countdown-track"><i style={{ transform: 'scaleX(.56)' }} /></div></div>{role === 'pointer' && <DirectionPad roundId={3} expired={false} onChoose={() => true} t={t} />}<button className="audio-preview" type="button" onClick={() => void previewAudio()}>{audioStatus}</button></>}
    </main>
  );
}

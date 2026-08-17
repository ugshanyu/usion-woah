import { useEffect, useMemo, useRef, useState } from 'react';
import { CameraController, type CameraState } from './camera/camera';
import { CalibrationOverlay } from './components/CalibrationOverlay';
import { Scoreboard } from './components/Scoreboard';
import { DirectionPad } from './components/DirectionPad';
import { RematchControl } from './components/RematchControl';
import { VideoStage } from './components/VideoStage';
import { MatchController, type MatchView } from './game/match-controller';
import { matchOutcome } from './game/match-format';
import { focusedCamera, resultDirectionComparison } from './game/match-view';
import { HEAD_RECOGNITION_TIMEOUT_MS } from './game/timing';
import { languageFor, translator } from './i18n';
import { UsionRoom, type RoomState } from './platform/room';
import { CalibrationSession, type CalibrationFeedback, type CalibrationStage } from './vision/calibration';
import { VisionInference } from './vision/inference';
import { SampleBuffer } from './vision/sample-buffer';

type AppPhase = 'boot' | 'intro' | 'calibration' | 'play' | 'error';
type SetupFailure = 'camera-denied' | 'camera-error' | 'vision-error' | null;

const initialMatch: MatchView = { phase: 'waiting', peerName: null, localReady: false, peerReady: false, role: null, targetLocalMs: null, roundId: 0, score: {}, result: null, rtcState: 'new', clockUncertaintyMs: Number.POSITIVE_INFINITY, rematchLocalReady: false, rematchPeerReady: false };

export default function App() {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const calibrated = useRef(false);
  const readyRoomId = useRef<string | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const room = useMemo(() => new UsionRoom(), []);
  const camera = useMemo(() => new CameraController(), []);
  const inference = useMemo(() => new VisionInference(), []);
  const samples = useMemo(() => new SampleBuffer(), []);
  const calibration = useMemo(() => new CalibrationSession(inference), [inference]);
  const match = useMemo(() => new MatchController(room, inference, samples), [room, inference, samples]);
  const [phase, setPhase] = useState<AppPhase>('boot');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [matchView, setMatchView] = useState<MatchView>(initialMatch);
  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [modelStatus, setModelStatus] = useState<'idle' | 'loading' | 'ready' | 'slow' | 'error'>('idle');
  const [calibrationStage, setCalibrationStage] = useState<CalibrationStage>('neutral');
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [calibrationFeedback, setCalibrationFeedback] = useState<CalibrationFeedback>('searching');
  const [direction, setDirection] = useState('neutral');
  const [error, setError] = useState<string | null>(null);
  const [setupFailure, setSetupFailure] = useState<SetupFailure>(null);
  const [now, setNow] = useState(() => performance.now());
  const [language, setLanguage] = useState<'en' | 'mn'>('en');
  const t = useMemo(() => translator(language), [language]);

  useEffect(() => {
    room.onState = (state) => {
      setRoomState(state);
      match.handleConnection(state.connection);
      if (calibrated.current && state.roomId && state.connection === 'connected' && readyRoomId.current !== state.roomId && camera.stream) {
        readyRoomId.current = state.roomId;
        void match.markLocalReady(camera.stream);
      }
    };
    room.onSignal = (signal, sender) => match.handleSignal(signal, sender);
    room.onControl = (event, sender) => match.handleControl(event, sender);
    room.onPeerGone = (peer) => match.handlePeerGone(peer);
    room.onReconnected = () => void match.handleReconnected();
    match.onView = setMatchView;
    match.onRemoteStream = (stream) => {
      remoteStream.current = stream;
      attachRemoteVideo(remoteVideo.current, stream);
    };
    inference.onStatus = (status) => {
      setModelStatus(status === 'error' ? 'error' : status);
      if (status === 'error') setSetupFailure('vision-error');
    };
    inference.onHeadFeature = (feature) => calibration.acceptHead(feature);
    inference.onSample = (sample) => {
      samples.push(sample);
      match.handleVisionSample(sample);
      setDirection(sample.direction);
    };
    calibration.onStage = (stage, progress, feedback) => {
      setCalibrationStage(stage);
      setCalibrationProgress(progress);
      setCalibrationFeedback(feedback);
    };
    calibration.onComplete = () => {
      calibrated.current = true;
      setPhase('play');
      if (camera.stream) void match.markLocalReady(camera.stream);
    };
    camera.onState = (state, detail) => {
      setCameraState(state);
      if (state === 'denied') setSetupFailure('camera-denied');
      if (state === 'error') setSetupFailure('camera-error');
      if (state === 'ended') {
        calibrated.current = false;
        readyRoomId.current = null;
        calibration.cancel();
        inference.stop();
        match.suspend();
        setPhase('intro');
      }
    };
    void room.initialize().then((state) => {
      setLanguage(languageFor(state.config.language || Usion.getLanguage()));
      document.documentElement.dataset.theme = state.config.theme || Usion.getTheme();
      setPhase('intro');
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPhase('error');
    });
    const visibility = () => {
      if (document.hidden && camera.stream) {
        calibrated.current = false;
        readyRoomId.current = null;
        calibration.cancel();
        inference.stop();
        camera.stop();
        match.suspend();
        setPhase('intro');
      }
    };
    const orientationChanged = () => {
      if (!camera.stream) return;
      calibrated.current = false;
      readyRoomId.current = null;
      calibration.cancel();
      inference.stop();
      camera.stop();
      match.suspend();
      setPhase('intro');
    };
    document.addEventListener('visibilitychange', visibility);
    screen.orientation?.addEventListener('change', orientationChanged);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      screen.orientation?.removeEventListener('change', orientationChanged);
      calibration.cancel();
      inference.destroy();
      camera.stop();
      match.destroy();
    };
  }, [calibration, camera, inference, match, room, samples]);

  useEffect(() => {
    if (remoteStream.current) attachRemoteVideo(remoteVideo.current, remoteStream.current);
  }, [matchView.phase]);

  useEffect(() => {
    if (!matchView.targetLocalMs) return;
    let frame = 0;
    const update = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [matchView.targetLocalMs]);

  async function startCamera() {
    if (modelStatus === 'error') {
      location.reload();
      return;
    }
    setError(null);
    setSetupFailure(null);
    setPhase('calibration');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (!localVideo.current) return;
    try {
      await match.unlockAudio();
      await camera.start(localVideo.current);
      await inference.initialize();
      inference.start(localVideo.current);
      calibration.start();
      match.startSoundtrack();
    } catch (cause) {
      const failure: Exclude<SetupFailure, null> = camera.state === 'denied'
        ? 'camera-denied'
        : camera.state === 'ready'
          ? 'vision-error'
          : 'camera-error';
      setSetupFailure(failure);
      calibration.cancel();
      inference.stop();
      match.stopSoundtrack();
      if (failure === 'vision-error') camera.stop();
      const detail = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
      Usion.log(`Woah startup failed [${failure}]: ${detail.slice(0, 240)}`);
      setPhase('intro');
    }
  }

  const peerId = roomState?.roster.find((id) => id !== roomState.myId) ?? null;
  const countdown = matchView.targetLocalMs ? matchView.targetLocalMs - now : null;
  const cue = countdown === null ? null : countdown <= 0 ? 'WOAH' : countdown <= 1000 ? '1' : countdown <= 2000 ? '2' : '3';

  if (phase === 'boot') return <main className="center"><div className="brand-loader">WOAH</div></main>;
  if (phase === 'error') return <main className="center"><h1>{t('title')}</h1><p>{error}</p><button onClick={() => location.reload()}>{t('retry')}</button></main>;

  return (
    <main className="app-shell">
      {phase === 'intro' ? (
        <section className="intro center">
          <div className="logo-mark">W!</div>
          <h1>{t('title')}</h1><p className="subtitle">{t('subtitle')}</p>
          <p className="privacy">{setupFailure === 'camera-denied' ? t('cameraDenied') : setupFailure === 'camera-error' ? t('cameraError') : setupFailure === 'vision-error' ? t('visionError') : cameraState === 'ended' ? t('cameraEnded') : t('privacy')}</p>
          <button className="primary" onClick={() => void startCamera()}>{setupFailure || cameraState === 'ended' ? t('retry') : t('start')}</button>
        </section>
      ) : (
        <>
          {phase === 'play' && roomState && <Scoreboard view={matchView} myId={roomState.myId} peerId={peerId} t={t} />}
          <VideoStage localRef={localVideo} remoteRef={remoteVideo} showRemote={phase === 'play' && Boolean(peerId)} focus={focusedCamera(matchView.role)} localLabel={t('you')} remoteLabel={matchView.peerName || t('opponent')} badge={(phase === 'calibration' || matchView.role === 'looker') && direction !== 'neutral' && direction !== 'unknown' ? direction.toUpperCase() : undefined} />
          {phase === 'calibration' && <CalibrationOverlay stage={calibrationStage} progress={calibrationProgress} feedback={calibrationFeedback} t={t} />}
          {phase === 'calibration' && modelStatus === 'loading' && <div className="toast">{t('models')}</div>}
          {modelStatus === 'slow' && <div className="toast warning">{t('slow')}</div>}
          {phase === 'play' && matchView.phase === 'countdown' && matchView.role === 'pointer' && <DirectionPad roundId={matchView.roundId} expired={(countdown ?? 0) <= 0} onChoose={(choice) => match.submitDirection(choice)} t={t} />}
          {phase === 'play' && <MatchOverlay view={matchView} hasRoom={Boolean(roomState?.roomId)} cue={cue} countdown={countdown} myId={roomState?.myId ?? null} peerId={peerId} onRematch={() => match.requestRematch()} t={t} />}
        </>
      )}
      <div className="sr-only" aria-live="assertive">{cue === 'WOAH' ? 'WOAH' : ''}</div>
    </main>
  );
}

function MatchOverlay({ view, hasRoom, cue, countdown, myId, peerId, onRematch, t }: { view: MatchView; hasRoom: boolean; cue: string | null; countdown: number | null; myId: string | null; peerId: string | null; onRematch: () => boolean; t: ReturnType<typeof translator> }) {
  if (view.phase === 'countdown') {
    const progress = Math.max(0, Math.min(1, (countdown ?? 0) / 3000));
    return <div className={`cue ${cue === 'WOAH' ? 'woah' : ''}`}><strong>{view.role === 'pointer' ? t('pointer') : t('looker')}</strong><span>{cue}</span><p>{view.role === 'pointer' ? t('pointerHint') : t('lookerHint')}</p><div className="countdown-track"><i style={{ transform: `scaleX(${progress})` }} /></div></div>;
  }
  if (view.phase === 'judging') {
    const seconds = countdown === null ? null : Math.max(0, Math.ceil((HEAD_RECOGNITION_TIMEOUT_MS + countdown) / 1000));
    return <div className="status-card">{t('judging')}{seconds !== null && seconds > 0 ? ` ${seconds}` : ''}</div>;
  }
  if (view.phase === 'result' || view.phase === 'gameover') {
    const verdict = view.result?.verdict ?? 'void';
    const comparison = resultDirectionComparison(view.result);
    const outcome = view.phase === 'gameover' && myId && peerId ? matchOutcome(view.score, myId, peerId) : null;
    const title = outcome === 'win' ? t('youWin') : outcome === 'lose' ? t('youLose') : outcome === 'draw' ? t('draw') : t(verdict);
    return <div className={`result-card ${verdict}`}><h2>{title}</h2>{view.phase === 'gameover' && <div className="gameover-label">{t('gameover')}</div>}{comparison && <div className="result-comparison" aria-label={`${t('guessLabel')} ${comparison.guess}, ${t('faceLabel')} ${comparison.face}`}><span><small>{t('guessLabel')}</small><b>{comparison.guess}</b></span><strong>{comparison.operator}</strong><span><small>{t('faceLabel')}</small><b>{comparison.face}</b></span></div>}<p>{t(`${verdict}Detail` as 'hitDetail' | 'dodgeDetail' | 'penaltyDetail' | 'voidDetail')}</p>{view.phase === 'gameover' && view.result && <RematchControl localReady={view.rematchLocalReady} peerReady={view.rematchPeerReady} onRematch={onRematch} t={t} />}</div>;
  }
  const key = view.phase === 'connecting' ? 'connecting' : view.phase === 'syncing' ? 'syncing' : view.phase === 'reconnecting' ? 'reconnecting' : view.phase === 'network-error' ? 'networkUnsupported' : !hasRoom ? 'share' : view.peerReady ? 'opponentReady' : 'waiting';
  return <div className="status-card">{t(key)}</div>;
}

function attachRemoteVideo(video: HTMLVideoElement | null, stream: MediaStream) {
  if (!video || video.srcObject === stream) return;
  video.srcObject = stream;
  void video.play().catch(() => undefined);
}

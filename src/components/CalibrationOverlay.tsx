import type { CalibrationFeedback, CalibrationStage } from '../vision/calibration';
import type { MessageKey } from '../i18n';

const keys: Record<Exclude<CalibrationStage, 'complete'>, MessageKey> = {
  neutral: 'neutral', left: 'left', right: 'right', up: 'up', down: 'down',
};

const feedbackKeys: Record<CalibrationFeedback, MessageKey> = {
  searching: 'faceSearching',
  'move-more': 'faceMoveMore',
  hold: 'faceHold',
  recognized: 'faceRecognized',
  restart: 'calibrationRestart',
};

export function CalibrationOverlay({ stage, progress, feedback, t }: { stage: CalibrationStage; progress: number; feedback: CalibrationFeedback; t: (key: MessageKey) => string }) {
  if (stage === 'complete') return <div className="calibration-card success" role="status">{t('calibrated')}</div>;
  const arrow = stage.includes('left') ? '←' : stage.includes('right') ? '→' : stage.includes('up') ? '↑' : stage.includes('down') ? '↓' : '•';
  return (
    <div className="calibration-card" role="status" aria-live="polite">
      <div className="calibration-arrow" aria-hidden="true">{arrow}</div>
      <h2>{t(keys[stage])}</h2>
      <p>{t(feedbackKeys[feedback])}</p>
      <div className="progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
  );
}

import type { CalibrationFeedback, CalibrationStage } from '../vision/calibration';
import type { MessageKey } from '../i18n';

const feedbackKeys: Record<CalibrationFeedback, MessageKey> = {
  searching: 'faceSearching',
  hold: 'faceHold',
  recognized: 'faceRecognized',
  restart: 'calibrationRestart',
};

export function CalibrationOverlay({ stage, progress, feedback, t }: { stage: CalibrationStage; progress: number; feedback: CalibrationFeedback; t: (key: MessageKey) => string }) {
  if (stage === 'complete') return <div className="calibration-card success" role="status">{t('calibrated')}</div>;
  return (
    <div className="calibration-card" role="status" aria-live="polite">
      <div className="calibration-arrow" aria-hidden="true">•</div>
      <h2>{t('neutral')}</h2>
      <p>{t(feedbackKeys[feedback])}</p>
      <div className="progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
    </div>
  );
}

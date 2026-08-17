import type { MessageKey } from '../i18n';

export function RematchControl({ localReady, peerReady, onRematch, t }: {
  localReady: boolean;
  peerReady: boolean;
  onRematch: () => boolean;
  t: (key: MessageKey) => string;
}) {
  return (
    <div className="rematch-control">
      {peerReady && !localReady && <small>{t('rematchOpponentReady')}</small>}
      <button type="button" disabled={localReady} onClick={onRematch}>
        {localReady ? t('rematchWaiting') : t('rematch')}
      </button>
    </div>
  );
}

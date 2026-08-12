import type { MatchView } from '../game/match-controller';
import type { MessageKey } from '../i18n';

export function Scoreboard({ view, myId, peerId, t }: { view: MatchView; myId: string; peerId: string | null; t: (key: MessageKey) => string }) {
  return (
    <div className="scoreboard" aria-label={t('firstTo')}>
      <div><span>{t('you')}</span><strong>{view.score[myId] ?? 0}</strong></div>
      <small>{t('firstTo')}</small>
      <div><span>{view.peerName || t('opponent')}</span><strong>{peerId ? view.score[peerId] ?? 0 : 0}</strong></div>
    </div>
  );
}

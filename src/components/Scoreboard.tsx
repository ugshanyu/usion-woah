import type { MatchView } from '../game/match-controller';
import type { MessageKey } from '../i18n';

export function Scoreboard({ view, myId, peerId, t }: { view: MatchView; myId: string; peerId: string | null; t: (key: MessageKey) => string }) {
  const myScore = view.score[myId] ?? 0;
  const peerScore = peerId ? view.score[peerId] ?? 0 : 0;
  const total = myScore + peerScore;
  const myShare = total === 0 ? 50 : myScore / total * 100;
  return (
    <div className="match-hud">
      <div className={`turn-banner ${view.role ?? ''}`}>{view.role === 'pointer' ? t('yourGuessTurn') : view.role === 'looker' ? t('yourDodgeTurn') : t('preparingTurn')}</div>
      <div className="scoreboard" aria-label={t('firstTo')}>
        <div><span>{t('you')}</span><strong>{myScore}</strong></div>
        <small>{t('firstTo')}</small>
        <div><span>{view.peerName || t('opponent')}</span><strong>{peerScore}</strong></div>
      </div>
      <div className="score-ratio" aria-hidden="true">
        <span className="mine" style={{ width: `${myShare}%` }} />
        <span className="theirs" style={{ width: `${100 - myShare}%` }} />
      </div>
    </div>
  );
}

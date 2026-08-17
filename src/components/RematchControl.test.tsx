import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { translator } from '../i18n';
import { RematchControl } from './RematchControl';

describe('rematch control', () => {
  const t = translator('mn');

  it('lets a player accept the opponent rematch request', () => {
    const markup = renderToStaticMarkup(<RematchControl localReady={false} peerReady onRematch={() => true} t={t} />);
    expect(markup).toContain(t('rematchOpponentReady'));
    expect(markup).toContain(t('rematch'));
    expect(markup).not.toContain('disabled');
  });

  it('locks duplicate requests while waiting for the other player', () => {
    const markup = renderToStaticMarkup(<RematchControl localReady peerReady={false} onRematch={() => true} t={t} />);
    expect(markup).toContain(t('rematchWaiting'));
    expect(markup).toContain('disabled');
  });
});

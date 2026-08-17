import { describe, expect, it } from 'vitest';
import { buildIceServers, parseStunUrls, parseTurnUrls } from './ice-config.mjs';

describe('ICE configuration', () => {
  it('uses the approved public STUN defaults', () => {
    expect(buildIceServers()).toEqual([{
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    }]);
  });

  it('accepts only unique STUN URLs in the STUN list', () => {
    expect(parseStunUrls('turn:relay.example:3478, stun:one.example:3478,stun:one.example:3478,stuns:two.example:5349')).toEqual([
      'stun:one.example:3478',
      'stuns:two.example:5349',
    ]);
  });

  it('builds authenticated TURN fallback without mixing credentials into STUN', () => {
    expect(parseTurnUrls('stun:ignored.example:3478,turn:relay.example:3479?transport=udp,turn:relay.example:3479?transport=udp,turns:relay.example:5349')).toEqual([
      'turn:relay.example:3479?transport=udp',
      'turns:relay.example:5349',
    ]);
    expect(buildIceServers(
      'stun:stun.example:3478',
      'turn:relay.example:3479?transport=udp',
      { username: 'expiry:user-1', credential: 'signed-value' },
    )).toEqual([
      { urls: ['stun:stun.example:3478'] },
      { urls: ['turn:relay.example:3479?transport=udp'], username: 'expiry:user-1', credential: 'signed-value' },
    ]);
  });

  it('does not expose an unauthenticated TURN server', () => {
    expect(buildIceServers('stun:stun.example:3478', 'turn:relay.example:3479')).toEqual([
      { urls: ['stun:stun.example:3478'] },
    ]);
  });
});

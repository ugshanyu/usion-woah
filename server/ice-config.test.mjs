import { describe, expect, it } from 'vitest';
import { buildIceServers, parseStunUrls } from './ice-config.mjs';

describe('STUN-only ICE configuration', () => {
  it('uses the approved public STUN defaults', () => {
    expect(buildIceServers()).toEqual([{
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    }]);
  });

  it('accepts only unique STUN URLs and rejects TURN URLs', () => {
    expect(parseStunUrls('turn:relay.example:3478, stun:one.example:3478,stun:one.example:3478,stuns:two.example:5349')).toEqual([
      'stun:one.example:3478',
      'stuns:two.example:5349',
    ]);
  });
});

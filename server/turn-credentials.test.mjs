import { describe, expect, it } from 'vitest';
import { createTurnCredentials } from './turn-credentials.mjs';

describe('coturn REST credentials', () => {
  it('issues deterministic short-lived HMAC credentials', () => {
    expect(createTurnCredentials('secret', 'user-1', 600, 1_000_000)).toEqual({
      username: '1600:user-1',
      credential: '6oAuOkT6BJJjXpKROj+6zVhPi9I=',
    });
  });

  it('rejects unsafe TTLs and missing identity', () => {
    expect(() => createTurnCredentials('secret', '', 600)).toThrow('invalid_turn_configuration');
    expect(() => createTurnCredentials('secret', 'user-1', 10)).toThrow('invalid_turn_configuration');
  });
});

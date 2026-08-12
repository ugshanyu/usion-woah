import { describe, expect, it, vi } from 'vitest';
import { fetchMeteredIceServers } from './metered-turn.mjs';

const iceServers = [
  { urls: 'stun:global.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:443?transport=tcp', username: 'user', credential: 'password' },
];

describe('Metered TURN credentials', () => {
  it('requests the account-scoped ICE configuration for Asia', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => iceServers });

    await expect(fetchMeteredIceServers({
      domain: 'usion-woah.metered.live',
      apiKey: 'credential-key',
      fetchImpl,
    })).resolves.toEqual(iceServers);

    const [endpoint, options] = fetchImpl.mock.calls[0];
    expect(endpoint).toBeInstanceOf(URL);
    expect(endpoint.origin).toBe('https://usion-woah.metered.live');
    expect(endpoint.pathname).toBe('/api/v1/turn/credentials');
    expect(endpoint.searchParams.get('apiKey')).toBe('credential-key');
    expect(endpoint.searchParams.get('region')).toBe('asia');
    expect(options).toEqual(expect.objectContaining({ headers: { Accept: 'application/json' } }));
  });

  it('rejects domains outside the Metered account namespace', async () => {
    const fetchImpl = vi.fn();
    await expect(fetchMeteredIceServers({
      domain: 'metered.live.attacker.example',
      apiKey: 'credential-key',
      fetchImpl,
    })).rejects.toThrow('invalid_metered_turn_configuration');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects upstream errors and malformed ICE configuration', async () => {
    const unavailable = vi.fn().mockResolvedValue({ ok: false });
    await expect(fetchMeteredIceServers({
      domain: 'usion-woah.metered.live', apiKey: 'credential-key', fetchImpl: unavailable,
    })).rejects.toThrow('metered_turn_unavailable');

    const missingCredential = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ urls: 'stun:relay.example:80' }, { urls: 'turn:relay.example:443' }],
    });
    await expect(fetchMeteredIceServers({
      domain: 'usion-woah.metered.live', apiKey: 'credential-key', fetchImpl: missingCredential,
    })).rejects.toThrow('invalid_metered_turn_response');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchIceServers } from './ice';

afterEach(() => vi.unstubAllGlobals());

describe('ICE configuration', () => {
  it('returns the authenticated STUN-only configuration', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    const iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers, mode: 'stun-only' }) });
    vi.stubGlobal('fetch', request);

    await expect(fetchIceServers('room-1', 'woah-1')).resolves.toEqual(iceServers);
    expect(request).toHaveBeenCalledWith('/api/ice', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer iframe-token' }),
    }));
  });

  it('fails closed when the authenticated ICE endpoint is unavailable', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(fetchIceServers('room-1', 'woah-1')).rejects.toThrow('ice_unavailable');
  });

  it('rejects TURN configuration even if an endpoint returns it', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ iceServers: [{ urls: 'turn:relay.example:3478', username: 'user', credential: 'secret' }] }),
    }));

    await expect(fetchIceServers('room-1', 'woah-1')).rejects.toThrow('ice_unavailable');
  });
});

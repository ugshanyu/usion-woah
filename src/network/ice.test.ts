import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchIceServers } from './ice';

afterEach(() => vi.unstubAllGlobals());

describe('ICE configuration', () => {
  it('returns only the authenticated self-hosted relay configuration', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    const iceServers = [{ urls: ['turn:turn.usions.example:3478'], username: 'user', credential: 'credential' }];
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers }) });
    vi.stubGlobal('fetch', request);

    await expect(fetchIceServers('room-1', 'woah-1')).resolves.toEqual(iceServers);
    expect(request).toHaveBeenCalledWith('/api/ice', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer iframe-token' }),
    }));
  });

  it('fails closed instead of using a public STUN or TURN fallback', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(fetchIceServers('room-1', 'woah-1')).rejects.toThrow('ice_unavailable');
  });
});

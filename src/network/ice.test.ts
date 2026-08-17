import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchIceServers } from './ice';

afterEach(() => vi.unstubAllGlobals());

describe('ICE configuration', () => {
  it('returns authenticated STUN and TURN configuration', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    const iceServers = [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['turn:relay.example:3479?transport=udp'], username: 'expiry:user-1', credential: 'signed-value' },
    ];
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers, mode: 'turn-backed' }) });
    vi.stubGlobal('fetch', request);

    await expect(fetchIceServers('room-1', 'woah-1')).resolves.toEqual(iceServers);
    expect(request).toHaveBeenCalledWith('/api/ice', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer iframe-token' }),
    }));
  });

  it('retries one transient failure before succeeding', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    const iceServers = [
      { urls: ['stun:stun.l.google.com:19302'] },
      { urls: ['turn:relay.example:3479?transport=udp'], username: 'expiry:user-1', credential: 'signed-value' },
    ];
    const request = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ iceServers, mode: 'turn-backed' }) });
    vi.stubGlobal('fetch', request);

    await expect(fetchIceServers('room-1', 'woah-1')).resolves.toEqual(iceServers);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('fails closed when the authenticated ICE endpoint is unavailable', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await expect(fetchIceServers('room-1', 'woah-1')).rejects.toThrow('ice_unavailable');
  });

  it('rejects a STUN-only response so production cannot silently lose relay fallback', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ iceServers: [{ urls: 'stun:stun.example:3478' }] }),
    }));

    await expect(fetchIceServers('room-1', 'woah-1')).rejects.toThrow('ice_unavailable');
  });

  it('rejects TURN URLs without credentials', async () => {
    vi.stubGlobal('Usion', { user: { getToken: () => 'iframe-token' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ iceServers: [{ urls: 'turn:relay.example:3479' }] }),
    }));

    await expect(fetchIceServers('room-1', 'woah-1')).rejects.toThrow('ice_unavailable');
  });
});

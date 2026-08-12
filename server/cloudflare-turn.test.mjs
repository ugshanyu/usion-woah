import { describe, expect, it, vi } from 'vitest';
import { fetchCloudflareIceServers } from './cloudflare-turn.mjs';

describe('Cloudflare TURN credentials', () => {
  it('requests and returns short-lived ICE servers', async () => {
    const iceServers = [{ urls: ['stun:stun.cloudflare.com:3478'] }, { urls: ['turns:turn.cloudflare.com:443'] }];
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers }) });
    await expect(fetchCloudflareIceServers({ keyId: 'key/id', apiToken: 'secret', ttlSeconds: 600, fetchImpl })).resolves.toEqual(iceServers);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://rtc.live.cloudflare.com/v1/turn/keys/key%2Fid/credentials/generate-ice-servers',
      expect.objectContaining({ method: 'POST', body: '{"ttl":600}' }),
    );
  });

  it('rejects missing configuration and malformed upstream responses', async () => {
    await expect(fetchCloudflareIceServers({ keyId: '', apiToken: 'secret', ttlSeconds: 600 })).rejects.toThrow('invalid_cloudflare_turn_configuration');
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers: [] }) });
    await expect(fetchCloudflareIceServers({ keyId: 'key', apiToken: 'secret', ttlSeconds: 600, fetchImpl })).rejects.toThrow('invalid_cloudflare_turn_response');
  });
});

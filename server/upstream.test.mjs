import { describe, expect, it, vi } from 'vitest';
import { postJsonWithRetry } from './upstream.mjs';

const options = { attempts: 3, attemptTimeoutMs: 200, backoffMs: 1 };

describe('upstream verification retries', () => {
  it('returns the parsed body on first success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user_id: 'u1' }) });
    await expect(postJsonWithRetry(fetchImpl, 'https://api/verify', { token: 't' }, options)).resolves.toEqual({ user_id: 'u1' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries a hung or failed connection and then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user_id: 'u1' }) });
    await expect(postJsonWithRetry(fetchImpl, 'https://api/verify', { token: 't' }, options)).resolves.toEqual({ user_id: 'u1' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('retries 5xx responses', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user_id: 'u1' }) });
    await expect(postJsonWithRetry(fetchImpl, 'https://api/verify', { token: 't' }, options)).resolves.toEqual({ user_id: 'u1' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails fast on a definitive rejection without retrying', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    await expect(postJsonWithRetry(fetchImpl, 'https://api/verify', { token: 't' }, options)).rejects.toThrow('invalid_token');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting every attempt', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(postJsonWithRetry(fetchImpl, 'https://api/verify', { token: 't' }, options)).rejects.toThrow('network down');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});

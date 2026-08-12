const API_ROOT = 'https://rtc.live.cloudflare.com/v1/turn/keys';

export async function fetchCloudflareIceServers({ keyId, apiToken, ttlSeconds, fetchImpl = fetch }) {
  if (!keyId || !apiToken || !Number.isFinite(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) {
    throw new Error('invalid_cloudflare_turn_configuration');
  }
  const response = await fetchImpl(
    `${API_ROOT}/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: ttlSeconds }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok) throw new Error('cloudflare_turn_unavailable');
  const payload = await response.json();
  if (!Array.isArray(payload?.iceServers) || payload.iceServers.length < 2) {
    throw new Error('invalid_cloudflare_turn_response');
  }
  return payload.iceServers;
}

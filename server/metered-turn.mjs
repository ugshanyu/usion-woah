const METERED_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.metered\.live$/;

function normalizeUrls(value) {
  const urls = Array.isArray(value) ? value : [value];
  if (!urls.length || urls.some((url) => typeof url !== 'string' || !/^(?:stun|turns?):[^\s]+$/.test(url))) {
    throw new Error('invalid_metered_turn_response');
  }
  return urls;
}

function validateIceServers(payload) {
  if (!Array.isArray(payload) || payload.length < 2 || payload.length > 20) {
    throw new Error('invalid_metered_turn_response');
  }

  let hasStun = false;
  let hasTurn = false;
  for (const server of payload) {
    if (!server || typeof server !== 'object') throw new Error('invalid_metered_turn_response');
    const urls = normalizeUrls(server.urls);
    hasStun ||= urls.some((url) => url.startsWith('stun:'));
    if (urls.some((url) => url.startsWith('turn:') || url.startsWith('turns:'))) {
      if (typeof server.username !== 'string' || !server.username || typeof server.credential !== 'string' || !server.credential) {
        throw new Error('invalid_metered_turn_response');
      }
      hasTurn = true;
    }
  }

  if (!hasStun || !hasTurn) throw new Error('invalid_metered_turn_response');
  return payload;
}

export async function fetchMeteredIceServers({ domain, apiKey, fetchImpl = fetch }) {
  const normalizedDomain = String(domain || '').trim().toLowerCase();
  const normalizedApiKey = String(apiKey || '').trim();
  if (!METERED_DOMAIN.test(normalizedDomain) || !normalizedApiKey || normalizedApiKey.length > 512) {
    throw new Error('invalid_metered_turn_configuration');
  }

  const endpoint = new URL(`https://${normalizedDomain}/api/v1/turn/credentials`);
  endpoint.searchParams.set('apiKey', normalizedApiKey);
  endpoint.searchParams.set('region', 'asia');

  const response = await fetchImpl(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('metered_turn_unavailable');
  return validateIceServers(await response.json());
}

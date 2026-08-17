const ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 13_000;
const RETRY_BACKOFF_MS = 400;

function parseIceServers(payload: { iceServers?: RTCIceServer[] }): RTCIceServer[] {
  if (!Array.isArray(payload.iceServers) || !payload.iceServers.length) throw new Error('ice_unavailable');
  const iceServers: RTCIceServer[] = [];
  let hasTurn = false;
  for (const server of payload.iceServers) {
    const urls = (typeof server.urls === 'string' ? [server.urls] : server.urls)
      .filter((url): url is string => typeof url === 'string' && /^(?:stun|turn)s?:[^\s]+$/i.test(url));
    if (!urls.length) continue;
    const includesTurn = urls.some((url) => /^turns?:/i.test(url));
    if (includesTurn && (typeof server.username !== 'string' || !server.username || typeof server.credential !== 'string' || !server.credential)) continue;
    hasTurn ||= includesTurn;
    iceServers.push({
      urls: [...new Set(urls)].slice(0, 8),
      ...(includesTurn ? { username: server.username, credential: server.credential } : {}),
    });
  }
  if (!iceServers.length || !hasTurn) throw new Error('ice_unavailable');
  return iceServers;
}

export async function fetchIceServers(roomId: string, serviceId: string): Promise<RTCIceServer[]> {
  const deadline = performance.now() + 5000;
  while (!Usion.user.getToken() && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  const token = Usion.user.getToken();
  if (!token) throw new Error('ice_auth_unavailable');
  // The endpoint retries its own upstream verification, but a mobile radio
  // wake-up or a transient 5xx can still drop one request. Retry once before
  // declaring the match unplayable — a single blip must not end the game.
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch('/api/ice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ roomId, serviceId }),
        // The endpoint verifies the service-scoped iframe token with Usion
        // (with internal retries) before issuing credentials; allow for that.
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error('ice_unavailable');
      return parseIceServers(await response.json() as { iceServers?: RTCIceServer[] });
    } catch {
      if (attempt === ATTEMPTS - 1) throw new Error('ice_unavailable');
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }
  }
  throw new Error('ice_unavailable');
}

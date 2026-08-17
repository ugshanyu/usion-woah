export async function fetchIceServers(roomId: string, serviceId: string): Promise<RTCIceServer[]> {
  const deadline = performance.now() + 5000;
  while (!Usion.user.getToken() && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  const token = Usion.user.getToken();
  if (!token) throw new Error('ice_auth_unavailable');
  try {
    const response = await fetch('/api/ice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ roomId, serviceId }),
      // The endpoint verifies the service-scoped iframe token with Usion before
      // issuing credentials. Mobile requests can take more than five seconds
      // while the upstream service wakes or is under load.
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('ice_unavailable');
    const payload = await response.json() as { iceServers?: RTCIceServer[] };
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
  } catch {
    throw new Error('ice_unavailable');
  }
}

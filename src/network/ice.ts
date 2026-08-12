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
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('ice_unavailable');
    const payload = await response.json() as { iceServers?: RTCIceServer[] };
    if (!Array.isArray(payload.iceServers) || !payload.iceServers.length) throw new Error('ice_unavailable');
    const urls = payload.iceServers.flatMap((server) => typeof server.urls === 'string' ? [server.urls] : server.urls)
      .filter((url): url is string => typeof url === 'string' && /^stuns?:[^\s]+$/i.test(url));
    const stunUrls = [...new Set(urls)].slice(0, 8);
    if (!stunUrls.length) throw new Error('ice_unavailable');
    return [{ urls: stunUrls }];
  } catch {
    throw new Error('ice_unavailable');
  }
}

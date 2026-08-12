const FALLBACK_ICE: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

export async function fetchIceServers(roomId: string, serviceId: string): Promise<RTCIceServer[]> {
  const deadline = performance.now() + 5000;
  while (!Usion.user.getToken() && performance.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 100));
  const token = Usion.user.getToken();
  if (!token) return FALLBACK_ICE;
  try {
    const response = await fetch('/api/ice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ roomId, serviceId }),
    });
    if (!response.ok) return FALLBACK_ICE;
    const payload = await response.json() as { iceServers?: RTCIceServer[] };
    return Array.isArray(payload.iceServers) && payload.iceServers.length ? payload.iceServers : FALLBACK_ICE;
  } catch {
    return FALLBACK_ICE;
  }
}

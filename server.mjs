import express from 'express';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIceServers, parseStunUrls } from './server/ice-config.mjs';

const app = express();
const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const apiUrl = String(process.env.USION_API_URL || 'https://mobile.mongolai.mn').replace(/\/$/, '');
const serviceId = process.env.USION_SERVICE_ID || '';
const stunUrls = parseStunUrls(process.env.STUN_URLS);
const issueBuckets = new Map();

if (process.env.NODE_ENV === 'production' && !serviceId) {
  console.error('[FATAL] USION_SERVICE_ID is required in production.');
  process.exit(1);
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));
app.use((_, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://usions.com; connect-src 'self' https://usions.com https://mobile.mongolai.mn wss:; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; frame-ancestors https://usions.com https://*.usions.com");
  next();
});

function allowed(key) {
  const now = Date.now();
  const current = issueBuckets.get(key);
  if (!current || now - current.startedAt > 60_000) {
    if (issueBuckets.size >= 5000) {
      for (const [bucketKey, bucket] of issueBuckets) {
        if (now - bucket.startedAt > 60_000) issueBuckets.delete(bucketKey);
      }
      if (issueBuckets.size >= 5000) issueBuckets.delete(issueBuckets.keys().next().value);
    }
    issueBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 20;
}

function bearer(request) {
  const header = request.get('authorization') || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

async function verifyIdentity(token, expectedServiceId) {
  const response = await fetch(`${apiUrl}/iframe/verify-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, expected_service_id: expectedServiceId }),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('invalid_token');
  return response.json();
}

async function verifyRoom(token, roomId, userId, expectedServiceId) {
  const response = await fetch(`${apiUrl}/games/rooms/${encodeURIComponent(roomId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('invalid_room');
  const room = await response.json();
  const roomServiceId = room.service_id || room.game_id;
  if (roomServiceId !== expectedServiceId || !Array.isArray(room.player_ids) || !room.player_ids.includes(userId)) throw new Error('not_participant');
}

app.get('/health', (_, response) => response.json({
  ok: true,
  iceMode: 'stun-only',
  stunServerCount: stunUrls.length,
  visionMode: 'face-only',
  calibrationMode: 'recognition-driven',
  pointerInput: 'swipe',
}));

app.post('/api/ice', async (request, response) => {
  const token = bearer(request);
  const roomId = typeof request.body?.roomId === 'string' ? request.body.roomId : '';
  const requestedServiceId = typeof request.body?.serviceId === 'string' ? request.body.serviceId : '';
  if (!token || !roomId || roomId.length > 128 || !requestedServiceId || requestedServiceId !== serviceId) return response.status(400).json({ error: 'invalid_request' });
  if (!allowed(request.ip || 'unknown')) return response.status(429).json({ error: 'rate_limited' });
  try {
    const identity = await verifyIdentity(token, serviceId);
    const userId = String(identity.user_id || '');
    if (!userId) throw new Error('invalid_identity');
    await verifyRoom(token, roomId, userId, serviceId);
    response.setHeader('Cache-Control', 'no-store');
    return response.json({ iceServers: buildIceServers(stunUrls.join(',')), mode: 'stun-only' });
  } catch {
    return response.status(403).json({ error: 'forbidden' });
  }
});

app.use(express.static(resolve(root, 'dist'), {
  maxAge: '1h',
  setHeaders(response, path) {
    if (path.endsWith('.html')) response.setHeader('Cache-Control', 'no-store');
    else if (path.includes(`${resolve(root, 'dist', 'assets')}`)) response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

const server = app.listen(port, '0.0.0.0', () => console.log(`[WOAH] listening on ${port}`));

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

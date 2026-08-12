import { createHmac } from 'node:crypto';

export function createTurnCredentials(sharedSecret, userId, ttlSeconds, nowMs = Date.now()) {
  if (!sharedSecret || !userId || !Number.isFinite(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) {
    throw new Error('invalid_turn_configuration');
  }
  const username = `${Math.floor(nowMs / 1000) + ttlSeconds}:${userId}`;
  const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');
  return { username, credential };
}

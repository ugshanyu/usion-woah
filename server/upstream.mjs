// Usion upstream calls with bounded retries. A cold container's first
// outbound request can stall on DNS or a dropped handshake for the full
// timeout; one hung attempt must never cost both players their match.
const RETRIABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export async function postJsonWithRetry(fetchImpl, url, body, {
  attempts = 3,
  attemptTimeoutMs = 3500,
  backoffMs = 300,
} = {}) {
  let lastError = new Error('upstream_unavailable');
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(attemptTimeoutMs),
      });
      if (response.ok) return response.json();
      if (!RETRIABLE_STATUS.has(response.status)) {
        const rejection = new Error('invalid_token');
        rejection.final = true;
        throw rejection;
      }
      lastError = new Error(`upstream_${response.status}`);
    } catch (error) {
      if (error?.final) throw error;
      lastError = error instanceof Error ? error : new Error(String(error));
    }
    if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, backoffMs * (attempt + 1)));
  }
  throw lastError;
}

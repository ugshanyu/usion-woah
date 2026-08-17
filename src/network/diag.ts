// Match diagnostics: buffered breadcrumbs shipped to the game server's
// /api/log so connection failures are debuggable from server logs alone.
// Content is connection metadata only — never frames, tokens, or SDP bodies.
const MAX_LINE_CHARS = 220;
const MAX_BATCH_LINES = 15;
const FLUSH_DELAY_MS = 1000;

const context = { roomId: '', myId: '' };
let buffer: string[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

export function setDiagContext(partial: { roomId?: string | null; myId?: string | null }): void {
  if (partial.roomId) context.roomId = partial.roomId;
  if (partial.myId) context.myId = partial.myId;
}

export function diag(event: string, detail?: unknown): void {
  let line = event;
  if (detail !== undefined) {
    try { line += ` ${JSON.stringify(detail)}`; } catch { line += ' [unserializable]'; }
  }
  line = `${(Date.now() % 1e7).toString().padStart(7, '0')} ${line}`.slice(0, MAX_LINE_CHARS);
  console.info(`[woah] ${line}`);
  buffer.push(line);
  if (buffer.length >= MAX_BATCH_LINES) flush();
  else if (timer === null) timer = setTimeout(flush, FLUSH_DELAY_MS);
}

function flush(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
  if (!buffer.length) return;
  const lines = buffer;
  buffer = [];
  void fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: context.roomId, myId: context.myId, lines }),
    keepalive: true,
  }).catch(() => undefined);
}

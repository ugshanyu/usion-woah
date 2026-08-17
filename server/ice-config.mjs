const DEFAULT_STUN_URLS = [
  'stun:stun.l.google.com:19302',
  'stun:stun1.l.google.com:19302',
];

export function parseStunUrls(value = '') {
  const urls = String(value)
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^stuns?:[^\s]+$/i.test(url));
  return [...new Set(urls.length ? urls : DEFAULT_STUN_URLS)].slice(0, 8);
}

export function parseTurnUrls(value = '') {
  const urls = String(value)
    .split(',')
    .map((url) => url.trim())
    .filter((url) => /^turns?:[^\s]+$/i.test(url));
  return [...new Set(urls)].slice(0, 8);
}

export function buildIceServers(stunValue = '', turnValue = '', credentials = null) {
  const servers = [{ urls: parseStunUrls(stunValue) }];
  const turnUrls = parseTurnUrls(turnValue);
  if (turnUrls.length && credentials?.username && credentials?.credential) {
    servers.push({
      urls: turnUrls,
      username: credentials.username,
      credential: credentials.credential,
    });
  }
  return servers;
}

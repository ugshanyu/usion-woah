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

export function buildIceServers(value = '') {
  return [{ urls: parseStunUrls(value) }];
}

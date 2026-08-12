import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public', 'mediapipe');
const wasmSource = resolve(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');

const assets = [
  {
    file: 'pose_landmarker_lite.task',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a',
  },
  {
    file: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
  },
];

async function exists(path) {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
}

async function digest(path) {
  const contents = await readFile(path);
  return createHash('sha256').update(contents).digest('hex');
}

async function download({ file, url, sha256 }) {
  const target = resolve(publicDir, file);
  if (!(await exists(target))) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download ${file}: HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(target, bytes);
  }
  const actual = await digest(target);
  if (actual !== sha256) throw new Error(`Integrity check failed for ${file}: ${actual}`);
}

await mkdir(publicDir, { recursive: true });
await cp(wasmSource, resolve(publicDir, 'wasm'), { recursive: true, force: true });
await Promise.all(assets.map(download));

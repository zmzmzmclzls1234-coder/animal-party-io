// Downloads Three.js r160 into public/lib so the game does not depend on a CDN at runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'lib');
const out = path.join(dir, 'three.module.js');
const URLS = ['https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', 'https://unpkg.com/three@0.160.0/build/three.module.js'];
if (fs.existsSync(out) && fs.statSync(out).size > 100000) { console.log('three.module.js already present'); process.exit(0); }
fs.mkdirSync(dir, { recursive: true });
for (const u of URLS) {
  try {
    const r = await fetch(u); if (!r.ok) throw new Error(r.status);
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); console.log('downloaded', u); process.exit(0);
  } catch (e) { console.warn('failed', u, e.message); }
}
console.warn('Could not download three.js - the game will load it from the CDN instead.');

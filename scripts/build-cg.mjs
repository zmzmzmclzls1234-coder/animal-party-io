// Builds public/crazygames.zip = the exact package to upload to CrazyGames
// (index.html + lib/three.module.js + any sounds/*.mp3). Runs on Render after fetch-three.
// Zero dependencies: writes a plain "stored" zip.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const files = [['index.html', join(root, 'index.html')]];
if (existsSync(join(root, 'lib', 'three.module.js'))) files.push(['lib/three.module.js', join(root, 'lib', 'three.module.js')]);
else console.warn('build-cg: lib/three.module.js missing - the zip will fall back to the CDN');
const sd = join(root, 'sounds');
if (existsSync(sd)) for (const f of readdirSync(sd)) if (/\.(mp3|ogg|wav)$/i.test(f)) files.push(['sounds/' + f, join(sd, f)]);

const T = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; }
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

const parts = [], central = []; let off = 0;
const d = new Date(), dosT = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), dosD = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
for (const [name, path] of files) {
  const data = readFileSync(path), nm = Buffer.from(name), crc = crc32(data);
  const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
  h.writeUInt16LE(dosT, 10); h.writeUInt16LE(dosD, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
  parts.push(h, nm, data);
  const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
  c.writeUInt16LE(dosT, 12); c.writeUInt16LE(dosD, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28);
  c.writeUInt32LE(off, 42); central.push(c, nm);
  off += 30 + nm.length + data.length;
}
const cd = Buffer.concat(central), e = Buffer.alloc(22);
e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
writeFileSync(join(root, 'crazygames.zip'), Buffer.concat([...parts, cd, e]));
console.log('build-cg: public/crazygames.zip with', files.map(f => f[0]).join(', '));

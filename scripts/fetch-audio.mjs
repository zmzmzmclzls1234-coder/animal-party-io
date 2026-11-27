// Downloads the game's recorded sound effects and music into public/sounds at install time
// (same idea as fetch-three.mjs: the game never hotlinks at runtime).
// Sources are pinned: Kenney packs on GitHub at fixed commits (CC0), Juhani Junkala's
// Retro Game Music Pack (CC0) and Mixkit sound effects (Mixkit Sound Effects Free License).
// If ffmpeg is on the PATH, OGG/WAV files are converted to small mono MP3s (Safari-safe);
// otherwise the originals are kept and the game decodes them itself.
// The game trims silence and normalises loudness after decoding, so files work either way.
// Never fails the install: anything that cannot be fetched falls back to the built-in synth.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sounds');
const GH = 'https://raw.githubusercontent.com/';
const KP = GH + 'KenneyNL/Starter-Kit-3D-Platformer/3fa8a04b1c01ab23db43123d4ce814a34c3fc7f0/sounds/';
const KF = GH + 'KenneyNL/Starter-Kit-FPS/185fd2326d74a5cf858cffc616f87cf9696f9cc0/sounds/';
const KM = GH + 'KenneyNL/Starter-Kit-Match-3/4ddb3d2a50cbf247c79cafe9e7884d7d8f99c012/sounds/';
const KI = GH + 'Calinou/kenney-interface-sounds/4596a49eaf5a533948d49a47467f606bcdea70ff/addons/kenney_interface_sounds/';
const JJ = GH + 'ensisoft/gamestudio/4334bd129b07f5fc488fb481afd54f2d7a6cab1c/editor/dist/demos/blast/music/junkala/Juhani%20Junkala%20%5BRetro%20Game%20Music%20Pack%5D%20';
const MX = id => `https://assets.mixkit.co/active_storage/sfx/${id}/${id}-preview.mp3`;

// [cue, source url, gain (0..1, applied in game), max seconds]
export const SFX = [
  ['click', KI + 'click_002.wav', 0.55], ['click', KI + 'click_003.wav', 0.55],
  ['hover', KI + 'tick_002.wav', 0.25], ['open', KI + 'maximize_006.wav', 0.45], ['close', KI + 'minimize_006.wav', 0.4],
  ['tab', KI + 'switch_002.wav', 0.45], ['error', KI + 'error_006.wav', 0.5], ['join', KI + 'confirmation_002.wav', 0.6], ['tick', KI + 'tick_004.wav', 0.6],
  ['jump', MX(2043), 0.45], ['jump', KP + 'jump.ogg', 0.5], ['djump', MX(2648), 0.45],
  ['land', KP + 'land.ogg', 0.5], ['land', KF + 'land.ogg', 0.5],
  ['dash', MX(1461), 0.55], ['dash', MX(1469), 0.55], ['whoosh', MX(2607), 0.5], ['whoosh', MX(1471), 0.5],
  ['hit', MX(2155), 0.8], ['hit', MX(2153), 0.8], ['hit', MX(2143), 0.8], ['ko', MX(746), 0.85], ['ko', MX(2050), 0.85],
  ['pop', MX(2364), 0.55], ['pop', MX(2358), 0.55], ['coin', KP + 'coin.ogg', 0.55], ['coin', MX(2069), 0.5],
  ['eat', MX(117), 0.6, 0.6], ['eat', KM + 'tile-match.ogg', 0.6],
  ['boom', MX(1694), 0.9, 1.6], ['boom', MX(1693), 0.9, 1.6], ['shoot', KF + 'blaster_repeater.ogg', 0.35], ['shoot', MX(1670), 0.35, 0.6],
  ['splat', MX(2889), 0.65], ['splat', MX(2884), 0.65], ['go', MX(269), 0.7], ['win', MX(2068), 0.75, 3], ['lose', MX(2876), 0.7], ['lose', MX(473), 0.6, 2.5],
  ['item', MX(254), 0.65], ['boost', MX(3164), 0.55, 1.5], ['fall', MX(395), 0.6, 2], ['fall', MX(406), 0.6, 1.5], ['checkpoint', MX(600), 0.6, 2],
  ['summit', MX(555), 0.75, 4.5], ['zap', MX(2365), 0.6], ['zap', MX(1514), 0.6], ['reload', KF + 'weapon_change.ogg', 0.5], ['boing', MX(2894), 0.6],
  ['splash', MX(1311), 0.55], ['crate', KP + 'break.ogg', 0.6], ['cheer', MX(459), 0.55, 4], ['bite', KM + 'tile-swap.ogg', 0.5],
];
export const MUSIC = [['lobby', JJ + 'Title%20Screen.ogg'], ['climb', JJ + 'Level%201.ogg'], ['party', JJ + 'Level%202.ogg'], ['battle', JJ + 'Level%203.ogg']];

const local = process.env.AUDIO_LOCAL;   // tests: map GitHub URLs onto local clones
async function get(u) {
  if (local && u.startsWith(GH)) {
    const [owner, repo, , ...rest] = u.slice(GH.length).split('/');
    const p = path.join(local, decodeURIComponent(repo), ...rest.map(decodeURIComponent));
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 20000);
  try { const r = await fetch(u, { signal: ac.signal, headers: { 'User-Agent': 'animal-party-build' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); }
  finally { clearTimeout(t); }
}
let ffStatic = null; try { ffStatic = (await import('ffmpeg-static')).default; } catch { }
const ff = [process.env.FFMPEG, ffStatic, 'ffmpeg'].filter(Boolean).find(bin => { try { return spawnSync(bin, ['-version']).status === 0; } catch { return false; } }) || null;
function toMp3(src, dst, music) {
  const af = music ? 'loudnorm=I=-18:TP=-1.5' : 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse';
  const args = ['-y', '-loglevel', 'error', '-i', src, '-af', af, '-ar', '44100', '-ac', music ? '2' : '1', '-b:a', music ? '96k' : '64k', dst];
  return spawnSync(ff, args).status === 0 && fs.existsSync(dst) && fs.statSync(dst).size > 200;
}

const manifest = { v: 1, cues: {}, music: {}, files: [] };
const mf = path.join(out, 'manifest.json');
if (fs.existsSync(mf) && !process.env.AUDIO_FORCE) {
  try { const m = JSON.parse(fs.readFileSync(mf, 'utf8')); if (m.v === 1 && m.files.length >= SFX.length - 4 && m.files.every(f => fs.existsSync(path.join(out, f.f)))) { console.log('fetch-audio: sounds already present'); process.exit(0); } } catch { }
}
fs.mkdirSync(out, { recursive: true });
const tmp = path.join(out, '.tmp'); fs.mkdirSync(tmp, { recursive: true });
const count = {};
async function one(cue, url, music, gain, max) {
  const n = (count[cue] = (count[cue] || 0) + 1), ext = path.extname(new URL(url).pathname).toLowerCase() || '.mp3';
  const base = music ? 'mus_' + cue : `${cue}_${n}`;
  const buf = await get(url);
  let file = base + ext;
  if (ff && ext !== '.mp3') { const s = path.join(tmp, base + ext); fs.writeFileSync(s, buf); if (toMp3(s, path.join(out, base + '.mp3'), music)) file = base + '.mp3'; else fs.writeFileSync(path.join(out, file), buf); }
  else fs.writeFileSync(path.join(out, file), buf);
  const bytes = fs.statSync(path.join(out, file)).size;
  manifest.files.push({ f: file, cue, src: url, srcBytes: buf.length, bytes });
  if (music) manifest.music[cue] = { f: file };
  else (manifest.cues[cue] = manifest.cues[cue] || []).push({ f: file, g: gain, max: max || 2.2 });
}
const jobs = SFX.map(([c, u, g, m]) => [c, u, false, g, m]).concat(MUSIC.map(([c, u]) => [c, u, true, 1]));
let ok = 0, bad = 0;
for (let i = 0; i < jobs.length; i += 6) {
  const res = await Promise.allSettled(jobs.slice(i, i + 6).map(j => one(...j)));
  res.forEach((r, k) => { if (r.status === 'fulfilled') ok++; else { bad++; console.warn('fetch-audio: failed', jobs[i + k][1], r.reason && r.reason.message); } });
}
fs.rmSync(tmp, { recursive: true, force: true });
// keep the cue order stable regardless of download order
for (const c in manifest.cues) manifest.cues[c].sort((a, b) => a.f.localeCompare(b.f, 'en', { numeric: true }));
fs.writeFileSync(mf, JSON.stringify(manifest));
console.log(`fetch-audio: ${ok} files ready, ${bad} failed${ff ? ' (ffmpeg mp3)' : ' (originals)'}`);

// Downloads the game fonts (Titan One + Fredoka) into public/fonts so the game
// never depends on Google Fonts at runtime (works offline, inside CrazyGames, behind firewalls).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'fonts');
const CSS_URL = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Titan+One&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
if (fs.existsSync(path.join(dir, 'fonts.css'))) { console.log('fonts already present'); process.exit(0); }
try {
  let css = await (await fetch(CSS_URL, { headers: { 'user-agent': UA } })).text();
  // keep only latin + latin-ext subsets (the game text is English)
  const blocks = css.split('/* ').filter(b => /^latin(-ext)? \*\//.test(b)).map(b => '/* ' + b);
  if (!blocks.length) throw new Error('unexpected CSS');
  fs.mkdirSync(dir, { recursive: true });
  let out = '', n = 0;
  for (let b of blocks) {
    const m = b.match(/url\((https:[^)]+\.woff2)\)/); if (!m) continue;
    const name = `f${n++}.woff2`;
    fs.writeFileSync(path.join(dir, name), Buffer.from(await (await fetch(m[1])).arrayBuffer()));
    out += b.replace(m[1], name);
  }
  fs.writeFileSync(path.join(dir, 'fonts.css'), out);
  console.log('downloaded', n, 'font files');
} catch (e) { console.warn('Could not download fonts - the game will load them from Google Fonts instead.', e.message); }

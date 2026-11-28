// Writes public/words.txt: the English word list Hangman and Doodle Guess use to check and guess words.
// Source: the dictionary-en package (Hunspell en_US, MIT/BSD-style SCOWL license). Lowercase words of 3-10 letters,
// front-coded (each word = how many letters it shares with the previous one + the rest) so the file stays small.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public', 'words.txt');
const dic = path.join(root, 'node_modules', 'dictionary-en', 'index.dic');
if (!fs.existsSync(dic)) { console.warn('build-words: dictionary-en not installed, keeping', fs.existsSync(out) ? 'the old words.txt' : 'no word list (the game falls back to its built-in list)'); process.exit(0); }
const BAD = new Set('nigger nigga faggot fag cunt whore slut bitch rape rapist retard spic kike chink dyke tranny twat cock dick pussy penis vagina anus anal dildo porn sex fuck shit piss'.split(' '));
const words = new Set();
for (const line of fs.readFileSync(dic, 'utf8').split('\n').slice(1)) {
  const w = line.split('/')[0].trim();
  if (/^[a-z]{3,10}$/.test(w) && !BAD.has(w)) words.add(w);
}
const list = [...words].sort();
let prev = '', s = '';
for (const w of list) { let k = 0; while (k < prev.length && k < w.length && k < 9 && prev[k] === w[k]) k++; s += k + w.slice(k); prev = w; }
fs.writeFileSync(out, s);
console.log('build-words:', list.length, 'words,', s.length, 'bytes -> public/words.txt');

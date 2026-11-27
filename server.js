// ANIMAL PARTY.io server — static hosting + WebSocket party relay (no dependencies)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUB = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, 'public'));
const PARTY_MAX = 5;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.txt': 'text/plain', '.zip': 'application/zip', '.mp4': 'video/mp4', '.webm': 'video/webm' };

// ---------------- HTTP ----------------
const server = http.createServer((req, res) => {
  let u = '/';
  try { u = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { }
  if (u === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (u === '/stats') { res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ online: clients.size, rooms: parties.size })); }
  if (u.endsWith('/')) u += 'index.html';
  const file = path.normalize(path.join(PUB, u));
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600', 'access-control-allow-origin': '*' });
    res.end(data);
  });
});

// ---------------- minimal WebSocket ----------------
const clients = new Set();
let nextId = 1;
const newId = () => 'p' + (nextId++).toString(36) + crypto.randomBytes(2).toString('hex');

class Client {
  constructor(sock) {
    this.sock = sock; this.id = newId(); this.buf = Buffer.alloc(0); this.frag = null; this.alive = true; this.party = null; this.profile = null; this.rate = 0; this.closed = false;
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => this.onClose());
    clients.add(this);
    this.send({ t: 'hello', id: this.id, event: liveEvent(), gift: lastGift });
  }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    if (this.buf.length > 4e6) return this.close();
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0], b1 = this.buf[1], fin = (b0 & 0x80) !== 0, op = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; if (this.buf.readUInt32BE(2)) return this.close(); len = this.buf.readUInt32BE(6); off = 10; }
      if (len > 2e6) return this.close();
      const mlen = masked ? 4 : 0;
      if (this.buf.length < off + mlen + len) return;
      let payload = this.buf.subarray(off + mlen, off + mlen + len);
      if (masked) { const mask = this.buf.subarray(off, off + 4); payload = Buffer.from(payload); for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]; }
      this.buf = this.buf.subarray(off + mlen + len);
      if (op === 0x8) return this.close();
      if (op === 0x9) { this.raw(0xA, payload); continue; }
      if (op === 0xA) { this.alive = true; continue; }
      if (op === 0x1 || op === 0x2) { if (fin) this.onMsg(payload.toString('utf8')); else this.frag = [Buffer.from(payload)]; }
      else if (op === 0x0 && this.frag) { this.frag.push(Buffer.from(payload)); if (fin) { const m = Buffer.concat(this.frag).toString('utf8'); this.frag = null; this.onMsg(m); } }
    }
  }
  raw(op, data, drop) {
    if (this.sock.destroyed) return;
    if (drop && this.sock.writableLength > 256 * 1024) return;   // backpressure: skip stale snapshots for slow clients
    const len = data.length; let h;
    if (len < 126) h = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(len, 6); }
    try { this.sock.write(Buffer.concat([h, data])); } catch (e) { }
  }
  send(o, drop) { this.raw(0x1, Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)), drop); }
  close() { try { this.raw(0x8, Buffer.alloc(0)); } catch (e) { } this.sock.destroy(); this.onClose(); }
  onClose() { if (this.closed) return; this.closed = true; clients.delete(this); leaveParty(this); }
  onMsg(s) {
    if (++this.rate > 600) return; // flood guard (per second)
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    if (m && typeof m === 'object') handle(this, m);
  }
}
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  sock.setNoDelay(true);
  const cl = new Client(sock); cl.ip = String(req.headers['x-forwarded-for'] || sock.remoteAddress || '').split(',')[0].trim();
});
setInterval(() => { for (const c of clients) c.rate = 0; }, 1000);
setInterval(() => { for (const c of clients) { if (!c.alive) { c.close(); continue; } c.alive = false; c.raw(0x9, Buffer.alloc(0)); } }, 15000);

// ---------------- parties ----------------
const parties = new Map();
const ANIMALS = ['cat', 'dog', 'panda', 'rabbit', 'fox'];
function makeCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s; do { s = ''; for (let i = 0; i < 5; i++) s += A[crypto.randomInt(A.length)]; } while (parties.has(s)); return s; }
const str = (v, n, d) => String(v == null ? d : v).replace(/[<>"'&]/g, '').slice(0, n) || d;
function cleanProfile(p) {
  p = p || {};
  return { name: str(p.name, 12, 'Player'), animal: ANIMALS.includes(p.animal) ? p.animal : 'cat', color: Number.isInteger(p.color) ? p.color : null, hat: str(p.hat, 16, 'none'), face: str(p.face, 16, 'none'), back: str(p.back, 16, 'none') };
}
function partyState(p) { return { code: p.code, leader: p.leader, pub: !!p.pub, show: p.show || null, inMatch: !!p.inMatch, startIn: p.pub && !p.inMatch ? Math.max(0, p.startAt - Date.now()) : null, members: p.members.map(c => ({ id: c.id, profile: c.profile })) }; }
// ---- Admin tools (set ADMIN_KEY on Render to enable) ----
const ADMIN_KEY = process.env.ADMIN_KEY || '';
let event = null, lastGift = null; const badTries = new Map();
const liveEvent = () => (event && event.until > Date.now() ? event : null);
function toAll(obj) { const s = JSON.stringify(obj); for (const c of clients) c.send(s); }
function adminCmd(c, m) {
  const ip = c.ip || 'x', bt = badTries.get(ip) || { n: 0, t: 0 };
  if (bt.n >= 5 && Date.now() - bt.t < 10 * 60e3) return c.send({ t: 'admin', ok: false, msg: 'Too many wrong keys. Try again later.' });
  if (!ADMIN_KEY) return c.send({ t: 'admin', ok: false, msg: 'Admin is disabled: set ADMIN_KEY on the server.' });
  if (typeof m.key !== 'string' || m.key !== ADMIN_KEY) { badTries.set(ip, { n: bt.n + 1, t: Date.now() }); return c.send({ t: 'admin', ok: false, msg: 'Wrong admin key' }); }
  badTries.delete(ip);
  const txt = v => String(v || '').replace(/[<>]/g, '').slice(0, 140);
  switch (m.op) {
    case 'login': break;
    case 'shout': if (txt(m.text)) toAll({ t: 'shout', text: txt(m.text), name: txt(m.name).slice(0, 16) || 'ADMIN' }); break;
    case 'event': {
      const cm = Math.min(10, Math.max(1, +m.coinMul || 1)), xm = Math.min(10, Math.max(1, +m.xpMul || 1)), min = Math.min(24 * 60, Math.max(1, +m.minutes || 15));
      event = { title: txt(m.title) || `${cm}x COINS EVENT`, coinMul: cm, xpMul: xm, until: Date.now() + min * 60e3 };
      toAll({ t: 'event', event }); break;
    }
    case 'stopEvent': event = null; toAll({ t: 'event', event: null }); break;
    case 'gift': {
      const coins = Math.min(100000, Math.max(1, Math.floor(+m.coins || 0)));
      lastGift = { id: Date.now().toString(36), coins, text: txt(m.text) || 'A gift from the admin!', until: Date.now() + 30 * 60e3 };
      toAll({ t: 'gift', gift: lastGift }); break;
    }
    default: return c.send({ t: 'admin', ok: false, msg: 'Unknown command' });
  }
  c.send({ t: 'admin', ok: true, op: m.op, online: clients.size, rooms: parties.size, event: liveEvent() });
}
// ---- Quick Play: public rooms of strangers, bots fill the empty seats ----
const PUB_MAX = 6, PUB_WAIT = 3000, PUB_JOIN_GRACE = 0, PUB_MAX_WAIT = 3000;   // wait 3 s for real players, then fill the rest
function quickJoin(c, show) {
  const now = Date.now();
  let best = null;
  for (const p of parties.values()) if (p.pub && !p.inMatch && p.show === show && p.members.length < PUB_MAX && (!best || p.members.length > best.members.length)) best = p;
  if (best) {
    best.members.push(c); c.party = best;
    best.startAt = best.members.length >= PUB_MAX ? Math.min(best.startAt, now + 2500) : Math.min(best.created + PUB_MAX_WAIT, Math.max(best.startAt, now + PUB_JOIN_GRACE));
    broadcastParty(best);
  } else {
    const p = { code: makeCode(), leader: c.id, members: [c], pub: true, show, created: now, startAt: now + PUB_WAIT };
    parties.set(p.code, p); c.party = p; broadcastParty(p);
  }
}
setInterval(() => {
  const now = Date.now();
  for (const p of parties.values()) if (p.pub && !p.inMatch && now >= p.startAt) {
    p.inMatch = true; broadcastParty(p);
    const msg = JSON.stringify({ t: 'start' }); for (const c of p.members) c.send(msg);
  }
}, 200);
function broadcastParty(p) { const msg = JSON.stringify({ t: 'party', party: partyState(p) }); for (const c of p.members) c.send(msg); }
function leaveParty(c) {
  const p = c.party; if (!p) return;
  p.members = p.members.filter(x => x !== c); c.party = null;
  if (!p.members.length) { parties.delete(p.code); return; }
  if (p.leader === c.id) p.leader = p.members[0].id;
  broadcastParty(p);
}
function handle(c, m) {
  switch (m.t) {
    case 'create': {
      leaveParty(c); c.profile = cleanProfile(m.profile);
      const p = { code: makeCode(), leader: c.id, members: [c] }; parties.set(p.code, p); c.party = p; broadcastParty(p);
      break;
    }
    case 'join': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const p = parties.get(code);
      if (!p) return c.send({ t: 'error', msg: 'Party not found' });
      if (p === c.party) return broadcastParty(p);
      if (p.members.length >= (p.pub ? PUB_MAX : PARTY_MAX)) return c.send({ t: 'error', msg: 'That party is full' });
      if (p.pub && p.inMatch) return c.send({ t: 'error', msg: 'That match already started' });
      leaveParty(c); c.profile = cleanProfile(m.profile); p.members.push(c); c.party = p; broadcastParty(p);
      break;
    }
    case 'quick': leaveParty(c); c.profile = cleanProfile(m.profile); quickJoin(c, /^[a-z]{3,8}$/.test(m.show) ? m.show : 'main'); break;
    case 'leave': leaveParty(c); break;
    case 'admin': adminCmd(c, m); break;
    case 'profile': if (c.party) { c.profile = cleanProfile(m.profile); broadcastParty(c.party); } break;
    case 'relay': {
      const p = c.party; if (!p) return;
      const out = JSON.stringify({ t: 'relay', from: c.id, d: m.d });
      if (out.length > 300000) return;
      const drop = !!(m.d && m.d.k === 's');   // world snapshots are replaced by the next one
      if (m.to === 'all') { for (const x of p.members) if (x !== c) x.send(out, drop); }
      else if (m.to === 'host') { const h = p.members.find(x => x.id === p.leader); if (h && h !== c) h.send(out); }
      else { const x = p.members.find(x => x.id === m.to); if (x && x !== c) x.send(out); }
      break;
    }
  }
}

server.listen(PORT, () => console.log(`ANIMAL PARTY.io server on :${PORT} (serving ${PUB})`));

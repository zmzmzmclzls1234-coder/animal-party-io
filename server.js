// ANIMAL PARTY.io server — static hosting + WebSocket party relay (no dependencies)
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUB = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, 'public'));
const PARTY_MAX = 5;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.txt': 'text/plain' };

// ---------------- HTTP ----------------
const server = http.createServer((req, res) => {
  let u = '/';
  try { u = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { }
  if (u === '/health') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (u === '/stats') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ clients: clients.size, parties: parties.size })); }
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
    this.send({ t: 'hello', id: this.id });
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
  raw(op, data) {
    if (this.sock.destroyed) return;
    const len = data.length; let h;
    if (len < 126) h = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = 0x80 | op; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeUInt32BE(0, 2); h.writeUInt32BE(len, 6); }
    try { this.sock.write(Buffer.concat([h, data])); } catch (e) { }
  }
  send(o) { this.raw(0x1, Buffer.from(typeof o === 'string' ? o : JSON.stringify(o))); }
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
  new Client(sock);
});
setInterval(() => { for (const c of clients) c.rate = 0; }, 1000);
setInterval(() => { for (const c of clients) { if (!c.alive) { c.close(); continue; } c.alive = false; c.raw(0x9, Buffer.alloc(0)); } }, 25000);

// ---------------- parties ----------------
const parties = new Map();
const ANIMALS = ['cat', 'dog', 'panda', 'rabbit', 'fox'];
function makeCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s; do { s = ''; for (let i = 0; i < 5; i++) s += A[crypto.randomInt(A.length)]; } while (parties.has(s)); return s; }
const str = (v, n, d) => String(v == null ? d : v).replace(/[<>"'&]/g, '').slice(0, n) || d;
function cleanProfile(p) {
  p = p || {};
  return { name: str(p.name, 12, 'Player'), animal: ANIMALS.includes(p.animal) ? p.animal : 'cat', color: Number.isInteger(p.color) ? p.color : null, hat: str(p.hat, 16, 'none'), face: str(p.face, 16, 'none'), back: str(p.back, 16, 'none') };
}
function partyState(p) { return { code: p.code, leader: p.leader, members: p.members.map(c => ({ id: c.id, profile: c.profile })) }; }
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
      if (p.members.length >= PARTY_MAX) return c.send({ t: 'error', msg: 'That party is full (5 max)' });
      leaveParty(c); c.profile = cleanProfile(m.profile); p.members.push(c); c.party = p; broadcastParty(p);
      break;
    }
    case 'leave': leaveParty(c); break;
    case 'profile': if (c.party) { c.profile = cleanProfile(m.profile); broadcastParty(c.party); } break;
    case 'relay': {
      const p = c.party; if (!p) return;
      const out = JSON.stringify({ t: 'relay', from: c.id, d: m.d });
      if (out.length > 300000) return;
      if (m.to === 'all') { for (const x of p.members) if (x !== c) x.send(out); }
      else if (m.to === 'host') { const h = p.members.find(x => x.id === p.leader); if (h && h !== c) h.send(out); }
      else { const x = p.members.find(x => x.id === m.to); if (x && x !== c) x.send(out); }
      break;
    }
  }
}

server.listen(PORT, () => console.log(`ANIMAL PARTY.io server on :${PORT} (serving ${PUB})`));

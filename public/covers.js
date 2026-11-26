// ANIMAL PARTY.io - cover image + preview video generator.
// Open  /index.html?covers  in Chrome. Not part of the CrazyGames upload.
const { THREE, renderer, scene, camera, makeBean, Particles, floaters } = window.AP;
document.documentElement.style.overflow = 'auto';

const INK = '#1b0f3a';
const CAST = [
  { animal: 'cat', color: null, hat: 'party', face: 'none', back: 'none' },
  { animal: 'dog', color: null, hat: 'crown', face: 'sunglasses', back: 'none' },
  { animal: 'panda', color: null, hat: 'beanie', face: 'glasses', back: 'backpack' },
  { animal: 'rabbit', color: null, hat: 'flower', face: 'heart', back: 'wings' },
  { animal: 'fox', color: null, hat: 'tophat', face: 'none', back: 'cape' },
];
// stage spots: [x, y, z, yaw, scale]
const SPOTS = [[0, 0, 0.2, 0, 1.05], [-1.55, 0, -0.5, 0.35, 0.95], [1.55, 0, -0.5, -0.35, 0.95], [-2.85, -0.45, -1.35, 0.5, 0.9], [2.85, -0.45, -1.35, -0.5, 0.9]];
const ORDER = [0, 3, 1, 2, 4]; // CAST index placed on each spot (cat center, bunny & dog beside, panda & fox outside)
const beans = SPOTS.map((s, i) => {
  const b = makeBean(CAST[ORDER[i]]); b.root.position.set(s[0], s[1], s[2]); b.root.rotation.y = s[3]; b.root.scale.setScalar(s[4]);
  b.phase = i * 1.3; b.t = i * 0.7; scene.add(b.root); return b;
});

const LAYOUTS = {
  landscape: { W: 1920, H: 1080, fov: 34, cam: [0, 1.75, 9.6], look: [0, 1.25, -0.4], title: { y: 0.15, size: 190, rot: -3 } },
  portrait: { W: 800, H: 1200, fov: 50, cam: [0, 1.6, 9.8], look: [0, 0.6, -0.4], title: { y: 0.13, size: 118, rot: -4, split: true } },
  square: { W: 800, H: 800, fov: 44, cam: [0, 1.7, 9.3], look: [0, 0.95, -0.4], title: { y: 0.14, size: 104, rot: -3, split: true } },
  vlandscape: { W: 1920, H: 1080, fov: 34, cam: [0, 1.75, 9.6], look: [0, 1.25, -0.4], title: { y: 0.15, size: 190, rot: -3 } },
  vportrait: { W: 1080, H: 1620, fov: 50, cam: [0, 1.6, 9.8], look: [0, 0.6, -0.4], title: { y: 0.13, size: 160, rot: -4, split: true } },
};

function drawTitle(g, L, W, H, pulse = 1) {
  const T = L.title, size = T.size * pulse;
  g.save(); g.translate(W / 2, H * T.y + size * 0.4); g.rotate(T.rot * Math.PI / 180);
  const lines = T.split ? [['ANIMAL', ''], ['PARTY', '.io']] : [['ANIMAL PARTY', '.io']];
  const lh = size * 0.95, y0 = -(lines.length - 1) * lh / 2;
  lines.forEach(([main, tail], i) => {
    const fs = size, fs2 = size * 0.62;
    g.font = `${fs}px "Titan One"`; const w1 = g.measureText(main).width; g.font = `${fs2}px "Titan One"`; const w2 = tail ? g.measureText(tail).width + fs * 0.04 : 0;
    let x = -(w1 + w2) / 2; const y = y0 + i * lh;
    const seg = (txt, f, col, xx) => {
      g.font = `${f}px "Titan One"`; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.fillStyle = INK; g.fillText(txt, xx, y + size * 0.09);                    // drop
      g.strokeStyle = INK; g.lineWidth = size * 0.17; g.strokeText(txt, xx, y);    // outline
      g.fillStyle = col; g.fillText(txt, xx, y);
      g.save(); g.globalAlpha = 0.35; g.fillStyle = '#fff'; g.beginPath(); g.rect(xx, y - f * 0.42, g.measureText(txt).width, f * 0.16); g.clip(); g.fillText(txt, xx, y); g.restore();
    };
    seg(main, fs, '#ffd21f', x);
    if (tail) seg(tail, fs2, '#ff5fb7', x + w1 + fs * 0.04);
  });
  g.restore();
}

let out = null, og = null;
function setup(L) {
  renderer.setPixelRatio(1); renderer.setSize(L.W, L.H, false);
  camera.fov = L.fov; camera.aspect = L.W / L.H; camera.updateProjectionMatrix();
  out = document.createElement('canvas'); out.width = L.W; out.height = L.H; og = out.getContext('2d');
}
function frame(L, camOff = [0, 0, 0], pulse = 1) {
  camera.position.set(L.cam[0] + camOff[0], L.cam[1] + camOff[1], L.cam[2] + camOff[2]);
  camera.lookAt(L.look[0], L.look[1], L.look[2]);
  renderer.render(scene, camera);
  og.clearRect(0, 0, L.W, L.H); og.drawImage(renderer.domElement, 0, 0, L.W, L.H);
  drawTitle(og, L, L.W, L.H, pulse);
}
function animStep(dt, t) {
  beans.forEach((b, i) => { b.animate(dt, 0, b.jumpT > 0); if (b.jumpT === 0 && b.wasAir) { b.land(); b.wasAir = false; } if (b.jumpT > 0) b.wasAir = true; });
  for (const f of floaters) { f.m.rotation.x += f.sx * dt; f.m.rotation.y += f.sy * dt; f.m.position.y = f.y0 + Math.sin(t * 0.8 + f.ph) * 0.3; }
  Particles.update(dt);
}
const CONF = [0xff4f8b, 0xffd21f, 0x3aa0ff, 0x3ddc84, 0xa06bff, 0xffffff];
function posePeak() { // center jumps, others cheer
  Particles.clear();
  for (let k = 0; k < 40; k++) animStep(1 / 30, k / 30);
  beans[0].hop(); beans[0].animate(0.3, 0, true);
  beans.slice(1).forEach(b => { b.arms[0].rotation.z = -1.25; b.arms[1].rotation.z = 1.25; });
  Particles.burst(0, 2.2, 0, CONF, 140, 9, 0.12, 6, 3); for (let k = 0; k < 14; k++) Particles.update(1 / 30);
}

async function still(name) {
  await document.fonts.load('100px "Titan One"');
  const L = LAYOUTS[name]; setup(L); posePeak(); frame(L);
  return out.toDataURL('image/png');
}

async function video(name, onProg) {
  await document.fonts.load('100px "Titan One"');
  const L = LAYOUTS[name]; setup(L); posePeak(); frame(L);
  const types = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const type = types.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
  const stream = out.captureStream(30), rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 }), chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  rec.start(500);
  const DUR = 18, t0 = performance.now(); let last = t0, nextHop = 1.4, hopI = 1;
  await new Promise(res => {
    const tick = now => {
      const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (t >= DUR) return res();
      if (t > 1) {                                                    // first second = static cover frame
        animStep(dt, t);
        if (t > nextHop) {
          const b = beans[hopI % beans.length], p = b.root.position; b.hop();
          Particles.burst(p.x, p.y + 1.6, p.z, CONF, 50, 7, 0.1, 2.5, 9);
          hopI = (hopI + 1 + (hopI % 3 === 0 ? 1 : 0)); nextHop = t + (hopI % 5 === 0 ? 1.1 : 0.7);
          if (hopI % 6 === 0) { beans.forEach(bb => bb.hop()); Particles.burst(0, 2.4, 0, CONF, 160, 10, 0.12, 4, 4); }
        }
      }
      const k = Math.max(0, t - 1) / (DUR - 1), ang = Math.sin(k * Math.PI * 1.5) * 0.32, r = L.cam[2] - Math.sin(k * Math.PI) * 1.2;
      const off = [Math.sin(ang) * r - L.cam[0], Math.sin(k * 6) * 0.15, Math.cos(ang) * r - L.cam[2]];
      const pulse = 1 + Math.max(0, Math.sin((t - 1) * 1.8)) * 0.025 * (t > 1 ? 1 : 0);
      frame(L, off, pulse);
      if (onProg) onProg(t / DUR);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop(); await done;
  return { blob: new Blob(chunks, { type: type.split(';')[0] }), ext: type.startsWith('video/mp4') ? 'mp4' : 'webm' };
}

// ---------- UI ----------
const ui = document.createElement('div'); ui.id = 'coverUI';
ui.style.cssText = 'position:relative;padding:24px;color:#fff;font-family:Fredoka,system-ui,sans-serif;display:flex;flex-direction:column;gap:18px;user-select:text;-webkit-user-select:text';
ui.innerHTML = `<h1 style="font-family:'Titan One';margin:0">ANIMAL PARTY.io - CrazyGames covers</h1>
<div>1) Covers render automatically below. Click an image's link to download it.<br>2) Preview videos: press a button, keep this tab visible for 18 seconds, then download.</div>
<div id="cvImgs" style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start"></div>
<div style="display:flex;gap:12px;flex-wrap:wrap"><button id="vL" class="btn">Record landscape video (1920x1080)</button><button id="vP" class="btn">Record portrait video (1080x1620)</button><span id="vStat"></span></div>
<div id="cvVids" style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start"></div>`;
document.body.appendChild(ui);
const card = (src, label, file, isVid) => {
  const d = document.createElement('div'); d.style.cssText = 'background:#fff;color:#1b0f3a;border:4px solid #1b0f3a;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:6px';
  d.innerHTML = `${isVid ? `<video src="${src}" controls muted loop style="max-width:420px;max-height:420px"></video>` : `<img src="${src}" style="max-width:420px;max-height:420px">`}<b>${label}</b><a download="${file}" href="${src}" style="font-weight:700">Download ${file}</a>`;
  return d;
};
(async () => {
  for (const [n, f] of [['landscape', 'cover-landscape-1920x1080.png'], ['portrait', 'cover-portrait-800x1200.png'], ['square', 'cover-square-800x800.png']]) {
    const url = await still(n); $id('cvImgs').appendChild(card(url, `${n} ${LAYOUTS[n].W}x${LAYOUTS[n].H}`, f));
  }
})();
function $id(i) { return document.getElementById(i); }
let busy = false;
async function rec(name, label) {
  if (busy) return; busy = true;
  const r = await video(name, p => $id('vStat').textContent = `Recording ${label}... ${Math.round(p * 100)}%`);
  const url = URL.createObjectURL(r.blob); $id('vStat').textContent = `Done (${(r.blob.size / 1e6).toFixed(1)} MB, ${r.ext})`;
  $id('cvVids').appendChild(card(url, label, `preview-${name.slice(1)}.${r.ext}`, true)); busy = false;
}
$id('vL').onclick = () => rec('vlandscape', 'landscape video');
$id('vP').onclick = () => rec('vportrait', 'portrait video');
window.CoverGen = { still, video, LAYOUTS, beans, frame, setup };

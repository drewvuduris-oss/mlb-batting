// The report's opening "product shot": an old, worn baseball on the cream page,
// softly lit, turning slowly as the reader scrolls. Decorative only; it shows no data.
// If WebGL is unavailable, the CSS-drawn ball (#ball-fallback) stays visible instead.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const canvas = document.getElementById("ball");
const fallback = document.getElementById("ball-fallback");
const hero = document.getElementById("hero");
const REDUCED = window.REDUCED_MOTION;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  canvas.remove();
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.45;

const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
camera.position.set(0, 0, 6.2);

// Studio lights: warm key from upper left, cool soft fill, faint rim from behind
const key = new THREE.DirectionalLight(0xfff0dc, 2.2);
key.position.set(-4, 5, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xdfe7f2, 0.5);
fill.position.set(5, -1, 3);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.9);
rim.position.set(2, 3, -5);
scene.add(rim);

const rand = (a, b) => a + Math.random() * (b - a);

// ---------- Seam and stitch layout (computed first; the leather texture uses it) ----------
// Seam curve on the unit sphere: (a cos t + b cos 3t, a sin t - b sin 3t, c sin 2t), a + b = 1
const A = 0.76, B = 0.24, C = 2 * Math.sqrt(A * B);
const seamAt = (t) => new THREE.Vector3(A * Math.cos(t) + B * Math.cos(3 * t), A * Math.sin(t) - B * Math.sin(3 * t), C * Math.sin(2 * t));
const seamPts = [];
for (let i = 0; i < 400; i++) seamPts.push(seamAt((i / 400) * Math.PI * 2));
const seam = new THREE.CatmullRomCurve3(seamPts, true);

const STITCHES = 108;          // a regulation ball has 108 double stitches
const STITCH_R = 0.0095;
const STITCH_LEN = 0.06 + 2 * STITCH_R;
const stitchPlacements = [];   // { basis: Matrix4, outer: Vector3 }
{
  const xA = new THREE.Vector3(), yA = new THREE.Vector3(), zA = new THREE.Vector3();
  for (let i = 0; i < STITCHES; i++) {
    const u = i / STITCHES;
    const p = seam.getPointAt(u).multiplyScalar(0.994);
    const T = seam.getTangentAt(u);
    const N = p.clone().normalize();
    const Bn = new THREE.Vector3().crossVectors(T, N).normalize();
    [-1, 1].forEach((side) => {
      yA.copy(Bn).multiplyScalar(side).addScaledVector(T, 0.75).normalize(); // V-shaped pair across the seam
      zA.copy(N);
      xA.crossVectors(yA, zA).normalize();
      const m = new THREE.Matrix4().makeBasis(xA, yA, zA);
      // each half starts at the seam and runs outward, so the pair meets in a tight V
      m.setPosition(N.clone().multiplyScalar(1.003).addScaledVector(yA, (STITCH_LEN / 2) * 0.92));
      stitchPlacements.push({ m, outer: N.clone().addScaledVector(yA, STITCH_LEN * 1.12).normalize() });
    });
  }
}

// Texture coordinates of a point on the unit sphere, matching THREE.SphereGeometry's UV layout
// (canvas top row = north pole).
function toCanvas(p, w, h) {
  const theta = Math.acos(Math.max(-1, Math.min(1, p.y)));
  let phi = Math.atan2(p.z, -p.x);
  if (phi < 0) phi += Math.PI * 2;
  return [(phi / (Math.PI * 2)) * w, (theta / Math.PI) * h];
}

// ---------- Aged leather, drawn procedurally ----------
function canvasTex(w, h, draw, color = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// Draws fn at x, and again shifted by the texture width when it crosses an edge,
// so the texture wraps around the ball without a visible join.
const wrapDraw = (w, x, r, fn) => { fn(x); if (x - r < 0) fn(x + w); if (x + r > w) fn(x - w); };

// Darkening along the seam crease (soft ambient occlusion), baked at low resolution.
function seamShade(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  const sp = seamPts;
  for (let y = 0; y < h; y++) {
    const theta = ((y + 0.5) / h) * Math.PI, st = Math.sin(theta), ct = Math.cos(theta);
    for (let x = 0; x < w; x++) {
      const phi = ((x + 0.5) / w) * Math.PI * 2;
      const px = -Math.cos(phi) * st, pz = Math.sin(phi) * st;
      let best = 9;
      for (let k = 0; k < sp.length; k++) {
        const dx = px - sp[k].x, dy = ct - sp[k].y, dz = pz - sp[k].z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) best = d;
      }
      const d = Math.sqrt(best);
      const a = 0.42 * Math.exp(-((d / 0.03) ** 2)) + 0.2 * Math.exp(-((d / 0.1) ** 2));
      const i = (y * w + x) * 4;
      img.data[i] = 72; img.data[i + 1] = 52; img.data[i + 2] = 32; img.data[i + 3] = a * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

const leather = canvasTex(2048, 1024, (g, w, h) => {
  g.fillStyle = "#e0d0ae";
  g.fillRect(0, 0, w, h);
  // uneven yellowing and handling marks
  for (let i = 0; i < 140; i++) {
    const x = rand(0, w), y = rand(h * 0.1, h * 0.9), r = rand(50, 280);
    const tone = Math.random() < 0.7 ? "150,115,60" : "120,100,80";
    const a = rand(0.07, 0.17);
    wrapDraw(w, x, r, (cx) => {
      const grd = g.createRadialGradient(cx, y, 0, cx, y, r);
      grd.addColorStop(0, `rgba(${tone},${a})`);
      grd.addColorStop(1, `rgba(${tone},0)`);
      g.fillStyle = grd;
      g.fillRect(cx - r, y - r, r * 2, r * 2);
    });
  }
  // infield-dirt smudges and a faint grass stain
  [["128,92,58", 0.24, 240], ["110,82,50", 0.18, 180], ["92,98,60", 0.12, 160]].forEach(([c, a, r]) => {
    const x = rand(w * 0.2, w * 0.8), y = rand(h * 0.35, h * 0.65);
    g.save(); g.translate(x, y); g.scale(1.8, 1);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, `rgba(${c},${a})`);
    grd.addColorStop(1, `rgba(${c},0)`);
    g.fillStyle = grd; g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  });
  // abrasion: soft scuffed patches made of many faint, short strokes
  for (let p = 0; p < 22; p++) {
    const cx = rand(0, w), cy = rand(h * 0.2, h * 0.8), spread = rand(30, 90);
    const light = Math.random() < 0.55;
    for (let i = 0; i < 70; i++) {
      const x = cx + rand(-spread, spread), y = cy + rand(-spread * 0.5, spread * 0.5), len = rand(3, 12), ang = rand(-0.5, 0.5);
      g.strokeStyle = light ? `rgba(248,242,228,${rand(0.08, 0.2)})` : `rgba(105,80,52,${rand(0.05, 0.14)})`;
      g.lineWidth = rand(1, 3);
      wrapDraw(w, x, len, (sx) => { g.beginPath(); g.moveTo(sx, y); g.lineTo(sx + Math.cos(ang) * len, y + Math.sin(ang) * len); g.stroke(); });
    }
  }
  // dust specks
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(80,60,40,${rand(0.04, 0.12)})`;
    g.fillRect(rand(0, w), rand(0, h), rand(1, 2.2), rand(1, 2.2));
  }
  // seam crease shading
  g.imageSmoothingQuality = "high";
  g.drawImage(seamShade(512, 256), 0, 0, w, h);
  // stitch holes, with a faint red stain where old thread has bled into the leather
  stitchPlacements.forEach(({ outer }) => {
    const [x, y] = toCanvas(outer, w, h);
    const sx = 1 / Math.max(0.2, Math.sin(Math.acos(outer.y))); // widen near the poles, like the UV map does
    wrapDraw(w, x, 10 * sx, (cx) => {
      g.save(); g.translate(cx, y); g.scale(sx, 1);
      const stain = g.createRadialGradient(0, 0, 0, 0, 0, 9);
      stain.addColorStop(0, "rgba(150,55,45,0.14)");
      stain.addColorStop(1, "rgba(150,55,45,0)");
      g.fillStyle = stain; g.fillRect(-9, -9, 18, 18);
      g.fillStyle = "rgba(58,34,24,0.55)";
      g.beginPath(); g.arc(0, 0, 2.4, 0, Math.PI * 2); g.fill();
      g.restore();
    });
  });
});

const bump = canvasTex(1024, 512, (g, w, h) => {
  const img = g.createImageData(w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (Math.random() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.filter = "blur(0.6px)";
  g.drawImage(g.canvas, 0, 0);
}, false);

const ball = new THREE.Group();
scene.add(ball);
ball.add(new THREE.Mesh(
  new THREE.SphereGeometry(1, 128, 96),
  new THREE.MeshPhysicalMaterial({
    map: leather, bumpMap: bump, bumpScale: 0.8, roughness: 0.74, metalness: 0,
    sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color("#fff3df"), // the soft glow of worn hide
  }),
));

// The crease where the two covers meet
ball.add(new THREE.Mesh(
  new THREE.TubeGeometry(seam, 800, 0.008, 8, true),
  new THREE.MeshStandardMaterial({ color: 0x8c7654, roughness: 0.95 }),
));

// Double red stitching, rounded thread ends, slightly uneven faded color
const stitches = new THREE.InstancedMesh(
  new THREE.CapsuleGeometry(STITCH_R, STITCH_LEN - 2 * STITCH_R, 4, 8),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
  stitchPlacements.length,
);
const faded = ["#6e211b", "#7a2a22", "#662019", "#803127"].map((c) => new THREE.Color(c));
stitchPlacements.forEach(({ m }, i) => {
  stitches.setMatrixAt(i, m);
  stitches.setColorAt(i, faded[i % faded.length]);
});
ball.add(stitches);

// ---------- Motion ----------
const base = { x: 0.42, y: -0.55, z: 0.18 };
const cur = { x: base.x, y: base.y };

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the whole ball in frame on narrow screens
  camera.position.z = camera.aspect < 1 ? 6.2 / Math.max(camera.aspect, 0.62) : 6.2;
  camera.updateProjectionMatrix();
  draw(performance.now());
}

function draw(t) {
  const p = window.heroProgress || 0;
  const ty = base.y + (REDUCED ? 0 : p * Math.PI * 1.35 + t * 0.00008);
  const tx = base.x + (REDUCED ? 0 : p * 0.35);
  cur.y += (ty - cur.y) * 0.08;
  cur.x += (tx - cur.x) * 0.08;
  ball.rotation.set(cur.x, cur.y, base.z);
  ball.position.y = REDUCED ? 0 : Math.sin(t * 0.0009) * 0.025;
  renderer.render(scene, camera);
}

// Only animate while the opening is on screen.
let visible = true, raf = 0;
function loop(t) {
  draw(t);
  raf = visible ? requestAnimationFrame(loop) : 0;
}
new IntersectionObserver((es) => {
  visible = es[0].isIntersecting;
  if (visible && !raf && !REDUCED) raf = requestAnimationFrame(loop);
}).observe(hero);

addEventListener("resize", resize);
resize();
if (fallback) fallback.style.opacity = "0";
if (!REDUCED) raf = requestAnimationFrame(loop);

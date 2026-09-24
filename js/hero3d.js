// 3D hero for the report page: a ballpark the camera flies over as you scroll,
// with a spinning baseball in the foreground that tilts toward the pointer.
// Decorative only - no data is shown here. Falls back to a CSS gradient if WebGL
// is unavailable, and holds still for visitors who prefer reduced motion.

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const hero = document.getElementById("hero");
const canvas = document.getElementById("hero-canvas");
const fallback = document.getElementById("hero-fallback");
const copy = hero.querySelector(".hero-copy");
const hint = hero.querySelector(".scroll-hint");
const REDUCED = window.REDUCED_MOTION;

// Units: 1 = 10 feet. Home plate at the origin; center field toward -z.
const DEG = Math.PI / 180;
const fieldR = (t) => 33 + 7 * Math.cos(2 * t);   // 330 ft down the lines, 400 ft to center
const wallR = (t) => fieldR(t) + 1.5;               // 15 ft warning track
const polar = (r, t, y = 0) => new THREE.Vector3(r * Math.sin(t), y, -r * Math.cos(t));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
} catch (e) {
  canvas.remove();
  throw e; // fallback gradient stays visible
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
fallback.style.transition = "opacity 0.8s ease";

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
scene.add(camera);

// ---------- Helpers ------------------------------------------------------------
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function fanShape(rFn, from = -45 * DEG, to = 45 * DEG, steps = 64) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  for (let i = 0; i <= steps; i++) {
    const t = from + (to - from) * (i / steps);
    const r = rFn(t);
    s.lineTo(r * Math.sin(t), r * Math.cos(t));
  }
  s.lineTo(0, 0);
  return s;
}
function flat(shapeOrGeo, material, y) {
  const geo = shapeOrGeo instanceof THREE.Shape ? new THREE.ShapeGeometry(shapeOrGeo, 48) : shapeOrGeo;
  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  scene.add(mesh);
  return mesh;
}
// A curved band following the outfield arc: inner edge (r1, y1) to outer edge (r2, y2).
function arcBand(r1Fn, y1, r2Fn, y2, from, to, material, steps = 72) {
  const pos = [];
  const idx = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + (to - from) * (i / steps);
    const a = polar(r1Fn(t), t, y1);
    const b = polar(r2Fn(t), t, y2);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (i < steps) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  scene.add(mesh);
  return mesh;
}

// ---------- Field ----------------------------------------------------------------
const grassTex = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = "#2f7d36"; g.fillRect(0, 0, w, h);
  g.fillStyle = "#3a8f40"; g.fillRect(0, 0, w / 2, h);
  g.fillStyle = "rgba(255,255,255,0.03)";
  for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 16);
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(0.1, 0.1);

const mat = {
  grass: new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
  dirt: new THREE.MeshStandardMaterial({ color: 0xa8683f, roughness: 1 }),
  chalk: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  ground: new THREE.MeshStandardMaterial({ color: 0x0b1320, roughness: 1 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x0f3b2c, roughness: 0.8, side: THREE.DoubleSide }),
  wallCap: new THREE.MeshStandardMaterial({ color: 0xffc53d, emissive: 0x4a3200, side: THREE.DoubleSide }),
  stands: new THREE.MeshStandardMaterial({ color: 0x1c2438, roughness: 0.9, side: THREE.DoubleSide }),
  pole: new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 0.6, roughness: 0.4 }),
  foulPole: new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x3a2a00 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xfff3cf, emissive: 0xfff1c4, emissiveIntensity: 2 }),
};

flat(new THREE.PlaneGeometry(600, 600), mat.ground, -0.02);
flat(fanShape((t) => wallR(t)), mat.dirt, 0.0);                 // warning track (under the grass)
flat(fanShape(fieldR), mat.grass, 0.01);                         // outfield grass

const infield = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64), mat.dirt);
infield.rotation.x = -Math.PI / 2;
infield.position.set(0, 0.02, -6.05);
scene.add(infield);

const diamond = new THREE.Shape();
diamond.moveTo(0, 0.9); diamond.lineTo(5.5, 6.36); diamond.lineTo(0, 11.8); diamond.lineTo(-5.5, 6.36); diamond.lineTo(0, 0.9);
flat(diamond, mat.grass, 0.03);                                  // infield grass

const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.12, 40), mat.dirt);
mound.position.set(0, 0.06, -6.05);
scene.add(mound);

const baseGeo = new THREE.BoxGeometry(0.15, 0.05, 0.15);
[[6.36, -6.36], [0, -12.73], [-6.36, -6.36]].forEach(([x, z]) => {
  const b = new THREE.Mesh(baseGeo, mat.chalk);
  b.position.set(x, 0.05, z);
  b.rotation.y = Math.PI / 4;
  scene.add(b);
});
const plate = new THREE.Shape();
plate.moveTo(-0.085, 0); plate.lineTo(0.085, 0); plate.lineTo(0.085, 0.085); plate.lineTo(0, 0.17); plate.lineTo(-0.085, 0.085);
flat(plate, mat.chalk, 0.045).rotation.z = Math.PI;

// Foul lines
[-45, 45].forEach((d) => {
  const t = d * DEG;
  const len = fieldR(t);
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, len), mat.chalk);
  const mid = polar(len / 2, t, 0.04);
  line.position.copy(mid);
  line.rotation.y = -t;
  scene.add(line);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6, 8), mat.foulPole);
  pole.position.copy(polar(wallR(t), t, 3));
  scene.add(pole);
});

// Outfield wall with a yellow cap
arcBand(wallR, 0, wallR, 1.0, -45 * DEG, 45 * DEG, mat.wall);
arcBand(wallR, 1.0, (t) => wallR(t) + 0.12, 1.02, -45 * DEG, 45 * DEG, mat.wallCap);

// Stands: a sloped bowl behind the wall, filled with a crowd
const STANDS_FROM = -52 * DEG, STANDS_TO = 52 * DEG;
const standR = (t, j) => wallR(t) + 0.6 + j * 0.55;
const standY = (j) => 1.3 + j * 0.42;
const ROWS = 16;
arcBand((t) => standR(t, 0), standY(0), (t) => standR(t, ROWS), standY(ROWS), STANDS_FROM, STANDS_TO, mat.stands);
arcBand(wallR, 1.0, (t) => standR(t, 0), standY(0), STANDS_FROM, STANDS_TO, mat.stands);

const crowdColors = [0x1d3a6e, 0xc8102e, 0xf4f2ec, 0x2b2b2b, 0x3d6bb3, 0x8a1426, 0xffc53d, 0x51607a].map((c) => new THREE.Color(c));
const CROWD = 2600;
const crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.32, 0.2), new THREE.MeshStandardMaterial({ roughness: 0.9 }), CROWD);
const m4 = new THREE.Matrix4();
for (let i = 0; i < CROWD; i++) {
  const t = STANDS_FROM + Math.random() * (STANDS_TO - STANDS_FROM);
  const j = Math.random() * ROWS;
  const p = polar(standR(t, j), t, standY(j) + 0.16);
  m4.makeRotationY(-t);
  m4.setPosition(p);
  crowd.setMatrixAt(i, m4);
  crowd.setColorAt(i, crowdColors[Math.floor(Math.random() * crowdColors.length)]);
}
scene.add(crowd);

// Center-field scoreboard with real numbers from the report
function drawBoard(g, w, h) {
  g.fillStyle = "#050b16"; g.fillRect(0, 0, w, h);
  g.strokeStyle = "#1b2a44"; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
  g.fillStyle = "#ffd35c"; g.textAlign = "center";
  g.font = "bold 92px Orbitron, sans-serif";
  g.fillText("SWING & A MISS", w / 2, 150);
  g.font = "600 52px Orbitron, sans-serif";
  g.fillStyle = "#ff4d63";
  g.fillText("155 SEASONS · 106,470 BATTING LINES", w / 2, 270);
}
const boardTex = canvasTexture(1024, 384, drawBoard);
const scoreboard = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.75), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false }));
scoreboard.position.copy(polar(standR(0, ROWS) + 0.5, 0, standY(ROWS) + 3.2));
scene.add(scoreboard);
const boardBack = new THREE.Mesh(new THREE.BoxGeometry(10.6, 4.3, 0.4), mat.stands);
boardBack.position.copy(scoreboard.position).add(new THREE.Vector3(0, 0, -0.25));
scene.add(boardBack);
[-4, 4].forEach((x) => {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), mat.pole);
  leg.position.set(x, standY(ROWS) - 0.1, scoreboard.position.z - 0.3);
  scene.add(leg);
});

// Light towers with glowing lamp banks
const glowTex = canvasTexture(128, 128, (g, w) => {
  const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  grd.addColorStop(0, "rgba(255,245,215,1)");
  grd.addColorStop(0.25, "rgba(255,230,170,0.55)");
  grd.addColorStop(1, "rgba(255,220,150,0)");
  g.fillStyle = grd; g.fillRect(0, 0, w, w);
});
const glows = [];
[-40, -17, 17, 40].forEach((d) => {
  const t = d * DEG;
  const base = polar(standR(t, ROWS) + 1.2, t, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 15, 10), mat.pole);
  pole.position.set(base.x, 7.5, base.z);
  scene.add(pole);
  const bank = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.3), mat.lamp);
  bank.position.set(base.x, 15.3, base.z);
  bank.lookAt(0, 0, -12);
  scene.add(bank);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.position.copy(bank.position);
  glow.scale.set(9, 9, 1);
  scene.add(glow);
  glows.push(glow);
});

// Stars (night only)
const starGeo = new THREE.BufferGeometry();
const starPos = [];
for (let i = 0; i < 900; i++) {
  const th = Math.random() * Math.PI * 2;
  const ph = Math.random() * Math.PI * 0.42;
  const r = 250;
  starPos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) + 10, r * Math.sin(ph) * Math.sin(th));
}
starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false }));
scene.add(stars);

// Lights
const hemi = new THREE.HemisphereLight(0x8fa9d9, 0x0b1a0f, 0.8);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1d6, 1.6);
key.position.set(-20, 40, 10);
scene.add(key);

// ---------- Baseball (attached to the camera so it stays in frame) ----------------
const ball = new THREE.Group();
const leather = canvasTexture(512, 256, (g, w, h) => {
  g.fillStyle = "#f3eee2"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(120,100,70,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
});
ball.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.MeshStandardMaterial({ map: leather, roughness: 0.55 })));

// Seam curve on the unit sphere: x = a cos t + b cos 3t, y = a sin t - b sin 3t, z = c sin 2t, with a + b = 1.
const A = 0.75, B = 0.25, C = 2 * Math.sqrt(A * B);
const seam = (t) => new THREE.Vector3(A * Math.cos(t) + B * Math.cos(3 * t), A * Math.sin(t) - B * Math.sin(3 * t), C * Math.sin(2 * t));
const seamPts = [];
for (let i = 0; i < 200; i++) seamPts.push(seam((i / 200) * Math.PI * 2).multiplyScalar(1.004));
const seamCurve = new THREE.CatmullRomCurve3(seamPts, true);
ball.add(new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 400, 0.012, 6, true), new THREE.MeshStandardMaterial({ color: 0xd9d1bd, roughness: 0.8 })));

const STITCHES = 108;
const stitchMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.018, 0.024), new THREE.MeshStandardMaterial({ color: 0xd0263b, roughness: 0.5 }), STITCHES * 2);
const xAxis = new THREE.Vector3(), yAxis = new THREE.Vector3(), zAxis = new THREE.Vector3(), q = new THREE.Matrix4();
for (let i = 0; i < STITCHES; i++) {
  const u = i / STITCHES;
  const p = seamCurve.getPointAt(u);
  const T = seamCurve.getTangentAt(u);
  const N = p.clone().normalize();
  const Bn = new THREE.Vector3().crossVectors(T, N).normalize();
  [-1, 1].forEach((side, k) => {
    xAxis.copy(Bn).multiplyScalar(side).addScaledVector(T, 0.55).normalize(); // V-shaped stitch halves
    yAxis.copy(N);
    zAxis.crossVectors(xAxis, yAxis).normalize();
    q.makeBasis(xAxis, yAxis, zAxis);
    q.setPosition(N.clone().multiplyScalar(1.015).addScaledVector(Bn, side * 0.045));
    stitchMesh.setMatrixAt(i * 2 + k, q);
  });
}
ball.add(stitchMesh);
camera.add(ball);
const ballLight = new THREE.DirectionalLight(0xffffff, 1.4);
ballLight.position.set(-3, 4, 6);
camera.add(ballLight);

// ---------- Theme ------------------------------------------------------------------
function skyTexture(night) {
  return canvasTexture(4, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    if (night) {
      grd.addColorStop(0, "#02060f"); grd.addColorStop(0.55, "#0b1a38"); grd.addColorStop(0.8, "#233a6b"); grd.addColorStop(1, "#3a4c7c");
    } else {
      grd.addColorStop(0, "#2f6fc4"); grd.addColorStop(0.6, "#79b1ea"); grd.addColorStop(1, "#d6ebff");
    }
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
}
function applyTheme() {
  const night = document.documentElement.dataset.theme !== "day";
  if (scene.background) scene.background.dispose();
  scene.background = skyTexture(night);
  scene.fog = new THREE.Fog(night ? 0x14264a : 0xc9e2fb, 70, 190);
  stars.visible = night;
  glows.forEach((g) => (g.visible = night));
  mat.lamp.emissiveIntensity = night ? 2.2 : 0.4;
  hemi.color.set(night ? 0x8fa9d9 : 0xdff0ff);
  hemi.groundColor.set(night ? 0x0b1a0f : 0x3b5a2a);
  hemi.intensity = night ? 0.7 : 1.3;
  key.color.set(night ? 0xfff1d6 : 0xffffff);
  key.intensity = night ? 1.5 : 2.4;
  key.position.set(night ? -10 : -30, 40, night ? 5 : 20);
  mat.ground.color.set(night ? 0x123d24 : 0x3f8a44); // foul territory grass
  renderOnce();
}

// ---------- Camera flyover driven by scroll ------------------------------------------
const START = { pos: new THREE.Vector3(0, 1.5, 6.5), look: new THREE.Vector3(0, 1.4, -20) };
const END = { pos: new THREE.Vector3(0, 22, 5), look: new THREE.Vector3(0, 0, -21) };
const lookAt = new THREE.Vector3();
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
let progress = REDUCED ? 0.3 : 0;

const smooth = (x) => x * x * (3 - 2 * x);

function scrollProgress() {
  const span = hero.offsetHeight - window.innerHeight;
  const top = -hero.getBoundingClientRect().top;
  return span > 0 ? Math.min(1, Math.max(0, top / span)) : 0;
}

function placeBall() {
  const narrow = camera.aspect < 0.9;
  ball.position.set(narrow ? 0.4 : 2.1, narrow ? -1.2 : -0.1, narrow ? -7 : -6);
  ball.scale.setScalar(narrow ? 0.75 : 1);
}

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.9 ? 62 : 50;
  camera.updateProjectionMatrix();
  placeBall();
  renderOnce();
}

function update(time) {
  if (!REDUCED) progress = scrollProgress();
  const e = smooth(progress);
  pointer.x += (pointer.tx - pointer.x) * 0.06;
  pointer.y += (pointer.ty - pointer.y) * 0.06;

  camera.position.lerpVectors(START.pos, END.pos, e);
  camera.position.x += pointer.x * 0.8 + (REDUCED ? 0 : Math.sin(time * 0.00015) * 0.5 * (1 - e));
  camera.position.y += pointer.y * 0.4;
  lookAt.lerpVectors(START.look, END.look, e);
  camera.lookAt(lookAt);

  if (!REDUCED) {
    ball.rotation.y = time * 0.0006 + e * 6;
    ball.rotation.x = 0.35 + pointer.y * 0.6;
    ball.rotation.z = -0.25 + pointer.x * 0.6;
  } else {
    ball.rotation.set(0.35, 0.8, -0.25);
  }

  copy.style.opacity = String(Math.max(0, 1 - progress * 2.2));
  copy.style.transform = `translateY(${-progress * 60}px)`;
  hint.style.opacity = String(Math.max(0, 1 - progress * 5));
}

function renderOnce(time = performance.now()) {
  update(time);
  renderer.render(scene, camera);
}

// Only animate while the hero is on screen.
let visible = true;
let raf = 0;
function loop(time) {
  renderOnce(time);
  raf = visible ? requestAnimationFrame(loop) : 0;
}
new IntersectionObserver((entries) => {
  visible = entries[0].isIntersecting;
  if (visible && !raf && !REDUCED) raf = requestAnimationFrame(loop);
}).observe(hero);

window.addEventListener("pointermove", (e) => {
  pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
  pointer.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
  if (REDUCED) renderOnce();
}, { passive: true });
window.addEventListener("resize", resize);
window.addEventListener("themechange", applyTheme);

applyTheme();
resize();
fallback.style.opacity = "0";
if (!REDUCED) raf = requestAnimationFrame(loop);
// The scoreboard texture uses Orbitron; redraw it once the web font has loaded.
document.fonts?.ready.then(() => {
  const img = boardTex.image;
  drawBoard(img.getContext("2d"), img.width, img.height);
  boardTex.needsUpdate = true;
  renderOnce();
});

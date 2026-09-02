// velocity-network.js — connects particles with similar velocities
// Renders into the existing particle scene (same canvas).
// Reads position texture via readPixels (one 256×256 float readback/frame).

import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineSegments, AdditiveBlending } from 'three';

const GRID = 256, N = GRID * GRID, BINS = 8;
const MAX_DIST = 0.08;
const respawnThreshold = 0.4;

let enabled = false, prevPos = null;
const pos = new Float32Array(N * 4);
const vel = new Float32Array(N * 2);
const binOf = new Int32Array(N);
const bins = Array.from({ length: BINS }, () => []);
const gridW = 64;
const grid = Array.from({ length: gridW * gridW }, () => []);
let lineMesh = null;

function binIndex(velX, velY) {
  const angle = Math.atan2(velY, velX);
  return (((angle + Math.PI) / (2 * Math.PI)) * BINS | 0) % BINS;
}

function readPositions(P) {
  const renderer = P.getRenderer();
  const gl = renderer.getContext();
  const rt = P.getRT();
  const prevRT = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  try {
    gl.readPixels(0, 0, GRID, GRID, gl.RGBA, gl.FLOAT, pos);
  } catch (_) { /* float readback not supported */ }
  renderer.setRenderTarget(prevRT);
}

function computeVelocities() {
  if (!prevPos) { prevPos = new Float32Array(pos); return; }
  for (let i = 0; i < N; i++) {
    const i4 = i * 4, i2 = i * 2;
    const dx = pos[i4] - prevPos[i4];
    const dy = pos[i4 + 1] - prevPos[i4 + 1];
    if (dx * dx + dy * dy > respawnThreshold) { vel[i2] = vel[i2 + 1] = 0; }
    else { vel[i2] = dx; vel[i2 + 1] = dy; }
    binOf[i] = binIndex(vel[i2], vel[i2 + 1]);
  }
  prevPos.set(pos);
}

function spatialHash() {
  for (let i = 0; i < gridW * gridW; i++) grid[i].length = 0;
  for (let i = 0; i < N; i++) {
    const gx = ((pos[i * 4] + 1) * 0.5 * gridW | 0);
    const gy = ((pos[i * 4 + 1] + 1) * 0.5 * gridW | 0);
    if (gx >= 0 && gx < gridW && gy >= 0 && gy < gridW) grid[gy * gridW + gx].push(i);
  }
}

function connectParticles() {
  const verts = [], cols = [];
  for (let b = 0; b < BINS; b++) bins[b].length = 0;
  for (let i = 0; i < N; i++) bins[binOf[i]].push(i);

  for (let b = 0; b < BINS; b++) {
    const group = bins[b];
    for (let gi = 0; gi < group.length; gi++) {
      const i = group[gi];
      const px = pos[i * 4], py = pos[i * 4 + 1];
      const gx = ((px + 1) * 0.5 * gridW | 0);
      const gy = ((py + 1) * 0.5 * gridW | 0);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = gx + dx, cy = gy + dy;
          if (cx < 0 || cx >= gridW || cy < 0 || cy >= gridW) continue;
          const cell = grid[cy * gridW + cx];
          for (let ci = 0; ci < cell.length; ci++) {
            const j = cell[ci];
            if (j <= i) continue;
            if (binOf[j] !== b) continue;
            const ex = pos[j * 4] - px, ey = pos[j * 4 + 1] - py;
            if (ex * ex + ey * ey > MAX_DIST * MAX_DIST) continue;
            verts.push(px, py, 0, pos[j * 4], pos[j * 4 + 1], 0);
            const sp = 1 - Math.sqrt(ex * ex + ey * ey) / MAX_DIST;
            cols.push(sp, sp, sp, sp, sp, sp);
          }
        }
      }
    }
  }
  return { verts, cols };
}

function init(P) {
  const scene = P.getScene();

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute([], 3));
  geo.setAttribute('color', new Float32BufferAttribute([], 3));
  const mat = new LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: 1,
    blending: AdditiveBlending, depthTest: false, depthWrite: false,
  });
  lineMesh = new LineSegments(geo, mat);
  lineMesh.visible = false;
  scene.add(lineMesh);

  function update() {
    if (!enabled || !lineMesh) return;
    readPositions(P);
    computeVelocities();
    spatialHash();
    const { verts, cols } = connectParticles();
    lineMesh.geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
    lineMesh.geometry.setAttribute('color', new Float32BufferAttribute(cols, 3));
  }

  window.VelocityNetwork = {
    enable() { enabled = true; if (lineMesh) lineMesh.visible = true; },
    disable() { enabled = false; if (lineMesh) lineMesh.visible = false; },
    isEnabled() { return enabled; },
    update,
    setOpacity(v) { if (lineMesh) lineMesh.material.opacity = Math.max(0, Math.min(1, v)); },
    getOpacity() { return lineMesh ? lineMesh.material.opacity : 0.23; },
  };
}

export { init };

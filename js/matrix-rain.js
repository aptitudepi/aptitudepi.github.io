import { onMotionChange } from './motion.js';

const canvas = document.getElementById('matrix-rain');
const ctx = canvas.getContext('2d');

let drops = [];
let fontSize = 14;
let animId = null;
let active = false;
let pauseParticles = null;
let resumeParticles = null;
// WAVE 12 single-owner flag: while true the background owner
// (js/backgrounds.js) steps this layer via stepMatrixFrame() and this module
// never schedules its own rAF, so exactly one background loop runs at a time.
let schedulerOwned = false;

const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function dismiss() {
  if (!active) return;
  stopMatrixRain();
}

// Adjacent readable text for the overlay state (role=status lives on
// #matrix-status in the markup): the rain is never animation-alone.
function describeMatrixState(runningNow) {
  const statusNode = document.getElementById('matrix-status');
  if (!statusNode) return;
  if (runningNow) {
    statusNode.textContent = 'Matrix rain effect running full-screen. Press Escape to exit.';
  } else {
    statusNode.textContent = 'Matrix rain effect off.';
  }
}

function drawMatrixFrame() {
  ctx.fillStyle = `rgba(0, 0, 0, 0.08)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const green = `hsl(${120 + Math.random() * 40}, 100%, ${50 + Math.random() * 30}%)`;

  for (let dropIndex = 0; dropIndex < drops.length; dropIndex++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    const dropX = dropIndex * fontSize + fontSize / 4;
    const dropY = drops[dropIndex] * fontSize;

    const bright = drops[dropIndex] < 6 && drops[dropIndex] > 0;
    ctx.fillStyle = bright ? `#fff` : green;
    ctx.font = bright ? `bold ${fontSize}px monospace` : `${fontSize}px monospace`;
    ctx.fillText(text, dropX, dropY);

    if (dropY > canvas.height && Math.random() > 0.975) {
      drops[dropIndex] = 0;
    }
    drops[dropIndex]++;
  }
}

function animate() {
  if (!active) return;
  drawMatrixFrame();
  // Owned → the background owner drives stepMatrixFrame(); never reschedule
  // here or two loops would paint this canvas.
  if (schedulerOwned) {
    animId = null;
    return;
  }
  animId = requestAnimationFrame(animate);
}

// WAVE 12 ownership: hand scheduling to the single background owner. Any
// pending standalone frame is cancelled so only the owner loop remains.
export function takeMatrixLoop() {
  schedulerOwned = true;
  if (animId !== null) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

// One owner tick worth of rain. No-op unless the overlay is active.
export function stepMatrixFrame() {
  if (!active) return;
  drawMatrixFrame();
}

export function isMatrixOwned() {
  return schedulerOwned;
}

export function isMatrixSelfScheduled() {
  return animId !== null && !schedulerOwned;
}

export function startMatrixRain(onPause, onResume) {
  if (active) return;
  active = true;
  canvas.classList.add('active');
  canvas.setAttribute('aria-hidden', 'false');
  describeMatrixState(true);
  pauseParticles = onPause || null;
  resumeParticles = onResume || null;

  if (pauseParticles) pauseParticles();

  resize();
  window.addEventListener('resize', resize);

  const cols = Math.floor(canvas.width / fontSize);
  drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -100));

  document.addEventListener('keydown', onKey);
  canvas.addEventListener('click', dismiss);

  animate();
}

export function stopMatrixRain() {
  if (!active) return;
  active = false;
  canvas.classList.remove('active');
  canvas.setAttribute('aria-hidden', 'true');
  describeMatrixState(false);
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  window.removeEventListener('resize', resize);
  document.removeEventListener('keydown', onKey);
  canvas.removeEventListener('click', dismiss);

  if (resumeParticles) resumeParticles();
}

function onKey(keyEvent) {
  keyEvent.preventDefault();
  dismiss();
}

export function isMatrixActive() {
  return active;
}

// Strictly opt-in (terminal `matrix` command or the konami gesture — never
// auto-started): a mid-session motion-off flip dismisses the overlay instead
// of raining against the user's reduced-motion / data-saver need.
onMotionChange((motionOff) => {
  if (motionOff) dismiss();
});

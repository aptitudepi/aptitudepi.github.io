const canvas = document.getElementById('matrix-rain');
const ctx = canvas.getContext('2d');

let drops = [];
let fontSize = 14;
let animId = null;
let active = false;
let pauseParticles = null;
let resumeParticles = null;

const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF';

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function dismiss() {
  if (!active) return;
  stopMatrixRain();
}

function animate() {
  if (!active) return;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const green = `hsl(${120 + Math.random() * 40}, 100%, ${50 + Math.random() * 30}%)`;

  for (let i = 0; i < drops.length; i++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    const x = i * fontSize + fontSize / 4;
    const y = drops[i] * fontSize;

    const bright = drops[i] < 6 && drops[i] > 0;
    ctx.fillStyle = bright ? '#fff' : green;
    ctx.font = bright ? `bold ${fontSize}px monospace` : `${fontSize}px monospace`;
    ctx.fillText(text, x, y);

    if (y > canvas.height && Math.random() > 0.975) {
      drops[i] = 0;
    }
    drops[i]++;
  }

  animId = requestAnimationFrame(animate);
}

export function startMatrixRain(onPause, onResume) {
  if (active) return;
  active = true;
  canvas.classList.add('active');
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
  if (animId) cancelAnimationFrame(animId);
  animId = null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  window.removeEventListener('resize', resize);
  document.removeEventListener('keydown', onKey);
  canvas.removeEventListener('click', dismiss);

  if (resumeParticles) resumeParticles();
}

function onKey(e) {
  e.preventDefault();
  dismiss();
}

export function isMatrixActive() {
  return active;
}

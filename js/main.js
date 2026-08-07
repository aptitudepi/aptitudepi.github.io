import { initParticles, setKonami } from './three-particles.js';
import { initAnimations } from './animations.js';
import { initNav } from './nav.js';
import { createTerminal, startBoot, getTerm } from './terminal.js';
import { executeCommand } from './shell.js';
import { bootVM } from './v86-launcher.js';
import { startMatrixRain, stopMatrixRain, isMatrixActive } from './matrix-rain.js';
import { mountNavOrb } from './orb.js';

window.bootVM = bootVM;
window.startMatrixRain = startMatrixRain;
window.stopMatrixRain = stopMatrixRain;
window.isMatrixActive = isMatrixActive;

const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let konamiIdx = 0;

document.addEventListener('keydown', e => {
  const key = e.key;
  if (key === KONAMI[konamiIdx]) {
    konamiIdx++;
    if (konamiIdx === KONAMI.length) {
      konamiIdx = 0;
      const term = getTerm();
      if (term) executeCommand('cowsay Cheat code activated!', term);
      triggerMatrixRain();
    }
  } else {
    konamiIdx = 0;
  }
}, { capture: true });

function triggerMatrixRain() {
  setKonami(true);
  if (!isMatrixActive()) {
    setTimeout(() => {
      startMatrixRain(
        () => setKonami(false),
        () => setKonami(true)
      );
    }, 500);
  }
  setTimeout(() => {
    if (isMatrixActive()) stopMatrixRain();
    setKonami(false);
  }, 5000);
}

function updateClock() {
  const el = document.getElementById('headerClock');
  if (el) el.textContent = new Date().toLocaleTimeString();
}

function init() {
  initParticles();
  initNav();
  initAnimations();
  mountNavOrb();
  updateClock();
  setInterval(updateClock, 1000);

  const container = document.getElementById('terminal-container');
  if (container && typeof Terminal !== 'undefined') {
    createTerminal(container);
    startBoot();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

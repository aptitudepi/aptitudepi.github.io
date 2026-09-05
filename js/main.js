import { defineComponent, mountComponent } from './component.js';
import { store } from './state.js';
import { initParticles, setKonami } from './three-particles.js';
import { initAnimations } from './animations.js';
import { initGitHubStats } from './github-stats.js';
import { initThermalAscii, RAMP_BENGALI } from './thermal-ascii.js';
import { initNav } from './nav.js';
import { createTerminal, startBoot, getTerm } from './terminal.js';
import { executeCommand, ASCII_ART } from './shell.js';
import { bootVM } from './v86-launcher.js';
import { startMatrixRain, stopMatrixRain, isMatrixActive } from './matrix-rain.js';
import { mountNavOrb } from './orb.js';
import { initParticleBadges } from './particle-badge.js';

window.bootVM = bootVM;
window.startMatrixRain = startMatrixRain;
window.stopMatrixRain = stopMatrixRain;
window.isMatrixActive = isMatrixActive;

// Register Kyoto-inspired components
defineComponent('ThinkingOrb', () => ({
  init() {
    mountNavOrb();
  }
}));

defineComponent('GitHubStats', () => ({
  fetch() {
    return new Promise(resolve => {
      initGitHubStats();
      resolve(true);
    });
  }
}));

defineComponent('Clock', (ctx) => ({
  init() {
    const updateClock = () => {
      const el = ctx.container;
      if (el) el.textContent = new Date().toLocaleTimeString();
    };
    updateClock();
    this.timer = setInterval(updateClock, 1000);
  },
  destroy() {
    if (this.timer) clearInterval(this.timer);
  }
}));

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

function init() {
  initParticles();
  initNav();
  initAnimations();
  initParticleBadges();

  // Mount components via Kyoto component registry
  mountComponent(document.body, 'ThinkingOrb');
  mountComponent('#headerClock', 'Clock');
  mountComponent('[data-github-stats]', 'GitHubStats');

  const container = document.getElementById('terminal-container');
  if (container && typeof Terminal !== 'undefined') {
    createTerminal(container);
    startBoot();
  }

  const thermalCanvas = document.getElementById('thermal-ascii');
  // Dev page owns its thermal instance via the sidebar (init + re-init +
  // destroy); skip the shared init there so two loops never drive one canvas.
  if (thermalCanvas && !document.getElementById('dev-panel')) {
    initThermalAscii(thermalCanvas, { art: ASCII_ART, ramp: RAMP_BENGALI });
  }

  // Subscribe to universal reactive store
  store.subscribe('theme', (theme) => {
    document.body.setAttribute('data-theme', theme);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

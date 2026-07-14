import { initParticles } from './three-particles.js';
import { initAnimations } from './animations.js';
import { initNav } from './nav.js';
import { createTerminal, startBoot } from './terminal.js';
import { bootVM } from './v86-launcher.js';

window.bootVM = bootVM;

function init() {
  initParticles();
  initNav();
  initAnimations();

  const container = document.getElementById('terminal-container');
  if (container && typeof Terminal !== 'undefined') {
    const term = createTerminal(container);
    startBoot();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

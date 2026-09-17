import { isMotionOK } from './motion.js';

let isAnimatingScroll = false;

// Live gate on the single motion policy (js/motion.js) — read per call, so
// mid-session flips (and saveData / slow-2g) take effect without a reload.
const noAnim = () => isMotionOK() === false || typeof anime === 'undefined';

function initNav() {
  initMobileToggle();
  initActiveTracking();
  initDotScroll();
}

function initMobileToggle() {
  const toggle = document.getElementById('navToggle');
  const dialog = document.getElementById('nav-dialog');
  if (!toggle || !dialog) return;

  toggle.setAttribute('aria-controls', 'nav-dialog');
  toggle.setAttribute('aria-expanded', 'false');

  // Native <dialog> is modal: Esc closes it (cancel -> close), the backdrop
  // blocks the page, and no overlay z-index or body scroll-lock is needed.
  // Open/close is instant by design so prefers-reduced-motion needs no
  // special case here.
  const syncToggle = (isOpen) => {
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  };

  const openDialog = () => {
    if (dialog.open) return;
    dialog.showModal();
    syncToggle(true);
    const firstLink = dialog.querySelector('a');
    if (firstLink) firstLink.focus();
  };

  const closeDialog = () => {
    if (dialog.open === false) return;
    dialog.close();
  };

  toggle.addEventListener('click', openDialog);

  dialog.addEventListener('close', () => {
    syncToggle(false);
    toggle.focus();
  });

  dialog.addEventListener('click', (clickEvent) => {
    if (clickEvent.target === dialog) closeDialog();
  });

  dialog.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeDialog);
  });
}

const sectionIds = ['hero-target', 'about', 'projects', 'certifications', 'contact'];

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  const performScroll = () => {
    const y = target.getBoundingClientRect().top + window.scrollY;
    isAnimatingScroll = true;
    if (!noAnim()) {
      anime.animate(document.scrollingElement, {
        scrollTop: y,
        duration: 1200,
        ease: 'inOut(2)',
      });
      setTimeout(() => { isAnimatingScroll = false; }, 1300);
    } else {
      // Instant while the motion policy is off: an explicit smooth scroll
      // would animate against the user's reduced-motion need.
      window.scrollTo({ top: y, behavior: 'auto' });
      setTimeout(() => { isAnimatingScroll = false; }, 400);
    }
  };

  if (typeof document.startViewTransition === 'function' && !noAnim()) {
    document.startViewTransition(() => performScroll());
  } else {
    performScroll();
  }
}

function initDotScroll() {
  document.querySelectorAll('.nav-dot').forEach((dotButton) => {
    dotButton.addEventListener('click', () => {
      const section = dotButton.dataset.section;
      scrollToSection(section);
      // Phase sync rides the shared --cycle-phase (css/tokens.css): no
      // inline animation-delay here, so activating a dot never restarts its
      // colorcycle mid-flight and every dot stays in step with the cards.
      document.querySelectorAll('.nav-dot').forEach((otherButton) => {
        otherButton.classList.toggle('active', otherButton.dataset.section === section);
      });
    });
  });
}

function initActiveTracking() {
  const dotBtns = document.querySelectorAll('.nav-dot');

  function updateActive(id) {
    dotBtns.forEach((dotButton) => {
      dotButton.classList.toggle('active', dotButton.dataset.section === id);
    });
  }

  // The Motion library is currently not loaded (footer credit only), so this
  // would poll forever and scroll-spy would never init — cap the retries.
  let motionTries = 0;
  const checkMotion = setInterval(() => {
    if (!window.Motion) {
      if (++motionTries > 100) clearInterval(checkMotion); // ~20s, then give up
      return;
    }
    clearInterval(checkMotion);
    window.Motion.scroll(() => {
      if (isAnimatingScroll) return;
      const viewportH = window.innerHeight;
      let activeId = sectionIds[0];
      let maxVisible = 0;
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const visible = Math.min(rect.bottom, viewportH) - Math.max(rect.top, 0);
        if (visible > maxVisible) {
          maxVisible = visible;
          activeId = id;
        }
      }
      updateActive(activeId);
    });
  }, 200);
}

export { initNav };

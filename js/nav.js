import { isMotionOK } from './motion.js';

let isAnimatingScroll = false;
// Cancellable dot-scroll tween: a second dot click cancels the in-flight
// tween instead of fighting it, and the html scroll-behavior override below
// guarantees a single scroll driver while the tween runs.
let currentScrollTween = null;
let scrollRestoreTimer = 0;

// Live gate on the single motion policy (js/motion.js) — read per call, so
// mid-session flips (and saveData / slow-2g) take effect without a reload.
const noAnim = () => isMotionOK() === false || typeof anime === 'undefined';

function initNav() {
  initMobileToggle();
  initActiveTracking();
  initDotScroll();
  initFixedNavOffset();
}

function readNavHeight() {
  const barNode = document.querySelector(`.doc-nav`);
  if (!barNode) return 0;
  return barNode.offsetHeight;
}

function syncNavHeightVar() {
  const barHeight = readNavHeight();
  const pageRoot = document.documentElement;
  pageRoot.style.setProperty(`--doc-nav-height`, `${barHeight}px`);
}

function initFixedNavOffset() {
  syncNavHeightVar();
  window.addEventListener(`resize`, () => {
    syncNavHeightVar();
  });
  const fontSet = document.fonts;
  if (fontSet && typeof fontSet.ready.then === `function`) {
    fontSet.ready.then(() => {
      syncNavHeightVar();
    }).catch((fontError) => {
      console.warn(`nav height font sync skipped: ${fontError.message}`);
    });
  }
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

function scrollToSection(sectionId) {
  const targetNode = document.getElementById(sectionId);
  if (!targetNode) return;
  // Single driver, no view-transition snapshot: the old path wrapped the
  // anime tween in a VT update callback while html kept
  // scroll-behavior:smooth, so the VT snapshot, the CSS smooth scroll, and
  // the anime scrollTop tween fought over the same scroll offset (glitch,
  // then tween, then jump-back when the stale snapshot/offset resolved).
  // Dot scrolls now take exactly one path: cancellable anime tween with
  // scroll-behavior parked at auto, or native instant when the motion
  // policy is off. The destination y is recomputed fresh on every click
  // fresh on every click (after layout, never cached), so content-visibility
  // skips in .certs-section cannot serve a stale offset.
  const performScroll = () => {
    const barNode = document.querySelector(`.doc-nav`);
    const barHeight = barNode ? barNode.offsetHeight : 0;
    const rawDest = targetNode.getBoundingClientRect().top + window.scrollY;
    const fixedDest = rawDest - barHeight;
    const destY = fixedDest < 0 ? 0 : fixedDest;
    try {
      if (currentScrollTween && typeof currentScrollTween.cancel === 'function') {
        currentScrollTween.cancel();
      }
    } catch (cancelError) {
      console.warn(`nav dot scroll cancel skipped: ${cancelError.message}`);
    }
    currentScrollTween = null;
    if (scrollRestoreTimer) {
      clearTimeout(scrollRestoreTimer);
      scrollRestoreTimer = 0;
    }
    isAnimatingScroll = true;
    if (!noAnim()) {
      const rootNode = document.documentElement;
      const priorBehavior = rootNode.style.scrollBehavior;
      rootNode.style.scrollBehavior = `auto`;
      const settleScroll = () => {
        rootNode.style.scrollBehavior = priorBehavior;
        currentScrollTween = null;
        isAnimatingScroll = false;
      };
      try {
        currentScrollTween = anime.animate(document.scrollingElement, {
          scrollTop: destY,
          duration: 1200,
          ease: `inOut(2)`,
          onComplete: () => {
            if (scrollRestoreTimer) {
              clearTimeout(scrollRestoreTimer);
              scrollRestoreTimer = 0;
            }
            settleScroll();
          },
        });
      } catch (tweenError) {
        console.warn(`nav dot tween skipped: ${tweenError.message}`);
        window.scrollTo({ top: destY, behavior: `auto` });
        settleScroll();
        return;
      }
      scrollRestoreTimer = setTimeout(() => {
        scrollRestoreTimer = 0;
        settleScroll();
      }, 1400);
    } else {
      // Instant while the motion policy is off: an explicit smooth scroll
      // would animate against the user's reduced-motion need.
      window.scrollTo({ top: destY, behavior: `auto` });
      setTimeout(() => { isAnimatingScroll = false; }, 400);
    }
  };

  performScroll();
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

let isAnimatingScroll = false;
const navStartTime = Date.now();

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noAnim = () => prefersReduced || typeof anime === 'undefined';

function initNav() {
  initMobileToggle();
  initActiveTracking();
  initDotScroll();
}

function initMobileToggle() {
  const toggle = document.getElementById('navToggle');
  const overlay = document.getElementById('navOverlay');
  if (!toggle || !overlay) return;

  toggle.addEventListener('click', () => {
    const open = toggle.classList.toggle('open');
    overlay.classList.toggle('open', open);
    if (open) {
      overlay.style.display = 'flex';
      if (!noAnim()) anime.animate(overlay, { opacity: [0, 1], duration: 300, ease: 'out(3)' });
      else overlay.style.opacity = '1';
    } else {
      if (!noAnim()) {
        anime.animate(overlay, { opacity: 0, duration: 200, ease: 'in(2)' });
        setTimeout(() => { overlay.style.display = 'none'; }, 250);
      } else {
        overlay.style.display = 'none';
      }
    }
  });

  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      toggle.classList.remove('open');
      overlay.classList.remove('open');
      if (!noAnim()) {
        anime.animate(overlay, { opacity: 0, duration: 200, ease: 'in(2)' });
        setTimeout(() => { overlay.style.display = 'none'; }, 250);
      } else {
        overlay.style.display = 'none';
      }
    });
  });
}

const sectionIds = ['hero-target', 'about', 'projects', 'certifications', 'resume', 'contact'];

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
      window.scrollTo({ top: y, behavior: 'smooth' });
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
  document.querySelectorAll('.nav-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      scrollToSection(section);
      const phase = ((Date.now() - navStartTime) / 1000) % 6;
      document.querySelectorAll('.nav-dot').forEach(b => {
        b.classList.toggle('active', b.dataset.section === section);
        b.style.animationDelay = b.dataset.section === section ? `-${phase}s` : '';
      });
    });
  });
}

function initActiveTracking() {
  const dotBtns = document.querySelectorAll('.nav-dot');

  function updateActive(id) {
    const phase = ((Date.now() - navStartTime) / 1000) % 6;
    dotBtns.forEach(btn => {
      const isActive = btn.dataset.section === id;
      btn.classList.toggle('active', isActive);
      btn.style.animationDelay = isActive ? `-${phase}s` : '';
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

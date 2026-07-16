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
        anime.animate(overlay, { opacity: 0, duration: 200, ease: 'in(2)' }).finished.then(() => {
          overlay.style.display = 'none';
        });
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
        anime.animate(overlay, { opacity: 0, duration: 200, ease: 'in(2)' }).finished.then(() => {
          overlay.style.display = 'none';
        });
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
  const y = target.getBoundingClientRect().top + window.scrollY;
  if (!noAnim()) {
    anime.animate(document.scrollingElement, {
      scrollTop: y,
      duration: 1200,
      ease: 'inOut(2)',
    });
  } else {
    window.scrollTo({ top: y, behavior: 'smooth' });
  }
}

function initDotScroll() {
  document.querySelectorAll('.nav-dot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      scrollToSection(btn.dataset.section);
    });
  });
}

function initActiveTracking() {
  const dotBtns = document.querySelectorAll('.nav-dot');

  function updateActive(id) {
    dotBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.section === id));
  }

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.intersectionRatio - b.intersectionRatio);
    if (visible.length) updateActive(visible[visible.length - 1].target.id);
  }, { threshold: [0.2, 0.5, 0.8] });

  sectionIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

export { initNav };

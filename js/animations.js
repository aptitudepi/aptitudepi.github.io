const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noAnim = () => prefersReduced || typeof anime === 'undefined';

function initAnimations() {
  if (noAnim()) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    document.querySelectorAll('.spotlight-card, .bento-card, .cert-badge, .social-link').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  initMotionIntegration();
  initScrollProgress();
  initRevealObserver();
  initSpotlightTracking();
  initSocialHover();
  initCertHover();
  initResumePulse();
}

function initMotionIntegration() {
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import { animate, scroll, inView, hover, spring } from 'https://cdn.jsdelivr.net/npm/motion/+esm';
    window.Motion = { animate, scroll, inView, hover, spring };
  `;
  document.body.appendChild(script);
}

function initScrollProgress() {
  const bar = document.getElementById('progressBar');
  if (!bar) return;

  const checkMotion = setInterval(() => {
    if (window.Motion) {
      clearInterval(checkMotion);
      window.Motion.scroll((progress) => {
        bar.style.scale = `${progress} 1`;
      });
    }
  }, 200);
}

function initRevealObserver() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;

      if (el.classList.contains('spotlight-card') || el.classList.contains('bento-card')) {
        const idx = parseInt(el.dataset.index) || 0;
        anime.animate(el, {
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 500,
          ease: 'out(3)',
          delay: idx * 100,
        });
        observer.unobserve(el);
        return;
      }

      if (el.classList.contains('cert-badge')) {
        const idx = Array.from(el.parentElement.children).indexOf(el);
        anime.animate(el, {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 400,
          ease: 'out(3)',
          delay: idx * 60,
        });
        observer.unobserve(el);
        return;
      }

      if (el.classList.contains('social-link')) {
        const idx = Array.from(el.parentElement.children).indexOf(el);
        anime.animate(el, {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 400,
          ease: 'out(3)',
          delay: idx * 80,
        });
        observer.unobserve(el);
        return;
      }

      if (el.classList.contains('resume-download')) {
        anime.animate(el, {
          opacity: [0, 1],
          translateY: [16, 0],
          duration: 500,
          ease: 'out(3)',
        });
        observer.unobserve(el);
        return;
      }

      anime.animate(el, {
        opacity: [0, 1],
        translateY: [20, 0],
        duration: 500,
        ease: 'out(3)',
      });
      observer.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  document.querySelectorAll('.spotlight-card, .bento-card').forEach(el => observer.observe(el));
  document.querySelectorAll('.certs-grid').forEach(el => observer.observe(el));
  document.querySelectorAll('.social-grid').forEach(el => observer.observe(el));
  document.querySelectorAll('.section-header').forEach(el => observer.observe(el));
  document.querySelectorAll('.about-grid').forEach(el => observer.observe(el));
  document.querySelectorAll('.cert-badge').forEach(el => observer.observe(el));
  document.querySelectorAll('.social-link').forEach(el => observer.observe(el));
  const resumeCta = document.querySelector('.resume-download');
  if (resumeCta) observer.observe(resumeCta);
}

function initSpotlightTracking() {
  document.querySelectorAll('.spotlight-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      card.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });
}

function initSocialHover() {
  document.querySelectorAll('.social-link').forEach(link => {
    link.addEventListener('mouseenter', () => {
      anime.animate(link, { scale: 1.15, translateY: -4, duration: 400, ease: 'spring(1, 80, 10, 0)' });
    });
    link.addEventListener('mouseleave', () => {
      anime.animate(link, { scale: 1, translateY: 0, duration: 400, ease: 'spring(1, 80, 10, 0)' });
    });
  });
}

function initCertHover() {
  document.querySelectorAll('.cert-badge').forEach(badge => {
    badge.addEventListener('mouseenter', () => {
      anime.animate(badge, { scale: 1.06, duration: 300, ease: 'out(3)' });
    });
    badge.addEventListener('mouseleave', () => {
      anime.animate(badge, { scale: 1, duration: 300, ease: 'out(3)' });
    });
  });
}

function initResumePulse() {
  const btn = document.querySelector('.resume-download a');
  if (!btn) return;
  anime.animate(btn, {
    boxShadow: [
      '0 0 24px var(--color-primary-glow)',
      '0 0 40px var(--color-primary-glow)',
      '0 0 24px var(--color-primary-glow)',
    ],
    duration: 2000,
    loop: true,
    ease: 'inOut(2)',
  });
}

export { initAnimations };

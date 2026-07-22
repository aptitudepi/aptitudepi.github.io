const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noAnim = () => prefersReduced || typeof anime === 'undefined';

function initAnimations() {
  if (noAnim()) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    document.querySelectorAll('.spotlight-card, .bento-card, .cert-badge, .social-link, .section-header').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  initMotionIntegration();
  initScrollProgress();
  initRevealObserver();
  initCardTracking();
  initSocialHover();
  initCertHover();
  initResumePulse();
  initParticleBurst();
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

      if (el.classList.contains('section-header')) {
        const h2 = el.querySelector('h2');
        if (h2) {
          const originalText = h2.textContent.trim();
          h2.textContent = '';
          anime.animate(h2, {
            innerHTML: anime.scrambleText({
              text: originalText,
              duration: 1000,
              ease: 'out(2)',
              from: 'left',
              revealRate: 40,
              settleDuration: 200,
            })
          });
        }
        anime.animate(el, {
          opacity: [0, 1],
          translateY: [20, 0],
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

function initCardTracking() {
  const tilt = (nx, ny) => ({ rx: ny * -6, ry: nx * 6 });

  document.querySelectorAll('.spotlight-card, .bento-card').forEach(card => {
    let gx = 0, gy = 0, tx = 0, ty = 0;
    let rx = 0, ry = 0, trx = 0, trY = 0;
    let raf = null;
    const isBento = card.classList.contains('bento-card');

    const tick = () => {
      gx += (tx - gx) * 0.1;
      gy += (ty - gy) * 0.1;
      rx += (trx - rx) * 0.1;
      ry += (trY - ry) * 0.1;
      card.style.setProperty('--gx', gx.toFixed(1));
      card.style.setProperty('--gy', gy.toFixed(1));
      if (!isBento) {
        card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
      }
      const done = Math.abs(gx - tx) < 0.3 && Math.abs(gy - ty) < 0.3 && (isBento || (Math.abs(rx) < 0.05 && Math.abs(ry) < 0.05));
      if (done) { raf = null; return; }
      raf = requestAnimationFrame(tick);
    };

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      card.style.setProperty('--mx', `${mx}px`);
      card.style.setProperty('--my', `${my}px`);
      tx = mx; ty = my;
      const { rx: rxv, ry: ryv } = tilt((mx / rect.width) * 2 - 1, (my / rect.height) * 2 - 1);
      trx = rxv; trY = ryv;
      if (!raf) raf = requestAnimationFrame(tick);
    });

    card.addEventListener('mouseleave', () => {
      tx = -250; ty = -250;
      trx = 0; trY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
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

function initParticleBurst() {
  const canvas = document.createElement('canvas');
  canvas.id = 'burst-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let particles = [];
  let raf = null;

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  window.addEventListener('resize', resize);
  resize();

  function burst(x, y) {
    const colors = ['#0000FF', '#0044FF', '#0088FF', '#FF2200', '#FF0044', '#FF0088', '#fff'];
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
        decay: 0.008 + Math.random() * 0.015,
      });
    }
    if (!raf) raf = requestAnimationFrame(draw);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.life -= p.decay;
      if (p.life <= 0) continue;
      alive = true;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.life > 0);
    if (alive) { raf = requestAnimationFrame(draw); }
    else { raf = null; particles = []; }
  }

  document.querySelectorAll('.view-more-cta a, .resume-download a, .project-link').forEach(el => {
    el.addEventListener('click', e => {
      const rect = el.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
  });
}

export { initAnimations };

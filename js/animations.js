const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const noAnim = () => prefersReduced || typeof anime === 'undefined';

function initAnimations() {
  if (noAnim()) {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    document.querySelectorAll('.spotlight-card, .bento-card, .cert-badge, .social-link, .section-header, .about-text').forEach(el => {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  initMotionIntegration();
  initScrollProgress();
  initHeroTimeline();
  initRevealObserver();
  initCardTracking();
  initSectionDividers();
  initBentoSync();
  initAboutScroll();
  initSocialHover();
  initCertHover();
  initProjectLinkHover();
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

function initHeroTimeline() {
  const dots = document.querySelectorAll('.terminal-dot');
  const title = document.querySelector('.terminal-title');
  if (!dots.length || !title) return;
  anime.createTimeline()
    .add(dots, { scale: [0, 1], opacity: [0, 1], duration: 200, ease: 'out(3)' }, 0)
    .add(title, { opacity: [0, 1], translateY: [-6, 0], duration: 300, ease: 'out(3)' }, 250);
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

      if (el.classList.contains('spotlight-card')) {
        const idx = parseInt(el.dataset.index) || 0;
        anime.animate(el, {
          opacity: [0, 1],
          translateY: [24, 0],
          duration: 500,
          ease: 'out(3)',
          delay: idx * 100,
          composition: 'blend',
        });
        observer.unobserve(el);
        return;
      }

      if (el.classList.contains('certs-grid')) {
        const badges = el.querySelectorAll('.cert-badge');
        const cols = window.innerWidth < 768 ? 2 : 4;
        anime.animate(badges, {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 300,
          ease: 'out(3)',
          delay: anime.stagger(30, { grid: [cols, Math.ceil(badges.length / cols)], from: 'center' }),
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
  document.querySelectorAll('.spotlight-card').forEach(el => observer.observe(el));


  document.querySelectorAll('.section-header').forEach(el => observer.observe(el));

  document.querySelectorAll('.certs-grid').forEach(el => observer.observe(el));
  document.querySelectorAll('.social-link').forEach(el => observer.observe(el));
  const resumeCta = document.querySelector('.resume-download');
  if (resumeCta) observer.observe(resumeCta);
}

function initCardTracking() {
  const tilt = (nx, ny) => ({ rx: ny * -6, ry: nx * 6 });

  document.querySelectorAll('.spotlight-card, .bento-card, .cert-badge').forEach(card => {
    let gx = 0, gy = 0, tx = 0, ty = 0;
    let rx = 0, ry = 0, trx = 0, trY = 0;
    let raf = null;
    const noTilt = card.classList.contains('bento-card') || card.classList.contains('cert-badge');

    const tick = () => {
      gx += (tx - gx) * 0.18;
      gy += (ty - gy) * 0.18;
      rx += (trx - rx) * 0.18;
      ry += (trY - ry) * 0.18;
      card.style.setProperty('--gx', gx.toFixed(1));
      card.style.setProperty('--gy', gy.toFixed(1));
      if (!noTilt) {
        card.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateY(-2px)`;
      }
      const done = Math.abs(gx - tx) < 0.3 && Math.abs(gy - ty) < 0.3 && (noTilt || (Math.abs(rx) < 0.05 && Math.abs(ry) < 0.05));
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

function initSectionDividers() {
  const paths = document.querySelectorAll('.section-divider svg path');
  if (!paths.length) return;
  const divs = document.querySelectorAll('.section-divider');
  divs.forEach((div, i) => {
    const path = div.querySelector('svg path');
    if (!path) return;
    const drawable = anime.createDrawable(path);
    anime.animate(drawable, {
      draw: ['0 0', '1 1'],
      duration: 2000,
      ease: 'inOut(3)',
      delay: i * 200,
      autoplay: anime.onScroll({ sync: true }),
    });
  });
}

function initBentoSync() {
  document.querySelectorAll('.bento-card').forEach(card => {
    card.style.opacity = '0';
    anime.animate(card, {
      opacity: [0, 1],
      translateY: [16, 0],
      duration: 800,
      ease: 'out(3)',
      composition: 'blend',
      autoplay: anime.onScroll({ sync: true }),
    });
  });
}

function initAboutScroll() {
  const el = document.querySelector('.about-text');
  if (!el) return;
  el.style.opacity = '0';
  anime.animate(el, {
    opacity: [0, 1],
    translateY: [16, 0],
    duration: 1200,
    ease: 'out(3)',
    autoplay: anime.onScroll({ sync: true }),
  });
}

function initSocialHover() {
  const springBouncy = anime.createSpring({ stiffness: 320, damping: 14 });
  const springSnap = anime.createSpring({ stiffness: 400, damping: 10 });
  document.querySelectorAll('.social-link').forEach(link => {
    const icon = link.querySelector('svg');
    link.addEventListener('mouseenter', () => {
      anime.animate(link, { scale: 1.18, translateY: -5, duration: 500, ease: springBouncy });
      if (icon) anime.animate(icon, { rotate: [0, 10], duration: 400, ease: springSnap });
    });
    link.addEventListener('mouseleave', () => {
      anime.animate(link, { scale: 1, translateY: 0, duration: 500, ease: springBouncy });
      if (icon) anime.animate(icon, { rotate: [10, 0], duration: 400, ease: springSnap });
    });
  });
}

function initCertHover() {
  const spring = anime.createSpring({ stiffness: 260, damping: 18 });
  document.querySelectorAll('.cert-badge').forEach(badge => {
    badge.addEventListener('mouseenter', () => {
      anime.animate(badge, { scale: 1.07, duration: 400, ease: spring });
    });
    badge.addEventListener('mouseleave', () => {
      anime.animate(badge, { scale: 1, duration: 400, ease: spring });
    });
  });
}

function initProjectLinkHover() {
  const spring = anime.createSpring({ stiffness: 350, damping: 16 });
  const springSnap = anime.createSpring({ stiffness: 450, damping: 10 });
  document.querySelectorAll('.project-link').forEach(link => {
    const arrow = link.querySelector('svg path');
    if (!arrow) return;
    let drawable = null;
    link.addEventListener('mouseenter', () => {
      anime.animate(link, { gap: '12px', duration: 300, ease: spring });
      if (!drawable) drawable = anime.createDrawable(arrow);
      anime.animate(drawable, { draw: ['0 0', '1 1'], duration: 300, ease: springSnap });
    });
    link.addEventListener('mouseleave', () => {
      anime.animate(link, { gap: '8px', duration: 300, ease: spring });
      if (drawable) anime.animate(drawable, { draw: ['1 1', '0 0'], duration: 300, ease: springSnap });
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

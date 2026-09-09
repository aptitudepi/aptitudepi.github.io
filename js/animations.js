import { isMotionOK, onMotionChange } from './motion.js';

// Live gate on the single motion policy (js/motion.js): prefers-reduced-motion,
// saveData / slow-2g, or a manual override. Never snapshotted — mid-session
// flips re-settle through the onMotionChange subscription in initAnimations.
const noAnim = () => isMotionOK() === false || typeof anime === 'undefined';

let resumePulseHandle = null;
let magneticEnabled = true;
let animatedBooted = false;

function initAnimations() {
  initStatFlow();
  initResumePulse();
  // Fires immediately with the current state, so boot and every mid-session
  // flip settle through the same path: off parks everything statically, on
  // boots the animated layers once and resumes them afterwards.
  onMotionChange((motionOff) => {
    if (motionOff) {
      settleMotionState(true);
      return;
    }
    bootAnimatedLayers();
    settleMotionState(false);
  });
}

// Parks (motion off) or resumes (motion on) the ambient JS effects. The CSS
// kill-switch (html[data-motion="off"], see css/motion.css) freezes the
// declarative cycles instantly; this settles what CSS cannot reach: the
// resume-button pulse loop, the magnetic headings flag, and every reveal
// target that an IntersectionObserver has not reached yet.
function settleMotionState(motionOff) {
  magneticEnabled = motionOff === false;
  if (resumePulseHandle && typeof resumePulseHandle.pause === 'function' && typeof resumePulseHandle.play === 'function') {
    if (motionOff) {
      resumePulseHandle.pause();
    } else {
      resumePulseHandle.play();
    }
  }
  if (motionOff) {
    document.querySelectorAll('.reveal').forEach((revealNode) => {
      revealNode.classList.add('visible');
    });
    document.querySelectorAll('.spotlight-card, .bento-card, .cert-badge, .social-link, .section-header, .about-text').forEach((settleNode) => {
      settleNode.style.opacity = '1';
      settleNode.style.transform = 'none';
    });
  }
}

function bootAnimatedLayers() {
  if (animatedBooted) return;
  animatedBooted = true;
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
  initMagneticText();
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
  const title = [...document.querySelectorAll('.doc-nav-crumb, .terminal-title')];
  if (!dots.length || !title.length) return;
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
  const tiltFor = (normX, normY) => ({ tiltX: normY * -6, tiltY: normX * 6 });

  document.querySelectorAll('.spotlight-card, .bento-card, .cert-badge').forEach((trackedCard) => {
    let glowX = 0, glowY = 0, targetGlowX = 0, targetGlowY = 0;
    let tiltX = 0, tiltY = 0, targetTiltX = 0, targetTiltY = 0;
    let frameHandle = null;
    const skipTilt = trackedCard.classList.contains('bento-card') || trackedCard.classList.contains('cert-badge');

    const tickTrack = () => {
      glowX += (targetGlowX - glowX) * 0.18;
      glowY += (targetGlowY - glowY) * 0.18;
      tiltX += (targetTiltX - tiltX) * 0.18;
      tiltY += (targetTiltY - tiltY) * 0.18;
      trackedCard.style.setProperty('--gx', glowX.toFixed(1));
      trackedCard.style.setProperty('--gy', glowY.toFixed(1));
      // Tilt is pointer flourish: parked while the motion policy is off (the
      // glow position above still updates — it is finite feedback, and the
      // matching :focus-visible/.is-tapped CSS keeps keyboard and touch
      // users on the same visual language).
      if (!skipTilt && isMotionOK()) {
        trackedCard.style.transform = `perspective(900px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg) translateY(-2px)`;
      }
      const settledGlow = Math.abs(glowX - targetGlowX) < 0.3 && Math.abs(glowY - targetGlowY) < 0.3;
      const settledTilt = skipTilt || isMotionOK() === false || (Math.abs(tiltX) < 0.05 && Math.abs(tiltY) < 0.05);
      if (settledGlow && settledTilt) { frameHandle = null; return; }
      frameHandle = requestAnimationFrame(tickTrack);
    };

    const kickTrack = () => {
      if (!frameHandle) frameHandle = requestAnimationFrame(tickTrack);
    };

    trackedCard.addEventListener('mousemove', (hoverEvent) => {
      const cardRect = trackedCard.getBoundingClientRect();
      const pointerX = hoverEvent.clientX - cardRect.left;
      const pointerY = hoverEvent.clientY - cardRect.top;
      trackedCard.style.setProperty('--mx', `${pointerX}px`);
      trackedCard.style.setProperty('--my', `${pointerY}px`);
      targetGlowX = pointerX; targetGlowY = pointerY;
      const tiltPair = tiltFor((pointerX / cardRect.width) * 2 - 1, (pointerY / cardRect.height) * 2 - 1);
      targetTiltX = tiltPair.tiltX; targetTiltY = tiltPair.tiltY;
      kickTrack();
    });

    trackedCard.addEventListener('mouseleave', () => {
      targetGlowX = -250; targetGlowY = -250;
      targetTiltX = 0; targetTiltY = 0;
      trackedCard.style.transform = '';
      trackedCard.classList.remove('is-tapped');
      kickTrack();
    });

    // Keyboard + touch equivalents of the hover reveal: focusing a card's
    // inner link (or tapping the card) centres the glow and raises the same
    // .is-tapped treatment the CSS :focus-within rules paint.
    const showCenterGlow = () => {
      const cardRect = trackedCard.getBoundingClientRect();
      const centerX = cardRect.width / 2;
      const centerY = cardRect.height / 2;
      trackedCard.style.setProperty('--mx', `${centerX}px`);
      trackedCard.style.setProperty('--my', `${centerY}px`);
      targetGlowX = centerX; targetGlowY = centerY;
      targetTiltX = 0; targetTiltY = 0;
      trackedCard.classList.add('is-tapped');
      kickTrack();
    };

    trackedCard.addEventListener('focusin', () => {
      showCenterGlow();
    });

    trackedCard.addEventListener('focusout', () => {
      trackedCard.classList.remove('is-tapped');
    });

    trackedCard.addEventListener('touchstart', (touchEvent) => {
      const firstTouch = touchEvent.touches ? touchEvent.touches[0] : null;
      if (firstTouch) {
        const cardRect = trackedCard.getBoundingClientRect();
        const touchX = firstTouch.clientX - cardRect.left;
        const touchY = firstTouch.clientY - cardRect.top;
        trackedCard.style.setProperty('--mx', `${touchX}px`);
        trackedCard.style.setProperty('--my', `${touchY}px`);
        targetGlowX = touchX; targetGlowY = touchY;
      } else {
        showCenterGlow();
        return;
      }
      targetTiltX = 0; targetTiltY = 0;
      trackedCard.classList.add('is-tapped');
      kickTrack();
    }, { passive: true });

    trackedCard.addEventListener('touchend', () => {
      trackedCard.classList.remove('is-tapped');
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
  const springBouncy = anime.spring({ stiffness: 320, damping: 14 });
  const springSnap = anime.spring({ stiffness: 400, damping: 10 });
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
  const spring = anime.spring({ stiffness: 260, damping: 18 });
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
  const spring = anime.spring({ stiffness: 350, damping: 16 });
  const springSnap = anime.spring({ stiffness: 450, damping: 10 });
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
  const resumeButton = document.querySelector('.resume-download a');
  if (!resumeButton || typeof anime === 'undefined') return;
  resumePulseHandle = anime.animate(resumeButton, {
    boxShadow: [
      '0 0 24px var(--color-primary-glow)',
      '0 0 40px var(--color-primary-glow)',
      '0 0 24px var(--color-primary-glow)',
    ],
    duration: 2000,
    loop: true,
    ease: 'inOut(2)',
  });
  // A motion-off boot still owns the handle so a later mid-session flip to
  // motion-on can resume the same loop instead of stacking a second one.
  if (!isMotionOK() && resumePulseHandle && typeof resumePulseHandle.pause === 'function') {
    resumePulseHandle.pause();
  }
}

function initMagneticText() {
  // Magnetic pull is kept for actions only (buttons/links): non-action
  // headings no longer carry data-magnetic in the markup, and this selector
  // refuses to re-enlarge the set if one ever slips back in.
  document.querySelectorAll('a[data-magnetic], button[data-magnetic]').forEach(el => {
    let raf = null, targetX = 0, targetY = 0, curX = 0, curY = 0;
    const maxDist = 30;
    el.addEventListener('mousemove', e => {
      if (!magneticEnabled) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const strength = Math.min(1, dist / 200);
      const angle = Math.atan2(dy, dx);
      targetX = Math.cos(angle) * maxDist * strength;
      targetY = Math.sin(angle) * maxDist * strength;
      el.classList.add('magnetic-active');
      if (!raf) {
        raf = requestAnimationFrame(function tick() {
          curX += (targetX - curX) * 0.15;
          curY += (targetY - curY) * 0.15;
          el.style.transform = `translate(${curX.toFixed(1)}px, ${curY.toFixed(1)}px)`;
          if (Math.abs(curX - targetX) > 0.1 || Math.abs(curY - targetY) > 0.1) {
            raf = requestAnimationFrame(tick);
          } else { raf = null; }
        });
      }
    });
    el.addEventListener('mouseleave', () => {
      targetX = 0; targetY = 0;
      el.classList.remove('magnetic-active');
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      curX = 0; curY = 0;
      el.style.transform = '';
    });
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
    el.addEventListener('click', () => {
      const rect = el.getBoundingClientRect();
      burst(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
  });
}

export { initAnimations };



function initStatFlow() {
  const grid = document.querySelector('[data-stats-grid]');
  if (!grid) return;
  const items = [...grid.querySelectorAll('.stat-item')];
  if (!items.length) return;

  const setFinal = item => {
    const nf = item.querySelector('number-flow');
    const target = item.dataset.count;
    if (!nf || !target) return;
    if (typeof nf.update === 'function') {
      const n = Number(target);
      if (nf.value === n) return;
      if (!nf.dataset.hydrated) {
        nf.update(0);
        nf.dataset.hydrated = 'true';
      }
      nf.update(n);
    } else {
      nf.setAttribute('value', target);
    }
  };

  if (noAnim() || typeof IntersectionObserver === 'undefined') {
    items.forEach(setFinal);
    return;
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      setFinal(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.4 });
  items.forEach(item => io.observe(item));

  setTimeout(() => {
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible) setFinal(item);
    });
  }, 2000);
}

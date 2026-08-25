// Inspired by bklit-ui ParticleBadge component
// WebGL particle border emitter for certification badges & interactive cards.
//
// Originally every badge got its own WebGL context, its own render loop and
// its own spawn timer — twenty-ish live contexts and loops that ran flat out
// whether or not anything was on screen. That alone could push a weak GPU
// over the edge.
//
// Now the whole page shares ONE fixed overlay canvas and ONE WebGL context.
// Each registered badge is an "emitter": a cached viewport rect that spawns
// particles along its border while it is intersecting the viewport. Particles
// are clipped to their emitter's rect (+bleed), preserving the per-card
// `overflow: hidden` look the old containers gave, without the contexts.
//
// Everything scales continuously against perf.quality() (see perf.js): spawn
// rate, tick cadence and the global particle budget all shrink smoothly as
// quality drops — the effect stays present, just lighter.

import perf from './perf.js';

const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BLEED = 32;
const MAX_DPR = 2;

class SharedParticleField {
  constructor() {
    this.emitters = [];            // { el, rect, visible, hovering }
    this.particles = [];
    this.animFrame = null;
    this.interval = null;
    this.rectsDirty = true;
    this.render = this.render.bind(this);

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    document.body.appendChild(this.canvas);

    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!this.gl) {
      this.canvas.remove();
      return;
    }

    this.initShaders();
    this.resize();

    window.addEventListener('resize', () => { this.resize(); this.rectsDirty = true; }, { passive: true });
    window.addEventListener(
      'scroll',
      () => {
        // Rects are read at most once per frame, batched across scroll events.
        this.rectsDirty = true;
        if (!this.rectRaf) {
          this.rectRaf = requestAnimationFrame(() => {
            this.rectRaf = null;
            this.refreshRects();
          });
        }
      },
      { passive: true }
    );
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.pause();
      else this.resume();
    });

    // Only emitters near/inside the viewport spawn and track hover.
    this.io = new IntersectionObserver(
      entries => {
        let changed = false;
        for (const entry of entries) {
          const em = this.emitters.find(e => e.el === entry.target);
          if (em && em.visible !== entry.isIntersecting) {
            em.visible = entry.isIntersecting;
            changed = true;
          }
        }
        if (changed) {
          // Newly visible emitters may have stale cached rects (anchor jumps).
          this.rectsDirty = true;
          this.syncLoopState();
        }
      },
      { rootMargin: `${BLEED * 2}px` }
    );

    this.startSpawning();
    this.syncLoopState();
  }

  initShaders() {
    const gl = this.gl;
    const vsSource = `
      attribute vec2 a_position;
      attribute float a_size;
      attribute vec4 a_color;
      varying vec4 v_color;
      uniform vec2 u_resolution;
      void main() {
        vec2 clipSpace = (a_position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        gl_PointSize = a_size;
        v_color = a_color;
      }
    `;

    const fsSource = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        vec2 center = gl_PointCoord - vec2(0.5);
        float dist = length(center);
        float alpha = (1.0 - smoothstep(0.0, 0.5, dist)) * v_color.a;
        float glow = exp(-dist * 4.0) * 0.6;
        gl_FragColor = vec4(v_color.rgb, alpha + glow * v_color.a);
      }
    `;

    const createShader = (type, source) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };

    const vs = createShader(gl.VERTEX_SHADER, vsSource);
    const fs = createShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    gl.useProgram(this.program);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    this.posBuffer = gl.createBuffer();
    this.sizeBuffer = gl.createBuffer();
    this.colorBuffer = gl.createBuffer();

    this.uRes = gl.getUniformLocation(this.program, 'u_resolution');
    this.aPos = gl.getAttribLocation(this.program, 'a_position');
    this.aSize = gl.getAttribLocation(this.program, 'a_size');
    this.aColor = gl.getAttribLocation(this.program, 'a_color');
  }

  resize() {
    if (!this.canvas || !this.gl) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    this.dpr = dpr;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  addEmitter(el) {
    if (!this.gl) return;
    const em = { el, rect: null, visible: false, hovering: false };
    this.emitters.push(em);
    el.addEventListener('mouseenter', () => { em.hovering = true; });
    el.addEventListener('mouseleave', () => { em.hovering = false; });
    this.io.observe(el);
    this.rectsDirty = true;
  }

  /** Re-read viewport rects for everything currently marked visible. */
  refreshRects() {
    this.rectsDirty = false;
    for (const em of this.emitters) {
      if (em.visible || em.rect == null) em.rect = em.el.getBoundingClientRect();
    }
  }

  /**
   * Spawn along an emitter's border, in viewport coordinates. Density scales
   * continuously with quality; hovering multiplies it like the old code did.
   */
  burst(em) {
    const q = perf.quality();
    const m = 0.3 + 0.7 * q;
    const count = Math.max(1, Math.round((em.hovering ? 3 : 1) * m));
    const rect = em.rect;
    if (!rect) return;

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      let x = rect.left;
      let y = rect.top;
      if (edge === 0) { x = rect.left + Math.random() * rect.width; }
      else if (edge === 1) { x = rect.right; y = rect.top + Math.random() * rect.height; }
      else if (edge === 2) { x = rect.left + Math.random() * rect.width; y = rect.bottom; }
      else { y = rect.top + Math.random() * rect.height; }

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.2;
      const isRed = Math.random() > 0.5;

      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.3,
        life: 50 + Math.random() * 40,
        maxLife: 90,
        size: 2.0 + Math.random() * 3.5,
        r: (isRed ? 255 : 0) / 255,
        g: (isRed ? 80 : 180) / 255,
        b: 1.0,
        em,
      });
    }

    // Global budget across all emitters, scaled with quality; trim oldest.
    const budget = Math.round(perf.lerp(120, 600));
    if (this.particles.length > budget) {
      this.particles.splice(0, this.particles.length - budget);
    }
  }

  startSpawning() {
    const tickSpawn = () => {
      if (document.visibilityState === 'hidden') return;
      if (this.rectsDirty) this.refreshRects();
      const anyVisible = this.emitters.some(e => e.visible);
      if (!anyVisible) return;
      for (const em of this.emitters) {
        if (em.visible) this.burst(em);
      }
    };
    const schedule = () => {
      clearInterval(this.interval);
      const delay = Math.round(perf.lerp(240, 120));
      this.interval = setInterval(tickSpawn, delay);
    };
    schedule();
    // Re-cadence the spawner when quality shifts materially.
    perf.onChange(() => schedule());
  }

  syncLoopState() {
    const want = !document.hidden && this.emitters.some(e => e.visible);
    if (want && this.animFrame == null) {
      this.animFrame = requestAnimationFrame(this.render);
    } else if (!want && this.animFrame != null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  pause() {
    if (this.animFrame != null) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  resume() {
    this.syncLoopState();
  }

  render() {
    const gl = this.gl;
    if (!gl || !this.program) return;

    if (this.rectsDirty) this.refreshRects();

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const dpr = this.dpr || 1;
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.01;
      p.life -= 1;
      if (p.life <= 0) return false;
      // Clip to the emitting card's rect + bleed — the visual equivalent of
      // the old per-card overflow:hidden container.
      const r = p.em.rect;
      if (!r || !p.em.visible) return false;
      if (
        p.x < r.left - BLEED || p.x > r.right + BLEED ||
        p.y < r.top - BLEED || p.y > r.bottom + BLEED
      ) return false;
      return true;
    });

    if (this.particles.length > 0) {
      const positions = [];
      const sizes = [];
      const colors = [];

      for (const p of this.particles) {
        const alpha = (p.life / p.maxLife) * 0.85;
        positions.push(p.x * dpr, p.y * dpr);
        sizes.push(p.size * dpr * (p.life / p.maxLife + 0.4));
        colors.push(p.r, p.g, p.b, alpha);
      }

      gl.useProgram(this.program);
      gl.uniform2f(this.uRes, this.canvas.width, this.canvas.height);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aPos);
      gl.vertexAttribPointer(this.aPos, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.sizeBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aSize);
      gl.vertexAttribPointer(this.aSize, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.aColor);
      gl.vertexAttribPointer(this.aColor, 4, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, this.particles.length);
    }

    this.animFrame = requestAnimationFrame(this.render);
  }
}

let field = null;

export function initParticleBadges() {
  if (prefersReduced) return;
  const targets = document.querySelectorAll('.cert-badge, .spotlight-card');

  field = new SharedParticleField();
  targets.forEach(el => field.addEmitter(el));

  if (!field.gl) field = null;
}

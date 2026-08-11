// Inspired by bklit-ui ParticleBadge component
// WebGL particle border emitter for certification badges & interactive cards

const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class WebGLParticleBadge {
  constructor(el, options = {}) {
    this.el = el;
    this.bleed = options.bleed || 32;
    this.particles = [];
    this.maxParticles = 200;
    this.isHovering = false;
    this.animFrame = null;
    this.interval = null;

    if (prefersReduced) return;
    this.init();
  }

  init() {
    this.container = document.createElement('div');
    this.container.style.cssText = `position:absolute;inset:-${this.bleed}px;pointer-events:none;z-index:1;overflow:hidden;border-radius:inherit;`;

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;width:100%;height:100%;';
    this.container.appendChild(this.canvas);

    if (!this.el.style.position || this.el.style.position === 'static') {
      this.el.style.position = 'relative';
    }
    this.el.appendChild(this.container);

    this.gl = this.canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!this.gl) return;

    this.initShaders();
    this.resize();

    window.addEventListener('resize', () => this.resize(), { passive: true });
    this.el.addEventListener('mouseenter', () => { this.isHovering = true; this.burst(6); });
    this.el.addEventListener('mouseleave', () => { this.isHovering = false; });

    this.startLoop();
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
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  burst(count = 4) {
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);

    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      let x = this.bleed;
      let y = this.bleed;
      if (edge === 0) { x = Math.random() * w; }
      else if (edge === 1) { x = w - this.bleed; y = Math.random() * h; }
      else if (edge === 2) { x = Math.random() * w; y = h - this.bleed; }
      else { y = Math.random() * h; }

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
        b: 1.0
      });
    }

    if (this.particles.length > this.maxParticles) {
      this.particles = this.particles.slice(-this.maxParticles);
    }
  }

  startLoop() {
    this.interval = setInterval(() => {
      this.burst(this.isHovering ? 3 : 1);
    }, 120);

    const render = () => {
      const gl = this.gl;
      if (!gl || !this.program) return;

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      this.particles = this.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.01;
        p.life -= 1;
        return p.life > 0;
      });

      if (this.particles.length > 0) {
        const dpr = window.devicePixelRatio || 1;
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

      this.animFrame = requestAnimationFrame(render);
    };

    this.animFrame = requestAnimationFrame(render);
  }
}

export function initParticleBadges() {
  if (prefersReduced) return;
  document.querySelectorAll('.cert-badge, .spotlight-card').forEach(el => {
    if (!el.dataset.particleBadge) {
      el.dataset.particleBadge = 'true';
      new WebGLParticleBadge(el);
    }
  });
}

const PARTICLE_COUNTS = { sparse: 600, medium: 1200, dense: 2000 };

const THEMES = {
  aurora: { hueStart: 120, hueRange: 200, saturation: 90, lightness: 62, bg: '5, 5, 8', trailAlpha: 0.06 },
  ember: { hueStart: 0, hueRange: 55, saturation: 95, lightness: 58, bg: '8, 4, 2', trailAlpha: 0.07 },
  ocean: { hueStart: 180, hueRange: 90, saturation: 88, lightness: 60, bg: '2, 6, 10', trailAlpha: 0.06 },
};

function fieldAngle(x, y, t) {
  const s = 0.0025;
  return (
    Math.sin(x * s + t * 0.0007) * Math.PI +
    Math.cos(y * s + t * 0.0005) * Math.PI +
    Math.sin((x + y) * s * 0.6 + t * 0.0009) * Math.PI * 0.6 +
    Math.cos((x - y) * s * 0.4 + t * 0.0006) * Math.PI * 0.4
  );
}

export function createFlowField(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const theme = THEMES[opts.theme] || THEMES.aurora;
  const count = PARTICLE_COUNTS[opts.density] || PARTICLE_COUNTS.medium;
  const dpr = window.devicePixelRatio || 1;

  let width = 0;
  let height = 0;
  let animId = 0;
  let time = 0;
  let particles = [];

  function spawnParticle() {
    const maxLife = 200 + Math.floor(Math.random() * 300);
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      speed: 1.1 + Math.random() * 1.8,
      hue: theme.hueStart + Math.random() * theme.hueRange,
      life: Math.floor(Math.random() * maxLife),
      maxLife,
    };
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);
    ctx.fillStyle = 'rgb(' + theme.bg + ')';
    ctx.fillRect(0, 0, width, height);
    particles = Array.from({ length: count }, spawnParticle);
  }

  function render() {
    time++;
    ctx.fillStyle = 'rgba(' + theme.bg + ', ' + theme.trailAlpha + ')';
    ctx.fillRect(0, 0, width, height);

    for (const p of particles) {
      const angle = fieldAngle(p.x, p.y, time);
      p.x += Math.cos(angle) * p.speed;
      p.y += Math.sin(angle) * p.speed;
      p.life++;

      if (p.life > p.maxLife) {
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        p.life = 0;
        p.hue = theme.hueStart + Math.random() * theme.hueRange;
        continue;
      }

      if (p.x < 0) p.x += width;
      else if (p.x > width) p.x -= width;
      if (p.y < 0) p.y += height;
      else if (p.y > height) p.y -= height;

      const progress = p.life / p.maxLife;
      const fadeIn = Math.min(progress * 8, 1);
      const fadeOut = Math.min((1 - progress) * 6, 1);
      const alpha = fadeIn * fadeOut * 0.9;
      const hueMod = (p.hue + (angle / (Math.PI * 2)) * 70 + 360) % 360;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = 'hsla(' + hueMod + ', ' + theme.saturation + '%, ' + theme.lightness + '%, ' + alpha + ')';
      ctx.fill();
    }

    animId = requestAnimationFrame(render);
  }

  resize();
  window.addEventListener('resize', resize);
  render();

  return function destroy() {
    cancelAnimationFrame(animId);
    window.removeEventListener('resize', resize);
  };
}

// js/devtools.js — on-demand developer sidebar for index.html (the `devmode`
// terminal command lazy-imports this module; dev.html is deleted, this is
// the only copy of the panel wiring). Panel markup + styles live alongside:
// markup is injected below, styles via css/devtools.css. First import mounts
// and applies everything (same boot behavior the standalone page had);
// toggleDevPanel() flips visibility afterwards.
const PANEL_HTML = `<div id="dev-panel" hidden>
  <button class="dev-close" id="dev-panel-close" aria-label="Close dev panel" title="Close">×</button>
  <h3>Topolines</h3>
  <div class="dev-section">
    <div class="dev-row"><label>Enabled</label><input type="checkbox" id="dev-enabled" checked></div>
    <div class="dev-row"><label>Sync w/ site</label><input type="checkbox" id="dev-sync" checked></div>
    <div class="dev-row"><label>Sync saturation</label><input type="range" id="dev-sync-sat" min="0" max="1" step="0.01" value="0.25"><output id="dev-sync-sat-v">0.25</output></div>
  </div>
  <div class="dev-section">
    <div class="dev-row"><label>Color</label><input type="color" id="dev-color" value="#C9B8E8"></div>
    <div class="dev-row"><label>Opacity</label><input type="range" id="dev-opacity" min="0" max="1" step="0.01" value="0.10"><output id="dev-opacity-v">0.10</output></div>
    <div class="dev-row"><label>Line width</label><input type="range" id="dev-linewidth" min="0.2" max="4" step="0.1" value="0.5"><output id="dev-linewidth-v">0.5</output></div>
    <div class="dev-row"><label>Levels</label><input type="range" id="dev-levels" min="2" max="30" step="1" value="30"><output id="dev-levels-v">30</output></div>
    <div class="dev-row"><label>Scale</label><input type="range" id="dev-scale" min="0.3" max="3" step="0.01" value="3"><output id="dev-scale-v">3.00</output></div>
    <div class="dev-row"><label>Speed</label><input type="range" id="dev-speed" min="0" max="0.05" step="0.001" value="0.05"><output id="dev-speed-v">0.05</output></div>
    <div class="dev-row"><label>Warp</label><input type="range" id="dev-warp" min="0" max="0.6" step="0.01" value="0"><output id="dev-warp-v">0.00</output></div>
    <div class="dev-row"><label>Interactive</label><input type="checkbox" id="dev-interactive" checked></div>
    <div class="dev-row"><label>Particle influence</label><input type="range" id="dev-particle-influence" min="0" max="1" step="0.01" value="1"><output id="dev-particle-influence-v">1.00</output></div>
  </div>

  <h3>Acrylic</h3>
  <div class="dev-section">
    <div class="dev-row"><label>Blur</label><input type="range" id="dev-blur" min="0" max="40" step="1" value="10"><output id="dev-blur-v">10px</output></div>
    <div class="dev-row"><label>Bg alpha</label><input type="range" id="dev-glass-alpha" min="0" max="0.6" step="0.01" value="0.20"><output id="dev-glass-alpha-v">0.20</output></div>
    <div class="dev-row"><label>Border alpha</label><input type="range" id="dev-border-alpha" min="0" max="1" step="0.01" value="0.35"><output id="dev-border-alpha-v">0.35</output></div>
  </div>

  <h3>Particles</h3>
  <div class="dev-section">
    <div class="dev-row"><label>Count</label><input type="range" id="dev-p-count" min="1024" max="65536" step="1024" value="65536"><output id="dev-p-count-v">65536</output></div>
    <div class="dev-row"><label>Size</label><input type="range" id="dev-p-size" min="0.1" max="5" step="0.05" value="1"><output id="dev-p-size-v">1.00</output></div>
    <div class="dev-row"><label>FOV</label><input type="range" id="dev-p-fov" min="20" max="120" step="1" value="120"><output id="dev-p-fov-v">120°</output></div>
    <div class="dev-row"><label>CA strength</label><input type="range" id="dev-p-ca" min="0" max="1" step="0.01" value="1"><output id="dev-p-ca-v">1.00</output></div>
    <div class="dev-row"><label>Trail decay</label><input type="range" id="dev-p-decay" min="0.8" max="0.99" step="0.005" value="0.8"><output id="dev-p-decay-v">0.800</output></div>
    <div class="dev-row"><label>Brightness</label><input type="range" id="dev-p-bright" min="0.5" max="3" step="0.05" value="2.6"><output id="dev-p-bright-v">2.60</output></div>
    <div class="dev-row"><label>Scanline</label><input type="range" id="dev-p-scanline" min="0" max="0.05" step="0.001" value="0.02"><output id="dev-p-scanline-v">0.020</output></div>
    <div class="dev-row"><label>Vignette</label><input type="range" id="dev-p-vignette" min="0" max="3" step="0.05" value="1.5"><output id="dev-p-vignette-v">1.50</output></div>
    <div class="dev-row"><label>Rainbow</label><input type="checkbox" id="dev-p-rainbow"></div>
    <div class="dev-row"><label>Sync topo</label><input type="checkbox" id="dev-p-sync-topo" checked></div>
    <div class="dev-row"><label>Topo speed</label><input type="range" id="dev-p-topo-speed" min="0.01" max="1" step="0.01" value="0.25"><output id="dev-p-topo-speed-v">0.25</output></div>
    <div class="dev-row"><label>Quality</label><input type="range" id="dev-p-quality" min="0" max="1" step="0.01" value="1" disabled><output id="dev-p-quality-v">auto</output></div>
    <div class="dev-row"><label>Override</label><input type="checkbox" id="dev-p-override"></div>
  </div>

  <h3>Velocity Network</h3>
  <div class="dev-section">
    <div class="dev-row"><label>Enabled</label><input type="checkbox" id="dev-vn-enabled"></div>
    <div class="dev-row"><label>Opacity</label><input type="range" id="dev-vn-opacity" min="0" max="1" step="0.01" value="1"><output id="dev-vn-opacity-v">1.00</output></div>
  </div>

  <h3>Thermal ASCII</h3>
  <div class="dev-section">
    <div class="dev-row"><label>Enabled</label><input type="checkbox" id="dev-thermal-enabled" checked></div>
    <div class="dev-row"><label>Heat radius</label><input type="range" id="dev-thermal-radius" min="1" max="5" step="1" value="3"><output id="dev-thermal-radius-v">3</output></div>
    <div class="dev-row"><label>Decay</label><input type="range" id="dev-thermal-decay" min="0.85" max="0.99" step="0.01" value="0.93"><output id="dev-thermal-decay-v">0.93</output></div>
    <div class="dev-row"><label>Base density</label><input type="range" id="dev-thermal-density" min="0.3" max="0.7" step="0.01" value="0.45"><output id="dev-thermal-density-v">0.45</output></div>
    <div class="dev-row"><label>Ramp</label>
      <select id="dev-thermal-ramp">
        <option value="default">\` .:-=+*cs#%@</option>
        <option value="blocks">░▒▓█</option>
        <option value="braille">⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋</option>
        <option value="bengali">দ ব দ্ব</option>
        <option value="mixed" selected>░ দ ▒ ব ▓ দ্ব</option>
      </select>
    </div>
  </div>

  <h3>Export</h3>
  <div class="dev-section">
    <div class="dev-row"><button id="dev-export" style="flex:1;cursor:pointer;">📋 Copy settings JSON</button></div>
    <div class="dev-row" id="dev-export-status" style="display:none;color:var(--color-primary,#00f);font-size:0.7rem;justify-content:center;"></div>
  </div>

  <p class="dev-note">
    <b>Topolines</b>: "Sync w/ site" reads <code>--nav-cycle</code> each frame.
    Disable to use the manual colour picker. Particle influence blends the topo
    contour field between noise (0) and particle density (1).<br>
    <b>Acrylic</b>: patches <code>backdrop-filter</code> and glass CSS vars on
    <code>#app</code>, <code>.hero-shell</code>, <code>.doc-nav</code>,
    <code>.spotlight-card</code>, <code>.footer</code>.<br>
    <b>Particles</b>: "Override" lets you pin quality manually; uncheck to
    resume auto-scaling.<br>
    <b>Velocity Network</b>: connects particles with similar velocity directions.<br>
    <b>Thermal ASCII</b>: full-color braille headshot (106×55) that SCRAMBLES and
    flares toward the site's live <code>--nav-cycle</code> color under the cursor
    (sticky left column). Heat radius / decay tune the shimmer.
  </p>
</div>`;
function ensureCss() {
  if (!document.querySelector('link[data-devtools-css]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/devtools.css';
    link.dataset.devtoolsCss = '1';
    document.head.appendChild(link);
  }
}
function ensurePanel() {
  if (!document.getElementById('dev-panel')) document.body.insertAdjacentHTML('beforeend', PANEL_HTML);
}
ensureCss();
ensurePanel();

  const getEl = (id) => document.getElementById(id);

  /* ── Topolines ────────────────────────────── */
  const topo = {
    enabled:     getEl('dev-enabled'),
    sync:        getEl('dev-sync'),
    syncSat:     getEl('dev-sync-sat'),
    color:       getEl('dev-color'),
    opacity:     getEl('dev-opacity'),
    linewidth:   getEl('dev-linewidth'),
    levels:      getEl('dev-levels'),
    scale:       getEl('dev-scale'),
    speed:       getEl('dev-speed'),
    warp:        getEl('dev-warp'),
    interactive: getEl('dev-interactive'),
    particleInfluence: getEl('dev-particle-influence'),
  };
  const topoOut = {
    opacity:   getEl('dev-opacity-v'),
    linewidth: getEl('dev-linewidth-v'),
    levels:    getEl('dev-levels-v'),
    scale:     getEl('dev-scale-v'),
    speed:     getEl('dev-speed-v'),
    warp:      getEl('dev-warp-v'),
    particleInfluence: getEl('dev-particle-influence-v'),
    syncSat:   getEl('dev-sync-sat-v'),
  };

  function pushTopo() {
    if (!window.TopoDev) return;
    const syncOn = topo.sync.checked;
    window.TopoDev.setSync(syncOn);
    topo.color.disabled = syncOn;
    if (!syncOn) window.TopoDev.setOptions({ color: topo.color.value });
    window.TopoDev.setOptions({
      opacity:     Number(topo.opacity.value),
      lineWidth:   Number(topo.linewidth.value),
      levels:      Number(topo.levels.value),
      scale:       Number(topo.scale.value),
      speed:       Number(topo.speed.value),
      warp:        Number(topo.warp.value),
      interactive: topo.interactive.checked,
    });
    window.TopoDev.setParticleInfluence(Number(topo.particleInfluence.value));
    window.TopoDev.setSyncSaturation(Number(topo.syncSat.value));
    topoOut.opacity.textContent   = (Number(topo.opacity.value)).toFixed(2);
    topoOut.linewidth.textContent = (Number(topo.linewidth.value)).toFixed(1);
    topoOut.levels.textContent    = topo.levels.value;
    topoOut.scale.textContent     = (Number(topo.scale.value)).toFixed(2);
    topoOut.speed.textContent     = (Number(topo.speed.value)).toFixed(3);
    topoOut.warp.textContent      = (Number(topo.warp.value)).toFixed(2);
    topoOut.particleInfluence.textContent = (Number(topo.particleInfluence.value)).toFixed(2);
    topoOut.syncSat.textContent = (Number(topo.syncSat.value)).toFixed(2);
  }

  topo.sync.addEventListener('change', pushTopo);
  Object.values(topo).forEach(inp => {
    inp.addEventListener('input', pushTopo);
    inp.addEventListener('change', pushTopo);
  });
  topo.enabled.addEventListener('change', () => {
    if (topo.enabled.checked) location.reload();
    else window.TopoDev?.destroy();
  });

  /* ── Acrylic ──────────────────────────────── */
  const GLASS_TARGETS = ['#app', '.hero-shell', '.doc-nav', '.spotlight-card', '.footer'];
  const acrylic = {
    blur:       getEl('dev-blur'),
    glassAlpha: getEl('dev-glass-alpha'),
    borderAlpha:getEl('dev-border-alpha'),
  };
  const acrylicOut = {
    blur:       getEl('dev-blur-v'),
    glassAlpha: getEl('dev-glass-alpha-v'),
    borderAlpha:getEl('dev-border-alpha-v'),
  };

  function pushAcrylic() {
    const blurPx = Number(acrylic.blur.value);
    const glassVal = Number(acrylic.glassAlpha.value);
    const borderVal = Number(acrylic.borderAlpha.value);

    GLASS_TARGETS.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.style.backdropFilter = `blur(${blurPx}px)`;
        el.style.webkitBackdropFilter = `blur(${blurPx}px)`;
      });
    });

    document.documentElement.style.setProperty('--color-glass',
      `oklch(0.09 0.008 260 / ${glassVal.toFixed(2)})`);
    document.documentElement.style.setProperty('--color-glass-border',
      `oklch(0.2 0.02 260 / ${borderVal.toFixed(2)})`);

    acrylicOut.blur.textContent       = `${blurPx}px`;
    acrylicOut.glassAlpha.textContent  = glassVal.toFixed(2);
    acrylicOut.borderAlpha.textContent = borderVal.toFixed(2);
  }

  Object.values(acrylic).forEach(inp => {
    inp.addEventListener('input', pushAcrylic);
    inp.addEventListener('change', pushAcrylic);
  });

  /* ── Particles ────────────────────────────── */
  const part = {
    count:    getEl('dev-p-count'),
    size:     getEl('dev-p-size'),
    fov:      getEl('dev-p-fov'),
    ca:       getEl('dev-p-ca'),
    decay:    getEl('dev-p-decay'),
    bright:   getEl('dev-p-bright'),
    scanline: getEl('dev-p-scanline'),
    vignette: getEl('dev-p-vignette'),
    rainbow:  getEl('dev-p-rainbow'),
    syncTopo: getEl('dev-p-sync-topo'),
    topoSpeed:getEl('dev-p-topo-speed'),
    quality:  getEl('dev-p-quality'),
    override: getEl('dev-p-override'),
  };
  const partOut = {
    count:    getEl('dev-p-count-v'),
    size:     getEl('dev-p-size-v'),
    fov:      getEl('dev-p-fov-v'),
    ca:       getEl('dev-p-ca-v'),
    decay:    getEl('dev-p-decay-v'),
    bright:   getEl('dev-p-bright-v'),
    scanline: getEl('dev-p-scanline-v'),
    vignette: getEl('dev-p-vignette-v'),
    topoSpeed:getEl('dev-p-topo-speed-v'),
    quality:  getEl('dev-p-quality-v'),
  };

  // Sliders the user actually dragged. pushParticles() only pushes touched
  // sliders: a blanket push of every slider would pin all manual flags (see
  // three-particles.js) and snap a stepped-down scene back to the slider
  // maxima on panel open. Untouched sliders stay on the auto ladder; the
  // quality-override branch below is checkbox-state driven and always applies.
  const touchedInputs = new Set();

  function pushParticles() {
    const PDev = window.ParticleDev;
    if (!PDev) return;

    if (touchedInputs.has('dev-p-count')) PDev.setCount(Number(part.count.value));
    if (touchedInputs.has('dev-p-size')) PDev.setParticleSize(Number(part.size.value));
    if (touchedInputs.has('dev-p-fov')) PDev.setFOV(Number(part.fov.value));
    if (touchedInputs.has('dev-p-ca')) PDev.setCA(Number(part.ca.value));
    if (touchedInputs.has('dev-p-decay')) PDev.setTrailDecay(Number(part.decay.value));
    if (touchedInputs.has('dev-p-bright')) PDev.setBrightness(Number(part.bright.value));
    if (touchedInputs.has('dev-p-scanline')) PDev.setScanline(Number(part.scanline.value));
    if (touchedInputs.has('dev-p-vignette')) PDev.setVignette(Number(part.vignette.value));
    if (touchedInputs.has('dev-p-rainbow')) PDev.setRainbow(part.rainbow.checked);
    if (touchedInputs.has('dev-p-sync-topo')) PDev.setSyncTopo(part.syncTopo.checked);
    if (touchedInputs.has('dev-p-topo-speed')) PDev.setTopoSpeed(Number(part.topoSpeed.value));

    if (part.override.checked) {
      PDev.setQualityOverride(Number(part.quality.value));
      partOut.quality.textContent = (Number(part.quality.value)).toFixed(2);
    } else {
      PDev.setQualityOverride(null);
      partOut.quality.textContent = 'auto';
    }

    partOut.count.textContent    = part.count.value;
    partOut.size.textContent     = (Number(part.size.value)).toFixed(2);
    partOut.fov.textContent      = `${part.fov.value}°`;
    partOut.ca.textContent       = (Number(part.ca.value)).toFixed(2);
    partOut.decay.textContent    = (Number(part.decay.value)).toFixed(3);
    partOut.bright.textContent   = (Number(part.bright.value)).toFixed(2);
    partOut.scanline.textContent = (Number(part.scanline.value)).toFixed(3);
    partOut.vignette.textContent = (Number(part.vignette.value)).toFixed(2);
    partOut.topoSpeed.textContent = (Number(part.topoSpeed.value)).toFixed(2);
  }

  part.override.addEventListener('change', () => {
    part.quality.disabled = !part.override.checked;
    pushParticles();
  });

  Object.values(part).forEach(inp => {
    inp.addEventListener('input', () => { touchedInputs.add(inp.id); pushParticles(); });
    inp.addEventListener('change', () => { touchedInputs.add(inp.id); pushParticles(); });
  });

  /* ── Init outputs ─────────────────────────── */
  pushTopo();
  pushAcrylic();
  pushParticles();

  /* ── Wire particle canvas → topo ─────────── */
  function wireParticleTopo() {
    if (!window.TopoDev || !window.ParticleDev) {
      requestAnimationFrame(wireParticleTopo);
      return;
    }
    const canvas = window.ParticleDev.getParticleCanvas();
    if (canvas) window.TopoDev.setParticleTex(canvas);
  }
  wireParticleTopo();

  /* ── Velocity Network ─────────────────────── */
  import('./velocity-network.js').then(({ init: initVN }) => {
    function waitForParticles() {
      if (!window.ParticleDev) { requestAnimationFrame(waitForParticles); return; }
      initVN(window.ParticleDev);

      const vnet = {
        enabled:  getEl('dev-vn-enabled'),
        opacity:  getEl('dev-vn-opacity'),
      };
      const vnOut = {
        opacity:  getEl('dev-vn-opacity-v'),
      };

      function pushVN() {
        const velocityNet = window.VelocityNetwork;
        if (!velocityNet) return;
        if (vnet.enabled.checked) velocityNet.enable(); else velocityNet.disable();
        velocityNet.setOpacity(Number(vnet.opacity.value));
        vnOut.opacity.textContent = (Number(vnet.opacity.value)).toFixed(2);
      }

      vnet.enabled.addEventListener('change', pushVN);
      Object.values(vnet).forEach(inp => {
        inp.addEventListener('input', pushVN);
        inp.addEventListener('change', pushVN);
      });

      function vnLoop() {
        if (window.VelocityNetwork?.isEnabled()) window.VelocityNetwork.update();
        requestAnimationFrame(vnLoop);
      }
      setTimeout(() => requestAnimationFrame(vnLoop), 500);

      pushVN();
    }
    waitForParticles();
  });

  /* ── Thermal ASCII ───────────────────────────── */
  Promise.all([
    import('./thermal-ascii.js'),
    import('./shell.js'),
  ]).then(([{ initThermalAscii }, { ASCII_ART }]) => {
    function waitForCanvas() {
      const canvas = document.getElementById('thermal-ascii');
      if (!canvas) { requestAnimationFrame(waitForCanvas); return; }
      // main.js owns a loop on this canvas until devmode takes over — retire
      // it once so slider-driven re-inits are the sole painter afterwards.
      if (window.__mainThermal) { window.__mainThermal.destroy(); window.__mainThermal = null; }
      let thermal = initThermalAscii(canvas, { art: ASCII_ART });

      const thm = {
        enabled:   getEl('dev-thermal-enabled'),
        radius:    getEl('dev-thermal-radius'),
        decay:     getEl('dev-thermal-decay'),
        density:   getEl('dev-thermal-density'),
        ramp:      getEl('dev-thermal-ramp'),
      };
      const thOut = {
        radius:  getEl('dev-thermal-radius-v'),
        decay:   getEl('dev-thermal-decay-v'),
        density: getEl('dev-thermal-density-v'),
      };

      const rampMap = {
          default: " `.:-=+*cs#%@",
          blocks: "░▒▓█",
          braille: "⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋",
          bengali: " দবদ্দব্দব্বদ্বদ্ব",
          mixed: " ░দ▒ব▓দ্ব",
        };
      function thermalOptions() {
        return {
          art: ASCII_ART,
          heatRadius: Number(thm.radius.value),
          heatDecay: Number(thm.decay.value),
          ramp: rampMap[thm.ramp.value] || rampMap.default,
        };
      }
      let activeRampKey = 'default';
      function pushThermal() {
        // Labels first so sliders read live even when the instance is off.
        thOut.radius.textContent = thm.radius.value;
        thOut.decay.textContent = Number(thm.decay.value).toFixed(2);
        thOut.density.textContent = Number(thm.density.value).toFixed(2);
        if (!thermal) return;
        // Live setters: no destroy + re-init, heat is preserved per tick.
        if (typeof thermal.setHeatRadius === 'function') thermal.setHeatRadius(Number(thm.radius.value));
        if (typeof thermal.setHeatDecay === 'function') thermal.setHeatDecay(Number(thm.decay.value));
        if (typeof thermal.setDensity === 'function') thermal.setDensity(Number(thm.density.value));
        const nextRampKey = thm.ramp.value;
        if (nextRampKey !== activeRampKey) {
          activeRampKey = nextRampKey;
          const nextRamp = rampMap[nextRampKey] || rampMap.default;
          if (typeof thermal.setRamp === 'function') thermal.setRamp(nextRamp);
          // Centre pulse so the new ramp reads without needing a hover first.
          if (typeof thermal.pulseCenter === 'function') thermal.pulseCenter();
        }
      }

      thm.enabled.addEventListener('change', () => {
        if (!thm.enabled.checked) {
          if (thermal) {
            thermal.destroy();
            thermal = null;
          }
        } else if (!thermal) {
          thermal = initThermalAscii(document.getElementById('thermal-ascii'), thermalOptions());
          pushThermal();
        }
      });
      // Enabled has its dedicated toggle above; the generic loop covers only
      // the live sliders + ramp select (single-init on re-enable, no double).
      [thm.radius, thm.decay, thm.density, thm.ramp].forEach((sliderInput) => {
        sliderInput.addEventListener('input', () => { pushThermal(); });
        sliderInput.addEventListener('change', () => { pushThermal(); });
      });

      pushThermal();
    }
    waitForCanvas();
  });

  /* ── Export ─────────────────────────────────── */
  getEl('dev-export').addEventListener('click', () => {
    const val = (id) => {
      const fieldEl = getEl(id);
      if (!fieldEl) return null;
      if (fieldEl.type === 'checkbox') return fieldEl.checked;
      if (fieldEl.type === 'range' || fieldEl.type === 'number') return Number(fieldEl.value);
      return fieldEl.value;
    };
    const settings = {
      topo: {
        color:            val('dev-color'),
        opacity:          val('dev-opacity'),
        lineWidth:        val('dev-linewidth'),
        levels:           val('dev-levels'),
        scale:            val('dev-scale'),
        speed:            val('dev-speed'),
        warp:             val('dev-warp'),
        interactive:      val('dev-interactive'),
        particleInfluence:val('dev-particle-influence'),
      },
      particles: {
        count:    val('dev-p-count'),
        size:     val('dev-p-size'),
        fov:      val('dev-p-fov'),
        ca:       val('dev-p-ca'),
        decay:    val('dev-p-decay'),
        bright:   val('dev-p-bright'),
        scanline: val('dev-p-scanline'),
        vignette: val('dev-p-vignette'),
        rainbow:  val('dev-p-rainbow'),
        syncTopo: val('dev-p-sync-topo'),
        topoSpeed:val('dev-p-topo-speed'),
      },
      vnet: {
        enabled: val('dev-vn-enabled'),
        opacity: val('dev-vn-opacity'),
      },
      thermal: {
        enabled:   val('dev-thermal-enabled'),
        radius:    val('dev-thermal-radius'),
        decay:     val('dev-thermal-decay'),
        density:   val('dev-thermal-density'),
        ramp:      val('dev-thermal-ramp'),
      },
      acrylic: {
        blur:       val('dev-blur'),
        glassAlpha: val('dev-glass-alpha'),
        borderAlpha:val('dev-border-alpha'),
      },
    };
    const json = JSON.stringify(settings, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      const statusEl = getEl('dev-export-status');
      statusEl.textContent = '\u2713 Copied to clipboard \u2014 paste in chat';
      statusEl.style.display = 'flex';
      setTimeout(() => { statusEl.style.display = 'none'; }, 2500);
    }).catch(() => {
      const taEl = document.createElement('textarea');
      taEl.value = json;
      document.body.appendChild(taEl);
      taEl.select();
      document.execCommand('copy');
      document.body.removeChild(taEl);
      const statusEl = getEl('dev-export-status');
      statusEl.textContent = '\u2713 Copied to clipboard \u2014 paste in chat';
      statusEl.style.display = 'flex';
      setTimeout(() => { statusEl.style.display = 'none'; }, 2500);
    });
  });
document.getElementById('dev-panel-close')?.addEventListener('click', () => toggleDevPanel());
export function toggleDevPanel() {
  ensureCss();
  ensurePanel();
  const panel = document.getElementById('dev-panel');
  if (panel) panel.hidden = !panel.hidden;
}

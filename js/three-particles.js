import * as THREE from 'three';
import perf from './perf.js';
let uRainbow = 0;

function detectHz(cb) {
  const samples = []; let last = 0;
  function tick(t) {
    if (last) samples.push(t - last);
    last = t;
    if (samples.length < 10) requestAnimationFrame(tick);
    else {
      samples.sort((a, b) => a - b);
      const med = samples[Math.floor(samples.length / 2)];
      cb(Math.round(1000 / med));
    }
  }
  requestAnimationFrame(tick);
}

const CURL = `
vec4 _p(vec4 x){return mod(((x*34.)+1.)*x,289.);}
vec4 _t(vec4 r){return 1.7928429-.8537347*r;}
vec4 sg3(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz),l=1.-g;
  vec3 i1=min(g.xyz,l.zxy),i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx,x2=x0-i2+2.*C.xxx,x3=x0-1.+3.*C.xxx;
  i=mod(i,289.);
  vec4 pp=_p(_p(_p(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  vec4 j=pp-49.*floor(pp*(1./49.));
  vec4 x_=floor(j*(1./7.)),y_=floor(j-7.*x_);
  vec4 xs=x_*(2./7.)-1.,ys=y_*(2./7.)-1.;
  vec4 h=1.-abs(xs)-abs(ys);
  vec4 b0=vec4(xs.xy,ys.xy),b1=vec4(xs.zw,ys.zw);
  vec4 s0=floor(b0)*2.+1.,s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy,a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x),p1=vec3(a0.zw,h.y),p2=vec3(a1.xy,h.z),p3=vec3(a1.zw,h.w);
  vec4 nm=_t(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
  vec4 mx=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  vec4 mx2=mx*mx,mx4=mx2*mx2;
  vec4 pd=vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3));
  float n=42.*dot(mx4,pd);
  vec4 tmp=-8.*mx2*mx*pd;
  vec3 grad=42.*(tmp.x*x0+tmp.y*x1+tmp.z*x2+tmp.w*x3+mx4.x*p0+mx4.y*p1+mx4.z*p2+mx4.w*p3);
  return vec4(n,grad);
}
vec2 curl2(vec3 p){
  vec4 dA=sg3(p),dB=sg3(p+vec3(31.416,-47.853,12.679));
  return cross(dA.yzw,dB.yzw).xy;
}
vec2 curlFlow(vec3 p){
  return curl2(p)*.55+curl2(p*2.1+17.)*.22+curl2(p*5.2+31.)*.08;
}
`;

function buildTrailFrag(w, h) {
  return `precision highp float;
uniform sampler2D uPrev,uParts;
uniform float uTime,uDecay;
uniform vec4 uModeW;
${CURL}
void main(){
  vec2 uv=gl_FragCoord.xy/vec2(${w}.,${h}.);
  vec3 fp=vec3(uv*2.-1.,uTime*.12);
  vec2 vel=curlFlow(fp)*.0012+curl2(fp*3.)*.0004;
  vel*=mix(vec2(1.),vec2(-1.,1.),uModeW.y);
  vec2 src=clamp(uv-vel,.001,.999);
  vec4 prev=texture2D(uPrev,src)*uDecay;
  vec4 parts=texture2D(uParts,uv);
  gl_FragColor=max(prev,parts*1.25);
}`;
}

const BS_GLSL = `
float bsNorm(float x){
  float t=1./(1.+.2316419*abs(x));
  float p=t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
  float pdf=exp(-.5*x*x)*.3989422803;
  float cdf=1.-pdf*p;
  return x>=0.?cdf:1.-cdf;
}
float blackScholes(vec2 pos, float uTime){
  float S=length(pos)*1.05+0.4;
  float K=1.0;
  float r=0.05, sigma=0.28;
  float Tt=mod(uTime*0.12,6.)+0.05;
  float d1=(log(S/K)+(r+.5*sigma*sigma)*Tt)/(sigma*sqrt(Tt));
  float d2=d1-sigma*sqrt(Tt);
  float V=S*bsNorm(d1)-K*exp(-r*Tt)*bsNorm(d2);
  float delta=bsNorm(d1);
  return clamp(V/S,0.,1.)*(.5+delta*.5);
}
`;

let animFrameId = null;

function initParticles() {
  const canvas = document.getElementById('c');
  if (!canvas) return;

  // Fresh device-pixel-ratio read, capped at 2. Always re-read live (never
  // cached): browser zoom / monitor moves change it under us.
  function readRawPR() {
    return Math.min(window.devicePixelRatio || 1, 2);
  }
  let PR = readRawPR();
  let displayHz = 60;                // native refresh, learned once via detectHz
  let targetInterval = 1000 / 60;    // frame budget, derived from quality + displayHz
  let lastFrameTime = 0;
  let scrollOffset = 0;
  let syncTopo = true;               // dev default: particle clock drives topo
  let currentT = 0;                  // latest particle elapsed time (for topo sync)
  let topoSpeedMult = 0.25;          // topo evolves at this fraction of particle speed
  let topoPausedForSync = false;     // topo's own loop paused once sync takes over

  // How much of the 256×256 field actually draws (phase-2 tier ladder owns
  // this; see TIER_TABLE below) and the chromatic-aberration strength in the
  // post pass. The 256² sim buffers stay fixed at boot size — the ladder
  // moves triGeo.instanceCount only, never reallocs.
  const N_MAX = 256 * 256;
  let activeCount = N_MAX;
  let caStrength = 1;
  // Manual trail-decay override (dev sidebar). Null = auto: the frame loop
  // modulates decay with hover (`decayOverride ?? (0.8 - hP * 0.04)`).
  // setTrailDecay(number) pins; setTrailDecay(null) restores auto.
  let decayOverride = null;
  // Manual pins (dev sidebar): a setCount/setCA/setScanline/setVignette/
  // setParticleSize call pins that knob and the auto ladder stops touching
  // it; clearManualPins() releases every pin back to auto. The devtools panel
  // only pushes sliders the user actually dragged (see devtools.js), so
  // opening devmode never snaps the live scene back to the slider maxima.
  let manualCount = false;
  let manualCA = false;
  let manualScanline = false;
  let manualVignette = false;
  let manualSize = false;
  let manualSizeMult = 1;
  // Auto density-compensation multiplier for uPS (tier size column); used by
  // onResize while no manual size pin is held.
  let autoSizeMult = 1;
  // Single perf.onChange subscription handle (phase-0 leak fix): override-off
  // restores this instead of stacking another permanent listener.
  let qualityUnsub = null;
  // Topo throttle: sample readPixels at most 1x per N frames, N from the
  // tier table (ultra 2 / high 3 / med 5 / low 8). Counted on particle
  // frames — no second timer, and the overlay clock stays
  // particle-elapsed-driven.
  let topoEvery = 2;
  let frameCount = 0;
  // Overlay visibility: skip the density feed while the topo host is
  // off-screen (IntersectionObserver flips this; defaults to visible).
  let topoOnScreen = true;

  window.addEventListener('scroll', () => { scrollOffset = window.scrollY; }, { passive: true });

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  const R = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance'
  });
  R.setPixelRatio(PR);
  R.setSize(W(), H());
  R.autoClear = false;

  // Map the shared quality scalar to this system's knobs (hybrid §7: the
  // discrete tier owns the structural knobs, the continuous scalar keeps
  // trimming DPR + frame budget within the tier):
  //   • pixel ratio  — continuous 1…2 trim, additionally capped per tier
  //   • frame budget — continuous cap 30 (q=0) … native-but-≤90 (q=1)
  //   • count / post / topo cadence — discrete per-tier steps (TIER_TABLE)
  // Called once up front and again every time quality drifts meaningfully.
  let triGeo = null;
  // Quantized DPR steps so applied DPR never churns resizes/FBOs per frame.
  const PR_QUANTUM = 0.05;
  // Max DPR travel per apply: big quality swings settle over a few notifies
  // instead of reallocating the whole chain at once. Single setPixelRatio +
  // onResize per apply; no per-frame slide.
  const PR_STEP_MAX = 0.15;
  function quantizePR(value) {
    return Math.round(value / PR_QUANTUM) * PR_QUANTUM;
  }
  // Phase-2 count ladder + post kills. Four tiers from the quality scalar
  // (boundaries 0.75 / 0.5 / 0.25):
  //
  //   tier  (min q) | count | chroma | scanline | vignette | size | alpha | topoEvery | dprCap
  //   ultra (0.75)  | 65536 | 1      | 0.02     | 1.5      | 1    | 1     | 2         | 2
  //   high  (0.50)  | 32768 | 0      | 0.02     | 1.5      | 1.15 | 1.12  | 3         | 1.5
  //   med   (0.25)  | 16384 | 0      | 0        | 0.75     | 1.3  | 1.25  | 5         | 1.25
  //   low   (—)     | 8192  | 0      | 0        | 0        | 1.5  | 1.35  | 8         | 1
  //
  // Post dies progressively chroma → scanline → vignette via uniform values
  // only — the post shader stays compiled, no add/removePass recompiles.
  // Count steps via triGeo.instanceCount, the instanced-geometry equivalent
  // of setDrawRange (drawRange clips vertices, not instances, so
  // instanceCount is the correct no-realloc lever): seed buffers are never
  // re-uploaded and the 256² sim FBOs fixed at boot are never resized at
  // runtime. A full GPGPU re-init happens only on explicit quality-toggle
  // paths, never from this ladder.
  // Density compensation (size 1.0→1.5, alpha 1.0→1.35) holds perceived
  // density roughly constant as instances halve: area-exact would be
  // sqrt(2) per halving, but additive blending over-boosts overlaps, so the
  // ramp is gentler to avoid blowout.
  // Step-down order per bucket: DPR trim → post kills → count down →
  // topoEvery widen → DPR cap down → fps floor; step-up restores in
  // reverse. Tier boundaries (0.25) are far wider than any single quality
  // notify (≤ ~0.045 per frame, NOTIFY_EPS 0.02), so a bucket moves at most
  // one tier — one hitch per bucket max.
  const TIER_NAMES = ['ultra', 'high', 'medium', 'low'];
  const TIER_TABLE = [
    { count: 65536, chroma: 1, scanline: 0.02, vignette: 1.5, size: 1, alpha: 1, topoEvery: 2, dprCap: 2 },
    { count: 32768, chroma: 0, scanline: 0.02, vignette: 1.5, size: 1.15, alpha: 1.12, topoEvery: 3, dprCap: 1.5 },
    { count: 16384, chroma: 0, scanline: 0, vignette: 0.75, size: 1.3, alpha: 1.25, topoEvery: 5, dprCap: 1.25 },
    { count: 8192, chroma: 0, scanline: 0, vignette: 0, size: 1.5, alpha: 1.35, topoEvery: 8, dprCap: 1 },
  ];
  function tierForQuality(qualityValue) {
    if (qualityValue >= 0.75) return 0;
    if (qualityValue >= 0.5) return 1;
    if (qualityValue >= 0.25) return 2;
    return 3;
  }
  let currentTierIndex = -1;
  // Continuous DPR trim (phase 1) with the tier cap as the base: min() keeps
  // the in-tier slide while the cap steps the base down per tier.
  function applyTierDpr(qualityValue, tierEntry) {
    const rawPR = readRawPR();
    const wantPR = Math.min(quantizePR(1 + qualityValue), tierEntry.dprCap);
    const clampedStep = Math.max(-PR_STEP_MAX, Math.min(PR_STEP_MAX, wantPR - PR));
    const nextPR = Math.min(rawPR, PR + clampedStep);
    if (Math.abs(nextPR - PR) > PR_QUANTUM) {
      PR = nextPR;
      R.setPixelRatio(PR);
      onResize();
    }
  }
  function applyTierPost(tierEntry) {
    if (!manualCA) caStrength = tierEntry.chroma;
    if (!manualScanline) postMat.uniforms.uScanline.value = tierEntry.scanline;
    if (!manualVignette) postMat.uniforms.uVignette.value = tierEntry.vignette;
  }
  function applyTierCount(tierEntry) {
    if (manualCount) return;
    activeCount = tierEntry.count;
    if (triGeo) triGeo.instanceCount = activeCount;
  }
  function applyTierDensity(tierEntry) {
    pMat.uniforms.uAlpha.value = tierEntry.alpha;
    autoSizeMult = tierEntry.size;
    if (!manualSize) {
      const baseSize = W() / (PR * 2000) * 0.65;
      pMat.uniforms.uPS.value = baseSize * autoSizeMult;
    }
  }
  function applyQuality(qualityValue) {
    const tierIndex = tierForQuality(qualityValue);
    const tierEntry = TIER_TABLE[tierIndex];
    // Step-down sheds cheap pixels first and structural count later; step-up
    // restores in reverse so the visible field returns before costs ramp.
    // Everything still lands before the next frame — the order documents the
    // shed/restore priority, and the single-tier-per-bucket bound above keeps
    // it to one hitch.
    if (tierIndex >= currentTierIndex) {
      applyTierDpr(qualityValue, tierEntry);
      applyTierPost(tierEntry);
      applyTierCount(tierEntry);
      applyTierDensity(tierEntry);
      topoEvery = tierEntry.topoEvery;
    } else {
      topoEvery = tierEntry.topoEvery;
      applyTierDensity(tierEntry);
      applyTierCount(tierEntry);
      applyTierPost(tierEntry);
      applyTierDpr(qualityValue, tierEntry);
    }
    currentTierIndex = tierIndex;

    const fpsCap = Math.round(30 + 60 * qualityValue);              // 30 … 90
    const target = Math.min(displayHz, fpsCap);
    targetInterval = 1000 / target;
  }

  const scene = new THREE.Scene();
  const camMain = new THREE.PerspectiveCamera(120, W() / H(), 0.01, 10);
  camMain.position.z = 2.8;
  const flatCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const mkGPU = (sz) => new THREE.WebGLRenderTarget(sz, sz, {
    format: THREE.RGBAFormat, type: THREE.FloatType,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: false, stencilBuffer: false
  });
  const mkFull = () => new THREE.WebGLRenderTarget(W() * PR | 0, H() * PR | 0, {
    format: THREE.RGBAFormat, type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, stencilBuffer: false
  });

  let rA = mkGPU(256), rB = mkGPU(256), trailA = mkFull(), trailB = mkFull(), outRT = mkFull();
  let iW = W() * PR | 0, iH = H() * PR | 0;

  const posData = new Float32Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) {
    let x = 0, y = 0;
    do { x = Math.random() * 2 - 1; y = Math.random() * 2 - 1; } while (x * x + y * y > 1);
    posData[i * 4] = x;
    posData[i * 4 + 1] = y;
    posData[i * 4 + 2] = Math.random();
    posData[i * 4 + 3] = Math.random();
  }
  const posTex = new THREE.DataTexture(posData, 256, 256, THREE.RGBAFormat, THREE.FloatType);
  posTex.needsUpdate = true;

  const simScene = new THREE.Scene();
  const simMat = new THREE.ShaderMaterial({
    uniforms: {
      uPos: { value: posTex }, uSZ: { value: 256 },
      uMouse: { value: new THREE.Vector2() }, uMouseR: { value: 0.18 },
      uTime: { value: 0 }, uDt: { value: 0.016 }, uHover: { value: 0 },
      uModeW: { value: new THREE.Vector4(1, 0, 0, 0) }
    },
    vertexShader: 'void main(){gl_Position=vec4(position,1.);}',
    fragmentShader: `precision highp float;
uniform sampler2D uPos;
uniform float uSZ,uTime,uDt,uHover,uMouseR;
uniform vec2 uMouse;
uniform vec4 uModeW;
${CURL}
float h1(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
void main(){
  vec2 uv=gl_FragCoord.xy/uSZ;
  vec4 pf=texture2D(uPos,uv);
  vec2 pos=pf.xy; float scale=pf.z,age=pf.w;
  float seed=h1(uv.x*71.+uv.y*137.),seed2=h1(seed*211.+uv.y*97.);
  age=mod(age+uDt/(2.5+seed*2.),1.);
  if(age<uDt/(2.5+seed*2.)){
    float ang=seed*6.2832+uTime*.3;
    pos=vec2(cos(ang),sin(ang))*sqrt(seed2*.9+.05); scale=0.;
  }
  vec3 p3=vec3(pos*1.4,uTime*.18);
  vec2 v=curlFlow(p3);
  vec2 rv=normalize(pos+1e-4);
  vec2 vortex=vec2(-rv.y,rv.x)*(.5-length(pos)*.3);
  float dp=length(pos);
  vec2 pulsar=normalize(pos+1e-4)*sin(dp*8.-uTime*3.)*.04+vec2(-pos.y,pos.x)*(1./(dp+.5))*.04;
  vec2 aurora=vec2(sin(pos.y*4.+uTime)*.05,cos(pos.x*3.+uTime*.7)*.04);
  v+=vortex*uModeW.y+pulsar*uModeW.z+aurora*uModeW.w;
  vec2 dm=pos-uMouse;
  float md=length(dm);
  float gaussR=uMouseR;
  float radial=exp(-md*md/(2.*gaussR*gaussR))*uHover;
  v+=normalize(dm+1e-5)*radial*0.055;
  vec2 tang=vec2(-dm.y,dm.x)/(md+.01);
  float tangMask=smoothstep(gaussR*2.2,gaussR*.4,md)*uHover;
  v+=tang*tangMask*0.018;
  pos+=v*uDt*28.;
  if(dot(pos,pos)>1.04)pos*=.984;
  float env=smoothstep(0.,.12,age)*smoothstep(1.,.8,age);
  scale+=(env*(.5+seed*.5)-scale)*.12;
  gl_FragColor=vec4(pos,scale,age);
}`
  });
  simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMat));

  const triVerts = new Float32Array([
    0.0, 1.0, 0.0,
    -0.866, -0.5, 0.0,
    0.866, -0.5, 0.0
  ]);
  triGeo = new THREE.InstancedBufferGeometry();
  triGeo.setAttribute('position', new THREE.BufferAttribute(triVerts, 3));

  const N = 256 * 256;
  const uvA = new Float32Array(N * 2), sdA = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    uvA[i * 2] = (i % 256) / 256;
    uvA[i * 2 + 1] = Math.floor(i / 256) / 256;
    sdA[i * 4] = Math.random();
    sdA[i * 4 + 1] = Math.random();
    sdA[i * 4 + 2] = Math.random();
    sdA[i * 4 + 3] = Math.random();
  }
  triGeo.setAttribute('iUV', new THREE.InstancedBufferAttribute(uvA, 2));
  triGeo.setAttribute('seeds', new THREE.InstancedBufferAttribute(sdA, 4));
  triGeo.instanceCount = N;

  const pMat = new THREE.ShaderMaterial({
    uniforms: {
      uPos: { value: posTex }, uTime: { value: 0 }, uHover: { value: 0 },
      uRez: { value: new THREE.Vector2(W(), H()) },
      uPS: { value: W() / (PR * 2000) * 0.65 }, uPR: { value: PR },
      uModeW: { value: new THREE.Vector4(1, 0, 0, 0) },
      uRainbow: { value: 0 }, uAlpha: { value: 1 }
    },
    vertexShader: `precision highp float;
attribute vec2 iUV;
attribute vec4 seeds;
uniform sampler2D uPos;
uniform float uTime,uPS,uPR,uHover;
uniform vec2 uRez;
varying float vAge,vScale,vSeed,vBS;
${CURL}
${BS_GLSL}
void main(){
  vec4 pf=texture2D(uPos,iUV);
  vec2 pos=pf.xy; float scale=pf.z,age=pf.w;
  vec2 md2=curl2(vec3(pos*6.,uTime*.22+seeds.z*10.))*.006;
  pos+=md2*(1.+mix(0.,smoothstep(0.,.9,age),uHover)*3.);
  vAge=age; vScale=scale; vSeed=seeds.x;
  vBS=blackScholes(pos,uTime);
  float sz=scale*0.012*uPS+0.0004;
  float ang=seeds.y*6.2832+uTime*.08+seeds.w*3.14;
  mat2 rot=mat2(cos(ang),-sin(ang),sin(ang),cos(ang));
  vec2 localPos=rot*position.xy*sz;
  vec4 vp=modelViewMatrix*vec4(pos+localPos,0.,1.);
  gl_Position=projectionMatrix*vp;
}`,
    fragmentShader: `precision highp float;
varying float vAge,vScale,vSeed,vBS;
uniform vec4 uModeW;
uniform float uTime,uRainbow,uAlpha;
vec3 designPal(float t){
  vec3 a=vec3(.44,.10,.57);
  vec3 b=vec3(.41,.06,.38);
  vec3 cc=vec3(1.,1.,1.);
  vec3 d=vec3(.0,.35,.65);
  return clamp(a+b*cos(6.28318*(cc*t+d)),0.,1.);
}
void main(){
  float a=smoothstep(.05,.2,vScale);
  if(a<.005)discard;
  float phaseShift=uModeW.y*.18+uModeW.z*.36+uModeW.w*.52;
  float t=vAge+vSeed*.3+phaseShift;
  vec3 col;
  if (uRainbow > 0.5) {
    col = 0.5 + 0.5 * cos(6.28318 * (vec3(t * 0.8 + vSeed) + vec3(0.0, 0.33, 0.67)));
  } else {
    col = designPal(t);
  }
  float bsLum=vBS*0.55;
  col+=vec3(bsLum*.4, bsLum*.15, bsLum*.05);
  col*=.85+vBS*.3;
  col*=1.8; // boost luminosity — visible through frosted glass
  gl_FragColor=vec4(clamp(col,0.,1.),a*(.6+vBS*.4)*uAlpha);
}`,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(triGeo, pMat);
  mesh.scale.set(2, -2, 2);
  scene.add(mesh);

  const trailScene = new THREE.Scene();
  const trailMat = new THREE.ShaderMaterial({
    uniforms: {
      uPrev: { value: trailA.texture }, uParts: { value: outRT.texture },
      uTime: { value: 0 }, uDecay: { value: 0.8 }, uModeW: { value: new THREE.Vector4(1, 0, 0, 0) }
    },
    vertexShader: 'void main(){gl_Position=vec4(position,1.);}',
    fragmentShader: buildTrailFrag(iW, iH)
  });
  trailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMat));

  const postScene = new THREE.Scene();
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: trailB.texture }, uRez: { value: new THREE.Vector2(iW, iH) }, uTime: { value: 0 },
      uCA: { value: 1 },
      uBrightness: { value: 2.6 },
      uScanline: { value: 0.02 },
      uVignette: { value: 1.5 },
    },
    vertexShader: 'void main(){gl_Position=vec4(position,1.);}',
    fragmentShader: `precision highp float;
uniform sampler2D uTex;
uniform vec2 uRez;
uniform float uTime;
uniform float uCA,uBrightness,uScanline,uVignette;
vec3 aces(vec3 x){float a=2.51,b=.03,c=2.43,e=.59,f=.14;return clamp((x*(a*x+b))/(x*(c*x+e)+f),0.,1.);}
void main(){
  vec2 uv=gl_FragCoord.xy/uRez;
  vec2 cen=uv-.5;
  float ca=dot(cen,cen)*.009*uCA;
  float rv=texture2D(uTex,uv+cen*ca*1.3).r;
  float gv=texture2D(uTex,uv).g;
  float bv=texture2D(uTex,uv-cen*ca*.9).b;
  vec3 col=aces(vec3(rv,gv,bv)*uBrightness);
  col*=1.-dot(cen,cen)*uVignette;
  col*=sin(gl_FragCoord.y*1.5)*uScanline+1.;
  gl_FragColor=vec4(col,1.);
}`
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  /* ── Post-out RT + blit pass ────────────────────────── */
  let postOut = mkFull();
  const blitMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: null }, uRez: { value: new THREE.Vector2(iW, iH) } },
    vertexShader: 'void main(){gl_Position=vec4(position,1.);}',
    fragmentShader: 'precision highp float;uniform sampler2D uTex;uniform vec2 uRez;void main(){gl_FragColor=texture2D(uTex,gl_FragCoord.xy/uRez);}',
  });
  const blitScene = new THREE.Scene();
  blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMat));

  /* ── Hidden 2D canvas for topo texture ──────────────── */
  const _topoCanvas = document.createElement('canvas');
  _topoCanvas.width = 256; _topoCanvas.height = 256;
  const _topoCtx = _topoCanvas.getContext('2d', { willReadFrequently: true });
  let _pxBuf = null;
  let _fBuf = null;
  // Reused across readbacks (no per-frame createImageData alloc); recreated
  // only when the sample size changes.
  let _imgBuf = null;
  let _imgW = 0;
  let _imgH = 0;

  // Track whether the topo overlay is on-screen; off-screen → no feed.
  if (typeof IntersectionObserver !== 'undefined') {
    const topoHost = document.getElementById('topo-host');
    if (topoHost) {
      const screenObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          topoOnScreen = entry.isIntersecting;
        }
      });
      screenObserver.observe(topoHost);
    }
  }

  const mouse = { x: 0, y: 0, active: false };
  let hP = 0;
  const mv = (x, y) => { mouse.x = (x / W()) * 2 - 1; mouse.y = -(y / H()) * 2 + 1; mouse.active = true; };
  window.addEventListener('mousemove', e => mv(e.clientX, e.clientY));
  window.addEventListener('mouseout', () => { mouse.active = false; });
  // Passive touch tracking for the hover field only. Deliberately never
  // preventDefault here: a window-level cancel kills native page scroll on
  // touch devices. (Terminal-buffer touch scroll is synthesized in terminal.js.)
  window.addEventListener('touchmove', e => { const t = e.touches[0]; if (t) mv(t.clientX, t.clientY); }, { passive: true });
  window.addEventListener('touchend', () => { mouse.active = false; });

  const modeW = new THREE.Vector4(1, 0, 0, 0);
  const HOLD = 8.0, BLEND = 3.0;

  function onResize() {
    // Re-read DPR here too (zoom / monitor move): shrink immediately when
    // the OS lowers it so we never render above the physical pixels. Growth
    // is left to applyQuality (quantized + step-limited, avoids zoom storms).
    const freshPR = readRawPR();
    if (freshPR < PR) {
      PR = freshPR;
      R.setPixelRatio(PR);
    }
    R.setSize(W(), H());
    camMain.aspect = W() / H();
    camMain.updateProjectionMatrix();
    pMat.uniforms.uRez.value.set(W(), H());
    // Keep the effective size multiplier across resizes: manual pin wins,
    // otherwise the tier density compensation (autoSizeMult).
    pMat.uniforms.uPS.value = W() / (PR * 2000) * 0.65 * (manualSize ? manualSizeMult : autoSizeMult);
    iW = W() * PR | 0;
    iH = H() * PR | 0;
    [trailA, trailB, outRT, postOut].forEach(r => r.dispose());
    trailA = mkFull();
    trailB = mkFull();
    outRT = mkFull();
    postOut = mkFull();
    postMat.uniforms.uRez.value.set(iW, iH);
    // NOTE: the blit renders to the canvas drawing buffer (physical pixels),
    // so its uRez must be physical too — CSS pixels under-divide gl_FragCoord
    // whenever PR>1 and ClampToEdge smears bright edge texels into thin
    // axis-aligned lines anchored at the right/top edges.
    blitMat.uniforms.uRez.value.set(iW, iH);
    trailMat.fragmentShader = buildTrailFrag(iW, iH);
    trailMat.needsUpdate = true;
  }
  window.addEventListener('resize', onResize);

  /** Read postOut pixels into the hidden 2D canvas for topo texture sampling */
  function updateParticleCanvas() {
    const w = W(), h = H();
    const pw = Math.min(256, w), ph = Math.min(256, h);
    if (_topoCanvas.width !== pw || _topoCanvas.height !== ph) {
      _topoCanvas.width = pw; _topoCanvas.height = ph;
    }
    const len = pw * ph * 4;
    // postOut is RGBA16F: RGBA/UNSIGNED_BYTE readback is invalid (GL error,
    // buffer left untouched). RGBA/FLOAT is the spec-required baseline.
    if (!_fBuf || _fBuf.length < len) _fBuf = new Float32Array(len);
    if (!_pxBuf || _pxBuf.length < len) _pxBuf = new Uint8Array(len);
    const gl = R.getContext();
    R.setRenderTarget(postOut);
    gl.readPixels(0, 0, pw, ph, gl.RGBA, gl.FLOAT, _fBuf);
    R.setRenderTarget(null);
    for (let i = 0; i < len; i++) {
      const scaled = _fBuf[i] * 255;
      _pxBuf[i] = scaled < 0 ? 0 : (scaled > 255 ? 255 : scaled);
    }
    // Reuse the ImageData across calls (no per-frame alloc); only recreate
    // when the sample size changes. Phase 2 keeps the ≤256px cap (stall
    // proportional to ≤65k pixels, never to the screen — a smaller proxy
    // target stays a later option), and the per-tier topoEvery cadence (see
    // frame) cuts how often we pay it at all.
    if (!_imgBuf || _imgW !== pw || _imgH !== ph) {
      _imgBuf = _topoCtx.createImageData(pw, ph);
      _imgW = pw;
      _imgH = ph;
    }
    const rowBytes = pw * 4;
    for (let rowIndex = 0; rowIndex < ph; rowIndex++) {
      const srcOffset = (ph - 1 - rowIndex) * rowBytes;
      const dstOffset = rowIndex * rowBytes;
      _imgBuf.data.set(_pxBuf.subarray(srcOffset, srcOffset + rowBytes), dstOffset);
    }
    _topoCtx.putImageData(_imgBuf, 0, 0);
  }

  /** True when a topo is bound and can actually consume a fresh density feed:
      ok + particle canvas wired + influence above ~0 + overlay on-screen and
      the tab visible. Otherwise the readPixels stall buys nothing. */
  function shouldSampleTopo() {
    if (document.hidden || !topoOnScreen) return false;
    const topoInstance = window.TopoDev?.getTopo?.();
    if (!topoInstance?.ok) return false;
    if (!topoInstance.particleCanvas) return false;
    const influence = Number(topoInstance.particleInfluence || 0);
    return influence > 0.001;
  }

  const clock = new THREE.Clock();
  let prevT = 0, ever = false;

  function frame(ts) {
    if (ts - lastFrameTime < targetInterval - 1) { requestAnimationFrame(frame); return; }
    lastFrameTime = ts;

    const t = clock.getElapsedTime();
    currentT = t;
    const dt = Math.min(t - prevT, 0.05);
    prevT = t;

    const kH = 1 - Math.pow(0.94, dt * 60);
    hP += ((mouse.active ? 1 : 0) - hP) * kH;

    const period = 4 * (HOLD + BLEND);
    const phase = t % period;
    const slot = Math.floor(phase / (HOLD + BLEND));
    const slotT = phase % (HOLD + BLEND);
    const blend = slotT < HOLD ? 0.0 : (slotT - HOLD) / BLEND;
    const next = (slot + 1) % 4;
    const tw = [0, 0, 0, 0];
    tw[slot] = 1 - blend;
    tw[next] += blend;
    const kM = 1 - Math.pow(0.97, dt * 60);
    modeW.x += (tw[0] - modeW.x) * kM;
    modeW.y += (tw[1] - modeW.y) * kM;
    modeW.z += (tw[2] - modeW.z) * kM;
    modeW.w += (tw[3] - modeW.w) * kM;
    [simMat, pMat, trailMat].forEach(m => m.uniforms.uModeW.value.copy(modeW));

    const mxw = mouse.x * Math.tan(25 * Math.PI / 180) * 2.8 * 0.36;
    const myw = mouse.y * Math.tan(25 * Math.PI / 180) * 2.8 * 0.36;

    simMat.uniforms.uPos.value = ever ? rA.texture : posTex;
    simMat.uniforms.uTime.value = t;
    simMat.uniforms.uDt.value = dt;
    simMat.uniforms.uHover.value = hP;
    simMat.uniforms.uMouse.value.set(mxw, myw);
    simMat.uniforms.uMouseR.value = 0.18 + hP * 0.04;
    R.setRenderTarget(rB);
    R.clear();
    R.render(simScene, flatCam);

    pMat.uniforms.uPos.value = rB.texture;
    pMat.uniforms.uTime.value = t;
    pMat.uniforms.uHover.value = hP;
    pMat.uniforms.uRainbow.value = uRainbow;
    R.setRenderTarget(outRT);
    R.clearColor();
    R.render(scene, camMain);

    trailMat.uniforms.uPrev.value = trailA.texture;
    trailMat.uniforms.uParts.value = outRT.texture;
    trailMat.uniforms.uTime.value = t;
    trailMat.uniforms.uDecay.value = decayOverride ?? (0.8 - hP * 0.04);
    R.setRenderTarget(trailB);
    R.clear();
    R.render(trailScene, flatCam);

    postMat.uniforms.uTex.value = trailB.texture;
    postMat.uniforms.uTime.value = t;
    postMat.uniforms.uCA.value = caStrength;
    R.setRenderTarget(postOut);
    R.clear();
    R.render(postScene, flatCam);

    /* Blit postOut → screen */
    blitMat.uniforms.uTex.value = postOut.texture;
    R.setRenderTarget(null);
    R.clear();
    R.render(blitScene, flatCam);

    /* Feed the hidden 2D canvas so the topo can sample particle density —
       throttled to every topoEvery-th frame and skipped entirely when the
       topo cannot consume it (unbound, influence ≈ 0, off-screen, hidden).
       The overlay clock below still drives every frame: a single clock drive
       (particle elapsed → topo), no second timer. */
    frameCount += 1;
    if (frameCount % topoEvery === 0 && shouldSampleTopo()) updateParticleCanvas();

    let tmp = rA; rA = rB; rB = tmp;
    tmp = trailA; trailA = trailB; trailB = tmp;
    ever = true;

    canvas.style.transform = `translateY(${-scrollOffset * 0.025}px)`;

    // Drive the topo from the particle clock when sync is on.
    // The topo's own rAF is paused on first drive; setClock() renders it
    // internally afterwards. topoSpeedMult slows the landscape vs particles.
    if (syncTopo) {
      const topoInstance = window.TopoDev?.getTopo?.();
      if (topoInstance?.ok) {
        if (!topoPausedForSync && topoInstance.running) {
          topoInstance.pause();
          topoPausedForSync = true;
        }
        topoInstance.setClock(currentT * topoSpeedMult);
      }
    }

    requestAnimationFrame(frame);
  }

  // Learn the display's refresh rate once, seed the quality-driven knobs, then
  // let perf.onChange keep them in step with the live quality scalar. The FPS
  // cap is min(displayHz, quality-cap), so a 240Hz panel on a weak GPU still
  // gets throttled down instead of running the whole pipeline 240×/second.
  detectHz(hz => {
    const knownHz = [60, 90, 120, 144, 165, 240];
    displayHz = knownHz.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a);
    qualityUnsub = perf.onChange(applyQuality); // fires immediately; single handle

    /* ── Dev API — exposed for dev sidebar (devmode) ──── */
    window.ParticleDev = {
      /* Expose internals for velocity-network and topo wiring */
      getRenderer() { return R; },
      getScene() { return scene; },
      getRT() { return rB; },
      getPosTex() { return posTex; },
      getParticleCanvas() { return _topoCanvas; },
      updateParticleCanvas,

      setCount(countValue) {
        manualCount = true;
        activeCount = Math.max(1024, Math.min(N_MAX, Math.round(countValue)));
        if (triGeo) triGeo.instanceCount = activeCount;
      },
      getCount() { return activeCount; },
      setCA(caValue) {
        manualCA = true;
        caStrength = Math.max(0, Math.min(1, caValue));
      },
      getCA() { return caStrength; },
      setTrailDecay(decayValue) {
        // Null restores auto (hover-modulated decay); a number pins.
        if (decayValue === null) {
          decayOverride = null;
          return;
        }
        decayOverride = Math.max(0.8, Math.min(0.99, decayValue));
        trailMat.uniforms.uDecay.value = decayOverride;
      },
      getTrailDecay() { return trailMat.uniforms.uDecay.value; },
      setRainbow(on) { uRainbow = on ? 1 : 0; },
      isRainbow() { return uRainbow > 0.5; },
      getQuality() { return perf.quality(); },
      setQualityOverride(overrideValue) {
        if (overrideValue === null) {
          // Restore auto without stacking listeners: drop the current
          // subscription first, then re-subscribe (fires immediately).
          if (qualityUnsub) qualityUnsub();
          qualityUnsub = perf.onChange(applyQuality);
        } else {
          applyQuality(Math.max(0, Math.min(1, overrideValue)));
        }
      },
      /* Particle size — multiplier on the computed uPS (default ~1.0).
         Pins the size knob: the density ladder stops touching uPS until
         clearManualPins() releases it. */
      setParticleSize(mult) {
        manualSize = true;
        manualSizeMult = Math.max(0.1, Math.min(5, mult));
        const base = W() / (PR * 2000) * 0.65;
        pMat.uniforms.uPS.value = base * manualSizeMult;
      },
      getParticleSize() {
        const base = W() / (PR * 2000) * 0.65;
        return pMat.uniforms.uPS.value / base;
      },
      /* Camera field of view — lower = zoomed in, higher = wider */
      setFOV(deg) {
        camMain.fov = Math.max(20, Math.min(120, deg));
        camMain.updateProjectionMatrix();
      },
      getFOV() { return camMain.fov; },
      /* Post-processing */
      setBrightness(v) {
        postMat.uniforms.uBrightness.value = Math.max(0.5, Math.min(3, v));
      },
      getBrightness() { return postMat.uniforms.uBrightness.value; },
      setScanline(scanValue) {
        manualScanline = true;
        postMat.uniforms.uScanline.value = Math.max(0, Math.min(0.05, scanValue));
      },
      getScanline() { return postMat.uniforms.uScanline.value; },
      setVignette(vignetteValue) {
        manualVignette = true;
        postMat.uniforms.uVignette.value = Math.max(0, Math.min(3, vignetteValue));
      },
      getVignette() { return postMat.uniforms.uVignette.value; },
      /* Active quality tier ({ index 0…3, name ultra/high/medium/low }),
         topo cadence, and density alpha — probes for the ladder. */
      getTier() {
        return { index: currentTierIndex, name: TIER_NAMES[currentTierIndex] || 'unknown' };
      },
      getTopoEvery() { return topoEvery; },
      getAlpha() { return pMat.uniforms.uAlpha.value; },
      /* Release every manual pin (count/CA/scanline/vignette/size) back to
         the auto ladder and re-apply the live quality immediately. */
      clearManualPins() {
        manualCount = false;
        manualCA = false;
        manualScanline = false;
        manualVignette = false;
        manualSize = false;
        manualSizeMult = 1;
        applyQuality(perf.quality());
      },
      /* Sync topo — particle clock drives topo's setClock(). Topo's own rAF
         is paused; the particle loop renders it via setClock(t) each frame. */
      setSyncTopo(on) {
        syncTopo = on;
        const topoInstance = window.TopoDev?.getTopo?.();
        if (!topoInstance?.ok) return;
        if (on) {
          topoInstance.pause();          // kill topo's own loop
          topoPausedForSync = true;
          topoInstance.setClock(currentT * topoSpeedMult); // seed from current particle time
        } else {
          topoPausedForSync = false;
          topoInstance.play();           // resume topo's own loop
        }
      },
      isSyncTopo() { return syncTopo; },
      /** Topo speed multiplier — fraction of particle time fed to topo clock.
       *  0.25 = topo evolves 4× slower than particles. */
      setTopoSpeed(v) { topoSpeedMult = Math.max(0.01, Math.min(1, v)); },
      getTopoSpeed() { return topoSpeedMult; },
    };

    // Live boot matches the dev sidebar (particle influence 1.00): hand the
    // topo our density canvas now when it is already up; otherwise dev.js
    // pulls it once TopoDev finishes its own init. Idempotent either way.
    const topoApi = window.TopoDev;
    if (topoApi?.getTopo?.()?.ok) topoApi.setParticleTex(window.ParticleDev.getParticleCanvas());

    animFrameId = requestAnimationFrame(frame);
  });
}

function setKonami(active) {
  uRainbow = active ? 1 : 0;
}

export { initParticles, setKonami };

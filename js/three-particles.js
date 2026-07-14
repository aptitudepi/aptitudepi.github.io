import * as THREE from 'three';

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

  const PR_raw = window.devicePixelRatio;
  let PR = Math.min(PR_raw, 2);
  let SZ = 256;
  let targetFPS = 60;
  let frameInterval = 1000 / 60;
  let lastFrameTime = 0;
  let gpuTier = 1;

  function applyQuality(tier) {
    gpuTier = tier;
    if (tier === 0) { SZ = 128; PR = Math.min(PR_raw, 1); }
    else if (tier === 1) { SZ = 192; PR = Math.min(PR_raw, 1.5); }
    else { SZ = 256; PR = Math.min(PR_raw, 2); }
    R.setPixelRatio(PR);
  }

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  const R = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: false, powerPreference: 'high-performance'
  });
  R.setPixelRatio(PR);
  R.setSize(W(), H());
  R.autoClear = false;

  const scene = new THREE.Scene();
  const camMain = new THREE.PerspectiveCamera(50, W() / H(), 0.01, 10);
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
    let x, y;
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
    vertexShader: `void main(){gl_Position=vec4(position,1.);}`,
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
  const triGeo = new THREE.InstancedBufferGeometry();
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
      uModeW: { value: new THREE.Vector4(1, 0, 0, 0) }
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
uniform float uTime;
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
  vec3 col=designPal(t);
  float bsLum=vBS*0.55;
  col+=vec3(bsLum*.4, bsLum*.15, bsLum*.05);
  col*=.85+vBS*.3;
  gl_FragColor=vec4(clamp(col,0.,1.),a*(.6+vBS*.4));
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
      uTime: { value: 0 }, uDecay: { value: 0.91 }, uModeW: { value: new THREE.Vector4(1, 0, 0, 0) }
    },
    vertexShader: `void main(){gl_Position=vec4(position,1.);}`,
    fragmentShader: buildTrailFrag(iW, iH)
  });
  trailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), trailMat));

  const postScene = new THREE.Scene();
  const postMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: trailB.texture }, uRez: { value: new THREE.Vector2(iW, iH) }, uTime: { value: 0 }
    },
    vertexShader: `void main(){gl_Position=vec4(position,1.);}`,
    fragmentShader: `precision highp float;
uniform sampler2D uTex;
uniform vec2 uRez;
uniform float uTime;
vec3 aces(vec3 x){float a=2.51,b=.03,c=2.43,e=.59,f=.14;return clamp((x*(a*x+b))/(x*(c*x+e)+f),0.,1.);}
void main(){
  vec2 uv=gl_FragCoord.xy/uRez;
  vec2 cen=uv-.5;
  float ca=dot(cen,cen)*.009;
  float rv=texture2D(uTex,uv+cen*ca*1.3).r;
  float gv=texture2D(uTex,uv).g;
  float bv=texture2D(uTex,uv-cen*ca*.9).b;
  vec3 col=aces(vec3(rv,gv,bv)*1.35);
  col*=1.-dot(cen,cen)*1.1;
  col*=sin(gl_FragCoord.y*1.5)*.011+1.;
  gl_FragColor=vec4(col,1.);
}`
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  const mouse = { x: 0, y: 0, active: false };
  let hP = 0;
  const mv = (x, y) => { mouse.x = (x / W()) * 2 - 1; mouse.y = -(y / H()) * 2 + 1; mouse.active = true; };
  window.addEventListener('mousemove', e => mv(e.clientX, e.clientY));
  window.addEventListener('mouseout', () => { mouse.active = false; });
  window.addEventListener('touchmove', e => { e.preventDefault(); mv(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  window.addEventListener('touchend', () => { mouse.active = false; });

  const modeW = new THREE.Vector4(1, 0, 0, 0);
  const HOLD = 8.0, BLEND = 3.0;

  function onResize() {
    R.setSize(W(), H());
    camMain.aspect = W() / H();
    camMain.updateProjectionMatrix();
    pMat.uniforms.uRez.value.set(W(), H());
    pMat.uniforms.uPS.value = W() / (PR * 2000) * 0.65;
    iW = W() * PR | 0;
    iH = H() * PR | 0;
    [trailA, trailB, outRT].forEach(r => r.dispose());
    trailA = mkFull();
    trailB = mkFull();
    outRT = mkFull();
    postMat.uniforms.uRez.value.set(iW, iH);
    trailMat.fragmentShader = buildTrailFrag(iW, iH);
    trailMat.needsUpdate = true;
  }
  window.addEventListener('resize', onResize);

  function probeGPU() {
    try {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) {
        const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase();
        if (/rtx|rx 6|rx 7|m1|m2|m3|a100|4090|3090|3080|radeon pro/i.test(renderer)) {
          applyQuality(2);
        } else if (/intel|hd graphics|uhd|mali|adreno 5|adreno 6/i.test(renderer)) {
          applyQuality(0);
        } else {
          applyQuality(1);
        }
      }
    } catch (_) { applyQuality(1); }
  }

  let targetInterval = 1000 / 60;
  const clock = new THREE.Clock();
  let prevT = 0, ever = false, gpuProbed = false;

  function frame(ts) {
    if (ts - lastFrameTime < targetInterval - 1) { requestAnimationFrame(frame); return; }
    lastFrameTime = ts;

    const t = clock.getElapsedTime();
    const dt = Math.min(t - prevT, 0.05);
    prevT = t;

    if (!gpuProbed && ever) { gpuProbed = true; probeGPU(); }

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
    R.setRenderTarget(outRT);
    R.clearColor();
    R.render(scene, camMain);

    trailMat.uniforms.uPrev.value = trailA.texture;
    trailMat.uniforms.uParts.value = outRT.texture;
    trailMat.uniforms.uTime.value = t;
    trailMat.uniforms.uDecay.value = 0.91 - hP * 0.04;
    R.setRenderTarget(trailB);
    R.clear();
    R.render(trailScene, flatCam);

    postMat.uniforms.uTex.value = trailB.texture;
    postMat.uniforms.uTime.value = t;
    R.setRenderTarget(null);
    R.clear();
    R.render(postScene, flatCam);

    let tmp = rA; rA = rB; rB = tmp;
    tmp = trailA; trailA = trailB; trailB = tmp;
    ever = true;

    requestAnimationFrame(frame);
  }

  detectHz(hz => {
    const knownHz = [60, 90, 120, 144, 165, 240];
    const snapped = knownHz.reduce((a, b) => Math.abs(b - hz) < Math.abs(a - hz) ? b : a);
    targetFPS = snapped;
    targetInterval = 1000 / snapped;
    animFrameId = requestAnimationFrame(frame);
  });
}

export { initParticles };

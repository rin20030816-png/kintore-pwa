"use strict";
/* キャラを「立体」に見せる（WebGL）。
   切り抜きの絵の輪郭から、ふっくらした厚みのある形（まるいクッションのような立体）を作り、絵をはりつけて、光と影をつけます。
   指でドラッグすると、ぐるぐる回り、横から見ると厚みがあり、うしろ姿は、暗い面になります。
   WebGLが使えない端末では、何もしません（pet.js の、平らな絵の回転のまま）。 */
(function () {
  const GEO = new Map(), CTL = new WeakMap();

  /* ---------- 絵 → 立体の形 ---------- */
  function build(im) {
    const w = im.naturalWidth, h = im.naturalHeight;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const cx = cv.getContext("2d", { willReadFrequently: true }); cx.drawImage(im, 0, 0);
    const d = cx.getImageData(0, 0, w, h).data;
    const GX = Math.max(28, Math.min(100, Math.round(w / 5))), GY = Math.max(28, Math.min(100, Math.round(h / 5)));
    const N = GX * GY, ins = new Uint8Array(N);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const px = Math.round(i / (GX - 1) * (w - 1)), py = Math.round(j / (GY - 1) * (h - 1)); let s = 0, c = 0;
      for (let dy = -3; dy <= 3; dy += 3) for (let dx = -3; dx <= 3; dx += 3) { const x = Math.min(w - 1, Math.max(0, px + dx)), y = Math.min(h - 1, Math.max(0, py + dy)); s += d[(y * w + x) * 4 + 3]; c++ }
      ins[j * GX + i] = s / c > 0.42 * 255 ? 1 : 0;
    }
    // 輪郭からの距離（2回なぞる近似）
    const dist = new Float32Array(N), at = (i, j) => (i < 0 || j < 0 || i >= GX || j >= GY) ? 0 : dist[j * GX + i];
    for (let k = 0; k < N; k++) dist[k] = ins[k] ? 1e9 : 0;
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const k = j * GX + i; if (!ins[k]) continue; dist[k] = Math.min(dist[k], at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + 1.414, at(i + 1, j - 1) + 1.414) }
    for (let j = GY - 1; j >= 0; j--) for (let i = GX - 1; i >= 0; i--) { const k = j * GX + i; if (!ins[k]) continue; dist[k] = Math.min(dist[k], at(i + 1, j) + 1, at(i, j + 1) + 1, at(i + 1, j + 1) + 1.414, at(i - 1, j + 1) + 1.414) }
    // ふっくらした厚み（まるい縁。中ほどは平ら）
    const R = Math.max(4, Math.min(GX, GY) / 15), T = 0.105, hh = new Float32Array(N);
    for (let k = 0; k < N; k++) { if (!ins[k]) continue; const t = Math.min(dist[k] / R, 1); hh[k] = T * Math.sqrt(1 - (1 - t) * (1 - t)) }
    // 少しなめらかに
    const sm = new Float32Array(N);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { let s = 0, c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = i + dx, y = j + dy; if (x < 0 || y < 0 || x >= GX || y >= GY) { c++; continue } s += hh[y * GX + x]; c++ } sm[j * GX + i] = ins[j * GX + i] ? s / c : 0 }
    const A = w / h, dxw = 2 * A / (GX - 1), dyw = 2 / (GY - 1), V = 9, buf = new Float32Array(2 * N * V);
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const k = j * GX + i, x = (i / (GX - 1) - 0.5) * 2 * A, y = (0.5 - j / (GY - 1)) * 2, z = sm[k];
      const hx = ((sm[j * GX + Math.min(GX - 1, i + 1)] - sm[j * GX + Math.max(0, i - 1)]) / (2 * dxw)), hy = ((sm[Math.max(0, j - 1) * GX + i] - sm[Math.min(GY - 1, j + 1) * GX + i]) / (2 * dyw));
      const nl = Math.hypot(hx, hy, 1);
      for (let side = 0; side < 2; side++) {
        const o = (side * N + k) * V, s = side ? -1 : 1;
        buf[o] = x; buf[o + 1] = y; buf[o + 2] = z * s; buf[o + 3] = i / (GX - 1); buf[o + 4] = j / (GY - 1);
        buf[o + 5] = -hx / nl; buf[o + 6] = -hy / nl; buf[o + 7] = s / nl; buf[o + 8] = side; // 前も後ろも、縁では外向きにかたむく
      }
    }
    const idx = [];
    for (let j = 0; j < GY - 1; j++) for (let i = 0; i < GX - 1; i++) {
      const a = j * GX + i, b = a + 1, c = a + GX, e = c + 1;
      if (!(ins[a] || ins[b] || ins[c] || ins[e])) continue;
      idx.push(a, b, c, b, e, c, N + a, N + c, N + b, N + b, N + c, N + e);
    }
    return { buf, idx: new Uint16Array(idx), A, im };
  }
  function geom(src) {
    if (GEO.has(src)) return GEO.get(src);
    const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => { try { res(build(im)) } catch (e) { rej(e) } }; im.onerror = rej; im.src = src });
    GEO.set(src, p); return p;
  }

  /* ---------- 描く ---------- */
  const VS = `attribute vec3 aPos;attribute vec2 aUv;attribute vec3 aNrm;attribute float aSide;
  uniform mat3 uRot;uniform float uS;uniform float uTy;uniform float uBob;
  varying vec2 vUv;varying vec3 vN;varying float vSide;
  void main(){vec3 p=uRot*aPos;vN=uRot*aNrm;vUv=aUv;vSide=aSide;
    gl_Position=vec4(p.x*uS,p.y*uS+uTy+uBob,-p.z*0.4,1.0-p.z*0.10*uS);}`;
  const FS = `precision mediump float;uniform sampler2D uTex;uniform vec3 uGlow;
  varying vec2 vUv;varying vec3 vN;varying float vSide;
  void main(){vec4 c=texture2D(uTex,vUv);if(c.a<0.06)discard;
    vec3 n=normalize(vN);vec3 L=normalize(vec3(-0.45,0.55,0.75));
    float df=max(dot(n,L),0.0);float rim=pow(1.0-abs(n.z),2.0);
    float edge=mix(0.5,1.0,smoothstep(0.15,0.85,abs(n.z)));
    vec3 rgb=c.rgb*(0.62+0.55*df)*edge+uGlow*rim*0.12*c.a;
    if(vSide>0.5)rgb*=vec3(0.50,0.52,0.58);
    gl_FragColor=vec4(min(rgb,vec3(1.0)),c.a);}`;
  function sh(gl, type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
  const hex = h => { const n = parseInt((h || "#ffb02e").slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255] };

  function start(c, cvs, g) {
    const gl = cvs.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) throw new Error("no webgl");
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl, gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, g.buf, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    const F = 4, ST = 9 * F, att = (n, sz, off) => { const l = gl.getAttribLocation(pr, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, ST, off * F) };
    att("aPos", 3, 0); att("aUv", 2, 3); att("aNrm", 3, 5); att("aSide", 1, 8);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g.im);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const U = n => gl.getUniformLocation(pr, n);
    const uRot = U("uRot"), uS = U("uS"), uTy = U("uTy"), uBob = U("uBob"), uGlow = U("uGlow");
    gl.uniform3fv(uGlow, hex(c.dataset.gc));
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const S = 0.86 / Math.max(1, g.A), TY = -0.90 + S;
    const ctl = { yaw: 0, pitch: 0, rest: true, dead: false, raf: 0,
      set(a, p) { ctl.yaw = a; ctl.pitch = p || 0; ctl.rest = (a % 360 === 0) && !p },
      destroy() { if (ctl.dead) return; ctl.dead = true; cancelAnimationFrame(ctl.raf); try { gl.getExtension("WEBGL_lose_context") && gl.getExtension("WEBGL_lose_context").loseContext() } catch (e) {} } };
    function frame(t) {
      if (ctl.dead) return;
      if (!c.isConnected) { ctl.destroy(); return }
      ctl.raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(2, Math.round(c.clientWidth * dpr)), H = Math.max(2, Math.round(c.clientHeight * dpr));
      if (cvs.width !== W || cvs.height !== H) { cvs.width = W; cvs.height = H }
      gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const s = t / 1000, still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const sway = ctl.rest && !still ? Math.sin(s * 0.9) * 9 : 0, tilt = ctl.rest && !still ? Math.sin(s * 0.7) * 2.5 : 0;
      const ya = (ctl.yaw + sway) * Math.PI / 180, pa = (ctl.pitch + tilt) * Math.PI / 180, cy = Math.cos(ya), sy = Math.sin(ya), cp = Math.cos(pa), sp = Math.sin(pa);
      // R = Rx(pitch) * Ry(yaw)（列を先にならべる）
      gl.uniformMatrix3fv(uRot, false, new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]));
      gl.uniform1f(uS, S); gl.uniform1f(uTy, TY); gl.uniform1f(uBob, still ? 0 : Math.sin(s * 2.2) * 0.022);
      gl.drawElements(gl.TRIANGLES, g.idx.length, gl.UNSIGNED_SHORT, 0);
    }
    ctl.raf = requestAnimationFrame(frame);
    return ctl;
  }

  /* ---------- つなぐ ---------- */
  function mount(root) {
    if (!root) return;
    root.querySelectorAll(".pc[data-spin]").forEach(c => {
      if (CTL.has(c)) return;
      const img = c.querySelector("img"); if (!img) return;
      CTL.set(c, null);
      const cvs = document.createElement("canvas"); cvs.className = "pc-gl"; cvs.setAttribute("aria-hidden", "true");
      cvs.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .25s";
      (c.querySelector(".pc-b") || c).appendChild(cvs);
      geom(img.getAttribute("src")).then(g => {
        if (!c.isConnected) { cvs.remove(); return }
        const ctl = start(c, cvs, g); CTL.set(c, ctl);
        img.style.visibility = "hidden"; cvs.style.opacity = "1"; c.classList.add("pc-3d");
      }).catch(() => { cvs.remove(); CTL.delete(c) });
    });
  }
  window.__pet3d = { mount, get: c => CTL.get(c) || null };
})();

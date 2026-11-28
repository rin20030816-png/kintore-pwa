"use strict";
/* 本物の3Dモデル（GLB）で、キャラを回して見せる。pet3d.js が、モデルのあるキャラ・段階のときだけ、このファイルを読みこむ。
   モデルがないとき、読みこみや描画に失敗したときは、pet3d.js の「ふくらませた立体」にもどる（何も起きない）。
   外すとき：pet3d.js の「GLB」の行（GLB と書いてある2か所）を消し、このファイル・vendor/three/・chars/glb/ を消す。 */
(function () {
  const LIBS = ["/vendor/three/three.min.js", "/vendor/three/BufferGeometryUtils.js", "/vendor/three/GLTFLoader.js"];
  let libP = null;
  const loadScript = s => new Promise((res, rej) => { const e = document.createElement("script"); e.src = s; e.onload = res; e.onerror = () => rej(new Error("load " + s)); document.head.appendChild(e) });
  const libs = () => libP || (libP = LIBS.reduce((p, s) => p.then(() => loadScript(s)), Promise.resolve()));
  const MODELS = new Map();
  const model = url => {
    /* このサイトの通信の決まり（CSP）は、blob: への fetch を許さない。three.js の ImageBitmap の読みこみは blob: を fetch するので、
       解析のあいだだけ createImageBitmap を無いことにして、ふつうの <img> での読みこみ（img-src の blob: は許可済み）にする */
    if (!MODELS.has(url)) MODELS.set(url, fetch(url).then(r => { if (!r.ok) throw new Error("glb " + r.status); return r.arrayBuffer() }).then(buf => new Promise((res, rej) => {
      const cib = window.createImageBitmap; window.createImageBitmap = undefined;
      try { new THREE.GLTFLoader().parse(buf, "", g => res(g.scene), rej) } catch (e) { rej(e) } finally { window.createImageBitmap = cib }
    })));
    return MODELS.get(url);
  };
  const hex = h => { const n = parseInt((h || "#ffb02e").slice(1), 16); return (n >> 16 & 255) / 255 + "," + (n >> 8 & 255) / 255 + "," + (n & 255) / 255 };

  /* まわりの景色（金属や光沢が、まっ黒にならないように、明るい面をいくつか置いた小さな部屋） */
  function envMap(renderer) {
    const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(renderer);
    sc.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), new THREE.MeshBasicMaterial({ color: 0x3a4152, side: THREE.BackSide })));
    const panel = (w, h, x, y, z, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m) };
    panel(8, 5, -4, 6, 5, 0xffffff); panel(4, 6, 7, 1, 2, 0xcfd8ff); panel(6, 3, 0, -4, 5, 0x706a60); panel(5, 5, 0, 5, -6, 0xffe2c0);
    const t = pm.fromScene(sc, 0.03).texture; pm.dispose(); return t;
  }

  /* c: .pc の要素、cvs: 描く先のcanvas。成功すると、pet3d.js と同じ形の操作役（set / destroy）を返す */
  function start(c, cvs, url) {
    return libs().then(() => model(url)).then(src => {
      const renderer = new THREE.WebGLRenderer({ canvas: cvs, alpha: true, antialias: true, premultipliedAlpha: true });
      renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.setClearColor(0x000000, 0);
      const scene = new THREE.Scene(); scene.environment = envMap(renderer);
      const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-1.6, 2.2, 2.6); scene.add(key);
      const rim = new THREE.DirectionalLight(0xffd9b0, 0.8); rim.position.set(2.5, 1.2, -2.2); scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xe4ecff, 0x2c2e38, 0.55));
      const obj = src.clone(true), box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
      const grp = new THREE.Group(), pivot = new THREE.Group(); // pivot: 足もとを中心に回す／grp: 大きさをそろえる
      obj.position.set(-ctr.x, -box.min.y, -ctr.z); pivot.add(obj); grp.add(pivot);
      const H = Math.max(size.y, 1e-3), Wd = Math.max(size.x, size.z); grp.scale.setScalar(1 / Math.max(H, Wd * 0.9)); scene.add(grp);
      const fov = 26, cam = new THREE.PerspectiveCamera(fov, 1, 0.05, 50);
      const target = new THREE.Vector3(0, 0.5 * (H / Math.max(H, Wd * 0.9)), 0), dist = 0.5 / Math.tan(fov * Math.PI / 360) * 1.55;
      cam.position.set(0, target.y + 0.02, dist); cam.lookAt(target);
      const ctl = { yaw: 0, pitch: 0, rest: true, dead: false, raf: 0,
        set(a, p) { ctl.yaw = a; ctl.pitch = p || 0; ctl.rest = (a % 360 === 0) && !p },
        destroy() { if (ctl.dead) return; ctl.dead = true; cancelAnimationFrame(ctl.raf); try { renderer.dispose(); renderer.forceContextLoss() } catch (e) {} } };
      let nf = 0, shown = false;
      const giveUp = why => { c.dataset.gl = "glb-fail:" + why; ctl.destroy(); if (ctl.onfail) ctl.onfail(why) };
      cvs.addEventListener("webglcontextlost", ev => { ev.preventDefault(); if (!ctl.dead) giveUp("lost") });
      const empty = () => { const gl = renderer.getContext(), W = cvs.width, Hh = cvs.height, px = new Uint8Array(4); for (let y = 1; y < 14; y++) for (let x = 1; x < 14; x++) { gl.readPixels(Math.floor(W * x / 14), Math.floor(Hh * y / 14), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (px[3] > 8) return false } return true };
      function frame(t) {
        if (ctl.dead) return;
        if (!c.isConnected) { ctl.destroy(); return }
        ctl.raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.max(2, Math.round(c.clientWidth * dpr)), Hh = Math.max(2, Math.round(c.clientHeight * dpr));
        if (cvs.width !== W || cvs.height !== Hh) { renderer.setSize(W, Hh, false); cam.aspect = W / Hh; cam.updateProjectionMatrix() }
        const s = t / 1000, still = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const sway = ctl.rest && !still ? Math.sin(s * 0.9) * 15 : 0, tilt = ctl.rest && !still ? Math.sin(s * 0.7) * 2.5 : 0;
        pivot.rotation.y = (ctl.yaw + sway) * Math.PI / 180; pivot.rotation.x = (ctl.pitch + tilt) * Math.PI / 180;
        grp.position.y = still ? 0 : Math.sin(s * 2.2) * 0.012;
        renderer.render(scene, cam);
        if (!shown && ++nf >= 3) { if (empty()) { giveUp("empty"); return } shown = true; c.dataset.gl = "glb-ok" }
      }
      ctl.raf = requestAnimationFrame(frame);
      return ctl;
    });
  }
  window.__petGlb = { start };
})();

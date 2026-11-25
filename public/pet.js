"use strict";
/* キャラ育成。記録から計算したポイント（points.js）の累計で、キャラが太陽系を旅して進化します。
   app.js・points.js のあとに読み込み、「記録」画面にキャラのカードを足すだけです（記録の計算や保存にはさわりません）。
   選んだキャラと、進化の演出を見せた段階は、設定（S.settings.pet / petLv）に入れて、ログインしていれば端末間で同期されます。 */
(function () {
  if (typeof window.render !== "function" || typeof window.computePoints !== "function") return;

  /* ---------- 段階（累計ポイントのしきい値は、あとから調整できる） ---------- */
  const STAGES = [
    { n: "地球", pt: 0, sub: "ここから、スタート", item: "はだか（素のすがた）", ground: "#2c6e50", sky: ["#0a1a35", "#1c4a7a"], planet: "earth" },
    { n: "月", pt: 500, sub: "ふわっと、軽い", item: "タンクトップ", ground: "#8c8e97", sky: ["#07080f", "#191c2c"], planet: "moon" },
    { n: "火星", pt: 2000, sub: "赤い大地で、鍛える", item: "ヘッドバンド", ground: "#b3532c", sky: ["#2a0f0a", "#6a2a18"], planet: "mars" },
    { n: "木星", pt: 5000, sub: "重力が、ずっしり", item: "グローブとベルト", ground: "#b08a5e", sky: ["#2a1c10", "#6b4a2a"], planet: "jupiter" },
    { n: "土星", pt: 10000, sub: "輪っかの向こうへ", item: "ケープ", ground: "#b9a15a", sky: ["#1d1a0c", "#5a4c20"], planet: "saturn" },
    { n: "天王星", pt: 20000, sub: "凍える星で、燃える", item: "金の肩パッド", ground: "#6fc3cc", sky: ["#06222a", "#176a78"], planet: "uranus" },
    { n: "海王星", pt: 35000, sub: "深い青の、はるか先", item: "王冠", ground: "#2f55c9", sky: ["#050b2a", "#14288a"], planet: "neptune" },
    { n: "冥王星", pt: 60000, sub: "異次元。もう、だれも追いつけない", item: "後光とオーラ（最終）", ground: "#a58a78", sky: ["#000000", "#1a0f2e"], planet: "pluto" }
  ];
  const SP = {
    mofu: { name: "もふ", fur: "#f1dcb4", belly: "#fff1d2", line: "#c2a066", accent: "#ff6a00" },
    puru: { name: "ぷる", fur: "#8fd0ff", belly: "#d5efff", line: "#4a98dc", accent: "#2f7bff" },
    piyo: { name: "ぴよ", fur: "#ffd84a", belly: "#fff0a0", line: "#d1a312", accent: "#ff8a1f" }
  };
  const stageOf = p => { let i = 0; STAGES.forEach((s, k) => { if (p >= s.pt) i = k }); return i };
  const uOf = p => { const i = stageOf(p); return i >= STAGES.length - 1 ? STAGES.length - 1 : i + (p - STAGES[i].pt) / (STAGES[i + 1].pt - STAGES[i].pt) };
  const nf = n => Math.round(n).toLocaleString("ja-JP");
  let UID = 0;
  const e = (cx, cy, rx, ry, f, x) => `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${f}" ${x || ""}/>`;
  const star = (x, y, r, f) => `<path d="M${x} ${y - r}L${x + r * .28} ${y - r * .28}L${x + r} ${y}L${x + r * .28} ${y + r * .28}L${x} ${y + r}L${x - r * .28} ${y + r * .28}L${x - r} ${y}L${x - r * .28} ${y - r * .28}Z" fill="${f}"/>`;

  function skyPlanet(k) {
    const x = 236, y = 66, r = 34;
    switch (k) {
      case "earth": return e(x, y, r, r, "#2f7fd0") + `<path d="M214 56q10-12 24-8 8 8-2 16-12 6-22-8zM236 76q10-4 16 4-4 12-16 8z" fill="#52b36a"/>` + e(x, y, r, r, "none", `stroke="#9fd0ff" stroke-opacity=".5" stroke-width="3"`);
      case "moon": return e(x, y, r, r, "#d8d9de") + e(226, 58, 7, 6, "#b9bac2") + e(246, 72, 9, 8, "#b9bac2") + e(232, 82, 4, 3, "#b9bac2");
      case "mars": return e(x, y, r - 6, r - 6, "#d2623a") + e(228, 64, 6, 4, "#a8452a") + e(244, 72, 5, 4, "#a8452a");
      case "jupiter": return e(x, y, r + 4, r + 4, "#d9b98a") + `<path d="M200 56h72M198 68h76M202 80h68" stroke="#b78a5c" stroke-width="5" opacity=".8"/>` + e(246, 72, 8, 5, "#b6563a");
      case "saturn": return e(x, y, r - 4, r - 4, "#e6cf86") + `<ellipse cx="${x}" cy="${y}" rx="${r + 14}" ry="9" fill="none" stroke="#f0e3b0" stroke-width="5" transform="rotate(-18 ${x} ${y})"/>`;
      case "uranus": return e(x, y, r - 4, r - 4, "#8fe3ea") + `<ellipse cx="${x}" cy="${y}" rx="${r + 8}" ry="3.5" fill="none" stroke="#c8f4f7" stroke-width="2" transform="rotate(80 ${x} ${y})"/>`;
      case "neptune": return e(x, y, r - 4, r - 4, "#3a62e0") + e(228, 62, 10, 4, "#7fa2ff", "opacity=\".6\"");
      default: return e(x, y, r - 10, r - 10, "#c9b2a1") + `<path d="M${x - 9} ${y - 4}q-6-9 3-10 5 0 6 5 1-5 6-5 9 1 3 10l-9 12z" fill="#fff3ee" opacity=".92"/>`; // 冥王星の「ハート」
    }
  }

  /* ---------- キャラの絵（SVG） ---------- */
  function draw(key, pts, opt) {
    opt = opt || {}; const id = "pg" + (++UID);
    const s = SP[key], i = stageOf(pts), u = uOf(pts), st = STAGES[i], U = STAGES.length - 1;
    const S_ = 0.80 + 0.30 * (u / U), m = Math.pow(Math.max(0, Math.min(1, (u - 1) / 6)), 0.9), c = 0.25 + 0.75 * (u / U);
    const cx = 150, bw = 54 + 13 * m, bh = 50 + 5 * m, by = 232, hr0 = 48 + 5 * c, hr1 = 42 + 5 * c, hy = by - bh - hr1 + 18, A = s.accent;
    const o = [];
    o.push(`<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${st.sky[0]}"/><stop offset="1" stop-color="${st.sky[1]}"/></linearGradient>
     <radialGradient id="${id}a"><stop offset="0" stop-color="#ffe68a" stop-opacity=".85"/><stop offset="1" stop-color="#ffb000" stop-opacity="0"/></radialGradient>
     <clipPath id="${id}b"><ellipse cx="${cx}" cy="${by}" rx="${bw}" ry="${bh}"/></clipPath></defs>`);
    o.push(`<rect width="300" height="300" fill="url(#${id}s)"/>`);
    for (let k = 0; k < 26; k++) { const x = (k * 97) % 300, y = (k * 53) % 190, r = (k % 3) * 0.5 + 0.7; o.push(`<circle class="${opt.still ? "" : "ptw"}" style="animation-delay:${(k % 7) * .3}s" cx="${x}" cy="${y}" r="${r}" fill="#fff"/>`) }
    o.push(skyPlanet(st.planet));
    o.push(`<path d="M-20 300V268Q150 242 320 268V300Z" fill="${st.ground}"/><path d="M-20 300V284Q150 266 320 284V300Z" fill="#000" opacity=".18"/>`);
    if (i >= 7) o.push(`<circle cx="150" cy="190" r="135" fill="url(#${id}a)"/>`);
    o.push(`<g transform="translate(150 284) scale(${S_.toFixed(3)}) translate(-150 -284)"><g class="${opt.still ? "" : "pbob"}">`);
    o.push(e(cx, 287, 70, 8, "#000", "opacity=\".28\""));
    if (i >= 4) o.push(`<path d="M${cx - bw * .8} ${by - bh * .62}L${cx + bw * .8} ${by - bh * .62}L${cx + bw * 1.45} ${by + bh * .98}L${cx - bw * 1.45} ${by + bh * .98}Z" fill="${A}" stroke="#000" stroke-opacity=".25" stroke-width="2"/>`);
    o.push(e(cx - 27, 282, 23, 11, "#fff", "stroke=\"#d6d6dc\"") + e(cx + 27, 282, 23, 11, "#fff", "stroke=\"#d6d6dc\"") + e(cx - 27, 284, 23, 5, A, "opacity=\".85\"") + e(cx + 27, 284, 23, 5, A, "opacity=\".85\""));
    o.push(e(cx, by, bw, bh, s.fur, `stroke="${s.line}" stroke-width="2"`) + e(cx, by + 8, bw * .62, bh * .7, s.belly));
    if (i >= 1) {
      o.push(`<g clip-path="url(#${id}b)"><rect x="${cx - bw * .8}" y="${by - bh * .62}" width="${bw * 1.6}" height="${bh * 1.0}" fill="${A}"/><ellipse cx="${cx}" cy="${by - bh * .62}" rx="${bw * .34}" ry="${bh * .2}" fill="${s.belly}"/></g>`);
      o.push(`<text x="${cx}" y="${by + 4}" text-anchor="middle" font-size="${(20 + 6 * m).toFixed(0)}" font-weight="900" fill="#fff" style="font-family:'Dela Gothic One','Noto Sans JP',sans-serif">力</text>`);
    }
    if (m > 0.3) {
      const op = Math.min(.7, m * 1.0);
      o.push(`<path d="M${cx - bw * .62} ${by - bh * .2}Q${cx - bw * .32} ${by + bh * .18} ${cx} ${by - bh * .04}M${cx + bw * .62} ${by - bh * .2}Q${cx + bw * .32} ${by + bh * .18} ${cx} ${by - bh * .04}" stroke="#000" stroke-opacity="${op * .55}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
      if (m > 0.55) o.push(`<path d="M${cx} ${by + bh * .22}V${by + bh * .62}M${cx - 11} ${by + bh * .34}H${cx + 11}M${cx - 11} ${by + bh * .5}H${cx + 11}" stroke="#000" stroke-opacity="${op * .45}" stroke-width="2" stroke-linecap="round"/>`);
    }
    if (i >= 3) o.push(`<g clip-path="url(#${id}b)"><rect x="${cx - bw}" y="${by + bh * .52}" width="${bw * 2}" height="8" fill="#2a2a30"/></g>` + `<rect x="${cx - 8}" y="${by + bh * .52 - 1}" width="16" height="10" rx="2" fill="#ffc21a" stroke="#a37a00"/>`);
    const ax = bw - 1, ay = by - 8, arx = 12 + 9 * m, ary = 26 + 7 * m;
    [-1, 1].forEach(d => {
      o.push(`<g transform="rotate(${d * 13} ${cx + d * ax} ${ay})">` + e(cx + d * ax, ay, arx, ary, s.fur, `stroke="${s.line}" stroke-width="2"`));
      if (m > 0.2) o.push(e(cx + d * (ax + 3), ay - 14, 7 + 10 * m, 6 + 8 * m, s.fur, `stroke="${s.line}" stroke-width="2"`));
      if (i >= 3) o.push(e(cx + d * ax, ay + ary - 5, arx + 2, 9, "#2a2a30") + e(cx + d * ax, ay + ary - 10, arx + 2, 3, A));
      if (i >= 5) o.push(e(cx + d * (ax - 1), ay - ary + 4, arx + 5 + m * 3, 9 + m * 2, "#ffc21a", `stroke="#a37a00" stroke-width="2"`));
      o.push(`</g>`);
    });
    if (key === "mofu") { [-1, 1].forEach(d => { o.push(e(cx + d * hr0 * .68, hy - hr1 * .82, 17, 17, s.fur, `stroke="${s.line}" stroke-width="2"`) + e(cx + d * hr0 * .68, hy - hr1 * .82, 9, 9, "#ffb3c0")); o.push(`<g transform="rotate(${d * 28} ${cx + d * hr0 * .68} ${hy - hr1 * .98})"><rect x="${cx + d * hr0 * .68 - 11}" y="${hy - hr1 * .98 - 3}" width="22" height="6" rx="2" fill="#8a8f99"/><rect x="${cx + d * hr0 * .68 - 14}" y="${hy - hr1 * .98 - 7}" width="6" height="14" rx="2" fill="#5a5f69"/><rect x="${cx + d * hr0 * .68 + 8}" y="${hy - hr1 * .98 - 7}" width="6" height="14" rx="2" fill="#5a5f69"/></g>`) }) }
    if (key === "puru") o.push(`<path d="M${cx} ${hy - hr1 - 14}Q${cx + 14} ${hy - hr1 + 6} ${cx} ${hy - hr1 + 8}Q${cx - 14} ${hy - hr1 + 6} ${cx} ${hy - hr1 - 14}Z" fill="${s.fur}" stroke="${s.line}" stroke-width="2"/>`);
    if (key === "piyo") o.push(`<path d="M${cx - 8} ${hy - hr1 + 4}Q${cx - 12} ${hy - hr1 - 14} ${cx - 3} ${hy - hr1 - 8}Q${cx} ${hy - hr1 - 22} ${cx + 5} ${hy - hr1 - 8}Q${cx + 14} ${hy - hr1 - 14} ${cx + 9} ${hy - hr1 + 4}Z" fill="${s.fur}" stroke="${s.line}" stroke-width="2"/>`);
    o.push(e(cx, hy, hr0, hr1, s.fur, `stroke="${s.line}" stroke-width="2"`) + e(cx, hy + 10, hr0 * .7, hr1 * .62, s.belly, "opacity=\".6\""));
    if (i >= 2) o.push(`<path d="M${cx - hr0 * .97} ${hy - 4}Q${cx} ${hy - hr1 * .62} ${cx + hr0 * .97} ${hy - 4}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M${cx - hr0 * .95} ${hy - 5}Q${cx} ${hy - hr1 * .62 - 1} ${cx + hr0 * .95} ${hy - 5}" stroke="${A}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
    const ex = hr0 * .42, ey = hy + 7, erx = 7 + 3.5 * c, ery = 9 + 5 * c;
    [-1, 1].forEach(d => { o.push(e(cx + d * ex, ey, erx, ery, "#1b1b22") + `<circle cx="${cx + d * ex - 2}" cy="${ey - ery * .35}" r="${2.4 + 2 * c}" fill="#fff"/><circle cx="${cx + d * ex + 3}" cy="${ey + ery * .3}" r="${1.2 + .8 * c}" fill="#fff" opacity=".8"/>`) });
    o.push(e(cx - hr0 * .66, hy + hr1 * .4, 9, 5, "#ff8fa3", `opacity="${(.12 + .48 * c).toFixed(2)}"`) + e(cx + hr0 * .66, hy + hr1 * .4, 9, 5, "#ff8fa3", `opacity="${(.12 + .48 * c).toFixed(2)}"`));
    if (key === "piyo") o.push(`<path d="M${cx - 8} ${hy + hr1 * .34}L${cx + 8} ${hy + hr1 * .34}L${cx} ${hy + hr1 * .34 + 11}Z" fill="#ff8a1f" stroke="#c46410" stroke-width="1.5" stroke-linejoin="round"/>`);
    else o.push(`<path d="M${cx - 7} ${hy + hr1 * .46}Q${cx} ${hy + hr1 * .46 + (7 + 3 * c)} ${cx + 7} ${hy + hr1 * .46}" stroke="#4a2f26" stroke-width="2.6" fill="none" stroke-linecap="round"/>`);
    if (c > 0.55) o.push(star(cx + hr0 * .62, hy - hr1 * .55, 7 + 3 * c, "#ffc21a"));
    if (i >= 6) o.push(`<path d="M${cx - 24} ${hy - hr1 + 2}L${cx - 22} ${hy - hr1 - 18}L${cx - 10} ${hy - hr1 - 6}L${cx} ${hy - hr1 - 22}L${cx + 10} ${hy - hr1 - 6}L${cx + 22} ${hy - hr1 - 18}L${cx + 24} ${hy - hr1 + 2}Z" fill="#ffc21a" stroke="#a37a00" stroke-width="2" stroke-linejoin="round"/><circle cx="${cx}" cy="${hy - hr1 - 8}" r="3.4" fill="#ff4b6e"/>`);
    if (i >= 7) o.push(`<ellipse cx="${cx}" cy="${hy - hr1 - 30}" rx="40" ry="9" fill="none" stroke="#ffe68a" stroke-width="4"/>`);
    if (i >= 4) o.push(star(cx - bw * 1.25, by - bh * .9, 6, "#fff7c2") + star(cx + bw * 1.3, by - bh * .7, 5, "#fff7c2"));
    if (i >= 7) { o.push(star(cx - bw * 1.4, by + 10, 8, "#ffe68a") + star(cx + bw * 1.45, by - 20, 9, "#ffe68a") + star(cx + 20, hy - hr1 - 48, 6, "#ffe68a")) }
    o.push(`</g></g>`);
    return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${s.name}・${st.n}">${o.join("")}</svg>`;
  }

  /* ---------- 累計ポイント（記録が変わったときだけ計算しなおす） ---------- */
  let ver = 0, cache = null;
  const _saveDay = window.saveDay;
  if (typeof _saveDay === "function") window.saveDay = function () { ver++; return _saveDay.apply(this, arguments) };
  function sigOf() { let n = 0, k = 0; for (const d in S.days) { k++; for (const x of S.days[d]) n += x.sets.length } return k + ":" + n }
  function life() {
    const sig = sigOf();
    if (cache && cache.days === S.days && cache.ver === ver && cache.sig === sig) return cache.v;
    let v = 0; try { const m = window.computePoints(); Object.keys(m).forEach(d => { v += m[d] }) } catch (x) { v = cache ? cache.v : 0 }
    cache = { days: S.days, ver, sig, v }; return v;
  }
  const pet = () => (S.settings && SP[S.settings.pet]) ? S.settings.pet : null;

  /* ---------- 見た目（CSS） ---------- */
  const st = document.createElement("style");
  st.textContent = `
  .pbob{animation:pbob 2.6s ease-in-out infinite;transform-origin:150px 284px}
  @keyframes pbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
  @keyframes ptw{0%,100%{opacity:.25}50%{opacity:1}}
  .ptw{animation:ptw 2.2s ease-in-out infinite}
  .pet-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:8px 12px 8px 8px;margin:0 0 12px;cursor:pointer;color:var(--ink);font:inherit}
  .pet-card .pet-th{flex:none;width:92px;border-radius:6px;overflow:hidden;line-height:0}
  .pet-card .pet-th svg{width:100%;height:auto}
  .pet-card .pet-bd{flex:1;min-width:0}
  .pet-card b{display:block;font-size:15px}
  .pet-card .pet-pt{font-size:12px;color:var(--muted);font-weight:700}
  .pet-bar{height:8px;background:var(--surface-2,#1b1e25);border-radius:99px;overflow:hidden;margin:6px 0 3px}
  .pet-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff4b1f,#ffc21a);border-radius:99px}
  .pet-card small{display:block;color:var(--muted);font-size:11px;line-height:1.4}
  .pet-pick{display:block;margin:0 0 12px;background:var(--surface);border:1px dashed var(--line);border-radius:var(--r);padding:12px}
  .pet-pick h3{margin:0 0 4px;font-size:15px}.pet-pick p{margin:0 0 10px;font-size:12px;color:var(--muted);line-height:1.6}
  .pet-pick .row{display:flex;gap:8px}
  .pet-pick button{flex:1;border:1px solid var(--line);background:var(--bg);border-radius:var(--r);padding:6px 4px 8px;color:var(--ink);font:inherit;font-weight:900;font-size:13px;cursor:pointer}
  .pet-pick button svg{display:block;width:100%;height:auto;border-radius:4px;margin-bottom:4px}
  #pet-ov{position:fixed;inset:0;z-index:80;background:var(--bg);color:var(--ink);overflow:auto;-webkit-overflow-scrolling:touch}
  #pet-ov .pw{max-width:620px;margin:0 auto;padding:12px 14px 60px}
  #pet-ov .ptop{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  #pet-ov .ptop b{font-size:16px}
  #pet-ov .pcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-bottom:12px}
  #pet-ov .pcard h2{margin:0 0 10px;font-size:15px}
  #pet-ov .pstage{position:relative;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#000}
  #pet-ov .pstage>svg{display:block;width:100%;height:auto}
  #pet-ov .hud{position:absolute;left:0;right:0;top:0;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;pointer-events:none;color:#fff}
  #pet-ov .hud .nm{font-family:var(--f-display,inherit);font-weight:900;font-size:30px;line-height:1;text-shadow:0 2px 8px rgba(0,0,0,.7)}
  #pet-ov .hud .sb{font-size:12px;font-weight:700;color:#e8ecf5;text-shadow:0 1px 6px rgba(0,0,0,.8);margin-top:4px}
  #pet-ov .hud .pp{margin-left:auto;text-align:right;font-weight:900;text-shadow:0 1px 6px rgba(0,0,0,.8)}
  #pet-ov .hud .pp b{font-size:32px;line-height:1;color:var(--gold)}
  #pet-ov .pbar{height:12px;background:var(--surface-2,#1b1e25);border-radius:99px;overflow:hidden;margin:8px 0 4px}
  #pet-ov .pbar i{display:block;height:100%;background:linear-gradient(90deg,#ff4b1f,#ffc21a);border-radius:99px}
  #pet-ov .chips{display:flex;gap:8px;flex-wrap:wrap}
  #pet-ov .chip{border:1px solid var(--line);background:var(--bg);border-radius:99px;padding:8px 14px;font-weight:900;font-size:14px;color:var(--muted);cursor:pointer;font-family:inherit}
  #pet-ov .chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
  #pet-ov .tl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  #pet-ov .tl .it{background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:4px 4px 8px;text-align:center}
  #pet-ov .tl .it.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(255,194,26,.3)}
  #pet-ov .tl svg{width:100%;height:auto;display:block;border-radius:4px}
  #pet-ov .tl .it.lock svg{filter:brightness(.32) blur(1.2px)}
  #pet-ov .tl b{display:block;font-size:13px;margin-top:4px}
  #pet-ov .tl small{display:block;color:var(--muted);font-size:10px;line-height:1.4}
  #pet-ov .items{margin:0;padding:0;list-style:none}
  #pet-ov .items li{display:flex;gap:8px;align-items:center;padding:7px 0;border-top:1px solid var(--line);font-size:14px}
  #pet-ov .items li:first-child{border-top:0}
  #pet-ov .items li .stn{flex:none;width:58px;font-weight:900;font-size:13px}
  #pet-ov .items li.lock{opacity:.4}
  #pet-ov .pnote{font-size:12px;color:var(--muted);line-height:1.6;margin:8px 0 0}
  #pet-ov .evo{position:absolute;left:12px;right:12px;bottom:12px;background:#fff;color:#111;border-radius:var(--r);padding:10px 14px;font-weight:900;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:pevo .5s ease both}
  #pet-ov .evo small{display:block;font-weight:700;font-size:12px;margin-top:2px;color:#444}
  @keyframes pevo{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion: reduce){.pbob,.ptw{animation:none!important}#pet-ov .evo{animation:none}}
  `;
  document.head.appendChild(st);

  /* ---------- 記録画面のカード ---------- */
  function cardHtml() {
    const k = pet(), p = life();
    if (!k) {
      return `<div class="pet-pick" id="pet-card"><h3>キャラを、むかえよう</h3>
        <p>記録がたまると、ポイントでキャラが育ちます。地球から冥王星まで、太陽系を旅します。どれにしますか？（あとで変えられます）</p>
        <div class="row">${Object.keys(SP).map(x => `<button type="button" data-pet="pick" data-k="${x}" aria-label="${SP[x].name}をむかえる">${draw(x, 600, { still: 1 })}${SP[x].name}</button>`).join("")}</div></div>`;
    }
    const i = stageOf(p), s = STAGES[i], nx = STAGES[i + 1], pr = nx ? (p - s.pt) / (nx.pt - s.pt) : 1;
    return `<button type="button" class="pet-card" id="pet-card" data-pet="open" aria-label="${SP[k].name}を見る">
      <span class="pet-th">${draw(k, p, { still: 1 })}</span>
      <span class="pet-bd"><b>${SP[k].name}　${s.n}　Lv.${i + 1}</b><span class="pet-pt">${nf(p)} pt</span>
      <span class="pet-bar" style="display:block"><i style="width:${(pr * 100).toFixed(1)}%"></i></span>
      <small>${nx ? `次の「${nx.n}」まで、あと ${nf(Math.max(0, nx.pt - Math.round(p)))} pt` : "最終段階。太陽系の果てに、たどりついた"}</small></span></button>`;
  }
  function decorate() {
    if (S.tab !== "log") return;
    const main = document.getElementById("main"); if (!main || document.getElementById("pet-card")) return;
    const tmp = document.createElement("div"); tmp.innerHTML = cardHtml();
    const card = tmp.firstElementChild, wk = main.querySelector(".week");
    if (wk) wk.insertAdjacentElement("afterend", card); else main.insertBefore(card, main.firstChild);
    checkEvolve();
  }

  /* ---------- 大きな画面（キャラの選びなおし・段階の一覧・服） ---------- */
  const OV = { open: false, pts: 0, banner: "", anim: 0 };
  function ovHtml() {
    const k = pet() || "mofu", p = OV.pts, i = stageOf(p), s = STAGES[i], nx = STAGES[i + 1], pr = nx ? (p - s.pt) / (nx.pt - s.pt) : 1, real = life();
    return `<div class="pw"><div class="ptop"><button class="btn" type="button" data-pet="close" id="pet-close">← もどる</button><b>キャラ育成</b></div>
      <div class="pcard" style="padding:10px"><div class="pstage">${draw(k, p)}<div class="hud"><div><div class="nm">${s.n}</div><div class="sb">${s.sub}</div></div><div class="pp"><b>${nf(p)}</b> pt<div style="font-size:11px;font-weight:700;color:#e8ecf5">${SP[k].name}　Lv.${i + 1}</div></div></div>${OV.banner ? `<div class="evo" role="status">${OV.banner}</div>` : ""}</div>
        <div class="pbar"><i style="width:${(pr * 100).toFixed(1)}%"></i></div>
        <div class="pnote" style="margin:0">${nx ? `次の「${nx.n}」まで、あと ${nf(Math.max(0, nx.pt - Math.round(p)))} pt` : "最終段階です。ここが、太陽系の果て。"}</div></div>
      <div class="pcard"><h2>キャラを選ぶ</h2><div class="chips">${Object.keys(SP).map(x => `<button type="button" class="chip" data-pet="pick" data-k="${x}" aria-pressed="${x === k}">${SP[x].name}</button>`).join("")}</div>
        <p class="pnote">どのキャラも、男の子・女の子を選びません。見た目の変化（ムキムキ・大きさ・服・かわいさ）は、全部のキャラで同じです。いつでも、選びなおせます（育ち具合は、そのまま）。</p></div>
      <div class="pcard"><h2>育ち方（太陽系を旅する）</h2><div class="tl">${STAGES.map((x, n) => `<div class="it${n === i ? " on" : ""}${real < x.pt ? " lock" : ""}">${draw(k, x.pt + (n < STAGES.length - 1 ? 5 : 0), { still: 1 })}<b>${x.n}</b><small>${nf(x.pt)}pt〜</small></div>`).join("")}</div>
        <p class="pnote">累計ポイントは、いままでの記録すべてから計算します（友達に見せる設定とは関係ありません）。過去の記録を取り込むと、ポイントが足されて、キャラが育ちます。まだ着いていない先のすがたは、暗くしてあります。</p></div>
      <div class="pcard"><h2>段階ごとの服（運営が決めます）</h2><ul class="items">${STAGES.map(x => `<li class="${real < x.pt ? "lock" : ""}"><span class="stn">${x.n}</span><span>${real >= x.pt ? "✓ " : "🔒 "}${x.item}</span></li>`).join("")}</ul>
        <p class="pnote">服は、運営が決めたものが、自動で着替えます。選ぶことはできません。</p></div></div>`;
  }
  function ovRender() { const el = document.getElementById("pet-ov"); if (!el) return; const sc = el.scrollTop; el.innerHTML = ovHtml(); el.scrollTop = sc }
  function openOv(opt) {
    opt = opt || {}; let el = document.getElementById("pet-ov");
    if (!el) { el = document.createElement("div"); el.id = "pet-ov"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "キャラ育成"); document.body.appendChild(el) }
    OV.open = true; OV.banner = opt.banner || ""; OV.pts = opt.from != null ? opt.from : life(); el.scrollTop = 0; ovRender();
    const b = document.getElementById("pet-close"); if (b) b.focus({ preventScroll: true });
    if (opt.from != null && life() > opt.from) animateTo(life(), 2600);
  }
  function closeOv() {
    const el = document.getElementById("pet-ov"); if (el) el.remove();
    OV.open = false; OV.anim++; OV.banner = ""; const c = document.getElementById("pet-card"); if (c) c.remove(); decorate();
  }
  function animateTo(target, ms) {
    const id = ++OV.anim, from = OV.pts, t0 = performance.now(); let last = stageOf(from);
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; if (reduce) ms = 1;
    (function f(t) {
      if (!OV.open || id !== OV.anim) return;
      const k = Math.min(1, (t - t0) / ms), q = 1 - Math.pow(1 - k, 3); OV.pts = from + (target - from) * q;
      const cur = stageOf(OV.pts); if (cur > last) { last = cur; OV.banner = `進化！ ${STAGES[cur].n} にたどりついた！<small>新しい服：${STAGES[cur].item}</small>` }
      ovRender(); if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- 進化（段階が上がったとき） ---------- */
  function checkEvolve() {
    const k = pet(); if (!k || OV.open) return;
    const cele = document.getElementById("cele"); if (cele && cele.classList.contains("show")) return;
    const cur = stageOf(life());
    if (S.settings.petLv == null) { S.settings.petLv = cur; saveMeta(); return }
    if (cur > S.settings.petLv) {
      const from = S.settings.petLv; S.settings.petLv = cur; saveMeta();
      openOv({ from: STAGES[from].pt, banner: "" });
    } else if (cur < S.settings.petLv) { /* 記録を消したときなど。見せた段階は下げない */ }
  }

  /* ---------- 操作 ---------- */
  function choose(key) {
    if (!SP[key]) return;
    const first = !pet(); S.settings.pet = key;
    if (first || S.settings.petLv == null) S.settings.petLv = stageOf(life());
    saveMeta();
    if (OV.open) { ovRender(); const c = document.getElementById("pet-card"); if (c) c.remove(); decorate(); return }
    const c = document.getElementById("pet-card"); if (c) c.remove();
    openOv({ from: 0, banner: first ? `${SP[key].name}が、仲間になった！` : "" });
  }
  document.addEventListener("click", ev => {
    const b = ev.target.closest && ev.target.closest("[data-pet]"); if (!b) return;
    const a = b.dataset.pet;
    if (a === "pick") choose(b.dataset.k);
    else if (a === "open") openOv();
    else if (a === "close") closeOv();
  });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && OV.open) closeOv() });

  const _render = window.render;
  window.render = function () { _render.apply(this, arguments); try { decorate() } catch (x) {} };
  try { window.render() } catch (x) {}
  window.__pet = { STAGES, stageOf, life, open: openOv }; // 動作確認用
})();

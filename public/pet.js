"use strict";
/* キャラ育成（御三家）。記録から計算したポイント（points.js）の累計で、選んだ1体が8段階に進化します。
   app.js・points.js のあとに読み込み、「記録」画面にキャラのカードを足すだけです（記録の計算や保存にはさわりません）。
   選んだキャラと、進化の演出を見せた段階は、設定（S.settings.pet / petLv）に入れて、ログインしていれば端末間で同期されます。
   まだ着いていない段階の絵は、画面に出しません（絵のファイルも、着くまで読みこみません）。
   記録更新のお祝いなどでは、選んだキャラが、いまの姿でほめてくれます（mascot.js が window.__petPraise を使います）。 */
/* ===== 自分専用のスイッチ（この機能は、まだ、自分の端末でだけ使う）=====
   ・入れる：アプリを「…/?pet=on」で開く。または、画面上の「筋トレは力なり」の文字を、4秒いないに7回タップ。
   ・切る　：「…/?pet=off」で開く。または、同じく文字を7回タップ（入れたり切ったりを、交互に）。
   ・スイッチが入っていない端末では、このファイルは何もしません（画面にも、通信にも、出ません）。
   ・完全にはずすとき：index.html の <script src="/pet.js"> の1行を消すだけ。
     （mascot.js は、キャラがいないときは、ボルトにもどります。残りのファイルは、消してもかまいません：
       pet.js / pet3d.js / pet-demo.js / chars フォルダ / store.js の pet・petLv の2行 / mascot.js の pp(...)）===== */
(function () {
  const KEY = "kt.pet";
  const store = { get() { try { return localStorage.getItem(KEY) === "1" } catch (x) { return false } }, set(v) { try { v ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY) } catch (x) {} } };
  const q = /[?&]pet=(on|off)(?:&|$)/.exec(location.search);
  if (q) { store.set(q[1] === "on"); try { const u = new URL(location.href); u.searchParams.delete("pet"); history.replaceState(null, "", u.pathname + u.search + u.hash) } catch (x) {} }
  // ひみつの入れ方：タイトルを、7回タップ（ホーム画面から開くアプリでも使える）
  let taps = [];
  document.addEventListener("click", ev => {
    if (!(ev.target.closest && ev.target.closest("#appname"))) return;
    const now = Date.now(); taps = taps.filter(t => now - t < 4000); taps.push(now);
    if (taps.length >= 7) { taps = []; const nv = !store.get(); store.set(nv); try { if (typeof toast === "function") toast(nv ? "キャラ育成を、入れました" : "キャラ育成を、切りました") } catch (x) {} setTimeout(() => location.reload(), 700) }
  });
  /* 自分のアカウントでログインしたら、自動でスイッチを入れる（メールアドレスそのものは書かず、ハッシュだけを持つ） */
  const OWNER_HASH = "bde4922b46499f3541ca7a4172478e30cecbf6ee51b403d49eb4a4f0082ad24c";
  if (!store.get() && window.crypto && crypto.subtle) {
    let tries = 0;
    const iv = setInterval(async () => {
      if (++tries > 150 || store.get()) return clearInterval(iv);
      const em = typeof A !== "undefined" && A && A.user && A.user.email; if (!em) return;
      clearInterval(iv);
      try {
        const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(em).trim().toLowerCase())))).map(b => b.toString(16).padStart(2, "0")).join("");
        if (h === OWNER_HASH) { store.set(true); location.reload() }
      } catch (x) {}
    }, 2000);
  }
  if (!store.get()) return;
  if (typeof window.render !== "function" || typeof window.computePoints !== "function") return;
  { const s3 = document.createElement("script"); s3.src = "/pet3d.js"; s3.async = true; s3.onload = () => { try { mount3d() } catch (x) {} }; document.head.appendChild(s3) }
  const DEV =/^(localhost|127\.0\.0\.1)$/.test(location.hostname); // デモ用の操作は、パソコン上の確認でだけ使える

  /* ---------- 段階（累計ポイントのしきい値。1日のポイントは700で頭打ちにするので、最後まで1日700ptで頭打ちとして、最短でも約286日。ふつうは年単位） ---------- */
  const STAGES = [
    { n: "地球", pt: 0, sub: "ここから、スタート" },
    { n: "月", pt: 1000, sub: "ふわっと、軽い" },
    { n: "火星", pt: 4000, sub: "赤い大地で、鍛える" },
    { n: "木星", pt: 12000, sub: "重力が、ずっしり" },
    { n: "土星", pt: 30000, sub: "輪っかの向こうへ" },
    { n: "天王星", pt: 65000, sub: "凍える星で、燃える" },
    { n: "海王星", pt: 120000, sub: "深い青の、はるか先" },
    { n: "冥王星", pt: 200000, sub: "異次元。もう、だれも追いつけない" }
  ];
  const SP = {
    bolt: { name: "ボルト", kind: "雷の妖精", line: "うるさい応援団長。「あと1回！」が口ぐせ。" },
    chick: { name: "ひよこ", kind: "ちいさな観察者", line: "マイペース。たまに、核心をつく。" },
    goro: { name: "ゴロウ", kind: "赤ちゃんゴリラ", line: "癒しの担当。人間のまねが、大好き。" }
  };
  /* ほめ言葉。[はじめ（段階1〜3）, 育ってきた（4〜6）, 最終に近い（7〜8）] */
  const SAY = {
    bolt: {
      oodai: ["大台突破！！やったー！", "大台、突破だーっ！！", "大台突破。…数えきれない！"],
      max: ["MAX更新！かっこいい！", "MAX更新！あと1回！…いや、最高！", "MAX更新。もう、止まらない！"],
      rm: ["RM更新！いい調子！", "RM更新！この調子、この調子！", "RM更新。数えがいがあるね！"],
      goal: ["目標達成！すごい！", "目標達成！ぜんぶ数えたよ！", "目標達成。さすがだね！"]
    },
    chick: {
      oodai: ["…すごい。ほんとに、すごい。", "大台。ふふ、見てたよ。", "大台突破。…ずっと見てた。"],
      max: ["いま、最高の日だね。", "最高の更新。ちゃんと、見てた。", "また、更新したね。さすが。"],
      rm: ["ちゃんと、伸びてる。", "うん、いい伸び方。", "伸びてる。ほんとに、ね。"],
      goal: ["今週、ちゃんとやったね。", "今週の目標、ちゃんと届いたね。", "今週も、約束を守ったね。"]
    },
    goro: {
      oodai: ["ウホーッ！！すごいすごい！", "ウホォーッ！！大台だーっ！", "…見事だ。大台を、越えたな。"],
      max: ["ウホッ！新記録！", "ウホッ！自己ベストだ！", "…よくやった。新記録だ。"],
      rm: ["ウホ！いい調子！", "ウホッ！力が、ついてきた！", "…伸びたな。確かな力だ。"],
      goal: ["ウホ！目標、できた！", "ウホッ！目標、達成だ！", "…約束を、果たしたな。"]
    }
  };
  const GLOW = ["#ffb02e", "#ffb02e", "#ff8a3d", "#ff6a2e", "#ffc21a", "#7fd8ff", "#7a8cff", "#ffd86a"];
  const CV = "?v=3d1"; // 絵を入れ替えたときに、古い絵が残らないための印
  const U = STAGES.length - 1;
  const stageOf = p => { let i = 0; STAGES.forEach((s, k) => { if (p >= s.pt) i = k }); return i };
  const uOf = p => { const i = stageOf(p); return i >= U ? U : i + (p - STAGES[i].pt) / (STAGES[i + 1].pt - STAGES[i].pt) };
  const nf = n => Math.round(n).toLocaleString("ja-JP");
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- キャラの絵（アプリの暗い面に、切り抜きの画像を置く。オーラは動く。宇宙の背景は使わない） ---------- */
  function sparks(i) {
    const n = Math.min(16, 2 + i * 2); let h = "";
    for (let k = 0; k < n; k++) h += `<b style="--x:${8 + (k * 37) % 84}%;--d:${(((k * 13) % 17) / 6).toFixed(1)}s;--t:${(2.4 + ((k * 7) % 5) * .5).toFixed(1)}s;--z:${3 + (k % 3) * 1.5}px"></b>`;
    return h;
  }
  /* draw(キャラ, ポイント, {still:止める, spin:回せる, stage:段階を直接指定}) */
  function draw(key, pts, opt) {
    opt = opt || {};
    const s = SP[key]; let i, u;
    if (opt.stage != null) { i = opt.stage; u = i } else { i = stageOf(pts); u = uOf(pts) }
    const f = Math.min(1, u - i), st = STAGES[i], live = !opt.still;
    return `<div class="pc${i >= U ? " pc-top" : ""}${opt.spin ? " spinnable" : ""}" ${opt.spin ? 'data-spin="1" tabindex="0"' : ""} data-gc="${GLOW[i]}" role="${opt.spin ? "button" : "img"}" aria-label="${s.name}・${st.n}${opt.spin ? "。押すと、くるっと回る" : ""}" style="--gc:${GLOW[i]};--ga:${(0.10 + 0.28 * (i / U)).toFixed(2)}"><i class="pc-g"></i>${live && i >= 3 ? `<i class="pc-r" style="--ro:${(0.35 + 0.09 * (i - 3)).toFixed(2)}"></i>` : ""}<div class="pc-s">${live ? sparks(i) : ""}</div><i class="pc-f"></i><div class="pc-b${live ? " pbob" : ""}"><img src="/chars/${key}_${i + 1}.webp${CV}" alt="" draggable="false" style="padding:${(14 - 6 * f).toFixed(1)}% ${(10 - 4 * f).toFixed(1)}%"></div></div>`;
  }
  const lockedTile = () => `<div class="q" aria-hidden="true">？</div>`;

  /* ---------- 累計ポイント（記録が変わったときだけ計算しなおす） ---------- */
  let ver = 0, cache = null, override = null;
  const _cacheLocal = window.cacheLocal; // 保存・同期・読みこみは、すべて cacheLocal を通る
  if (typeof _cacheLocal === "function") window.cacheLocal = function () { ver++; return _cacheLocal.apply(this, arguments) };
  function sigOf() { let n = 0, k = 0; for (const d in S.days) { k++; for (const x of S.days[d]) n += x.sets.length } return k + ":" + n }
  function life() {
    if (DEV && override != null) return override;
    if (cache && S.sel) return cache.v; // 入力中は、前の値を使う（重い計算を、1タップごとにしない）
    const sig = sigOf();
    if (cache && cache.days === S.days && cache.ver === ver && cache.sig === sig) return cache.v;
    let v = 0; try { const m = window.computePoints(), td = typeof today === "function" ? today() : "9999"; Object.keys(m).forEach(d => { if (d <= td) v += Math.min(m[d], 700) }) } catch (x) { v = cache ? cache.v : 0 }
    cache = { days: S.days, ver, sig, v }; return v;
  }
  const pet = () => (S.settings && SP[S.settings.pet]) ? S.settings.pet : null;

  /* ---------- お祝いなどで、選んだキャラが出てくる（mascot.js が使う） ---------- */
  function praise(kind) {
    const k = pet(); if (!k) return null;
    const lv = S.settings.petLv, i = Math.min(stageOf(life()), lv != null ? lv : 99), t = i >= 6 ? 2 : i >= 3 ? 1 : 0, set = SAY[k][kind];
    return { key: k, name: SP[k].name, stage: i, src: `/chars/${k}_${i + 1}.webp${CV}`, text: set ? set[t] : "" };
  }
  window.__petPraise = { get: praise };
  (window.requestIdleCallback || (f => setTimeout(f, 2500)))(() => { const p = praise("max"); if (p) { const im = new Image(); im.src = p.src } }, { timeout: 6000 });

  /* ---------- 見た目（CSS） ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .pc{position:relative;width:100%;aspect-ratio:1/1;border-radius:var(--r);overflow:hidden;background:linear-gradient(#181b22,#0f1116);line-height:0}
  .pc .pc-g{position:absolute;inset:-10%;background:radial-gradient(circle at 50% 62%,var(--gc) 0%,transparent 60%);opacity:var(--ga)}
  .pc .pc-f{position:absolute;left:20%;right:20%;bottom:5%;height:6%;background:radial-gradient(closest-side,rgba(0,0,0,.6),transparent)}
  .pc .pc-r{position:absolute;left:12%;right:12%;top:16%;aspect-ratio:1/1;border-radius:50%;background:conic-gradient(from 0deg,transparent 0 35%,var(--gc) 50%,transparent 65% 100%);-webkit-mask:radial-gradient(farthest-side,transparent 82%,#000 84%,#000 94%,transparent 96%);mask:radial-gradient(farthest-side,transparent 82%,#000 84%,#000 94%,transparent 96%);opacity:var(--ro,.5);animation:prot 5s linear infinite}
  @keyframes prot{to{transform:rotate(360deg)}}
  .pc .pc-s{position:absolute;inset:0;pointer-events:none}
  .pc .pc-s b{position:absolute;bottom:16%;left:var(--x);width:var(--z);height:var(--z);border-radius:50%;background:var(--gc);box-shadow:0 0 6px var(--gc);opacity:0;animation:pspark var(--t) ease-out var(--d) infinite}
  @keyframes pspark{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.95}100%{transform:translateY(-230%) scale(1);opacity:0}}
  .pc.pc-top .pc-g{animation:pglow 3.2s ease-in-out infinite}
  @keyframes pglow{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
  .pc.pc-pop .pc-g{animation:pflash .7s ease-out}
  @keyframes pflash{from{opacity:.95;transform:scale(1.25)}to{opacity:var(--ga);transform:scale(1)}}
  .pc .pc-b{position:absolute;inset:0}
  .pc img{position:absolute;left:0;top:0;width:100%;height:100%;box-sizing:border-box;object-fit:contain;object-position:50% 100%;filter:drop-shadow(0 0 1.2px rgba(255,255,255,.6)) drop-shadow(0 4px 6px rgba(0,0,0,.45));user-select:none;-webkit-user-drag:none;will-change:transform}
  .pc.spinnable{cursor:grab;touch-action:pan-y}.pc.spinnable:active{cursor:grabbing}.pc.spinnable:focus-visible{outline:2px solid var(--gold);outline-offset:-2px}
  .pbob{animation:pbob 2.8s ease-in-out infinite}
  @keyframes pbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  .pet-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:8px 12px 8px 8px;margin:0;cursor:pointer;color:var(--ink);font:inherit}
  .pet-card .pet-th{flex:none;width:92px;border-radius:6px;overflow:hidden;line-height:0}
  .pet-card .pet-bd{flex:1;min-width:0}
  .pet-card b{display:block;font-size:15px}
  .pet-card .pet-pt{font-size:12px;color:var(--muted);font-weight:700}
  .pet-bar{height:8px;background:var(--surface-2,#1b1e25);border-radius:99px;overflow:hidden;margin:6px 0 3px}
  .pet-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff4b1f,#ffc21a);border-radius:99px}
  .pet-card small{display:block;color:var(--muted);font-size:11px;line-height:1.4}
  .pet-pick{display:block;margin:0;background:var(--surface);border:1px dashed var(--line);border-radius:var(--r);padding:12px}
  .pet-pick h3{margin:0 0 4px;font-size:15px}.pet-pick p{margin:0 0 10px;font-size:12px;color:var(--muted);line-height:1.6}
  .pet-pick .row{display:flex;gap:8px;margin-bottom:10px}.pet-pick .row .pc{flex:1}
  #pet-ov,#pet-ob{position:fixed;inset:0;background:var(--bg);color:var(--ink);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  #pet-ov{z-index:80}#pet-ob{z-index:85}
  .pw{max-width:620px;margin:0 auto;padding:12px 14px 60px}
  #pet-ov .ptop{display:flex;align-items:center;gap:10px;margin-bottom:10px}
  #pet-ov .ptop b{font-size:16px}
  .pcard{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-bottom:12px}
  .pcard h2{margin:0 0 10px;font-size:15px}
  #pet-ov .pstage{position:relative;border-radius:var(--r);overflow:hidden;border:1px solid var(--line);background:#12141a}
  #pet-ov .pstage>.pc{border-radius:0}
  #pet-ov .hud{position:absolute;left:0;right:0;top:0;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;pointer-events:none;color:#fff}
  #pet-ov .hud .nm{font-family:var(--f-display,inherit);font-weight:900;font-size:30px;line-height:1;text-shadow:0 2px 8px rgba(0,0,0,.7)}
  #pet-ov .hud .sb{font-size:12px;font-weight:700;color:#e8ecf5;text-shadow:0 1px 3px #000,0 1px 8px rgba(0,0,0,.9);margin-top:4px;max-width:56vw}
  #pet-ov .hud .pp{white-space:nowrap}
  #pet-ov .hud .nm,#pet-ov .hud .pp b{text-shadow:0 1px 3px #000,0 2px 10px rgba(0,0,0,.85)}
  #pet-ov .hud .pp{margin-left:auto;text-align:right;font-weight:900;text-shadow:0 1px 6px rgba(0,0,0,.8)}
  #pet-ov .hud .pp b{font-size:32px;line-height:1;color:var(--gold)}
  #pet-ov .hint{position:absolute;right:10px;bottom:10px;font-size:11px;font-weight:700;color:#ffffffb8;background:#0009;padding:3px 10px;border-radius:99px;pointer-events:none}
  #pet-ov .pfl{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
  #pet-ov .pfl.go{animation:pfl .7s ease-out}
  @keyframes pfl{0%{opacity:.85}100%{opacity:0}}
  #pet-ov .pbar{height:12px;background:var(--surface-2,#1b1e25);border-radius:99px;overflow:hidden;margin:8px 0 4px}
  #pet-ov .pbar i{display:block;height:100%;background:linear-gradient(90deg,#ff4b1f,#ffc21a);border-radius:99px}
  #pet-ov .chips{display:flex;gap:8px;flex-wrap:wrap}
  #pet-ov .chip{border:1px solid var(--line);background:var(--bg);border-radius:99px;padding:8px 14px;font-weight:900;font-size:14px;color:var(--muted);cursor:pointer;font-family:inherit}
  #pet-ov .chip[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
  #pet-ov .swc{margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--bg);font-size:13px;line-height:1.6}
  #pet-ov .swc .row{display:flex;gap:8px;margin-top:8px}
  #pet-ov .tl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  #pet-ov .tl .it{background:var(--bg);border:1px solid var(--line);border-radius:var(--r);padding:4px 4px 8px;text-align:center}
  #pet-ov .tl .it[data-pet=jump]{cursor:pointer}
  #pet-ov .tl .it.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(255,194,26,.3)}
  #pet-ov .tl .q{aspect-ratio:1/1;display:grid;place-items:center;background:#0e1014;border-radius:4px;color:#363c4b;font-size:34px;font-weight:900;line-height:1}
  #pet-ov .tl b{display:block;font-size:13px;margin-top:4px}
  #pet-ov .tl small{display:block;color:var(--muted);font-size:10px;line-height:1.4}
  #pet-ov .pnote,#pet-ob .pnote{font-size:12px;color:var(--muted);line-height:1.6;margin:8px 0 0}
  #pet-ov .evo{position:absolute;left:12px;right:12px;bottom:12px;background:#fff;color:#111;border-radius:var(--r);padding:10px 14px;font-weight:900;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:pevo .5s ease both}
  @keyframes pevo{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
  #pet-ob h1{font-size:22px;margin:8px 0 6px;line-height:1.3}
  #pet-ob .lead{font-size:13px;color:var(--muted);line-height:1.7;margin:0 0 14px}
  #pet-ob .obc{display:grid;grid-template-columns:128px 1fr;gap:12px;align-items:center;width:100%;text-align:left;background:var(--surface);border:2px solid var(--line);border-radius:var(--r);padding:8px;margin-bottom:10px;color:var(--ink);font:inherit;cursor:pointer}
  #pet-ob .obc[aria-pressed=true]{border-color:var(--accent);box-shadow:0 0 0 3px rgba(255,75,31,.25)}
  #pet-ob .obc b{display:block;font-size:19px}
  #pet-ob .obc .kind{display:inline-block;font-size:11px;font-weight:900;color:var(--gold);border:1px solid #6a5316;border-radius:99px;padding:1px 10px;margin:4px 0 6px}
  #pet-ob .obc small{display:block;font-size:12px;color:var(--muted);line-height:1.6}
  #pet-ob .obc .sils{grid-column:1/-1;display:flex;gap:3px;align-items:flex-end;padding-top:6px;border-top:1px dashed var(--line)}
  #pet-ob .obc .sils i{flex:1;aspect-ratio:1/1;background:#6c7692;-webkit-mask:var(--m) center bottom/contain no-repeat;mask:var(--m) center bottom/contain no-repeat;opacity:.85}
  #pet-ob .obw{text-align:center;font-size:14px;line-height:1.7;margin:0 0 10px;color:var(--ink)}
  #pet-ob .obf{position:sticky;bottom:0;padding:12px 0 8px;background:linear-gradient(transparent,var(--bg) 30%)}
  #pet-ob .obf .btn{width:100%;padding:14px;font-size:16px}
  #pet-ob .obf .btn[disabled]{opacity:.45}
  #pet-ob .obf .lnk{display:block;margin:10px auto 0;background:none;border:0;color:var(--muted);font:inherit;font-size:13px;text-decoration:underline;cursor:pointer}
  @media (prefers-reduced-motion: reduce){.pbob,.pc .pc-r,.pc .pc-s b,.pc.pc-top .pc-g,.pc.pc-pop .pc-g{animation:none!important}#pet-ov .evo{animation:none}#pet-ov .pfl.go{animation:none}}
  `;
  document.head.appendChild(css);

  /* ---------- 記録画面のカード ---------- */
  function cardHtml() {
    const k = pet(), p = life();
    if (!k) {
      return `<div class="pet-pick" id="pet-card"><h3>相棒を、むかえよう</h3>
        <p>3体から1体を選んで、記録で育てていきます。一度選ぶと、変えられません。進化の先は、たどりつくまでのおたのしみ。</p>
        <div class="row">${Object.keys(SP).map(x => draw(x, 0, { still: 1, stage: 0 })).join("")}</div>
        <button type="button" class="btn" data-pet="ob">相棒を、えらぶ</button></div>`;
    }
    const i = stageOf(p), s = STAGES[i], nx = STAGES[i + 1], pr = nx ? (p - s.pt) / (nx.pt - s.pt) : 1;
    return `<button type="button" class="pet-card" id="pet-card" data-pet="open" aria-label="${SP[k].name}を見る">
      <span class="pet-th">${draw(k, p, { still: 1 })}</span>
      <span class="pet-bd"><b>${SP[k].name}　${s.n}　Lv.${i + 1}</b><span class="pet-pt">${nf(p)} pt</span>
      <span class="pet-bar" style="display:block"><i style="width:${(pr * 100).toFixed(1)}%"></i></span>
      <small>${nx ? `次の進化まで、あと ${nf(Math.max(0, nx.pt - Math.round(p)))} pt` : "最終段階。ここが、いちばん先。"}</small></span></button>`;
  }
  function decorate() {
    if (S.tab !== "log") return;
    const main = document.getElementById("main"); if (!main || document.getElementById("pet-card")) return;
    const tmp = document.createElement("div"); tmp.innerHTML = cardHtml();
    const card = tmp.firstElementChild, wk = main.querySelector(".week");
    if (wk) wk.insertAdjacentElement("afterend", card); else main.insertBefore(card, main.firstChild);
    scheduleEvolve();
  }

  /* ---------- 大きな画面（育ち方・キャラの選びなおし） ---------- */
  const OV = { open: false, pts: 0, banner: "", anim: 0, shown: -1, sw: null, bt: 0 };
  const clearBanner = () => { OV.banner = ""; const e = document.querySelector("#pstage .evo"); if (e) e.remove() };
  const armBanner = () => { clearTimeout(OV.bt); OV.bt = setTimeout(() => { if (OV.open) clearBanner() }, 3200) };
  const maxPt = () => Math.max(life(), 0);
  function stageBox(k, p, i, s) {
    return `${draw(k, p, { spin: 1 })}<div class="hud"><div><div class="nm">${s.n}</div><div class="sb">${s.sub}</div></div><div class="pp"><b id="pv">${nf(p)}</b> pt<div style="font-size:11px;font-weight:700;color:#e8ecf5">${SP[k].name}　Lv.${i + 1}</div></div></div><div class="hint">${reduce() ? "ドラッグで回せる" : "タップでくるっと／ドラッグで回せる"}</div><div class="pfl" id="pfl"></div>${OV.banner ? `<div class="evo" role="status">${OV.banner}</div>` : ""}`;
  }
  function tilesHtml(k, real, i) {
    return STAGES.map((x, n) => {
      const un = real >= x.pt, nextOne = !un && n === stageOf(real) + 1;
      return un
        ? `<div class="it${n === i ? " on" : ""}" data-pet="jump" data-n="${n}" role="button" tabindex="0">${draw(k, 0, { still: 1, stage: n })}<b>${x.n}</b><small>${nf(x.pt)}pt〜</small></div>`
        : `<div class="it lock" aria-label="まだ見られない段階">${lockedTile()}<b>？？？</b><small>${nextOne ? `あと ${nf(Math.max(0, x.pt - Math.round(real)))} pt` : "ひみつ"}</small></div>`;
    }).join("");
  }
  function ovHtml() {
    const k = pet() || "bolt", real = maxPt(), p = Math.min(OV.pts, real), i = stageOf(p), s = STAGES[i], nx = STAGES[i + 1], pr = nx ? (p - s.pt) / (nx.pt - s.pt) : 1;
    OV.shown = i;
    return `<div class="pw"><div class="ptop"><button class="btn" type="button" data-pet="close" id="pet-close">← もどる</button><b>キャラ育成</b></div>
      <div class="pcard" style="padding:10px"><div class="pstage" id="pstage">${stageBox(k, p, i, s)}</div>
        <div class="pbar"><i id="pbar" style="width:${(pr * 100).toFixed(1)}%"></i></div>
        <div class="pnote" style="margin:0" id="pnext">${nx ? `次の進化まで、あと ${nf(Math.max(0, nx.pt - Math.round(p)))} pt` : "最終段階です。ここが、いちばん先。"}</div></div>
      <div class="pcard"><h2>育ち方</h2><div class="tl" id="ptl">${tilesHtml(k, real, i)}</div>
        <p class="pnote">累計ポイントは、いままでの記録すべてから計算します（友達に見せる設定とは関係ありません）。まだ着いていない先のすがたは、たどりつくまで見られません。いちばん先までは、毎日コツコツ続けても、1年以上かかる長い道のりです。</p></div>
      <div class="pcard"><h2>相棒</h2><p class="pnote" style="margin:0">${SP[k].name}は、あなたが選んだ、ただひとりの相棒です。相棒は、あとから変えられません。この子と、最後まで。ほめてくれるのも、この子です。どのキャラも、男の子・女の子を選びません。</p></div></div>`;
  }
  function refocus(el, ae) { if (!ae || !ae.dataset || !ae.dataset.pet) return; const q = `[data-pet="${ae.dataset.pet}"]${ae.dataset.k ? `[data-k="${ae.dataset.k}"]` : ""}${ae.dataset.n ? `[data-n="${ae.dataset.n}"]` : ""}`, n = el.querySelector(q); if (n) n.focus({ preventScroll: true }) }
  function ovRender() { const el = document.getElementById("pet-ov"); if (!el) return; const sc = el.scrollTop, ae = document.activeElement; el.innerHTML = ovHtml(); el.scrollTop = sc; refocus(el, ae); mount3d(); if (window.__petDemoBar) window.__petDemoBar() }
  /* 数字を進めるあいだは、絵を作りなおさない（オーラや回転が止まらないように）。段階が変わったときだけ作りなおす */
  function ovLive() {
    const k = pet() || "bolt", p = OV.pts, i = stageOf(p), s = STAGES[i], nx = STAGES[i + 1], pr = nx ? (p - s.pt) / (nx.pt - s.pt) : 1;
    const bar = document.getElementById("pbar"); if (!bar) return;
    bar.style.width = (pr * 100).toFixed(1) + "%";
    const pv = document.getElementById("pv"); if (pv) pv.textContent = nf(p);
    const nt = document.getElementById("pnext"); if (nt) nt.textContent = nx ? `次の進化まで、あと ${nf(Math.max(0, nx.pt - Math.round(p)))} pt` : "最終段階です。ここが、いちばん先。";
    if (i !== OV.shown) {
      OV.shown = i; const stg = document.getElementById("pstage"); if (stg) { stg.innerHTML = stageBox(k, p, i, s); mount3d() }
      const tl = document.getElementById("ptl"); if (tl) tl.innerHTML = tilesHtml(k, maxPt(), i);
      const fl = document.getElementById("pfl"); if (fl) { fl.classList.remove("go"); void fl.offsetWidth; fl.classList.add("go") }
    }
  }
  function openOv(opt) {
    opt = opt || {}; let el = document.getElementById("pet-ov");
    if (!el) { el = document.createElement("div"); el.id = "pet-ov"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "キャラ育成"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el) }
    OV.open = true; OV.banner = opt.banner || ""; OV.sw = null; OV.pts = opt.from != null ? opt.from : maxPt(); el.scrollTop = 0; ovRender(); if (OV.banner) armBanner();
    const b = document.getElementById("pet-close"); if (b) b.focus({ preventScroll: true });
    if (opt.from != null && maxPt() > opt.from) animateTo(maxPt(), 2600);
  }
  function closeOv() {
    const el = document.getElementById("pet-ov"); if (el) el.remove();
    OV.open = false; OV.anim++; OV.banner = ""; OV.sw = null; clearTimeout(OV.bt); const c = document.getElementById("pet-card"); if (c) c.remove(); decorate();
  }
  function animateTo(target, ms) {
    const id = ++OV.anim, from = OV.pts, t0 = performance.now(); let last = stageOf(from);
    if (reduce()) ms = 1;
    (function f(t) {
      if (!OV.open || id !== OV.anim) return;
      const k = Math.min(1, (t - t0) / ms), q = 1 - Math.pow(1 - k, 3); OV.pts = from + (target - from) * q;
      const cur = stageOf(OV.pts); if (cur > last) { last = cur; OV.banner = `進化！ ${STAGES[cur].n} にたどりついた！`; armBanner() }
      ovLive(); if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------- 最初のキャラ選び（御三家） ---------- */
  const OB = { open: false, sel: null, done: false, conf: false };
  function obHtml() {
    const keys = Object.keys(SP);
    return `<div class="pw"><h1>相棒を、えらぼう</h1>
      <p class="lead">3体のなかから、1体を選びます。選んだ子と、最後まで育てていきます。<b>一度選ぶと、あとから変えられません。</b>あなたの筋トレの記録で、この子がいっしょに成長します。記録を更新したときは、この子がほめてくれます。進化のすがたは、影だけ見せます。本当のすがたは、たどりつくまでひみつ。</p>
      ${keys.map(x => `<button type="button" class="obc" data-pet="obsel" data-k="${x}" aria-pressed="${OB.sel === x}">${draw(x, 0, { stage: 0, still: OB.sel !== x })}<span><b>${SP[x].name}</b><span class="kind">${SP[x].kind}</span><small>${SP[x].line}</small></span><span class="sils" aria-label="進化のすがた（影だけ）">${STAGES.map((s, n) => n ? `<i style="--m:url(/chars/sil/${x}_${n + 1}.webp${CV})"></i>` : "").join("")}</span></button>`).join("")}
      <div class="obf">${OB.conf && OB.sel
        ? `<div class="obw"><b>${SP[OB.sel].name}で、決めますか？</b><br>相棒は、あとから変えられません。</div><button type="button" class="btn" data-pet="obgo2">この子に、決める</button><button type="button" class="lnk" data-pet="obback">もどって、えらびなおす</button>`
        : `<button type="button" class="btn" data-pet="obgo" ${OB.sel ? "" : "disabled"}>${OB.sel ? `${SP[OB.sel].name}にする` : "ひとり、えらんでね"}</button><button type="button" class="lnk" data-pet="obskip">あとで選ぶ</button>`}</div></div>`;
  }
  function openOb() {
    if (OB.open || pet()) return; OB.conf = false; let el = document.getElementById("pet-ob");
    if (!el) { el = document.createElement("div"); el.id = "pet-ob"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "相棒を選ぶ"); el.setAttribute("aria-modal", "true"); document.body.appendChild(el) }
    OB.open = true; el.innerHTML = obHtml(); el.scrollTop = 0; const f0 = el.querySelector(".obc"); if (f0) f0.focus({ preventScroll: true });
  }
  function obRender() { const el = document.getElementById("pet-ob"); if (el) { const sc = el.scrollTop, ae = document.activeElement; el.innerHTML = obHtml(); el.scrollTop = sc; refocus(el, ae) } }
  function closeOb() { const el = document.getElementById("pet-ob"); if (el) el.remove(); OB.open = false }
  function shouldOnboard() {
    if (OB.open || OB.done || OV.open || pet()) return false;
    try { if (sessionStorage.getItem("pet.skip") || localStorage.getItem("pet.skipUntil") > String(Date.now())) return false } catch (x) {}
    const ready = typeof A !== "undefined" && A && A.ready, own = (() => { try { return localStorage.getItem("tsumitore.owner") } catch (x) { return null } })();
    if (typeof A !== "undefined" && A && A.user && !ready) return false; // ログイン中の記録を読みこむまで待つ（選んだ相棒が、もう保存されているかもしれない）
    if (own && own !== "guest" && !ready) return false; // ログインしていた端末は、読みこみが終わるまで待つ
    if (/[?&]code=/.test(location.search) && !ready) return false; // ログインの戻りの途中
    return true;
  }
  function maybeOnboard() { if (shouldOnboard()) setTimeout(() => { if (shouldOnboard()) openOb() }, 350) }

  /* ---------- 進化（段階が上がったとき）。お祝い画面が出ているあいだは待ち、閉じたあとに出す ---------- */
  let evT = 0;
  function scheduleEvolve() { clearTimeout(evT); evT = setTimeout(checkEvolve, 900) }
  const _closeCele = window.closeCele;
  if (typeof _closeCele === "function") window.closeCele = function () { const r = _closeCele.apply(this, arguments); scheduleEvolve(); return r };
  function checkEvolve() {
    const k = pet(); if (!k || OV.open || OB.open || S.sel) return;
    if (DEV && override != null) return;
    if (typeof A !== "undefined" && A && A.user && !A.ready) return;
    const cele = document.getElementById("cele"); if (cele && cele.classList.contains("show")) return;
    const cur = stageOf(life());
    if (S.settings.petLv == null) { S.settings.petLv = cur; saveMeta(); return }
    if (cur > S.settings.petLv) {
      const from = S.settings.petLv; S.settings.petLv = cur; saveMeta();
      openOv({ from: STAGES[from].pt, banner: "" });
    }
  }

  /* ---------- 操作 ---------- */
  function syncing() { return typeof A !== "undefined" && !!A && !!A.user && !A.ready }
  function choose(key) {
    if (!SP[key] || pet()) return; // 相棒は、一度えらんだら、変えられない
    if (syncing()) { if (typeof toast === "function") toast("同期が終わるまで、少し待ってね"); return }
    if (DEV && override != null) return;
    const first = !pet(); S.settings.pet = key;
    if (first || S.settings.petLv == null) S.settings.petLv = stageOf(life());
    saveMeta();
    if (OV.open) { clearTimeout(OV.bt); OV.banner = ""; ovRender(); const c = document.getElementById("pet-card"); if (c) c.remove(); decorate(); setTimeout(() => { try { window.render() } catch (x) {} }, 0); return }
    const c = document.getElementById("pet-card"); if (c) c.remove();
    openOv({ from: 0, banner: first ? `${SP[key].name}が、仲間になった！` : "" });
    setTimeout(() => { try { window.render() } catch (x) {} }, 0); // 「今日は、何する？」などの絵も、選んだキャラにする
  }
  document.addEventListener("click", ev => {
    const b = ev.target.closest && ev.target.closest("[data-pet]"); if (!b) return;
    const a = b.dataset.pet;
    if (a === "open") openOv();
    else if (a === "close") closeOv();
    else if (a === "ob") openOb();
    else if (a === "obsel") { OB.sel = b.dataset.k; OB.conf = false; obRender() }
    else if (a === "obgo") { if (!OB.sel) return; OB.conf = true; obRender(); const el = document.getElementById("pet-ob"); if (el) el.scrollTop = el.scrollHeight }
    else if (a === "obback") { OB.conf = false; obRender() }
    else if (a === "obgo2") { if (!OB.sel) return; if (pet()) { OB.done = true; closeOb(); return } if (syncing()) { if (typeof toast === "function") toast("同期が終わるまで、少し待ってね"); return } const k = OB.sel; OB.done = true; closeOb(); choose(k) }
    else if (a === "obskip") { try { sessionStorage.setItem("pet.skip", "1"); localStorage.setItem("pet.skipUntil", String(Date.now() + 3 * 864e5)) } catch (x) {} OB.done = true; closeOb(); const c = document.getElementById("pet-card"); if (c) c.remove(); decorate() }
    else if (a === "jump") { const n = +b.dataset.n; if (STAGES[n] && maxPt() >= STAGES[n].pt) { OV.anim++; OV.banner = ""; OV.pts = n === stageOf(maxPt()) ? maxPt() : Math.min(maxPt(), STAGES[n].pt + 5); OV.shown = -1; ovRender() } }
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && OV.open) closeOv();
    const t = ev.target; if ((ev.key === "Enter" || ev.key === " ") && t && t.matches && t.matches(".pc[data-spin]")) { ev.preventDefault(); spinOnce(t) }
    else if ((ev.key === "Enter" || ev.key === " ") && t && t.matches && t.matches("#pet-ov .it[data-pet=jump]")) { ev.preventDefault(); t.click() }
  });

  /* ---------- キャラを回す（タップでくるっと一回転、ドラッグで好きなだけ。はなすと正面にもどる） ---------- */
  const SPIN = new WeakMap();
  const spinSt = c => { let s = SPIN.get(c); if (!s) { s = { a: 0, v: 0, raf: 0, down: false, moved: 0, lx: 0, busy: false, pid: 0 }; SPIN.set(c, s) } return s };
  const spinApply = (c, s) => {
    const g3 = window.__pet3d && window.__pet3d.get(c); if (g3) { g3.set(s.a, s.p || 0); return } // 立体（WebGL）のとき
    const im = c.querySelector("img"); if (im) im.style.transform = s.a % 360 === 0 ? "" : `perspective(620px) rotateY(${s.a.toFixed(1)}deg)` };
  const mount3d = () => { try { window.__pet3d && window.__pet3d.mount(document.getElementById("pet-ov")) } catch (x) {} };
  function spinTo(c, s, target) {
    cancelAnimationFrame(s.raf);
    (function f() {
      s.a += (target - s.a) * 0.13 + Math.sign(target - s.a) * 0.6; s.p = (s.p || 0) * 0.88;
      if (Math.abs(target - s.a) < 1) { s.a = 0; s.busy = false; spinApply(c, s); return }
      spinApply(c, s); s.raf = requestAnimationFrame(f);
    })();
  }
  function spinOnce(c) {
    if (reduce()) return; const s = spinSt(c); if (s.busy) return; // 回っている最中のタップは、無視する
    cancelAnimationFrame(s.raf); s.busy = true;
    c.classList.remove("pc-pop"); void c.offsetWidth; c.classList.add("pc-pop");
    s.a = 0; spinTo(c, s, 360);
  }
  function settle(c, s) {
    cancelAnimationFrame(s.raf);
    (function f() {
      s.a += s.v; s.v *= 0.94; s.p = (s.p || 0) * 0.94;
      if (Math.abs(s.v) < 0.5) { spinTo(c, s, Math.round(s.a / 360) * 360); return }
      spinApply(c, s); s.raf = requestAnimationFrame(f);
    })();
  }
  document.addEventListener("pointerdown", ev => {
    const c = ev.target.closest && ev.target.closest(".pc[data-spin]"); if (!c || ev.button !== 0 || !ev.isPrimary) return;
    const s = spinSt(c); cancelAnimationFrame(s.raf); s.busy = false; s.down = true; s.pid = ev.pointerId; s.moved = 0; s.lx = ev.clientX; s.ly = ev.clientY; s.v = 0;
    s.a = ((s.a % 360) + 360) % 360; if (s.a > 180) s.a -= 360; spinApply(c, s);
    try { c.setPointerCapture(ev.pointerId) } catch (x) {}
  });
  document.addEventListener("pointermove", ev => {
    const c = ev.target.closest && ev.target.closest(".pc[data-spin]"); if (!c) return;
    const s = SPIN.get(c); if (!s || !s.down || ev.pointerId !== s.pid) return;
    const dx = ev.clientX - s.lx, dy = ev.clientY - s.ly; s.lx = ev.clientX; s.ly = ev.clientY; s.moved += Math.abs(dx); s.a += dx * 0.9; s.v = dx * 0.9; s.p = Math.max(-28, Math.min(28, (s.p || 0) + dy * 0.25)); spinApply(c, s);
  });
  const spinEnd = ev => {
    const c = ev.target.closest && ev.target.closest(".pc[data-spin]"); if (!c) return;
    const s = SPIN.get(c); if (!s || !s.down || ev.pointerId !== s.pid) return; s.down = false;
    if (ev.type === "pointercancel") { settle(c, s); return } // 縦スクロールに取られたときは、タップ扱いにしない
    if (s.moved < 6) { s.a = 0; spinOnce(c) } else settle(c, s);
  };
  document.addEventListener("pointerup", spinEnd);
  document.addEventListener("pointercancel", spinEnd);

  const _render = window.render;
  window.render = function () { _render.apply(this, arguments); try { decorate(); maybeOnboard() } catch (x) {} };
  try { window.render() } catch (x) {}
  /* 動作確認用。デモ（スライダー）は、パソコン上（localhost）でだけ使える */
  if (DEV) window.__pet = { STAGES, stageOf, life, open: openOv, openOb, spinOnce, praise,
    setOverride(v) { if (DEV) { clearInterval(playT); OV.anim++; override = v == null ? null : +v; if (OV.open) { OV.pts = Math.min(OV.pts, maxPt()); OV.shown = -1; ovRender() } } },
    play() { if (!DEV) return; if (!OV.open) openOv(); clearInterval(playT); OV.anim++; override = STAGES[U].pt + 1; OV.pts = 0; OV.shown = -1; ovRender(); let n = 0;
      playT = setInterval(() => { n++; if (n > U) { clearInterval(playT); if (window.__petDemoDone) window.__petDemoDone(); return } OV.pts = STAGES[n].pt + 5; OV.banner = `進化！ ${STAGES[n].n} にたどりついた！`; armBanner(); ovLive(); const b = document.getElementById("pstage"); if (b && !b.querySelector(".evo")) { const e = document.createElement("div"); e.className = "evo"; e.setAttribute("role", "status"); e.textContent = OV.banner; b.appendChild(e) } }, 1700) } };
  let playT = 0;
  if (DEV) { const sc = document.createElement("script"); sc.src = "/pet-demo.js"; document.body.appendChild(sc) }
})();

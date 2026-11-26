"use strict";
/* ボルト（マスコット）: 記録更新・週の目標達成・記録がない日・しばらく行っていない日に出てきます。
   app.js のあとに読み込み、お祝い画面などの表示関数に「ボルトを足す」だけです（記録の計算や保存にはさわりません）。 */
(function () {
  if (typeof window.showCele !== "function" || typeof window.render !== "function") return;
  const IMG = n => "/mascot/bolt_" + n + ".webp";
  const K_OFF = "tsumitore.bolt.tiredOff";
  // 御三家で選んだキャラがいれば、ボルトの代わりに、そのキャラが（いまの進化の姿で）出てくる。pet.js が先に読みこまれていなくても、使う時に探す
  const pp = kind => { try { return window.__petPraise ? window.__petPraise.get(kind) : null } catch (e) { return null } };

  // 画像は、アプリが落ち着いてから先読みする（起動を遅くしない）。お祝い画面で使う分だけ
  const idle = window.requestIdleCallback || (f => setTimeout(f, 2000));
  idle(() => { const i = new Image(); i.src = IMG("jump") }, { timeout: 5000 });

  const css = `
  .bolt-wrap{display:flex;flex-direction:column;align-items:center;margin:-8px 0 8px}
  .bolt-wrap img{height:150px;width:auto;animation:boltBounce .9s ease-in-out infinite;filter:drop-shadow(0 8px 16px rgba(255,106,0,.4))}
  .bolt-say{margin-top:-2px;background:#ff6a00;color:#fff;font-weight:900;font-size:13px;letter-spacing:.04em;padding:5px 14px;border-radius:999px;box-shadow:0 4px 14px rgba(255,106,0,.45)}
  @keyframes boltBounce{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-12px) scale(1.05)}}
  @keyframes boltSway{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}
  .bolt-empty{display:flex;align-items:center;gap:14px;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:12px 14px}
  .bolt-empty img{height:128px;width:auto;flex:none;animation:boltSway 3s ease-in-out infinite;transform-origin:50% 90%}
  .bolt-empty b{display:block;font-size:17px;color:var(--ink)}
  .bolt-empty span{display:block;margin-top:6px;font-size:13px;color:var(--muted);line-height:1.6;font-weight:500}
  .bolt-tired{position:relative;display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--p-abs,#8b5cf6);border-radius:var(--r);padding:8px 34px 8px 14px}
  .bolt-tired img{height:84px;width:auto;flex:none}
  .bolt-tired b{display:block;font-size:14px}
  .bolt-tired span{display:block;margin-top:3px;font-size:12px;color:var(--muted);font-weight:500;line-height:1.5}
  .bolt-tired img.pet-tired{filter:grayscale(.55) brightness(.85);transform:rotate(-7deg)}
  .bolt-x{position:absolute;top:2px;right:4px;width:30px;height:30px;border:0;background:transparent;color:var(--muted);font-size:20px;line-height:1;cursor:pointer}
  .bolt-float{position:fixed;left:50%;bottom:92px;z-index:70;display:flex;flex-direction:column;align-items:center;pointer-events:none;animation:boltPop 3.6s ease both}
  .bolt-float img{height:190px;width:auto;filter:drop-shadow(0 10px 18px rgba(255,106,0,.45))}
  @keyframes boltPop{0%{opacity:0;transform:translate(-50%,50px) scale(.6)}10%{opacity:1;transform:translate(-50%,-6px) scale(1.06)}18%{transform:translate(-50%,0) scale(1)}84%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-24px) scale(1)}}
  @media (max-height:720px){.bolt-wrap img{height:96px}.bolt-float img{height:140px}}
  @media (prefers-reduced-motion: reduce){.bolt-wrap img,.bolt-empty img,.bolt-float{animation:none!important}.bolt-float{opacity:1;transform:translate(-50%,0)}}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // 1) 記録更新（RM更新・MAX更新・大台突破）のお祝い画面
  const SAY = { oodai: "大台突破！！やったー！", max: "MAX更新！かっこいい！", rm: "RM更新！いい調子！" };
  const _showCele = window.showCele;
  window.showCele = function (c) {
    _showCele(c);
    try {
      const dlg = document.querySelector("#cele .cc, #cele .oo"); if (!dlg) return;
      const kind = c.oodai ? "oodai" : c.max ? "max" : "rm", P = pp(kind);
      const w = document.createElement("div"); w.className = "bolt-wrap";
      w.innerHTML = `<img src="${P ? P.src : IMG("jump")}" alt="" aria-hidden="true" decoding="async"><span class="bolt-say">${P ? P.text : SAY[kind]}</span>`;
      dlg.insertBefore(w, dlg.firstChild);
    } catch (e) {}
  };

  // 2) 今週の目標を達成したとき
  function floatBolt(pose, text, kind) {
    const P = kind ? pp(kind) : null;
    const el = document.createElement("div"); el.className = "bolt-float";
    el.innerHTML = `<img src="${P ? P.src : IMG(pose)}" alt="" aria-hidden="true" decoding="async"><span class="bolt-say">${P ? P.text : text}</span>`;
    document.body.appendChild(el); setTimeout(() => el.remove(), 3700);
  }
  if (typeof window.toast === "function") {
    const _toast = window.toast;
    window.toast = function (m) { _toast(m); try { if (/目標.*達成/.test(String(m))) floatBolt("jump", "目標達成！すごい！", "goal") } catch (e) {} };
  }

  // 3) 記録がない日／しばらくジムに行っていない日
  function daysSinceLast() {
    const ds = trainedDates().filter(d => d <= today()); if (!ds.length) return 0;
    return Math.round((new Date(today()) - new Date(ds[ds.length - 1])) / 864e5);
  }
  function off() { try { return localStorage.getItem(K_OFF) === today() } catch (e) { return false } }
  function decorate() {
    if (S.tab !== "log") return; const main = document.getElementById("main"); if (!main) return;
    const p = [...main.querySelectorAll("p.empty")].find(x => x.textContent.includes("この日の記録はまだありません"));
    if (p && !p.dataset.bolt) {
      p.dataset.bolt = "1"; p.className = "bolt-empty";
      const P = pp("think");
      p.innerHTML = `<img src="${P ? P.src : IMG("think")}" alt="" aria-hidden="true" decoding="async"><div><b>今日は、何する？</b><span>下から種目を足して、最初の1セットを入れよう。<br>5分だけでも、OK。</span></div>`;
    }
    if (!document.getElementById("bolt-tired") && S.date === today() && daysSinceLast() >= 3 && !off()) {
      const d = document.createElement("div"); d.id = "bolt-tired"; d.className = "bolt-tired";
      const P = pp("tired");
      d.innerHTML = `<img ${P ? 'class="pet-tired" ' : ""}src="${P ? P.src : IMG("tired")}" alt="" aria-hidden="true" decoding="async"><div><b>${P ? P.name : "ボルト"}が、ぐったりしてる…</b><span>しばらくジムに行ってないよ。<br>5分だけでいいから、一緒に行こう。</span></div><button class="bolt-x" aria-label="今日は表示しない">×</button>`;
      main.insertBefore(d, main.firstChild);
    }
  }
  document.addEventListener("click", ev => {
    if (!ev.target.closest || !ev.target.closest(".bolt-x")) return;
    try { localStorage.setItem(K_OFF, today()) } catch (e) {}
    const b = document.getElementById("bolt-tired"); if (b) b.remove();
  });
  const _render = window.render;
  window.render = function () { _render.apply(this, arguments); try { decorate() } catch (e) {} };
  try { window.render() } catch (e) {}
})();

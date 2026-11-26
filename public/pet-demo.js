"use strict";
/* パソコン上（localhost）の確認用。pet.js が、localhost のときだけ読みこむ。本番のサイトでは、読みこまれない。
   育ち具合を動かして、進化の絵や、「ほめてくれる」ようすを見る。記録そのものは変えない。 */
(function () {
  if (!window.__pet || document.getElementById("pdemo")) return;
  const P = window.__pet, S_ = P.STAGES;
  const st = document.createElement("style");
  st.textContent = `#pdemo{position:fixed;left:8px;right:8px;bottom:8px;z-index:200;max-height:40vh;overflow:auto;background:#000d;border:1px dashed #ff6a00;border-radius:8px;padding:8px 10px;color:#fff;font:12px/1.5 system-ui,sans-serif}
  #pdemo input{width:100%}#pdemo .r{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}#pdemo button{background:#ff4b1f;border:0;color:#fff;border-radius:6px;padding:5px 10px;font-weight:700;cursor:pointer}#pdemo button.g{background:#333}
  #pdemo b{color:#ffc21a}`;
  document.head.appendChild(st);
  const d = document.createElement("div"); d.id = "pdemo";
  d.innerHTML = `<div>デモ（このパソコンだけ）　育ち具合：<b id="pdv">本物</b>　<button class="g" id="pdt" style="padding:1px 8px">たたむ</button></div><div id="pdb"><input type="range" id="pdr" min="0" max="${S_[S_.length - 1].pt + 1}" step="100" value="0">
  <div class="r"><button id="pdp">0から最後まで進化を見る</button><button class="g" id="pdn">本物の記録にもどす</button><button class="g" id="pdc">お祝いを出す（RM）</button><button class="g" id="pdm">お祝いを出す（MAX）</button><button class="g" id="pdo">お祝いを出す（大台）</button></div></div>`;
  document.body.appendChild(d);
  const $ = id => document.getElementById(id);
  $("pdt").addEventListener("click", () => { const b = $("pdb"), h = b.style.display === "none"; b.style.display = h ? "" : "none"; $("pdt").textContent = h ? "たたむ" : "ひらく" });
  window.__petDemoDone = () => { $("pdv").textContent = "再生おわり" };
  $("pdr").addEventListener("input", e => { P.setOverride(+e.target.value); $("pdv").textContent = (+e.target.value).toLocaleString("ja-JP") + " pt" });
  $("pdn").addEventListener("click", () => { P.setOverride(null); $("pdv").textContent = "本物" });
  $("pdp").addEventListener("click", () => { $("pdv").textContent = "再生中"; P.play(12000) });
  const cele = kind => () => {
    if (typeof showCele !== "function") return;
    const base = { name: "ベンチプレス", date: "2026-11-26", w: 100, r: 1, L: 100 };
    if (kind === "rm") showCele({ ...base, rm: { value: 107, prev: 102 }, max: null, msg: "推定RMを更新しました。", oodai: 0 });
    else if (kind === "max") showCele({ ...base, rm: { value: 107, prev: 102 }, max: { value: 100, prev: 97.5 }, msg: "自己最重量を更新しました。", oodai: 0 });
    else showCele({ ...base, rm: null, max: { value: 100, prev: 97.5 }, msg: "100kgクラブ入りです。", oodai: 100 });
  };
  $("pdc").addEventListener("click", cele("rm")); $("pdm").addEventListener("click", cele("max")); $("pdo").addEventListener("click", cele("oodai"));
  window.__petDemoBar = () => {}; // 大きな画面を作りなおしたあとも、操作パネルはそのまま
})();

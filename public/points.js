"use strict";
/* ポイントの計算（仕様: docs/friends-spec.md）。友達機能とキャラ育成の両方が使います。
   app.js のあとに読み込み、window.computePoints を足すだけです（記録の保存や表示にはさわりません）。 */
(function () {
  const DAY = 864e5;
  const parseD = s => new Date(s + "T00:00:00");
  const ZP = i => i < 0.4 ? 0 : i < 0.6 ? 5 : i < 0.75 ? 12 : i < 0.85 ? 20 : i < 0.95 ? 30 : 40;
  window.computePoints = function computePoints() {
    const days = Object.keys(S.days).filter(d => S.days[d].some(e => e.sets.length)).sort();
    const hist = {}, seen = {}, out = {};
    for (const d of days) {
      const td = parseD(d).getTime();
      let sets = 0, bon = 0;
      for (const e of S.days[d]) {
        if (!e.sets.length || isBW(e.name) || isCardio(e.name)) continue;
        const h = hist[e.name] || (hist[e.name] = []), prior = seen[e.name] || 0;
        const rec = h.filter(x => x.t >= td - 90 * DAY).map(x => x.rm);
        const base = rec.length ? Math.max(...rec) : 0;          // 直近90日の最高の推定1RM
        const items = [], rms = [];
        e.sets.forEach(s => {
          if (s.a) return;                                         // 補助ありは数えない
          const f = info(e.name, d, s); if (!(s.r > 0) || !(f.L > 0)) return;
          rms.push(rmOf(f.L, Math.min(s.r, 10)));
          if (prior < 3 || !(base > 0)) return;                    // ベスト作りの期間（最初の3日分）は点なし
          const i = Math.min(1.1, f.L / base); if (i < 0.4) return;
          items.push({ p: ZP(i) + ((s.r >= 8 && i < 0.95) ? 10 : 0), heavy: i >= 0.95 });
        });
        if (prior >= 3 && base > 0) {
          let hv = 0;                                              // 1種目5セットまで（点の高い順）、95%以上は1日3セットまで
          const top = items.sort((a, b) => b.p - a.p).filter(x => { if (x.heavy) { if (hv >= 3) return false; hv++ } return true }).slice(0, 5);
          sets += top.reduce((t, x) => t + x.p, 0);
          const pr = prFlags(e, d);
          if (pr.some(f => f.max)) bon += 40; else if (pr.some(f => f.rm)) bon += 10;
          if (pr.some(f => f.oodai)) bon += 80;
        }
        if (rms.length) { h.push({ t: td, rm: Math.max(...rms) }); seen[e.name] = prior + 1 }
      }
      out[d] = Math.round(Math.min(sets, 600) + bon);               // 1日のセット合計は600ptまで（ボーナスは別）
    }
    return out;                                                    // { 日付: ポイント }（記録のある日だけ）
  };
})();

"use strict";
/* 友達機能。app.js・store.js のあとに読み込み、「友達」タブと、ポイントの計算・送信、招待リンクの処理を足します。
   友達に見えるのは「表示名」「行った日」「ポイント」だけ。見えてよいかの判断は、すべてデータベースの関数がします。
   ログインできない環境（CLOUD_OK が偽）では、何もしません。 */
(function () {
  if (typeof CLOUD_OK === "undefined" || !CLOUD_OK || !SB) return;

  /* ---------- 準備 ---------- */
  const K_INV = "tsumitore.invite", K_SYNC = "tsumitore.fr.synced", K_HIDE = "tsumitore.fr.hide";
  const DAY = 864e5, pad2 = n => String(n).padStart(2, "0");
  const ymd = d => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  const parseD = s => new Date(s + "T00:00:00");
  const addD = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d) };
  const FR = { loaded: false, loading: false, profile: null, friends: [], blocks: [], act: [], invites: [], range: "week", sel: null, msg: "", busy: false, newInvite: null };
  let PENDING = null;
  try { PENDING = localStorage.getItem(K_INV) } catch (e) {}
  const hideRank = () => { try { return localStorage.getItem(K_HIDE) === "1" } catch (e) { return false } };

  // 招待リンク（/f/12文字）で開いたら、トークンを覚えて、URLをトップに戻す
  (function () {
    const m = location.pathname.match(/^\/f\/([0-9a-fA-F]{12})\/?$/);
    if (m) { PENDING = m[1].toLowerCase(); try { localStorage.setItem(K_INV, PENDING) } catch (e) {} try { history.replaceState(null, "", "/") } catch (e) {} }
  })();

  // 「友達」タブを足す
  const FRIEND_ICON = '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M3 19c0-3.2 2.7-5 6-5s6 1.8 6 5M15 14.2c.7-.2 1.3-.3 2-.3 2.6 0 4 1.5 4 4.1"/>';
  ICON.friends = FRIEND_ICON;
  TABS.splice(4, 0, ["friends", "友達", "--p-abs"]);
  window.vFriends = vFriends;

  /* ---------- ポイントの計算（仕様: docs/friends-spec.md） ---------- */
  const ZP = i => i < 0.4 ? 0 : i < 0.6 ? 5 : i < 0.75 ? 12 : i < 0.85 ? 20 : i < 0.95 ? 30 : 40;
  function computePoints() {
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
  }

  /* ---------- ポイントを送る（「見せる」がONのときだけ） ---------- */
  let syncTimer = null;
  function readSynced() { try { const v = JSON.parse(localStorage.getItem(K_SYNC) || "null"); return v && v.u === (A.user && A.user.id) ? v.m : {} } catch (e) { return {} } }
  function writeSynced(m) { try { localStorage.setItem(K_SYNC, JSON.stringify({ u: A.user.id, m })) } catch (e) {} }
  async function syncPoints(force) {
    if (!A.user || !FR.profile || !FR.profile.share) return;
    const all = computePoints(), from = addD(today(), -61), cur = {};
    Object.keys(all).forEach(d => { if (d >= from) cur[d] = all[d] });
    const last = force ? {} : readSynced();
    const up = Object.keys(cur).filter(d => last[d] !== cur[d]).map(d => ({ user_id: A.user.id, day: d, points: cur[d], trained: true }));
    const del = Object.keys(last).filter(d => !(d in cur));
    try {
      if (up.length) { const r = await SB.from("daily_points").upsert(up, { onConflict: "user_id,day" }); if (r.error) throw r.error }
      if (del.length) { const r = await SB.from("daily_points").delete().eq("user_id", A.user.id).in("day", del); if (r.error) throw r.error }
      writeSynced(cur);
    } catch (e) { /* つながらないときは、次の機会に送る */ }
  }
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(() => syncPoints(false), 4000) }
  const _saveDay = window.saveDay;
  window.saveDay = function (date) { _saveDay.apply(this, arguments); try { scheduleSync() } catch (e) {} };

  /* ---------- データの読み込み ---------- */
  const rangeFrom = () => { const t = today(); const ms = t.slice(0, 7) + "-01", w = addD(t, -13); return ms < w ? ms : w };
  async function load() {
    if (!A.user || FR.loading) return; FR.loading = true; FR.msg = ""; render();
    try {
      const [p, fl, bl, iv, ac] = await Promise.all([
        SB.from("profiles").select("display_name,share").eq("user_id", A.user.id).maybeSingle(),
        SB.rpc("list_friends"), SB.rpc("list_blocks"),
        SB.from("friend_invites").select("token,expires_at,created_at,note,max_uses,use_count").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
        SB.rpc("friends_activity", { p_from: rangeFrom(), p_to: today() })]);
      if (p.error || fl.error || bl.error || iv.error || ac.error) throw new Error("load");
      FR.profile = p.data || null; FR.friends = fl.data || []; FR.blocks = bl.data || []; FR.invites = (iv.data || []).filter(i => i.use_count < i.max_uses); FR.act = ac.data || [];
      FR.loaded = true;
      const nw = await SB.rpc("take_invite_news");
      (nw.data || []).forEach(n => toast((n.friend_name || "だれか") + "さんが、招待を使って友達になりました"));
      if (FR.profile && FR.profile.share) syncPoints(false);
    } catch (e) { FR.msg = "読み込めませんでした。電波を確認して、「更新」を押してください。" }
    FR.loading = false; render();
  }

  /* ---------- 画面 ---------- */
  const style = document.createElement("style");
  style.textContent = `
  .fr-note{font-size:12px;color:var(--muted);line-height:1.6;margin:8px 0 0}
  .fr-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .fr-seg{display:flex;gap:6px;margin-bottom:10px}
  .fr-seg button{flex:1;padding:9px;border:1px solid var(--line);background:var(--surface);border-radius:var(--r);font-weight:900;color:var(--muted)}
  .fr-seg button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
  .fr-rk{display:grid;grid-template-columns:28px 80px 1fr 64px;align-items:center;gap:8px;margin:9px 0}
  .fr-rk .no{font-family:var(--f-display);font-weight:800;font-size:18px;color:var(--muted);text-align:center}
  .fr-rk .nm{font-weight:900;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fr-rk .bar{height:14px;background:var(--s2);border-radius:99px;overflow:hidden}
  .fr-rk .bar i{display:block;height:100%;border-radius:99px}
  .fr-rk .pt{text-align:right;font-family:var(--f-display);font-weight:800;font-size:20px;line-height:1}
  .fr-rk .pt small{display:block;font-size:11px;color:var(--muted);font-family:var(--f-body);font-weight:500}
  .fr-rk.me .nm,.fr-rk.me .no{color:var(--gold)}
  .fr-strip{display:grid;grid-template-columns:64px repeat(14,1fr);gap:3px;align-items:center;margin:5px 0}
  .fr-strip .nm{font-size:12px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fr-strip i{display:block;aspect-ratio:1;border-radius:4px;background:var(--s2)}
  .fr-strip.hd span{font-size:9px;color:var(--muted);text-align:center;font-family:var(--f-display)}
  .fr-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
  .fr-cal .w{font-size:11px;color:var(--muted);text-align:center;font-weight:900}
  .fr-cal button{aspect-ratio:1;border:1px solid var(--line);background:var(--s2);border-radius:6px;padding:2px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;font-size:12px;font-weight:900;color:var(--ink)}
  .fr-cal button.sel{border-color:var(--gold);box-shadow:0 0 0 2px rgba(255,194,26,.35)}
  .fr-cal button.today{border-color:var(--accent)}
  .fr-cal .dots{display:flex;gap:2px;flex-wrap:wrap;justify-content:center;min-height:9px}
  .fr-cal .dots i{width:7px;height:7px;border-radius:50%}
  .fr-cal .e{visibility:hidden}
  .fr-leg{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;font-size:12px;font-weight:900}
  .fr-leg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px}
  .fr-fr{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid var(--line)}
  .fr-fr:first-of-type{border-top:0}
  .fr-fr .nm{flex:1;min-width:0;font-weight:900}
  .fr-fr .nm small{display:block;font-weight:500;color:var(--muted);font-size:11px}
  .fr-name{display:flex;gap:6px}
  .fr-name input{flex:1;min-width:0;padding:10px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:var(--r);font-weight:700}
  .fr-link{display:flex;gap:6px;margin-top:8px}
  .fr-link code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:9px;font-size:12px}
  .fr-tog{display:inline-flex;align-items:center;gap:8px;font-weight:900;font-size:14px}
  .fr-tog button{width:46px;height:26px;border-radius:99px;border:0;background:#3a3f4a;position:relative;transition:.2s}
  .fr-tog button::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}
  .fr-tog button[aria-pressed=true]{background:var(--ok)}
  .fr-tog button[aria-pressed=true]::after{left:23px}
  .fr-who{margin-top:10px;font-size:14px;font-weight:700;line-height:1.7}
  .fr-new{border:2px solid var(--accent);background:rgba(255,75,31,.08);border-radius:var(--r);padding:12px;margin-top:12px;animation:frflash 1.4s ease}
  @keyframes frflash{0%{box-shadow:0 0 0 0 rgba(255,75,31,.6)}100%{box-shadow:0 0 0 14px rgba(255,75,31,0)}}
  .fr-tag{display:inline-block;background:var(--accent);color:#fff;font-size:11px;font-weight:900;border-radius:99px;padding:2px 10px;margin-right:6px}
  .fr-tag.sm{background:var(--gold);color:#1a1200}
  .fr-tag.grp{background:#2f7bff}
  .fr-tag.one{background:#3a3f4a}
  .fr-kind{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 8px;font-size:14px;font-weight:900}
  .fr-kind label{display:flex;align-items:center;gap:6px}
  .fr-memo{font-size:15px}
  .fr-old{border-top:1px solid var(--line);padding:10px 0}
  .fr-oldh{display:flex;align-items:center;gap:8px;justify-content:space-between}
  .fr-oldh small{display:block;color:var(--muted);font-size:11px;font-weight:500}
  @media (prefers-reduced-motion: reduce){.fr-new{animation:none}}
  `;
  document.head.appendChild(style);

  const COLORS = ["#ff4b1f", "#2f7bff", "#16c784", "#a35cff", "#ffa412", "#14b8e6", "#ff6ec7", "#7c8494"];
  function rangeDates() { const t = today(); return FR.range === "week" ? [addD(t, -6), t] : [t.slice(0, 7) + "-01", t] }

  // 順位表の元になる、人ごとの {名前, ポイント, 行った日数}
  function board() {
    const [a, b] = rangeDates(), me = computePoints();
    const mine = Object.keys(me).filter(d => d >= a && d <= b);
    const rows = [{ id: A.user.id, name: (FR.profile && FR.profile.display_name) || "あなた", me: true, pts: mine.reduce((t, d) => t + me[d], 0), days: mine.length }];
    const by = {};
    FR.act.forEach(r => { if (r.user_id === A.user.id || r.day < a || r.day > b) return; const o = by[r.user_id] || (by[r.user_id] = { id: r.user_id, name: r.display_name, pts: 0, days: 0 }); o.pts += r.points; if (r.trained) o.days++ });
    return rows.concat(Object.values(by)).sort((x, y) => y.pts - x.pts);
  }

  function rankHTML() {
    const rows = board(), max = Math.max(1, ...rows.map(r => r.pts));
    const hide = hideRank(), shown = hide ? rows.filter(r => r.me) : rows;
    const list = shown.map((r, k) => `<div class="fr-rk${r.me ? " me" : ""}"><span class="no">${hide ? "" : (rows.indexOf(r) + 1)}</span><span class="nm">${esc(r.name)}</span><span class="bar"><i style="width:${r.pts / max * 100}%;background:${r.me ? "#fff" : COLORS[(rows.indexOf(r)) % COLORS.length]}"></i></span><span class="pt">${r.pts}<small>pt ・ ${r.days}日</small></span></div>`).join("");
    const mutual = rows.length - 1;
    return `<div class="card"><h2>${FR.range === "week" ? "週間ランキング（直近7日）" : "月間ランキング（今月）"}</h2>
      <div class="fr-seg"><button data-fr="range" data-v="week" aria-pressed="${FR.range === "week"}">週間</button><button data-fr="range" data-v="month" aria-pressed="${FR.range === "month"}">月間</button></div>
      ${list}
      ${hide ? `<p class="fr-note">順位を隠しています（自分の点だけ表示）。</p>` : (mutual === 0 ? `<p class="fr-note">まだ、見られる友達がいません。友達を招待して、おたがいに「見せる」をONにすると、ここに並びます。</p>` : "")}
      <div class="fr-row" style="margin-top:10px"><span class="fr-tog"><button data-fr="hide" aria-pressed="${hide}" aria-label="順位を隠す"></button><span>順位を隠す</span></span></div>
      <p class="fr-note">ポイントは、重さを自分のベストと比べて点にしたものです。種目・重さ・回数は、友達には見えません。</p></div>`;
  }

  function calHTML() {
    const t = today(), people = [{ id: A.user.id, name: "あなた", c: "#ffffff" }];
    const friendsShown = [...new Set(FR.act.filter(r => r.user_id !== A.user.id).map(r => r.user_id))];
    friendsShown.forEach((id, k) => people.push({ id, name: (FR.act.find(r => r.user_id === id) || {}).display_name || "", c: COLORS[k % COLORS.length] }));
    const mine = computePoints(), has = {};
    Object.keys(mine).forEach(d => (has[d] = has[d] || new Set()).add(A.user.id));
    FR.act.forEach(r => { if (r.user_id !== A.user.id && r.trained) (has[r.day] = has[r.day] || new Set()).add(r.user_id) });
    const strip = people.map(p => `<div class="fr-strip"><span class="nm">${esc(p.name)}</span>${Array.from({ length: 14 }, (_, i) => { const d = addD(t, i - 13); return `<i style="${has[d] && has[d].has(p.id) ? "background:" + p.c : ""}"></i>` }).join("")}</div>`).join("");
    const hd = `<div class="fr-strip hd"><span></span>${Array.from({ length: 14 }, (_, i) => `<span>${parseD(addD(t, i - 13)).getDate()}</span>`).join("")}</div>`;
    const y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7)), first = new Date(y, m - 1, 1), n = new Date(y, m, 0).getDate(), lead = (first.getDay() + 6) % 7;
    let cells = "月火水木金土日".split("").map(w => `<div class="w">${w}</div>`).join("") + `<div class="e"></div>`.repeat(lead);
    for (let d = 1; d <= n; d++) {
      const key = t.slice(0, 7) + "-" + pad2(d), fut = key > t, ids = fut ? [] : people.filter(p => has[key] && has[key].has(p.id));
      cells += `<button data-fr="day" data-v="${key}" class="${key === FR.sel ? "sel " : ""}${key === t ? "today" : ""}" ${fut ? "disabled style=\"opacity:.35\"" : ""}><span>${d}</span><span class="dots">${ids.map(p => `<i style="background:${p.c}"></i>`).join("")}</span></button>`;
    }
    const sel = FR.sel || t, who = people.filter(p => has[sel] && has[sel].has(p.id)).map(p => p.name);
    return `<div class="card"><h2>行った日</h2>${hd}${strip}</div>
      <div class="card"><h2>${m}月のカレンダー</h2><div class="fr-leg">${people.map(p => `<span><i style="background:${p.c}"></i>${esc(p.name)}</span>`).join("")}</div><div class="fr-cal">${cells}</div>
      <div class="fr-who"><b>${Number(sel.slice(5, 7))}/${Number(sel.slice(8))}</b>　${who.length ? "行った人： " + who.map(esc).join("、") : "この日は、だれも行ってないよ"}</div></div>`;
  }

  function manageHTML() {
    const p = FR.profile, since = s => { const d = new Date(s); return (d.getMonth() + 1) + "/" + d.getDate() + " から" };
    const friends = FR.friends.length ? FR.friends.map(f => `<div class="fr-fr"><span class="nm">${esc(f.display_name || "（名前なし）")}<small>${since(f.since)}${f.they_share ? "" : "　・　相手は「見せる」がOFF"}</small></span><button class="btn sm" data-fr="unfriend" data-v="${f.friend_id}" data-n="${esc(f.display_name)}">やめる</button><button class="btn sm" data-fr="block" data-v="${f.friend_id}" data-n="${esc(f.display_name)}">ブロック</button></div>`).join("") : `<p class="fr-note" style="margin:0">まだ友達がいません。</p>`;
    const blocks = FR.blocks.length ? `<h2 style="margin-top:14px">ブロック中</h2>${FR.blocks.map(b => `<div class="fr-fr"><span class="nm">${esc(b.display_name || "（名前なし）")}</span><button class="btn sm" data-fr="unblock" data-v="${b.user_id}">解除</button></div>`).join("")}` : "";
    const fmtT = s => { const d = new Date(s); return (d.getMonth() + 1) + "/" + d.getDate() + " " + pad2(d.getHours()) + ":" + pad2(d.getMinutes()) };
    const linkRow = i => { const url = location.origin + "/f/" + i.token; return `<div class="fr-link"><code>${esc(url)}</code><button class="btn sm" data-fr="copy" data-v="${esc(url)}">コピー</button>${navigator.share ? `<button class="btn sm" data-fr="share" data-v="${esc(url)}">送る</button>` : ""}</div>` };
    const leftDays = i => Math.max(0, Math.ceil((new Date(i.expires_at) - Date.now()) / DAY));
    const sorted = FR.invites.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const fresh = FR.newInvite ? sorted.find(i => i.token === FR.newInvite) : null;
    const rest = sorted.filter(i => i !== fresh);
    const full = sorted.length >= 5;
    const grp = i => i.max_uses > 1 ? `<span class="fr-tag grp">グループ用　${i.use_count}/${i.max_uses}人が使用</span>` : `<span class="fr-tag one">1人用</span>`;
    const freshBox = fresh ? `<div id="fr-new" class="fr-new"><span class="fr-tag">いま作ったリンク</span>${grp(fresh)}${fresh.note ? `<b class="fr-memo">${esc(fresh.note)}用</b>` : ""}${linkRow(fresh)}<p class="fr-note" style="margin:6px 0 0">${fresh.max_uses > 1 ? `このリンクは、<b>${fresh.max_uses}人まで</b>使えます。あと${leftDays(fresh)}日で切れます。信頼できるグループにだけ、送ってください。` : `このリンクは<b>1人だけ</b>使えます。次の友達には、もう一度「新しいリンクを作る」を押して、別のリンクを作ってください。`}</p></div>` : "";
    const restBox = rest.length ? `<h2 style="margin:16px 0 6px">使っていないリンク（${sorted.length}/5本）</h2>${rest.map((i, k) => `<div class="fr-old"><div class="fr-oldh"><span>${k === 0 && !fresh ? `<span class="fr-tag sm">いちばん新しい</span>` : ""}${grp(i)}<b>${i.note ? esc(i.note) + "用" : "メモなし"}</b><small>${fmtT(i.created_at)} に作成 ・ あと${leftDays(i)}日</small></span><button class="btn sm" data-fr="revoke" data-v="${esc(i.token)}">削除</button></div>${linkRow(i)}</div>`).join("")}` : "";
    const kind = FR.kind === "5" ? "5" : "1";
    return `<div class="card"><h2>友達を招待する</h2>
        <p class="fr-note" style="margin:0 0 8px">リンクは、2種類から選べます。<br><b>1人用</b>：1人だけ使えて、7日で切れます。1人の友達につき、1本ずつ作ります。<br><b>グループ用</b>：5人まで使えて、3日で切れます。LINEのグループなどに、1本送れます（同時に2本まで）。<br>使い終わったリンクは、自動で一覧から消えます。</p>
        <div class="fr-kind"><label><input type="radio" name="fr-kind" value="1" ${kind === "1" ? "checked" : ""}> 1人用（7日）</label><label><input type="radio" name="fr-kind" value="5" ${kind === "5" ? "checked" : ""}> グループ用（5人まで・3日）</label></div>
        ${kind === "5" ? `<p class="fr-note" style="margin:0 0 8px"><b>グループ用リンクは、転送されると、知らない人も入れてしまいます。</b>信頼できるグループにだけ送ってください。</p>` : ""}
        <div class="fr-name"><input id="fr-invnote" maxlength="12" value="${esc(FR.draft || "")}" placeholder="${kind === "5" ? "どのグループ？（メモ・任意）" : "だれに送る？（メモ・任意）"}" aria-label="招待のメモ"><button class="btn grad" data-fr="invite" ${FR.busy || full ? "disabled" : ""}>新しいリンクを作る</button></div>
        <p class="fr-note" style="margin:4px 0 0">メモは、あなただけに見えます（友達には見えません）。${full ? "<b>使っていないリンクが5本あるので、いまは新しく作れません。使われるか、削除すると、作れます。</b>" : ""}</p>
        ${freshBox}${restBox}
        <p class="fr-note">友達は最大30人です（いま ${FR.friends.length}人）。名前やメールアドレスで、友達を探すことはできません。</p></div>
      <div class="card"><h2>友達</h2>${friends}${blocks}
        <p class="fr-note">「やめる」でおたがいに見えなくなります。「ブロック」すると、友達から消えて、招待も使えなくなります。</p></div>
      <div class="card"><h2>あなたの設定</h2>
        <div class="fr-name"><input id="fr-name" maxlength="12" value="${esc(p ? p.display_name : "")}" placeholder="表示名（12文字まで）" aria-label="表示名"><button class="btn" data-fr="savename">保存</button></div>
        <p class="fr-note">友達に表示される名前です。メールアドレスは、友達には見えません。</p>
        <div class="fr-row" style="margin-top:12px"><span class="fr-tog"><button data-fr="share" data-v="${p && p.share ? "off" : "on"}" aria-pressed="${!!(p && p.share)}" aria-label="友達に見せる"></button><span>友達に見せる：${p && p.share ? "ON" : "OFF"}</span></span></div>
        <p class="fr-note">ONにすると、あなたの「行った日」と「ポイント」が、友達に見えます（種目・重さ・回数・体重は見えません）。<b>おたがいにONのときだけ</b>、友達の分も見られます。OFFにすると、送ったデータは消えます。</p></div>`;
  }

  function vFriends() {
    if (!A.user) return `<div class="card"><h2>友達</h2><p class="muted">友達機能は、ログインすると使えます。ログインすると、友達と「行った日」や「ポイント」を見せ合えます。</p><button class="btn grad" data-a="gomenu" data-v="data" style="width:100%;padding:12px">ログインする</button></div>`;
    if (FR.uid !== A.user.id) { FR.uid = A.user.id; FR.loaded = false; FR.profile = null; FR.friends = []; FR.blocks = []; FR.act = []; FR.invites = []; FR.msg = "" }   // 別のアカウントのデータは、持ち越さない
    if (!FR.loaded) {
      if (FR.msg && !FR.loading) return `<div class="card"><p class="msg" style="margin-top:0">${esc(FR.msg)}</p><button class="btn" data-fr="reload">更新</button></div>`;
      if (!FR.loading) setTimeout(load, 0);
      return `<p class="empty">読み込み中…</p>`;
    }
    if (!FR.profile) return `<div class="card"><h2>友達</h2><p class="muted" style="margin-top:0">はじめに、友達に表示される名前を決めてください（12文字まで）。メールアドレスは、友達には見えません。</p>
      <div class="fr-name"><input id="fr-name" maxlength="12" placeholder="表示名" aria-label="表示名"><button class="btn grad" data-fr="makename">決める</button></div>${FR.msg ? `<p class="msg">${esc(FR.msg)}</p>` : ""}</div>`;
    const top = `<div class="fr-row" style="margin-bottom:10px"><b style="flex:1;font-size:16px">友達</b><button class="btn sm" data-fr="reload">更新</button></div>${FR.msg ? `<p class="msg">${esc(FR.msg)}</p>` : ""}${FR.profile.share ? "" : `<div class="banner" style="margin-bottom:12px"><b>「友達に見せる」がOFFです。ONにすると、友達の記録も見られます（おたがいさま）。</b><button class="btn sm" data-fr="share" data-v="on">ONにする</button></div>`}`;
    return top + rankHTML() + calHTML() + manageHTML();
  }

  /* ---------- 操作 ---------- */
  function say(t) { FR.msg = t; render() }
  async function savePoints(share) { /* ONのとき: 送る / OFFのとき: 送ったデータを消す */
    if (share) { try { localStorage.removeItem(K_SYNC) } catch (e) {} await syncPoints(true) }
    else { try { await SB.from("daily_points").delete().eq("user_id", A.user.id) } catch (e) {} try { localStorage.removeItem(K_SYNC) } catch (e) {} }
  }
  async function makeProfile(name) {
    name = String(name || "").trim();
    if (!name) return say("名前を入れてください。");
    if ([...name].length > 12) return say("名前は12文字までです。");
    const r = await SB.from("profiles").upsert({ user_id: A.user.id, display_name: name }, { onConflict: "user_id" });
    if (r.error) return say("保存できませんでした。もう一度お試しください。");
    FR.msg = ""; FR.loaded = false; load();
  }
  async function doInvite() {
    if (FR.busy) return;
    const memo = String((document.getElementById("fr-invnote") || {}).value || "").trim();   // 画面を描き直す前に、メモを読む
    if ([...memo].length > 12) return say("メモは12文字までです。");
    FR.busy = true; render();
    const r = await SB.rpc("create_invite", { p_note: memo || null, p_max: FR.kind === "5" ? 5 : 1 }); FR.busy = false;
    if (r.error) {
      const m = String(r.error.message || "");
      say(/friends_full/.test(m) ? "友達が30人います。これ以上は招待できません。" : /too_many_group_invites/.test(m) ? "グループ用リンクは、同時に2本までです。使い切るか、削除すると、新しく作れます。" : /too_many_invites/.test(m) ? "使っていないリンクが5本あります。使われるか、削除すると、新しく作れます。" : /need_profile/.test(m) ? "先に、表示名を決めてください。" : "リンクを作れませんでした。もう一度お試しください。");
      return;
    }
    FR.draft = "";
    FR.newInvite = (r.data && r.data[0] && r.data[0].token) || null;
    await load();
    setTimeout(() => { const el = document.getElementById("fr-new"); if (el) el.scrollIntoView({ behavior: "smooth", block: "center" }) }, 80);
  }
  async function copyText(t) { try { await navigator.clipboard.writeText(t); toast("リンクをコピーしました") } catch (e) { window.prompt("このリンクをコピーしてください", t) } }
  async function shareLink(url) {
    const msg = { title: "筋トレは力なり", text: "筋トレの記録アプリで、友達になろう！", url };
    if (navigator.share) { try { await navigator.share(msg); return } catch (e) { if (e && e.name === "AbortError") return } }
    copyText(url);
  }
  async function rpcDo(name, args, okMsg) { const r = await SB.rpc(name, args); if (r.error) return say("うまくいきませんでした。もう一度お試しください。"); toast(okMsg); FR.loaded = false; load() }

  // 1人用／グループ用の切り替え（メモの下書きは、描き直しで消えないように覚えておく）
  document.addEventListener("input", ev => { if (ev.target && ev.target.id === "fr-invnote") FR.draft = ev.target.value });
  document.addEventListener("change", ev => { const r = ev.target; if (r && r.name === "fr-kind") { FR.kind = r.value; render() } });
  document.addEventListener("click", async ev => {
    const b = ev.target.closest && ev.target.closest("[data-fr]"); if (!b) return;
    const a = b.dataset.fr, v = b.dataset.v;
    if (a === "range") { FR.range = v; render() }
    else if (a === "day") { FR.sel = v; render() }
    else if (a === "hide") { try { localStorage.setItem(K_HIDE, hideRank() ? "0" : "1") } catch (e) {} render() }
    else if (a === "reload") { FR.loaded = false; load() }
    else if (a === "makename") makeProfile((document.getElementById("fr-name") || {}).value);
    else if (a === "savename") {
      const name = String((document.getElementById("fr-name") || {}).value || "").trim();
      if (!name || [...name].length > 12) return say("名前は、1〜12文字で入れてください。");
      const r = await SB.from("profiles").update({ display_name: name }).eq("user_id", A.user.id);
      if (r.error) return say("保存できませんでした。"); toast("名前を保存しました"); FR.loaded = false; load();
    }
    else if (a === "share") {
      if (b.tagName === "BUTTON" && (v === "on" || v === "off")) {
        const on = v === "on"; const r = await SB.from("profiles").update({ share: on }).eq("user_id", A.user.id);
        if (r.error) return say("設定を変えられませんでした。"); FR.profile.share = on; await savePoints(on); toast(on ? "友達に見せるようにしました" : "友達に見せないようにしました（送ったデータは消しました）"); FR.loaded = false; load();
      } else shareLink(v);
    }
    else if (a === "invite") doInvite();
    else if (a === "copy") copyText(v);
    else if (a === "unfriend") { if (await askChoice("友達をやめる", `${b.dataset.n || "この人"}さんと、友達をやめますか？ おたがいに見えなくなります。`, [{ label: "友達をやめる", value: true, pri: true }, { label: "やめない", value: false }])) rpcDo("remove_friend", { p_friend: v }, "友達をやめました") }
    else if (a === "block") { if (await askChoice("ブロックする", `${b.dataset.n || "この人"}さんをブロックしますか？ 友達から消えて、招待も使えなくなります。相手には知らせません。`, [{ label: "ブロックする", value: true, pri: true }, { label: "やめる", value: false }])) rpcDo("block_user", { p_user: v }, "ブロックしました") }
    else if (a === "unblock") rpcDo("unblock_user", { p_user: v }, "ブロックを解除しました");
    else if (a === "revoke") { if (await askChoice("リンクを削除", "このリンクを削除しますか？ まだ使われていなければ、このリンクでは、友達になれなくなります。", [{ label: "削除する", value: true, pri: true }, { label: "やめる", value: false }])) { if (FR.newInvite === v) FR.newInvite = null; rpcDo("revoke_invite", { p_token: v }, "リンクを削除しました") } }
  });

  /* ---------- 招待リンクから来たとき ---------- */
  function askName() {
    return new Promise(res => {
      const el = document.createElement("div"); el.id = "dlg"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "表示名");
      el.innerHTML = `<div class="sh"><h2 style="margin:0">表示名を決めてください</h2><p style="margin:0">友達に表示される名前です（12文字まで）。メールアドレスは、友達には見えません。</p>
        <input id="dlg-name" maxlength="12" placeholder="表示名" style="padding:12px;border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:var(--r);font-weight:700">
        <div class="acts" style="flex-direction:column"><button class="btn grad" data-ok="1">決める</button><button class="btn" data-ok="0">やめる</button></div></div>`;
      el.addEventListener("click", ev => { const b = ev.target.closest("button[data-ok]"); if (!b) return; if (b.dataset.ok === "1") { const n = el.querySelector("#dlg-name").value.trim(); if (!n || [...n].length > 12) return; el.remove(); res(n) } else { el.remove(); res(null) } });
      document.body.appendChild(el); setTimeout(() => { const i = el.querySelector("#dlg-name"); i && i.focus() }, 50);
    });
  }
  const ST = { not_found: "このリンクは使えません。", used: "このリンクは、もう使われています（またはグループ用の人数がいっぱいです）。招待した人に、新しいリンクをもらってください。", expired: "このリンクは、期限が切れています。招待した人に、新しいリンクをもらってください。", self: "これは、あなた自身の招待リンクです。友達に送ってください。", unavailable: "このリンクでは、友達になれません。", already: "もう友達です。", my_full: "友達が30人います。これ以上は増やせません。", their_full: "相手の友達がいっぱいで、友達になれません。" };
  let handling = false;
  async function handlePending() {
    if (handling || !PENDING || !A.user || !A.ready) return; handling = true;
    const tok = PENDING;
    const clear = () => { PENDING = null; try { localStorage.removeItem(K_INV) } catch (e) {} };
    try {
      let prof = (await SB.from("profiles").select("display_name").eq("user_id", A.user.id).maybeSingle()).data;
      if (!prof) {
        const name = await askName(); if (!name) { handling = false; return }   // やめても、リンクは覚えておく
        const r = await SB.from("profiles").upsert({ user_id: A.user.id, display_name: name }, { onConflict: "user_id" }); if (r.error) throw r.error;
      }
      const pk = await SB.rpc("peek_invite", { p_token: tok }); if (pk.error) throw pk.error;
      const row = (pk.data || [])[0] || { status: "not_found" };
      if (row.status !== "ok") { clear(); toast(ST[row.status] || "このリンクは使えません。"); handling = false; return }
      const yes = await askChoice("友達の招待", `${row.inviter_name || "だれか"}さんから、友達の招待が届いています。友達になりますか？ 友達になると、おたがいに「友達に見せる」をONにしたときだけ、「行った日」と「ポイント」が見えます。`, [{ label: "友達になる", value: true, pri: true }, { label: "やめる", value: false }]);
      if (!yes) { clear(); handling = false; return }
      const ac = await SB.rpc("accept_invite", { p_token: tok }); if (ac.error) throw ac.error;
      const res = (ac.data || [])[0] || { status: "not_found" }; clear();
      if (res.status === "ok") { toast((res.friend_name || "友達") + "さんと、友達になりました"); FR.loaded = false; S.tab = "friends"; render() }
      else toast(ST[res.status] || "友達になれませんでした。");
    } catch (e) { toast("うまくいきませんでした。リンクをもう一度開いてください。") }
    handling = false;
  }
  // ログインが落ち着いたら、プロフィールを確かめて（「見せる」がONなら）ポイントを送る
  let profChecked = null;
  async function checkProfile() {
    if (!A.user || !A.ready || profChecked === A.user.id) return; profChecked = A.user.id;
    try {
      const r = await SB.from("profiles").select("display_name,share").eq("user_id", A.user.id).maybeSingle();
      if (!r.error) { FR.profile = r.data || null; if (FR.profile && FR.profile.share) syncPoints(false) }
    } catch (e) { profChecked = null }
  }
  const _render = window.render;
  window.render = function () {
    _render.apply(this, arguments);
    try { if (A.user && A.ready) { setTimeout(checkProfile, 0); if (PENDING && !handling) setTimeout(handlePending, 0) } else if (!A.user) profChecked = null } catch (e) {}
  };
  setTimeout(() => { try { if (PENDING && A.user && A.ready) handlePending() } catch (e) {} }, 3500);
  // ログインしていない人が招待リンクで来たら、ログインをうながす
  if (PENDING) setTimeout(() => { if (PENDING && !A.user) { toast("招待リンクから来ました。ログインすると、友達になれます"); S.tab = "menu"; S.menu = "data"; _render() } }, 3000);
})();

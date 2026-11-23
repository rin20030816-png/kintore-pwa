"use strict";
const APP_NAME="筋トレは力なり";
const FL='"Dela Gothic One","Zen Kaku Gothic New",sans-serif';
const PARTS=["胸","背中","肩","腕","脚","腹","有酸素","その他"];
const PVAR={"胸":"--p-chest","背中":"--p-back","肩":"--p-shoulder","腕":"--p-arm","脚":"--p-leg","腹":"--p-abs","有酸素":"--p-cardio","その他":"--p-other"};
const PHEX={"胸":"#ff3b55","背中":"#2f7bff","肩":"#ffa412","腕":"#a35cff","脚":"#16c784","腹":"#14b8e6","有酸素":"#ff6ec7","その他":"#7c8494"};
const GUESS=[["有酸素",/ランニング|ジョギング|ウォーキング|トレッドミル|エアロバイク|バイク|スイム|水泳|クロストレーナー|ステップマシン|ステアマスター|縄跳び|サイクリング|HIIT|有酸素/],["腹",/アブ|クランチ|腹|プランク|レッグレイズ|シットアップ/],["胸",/ベンチ|チェスト|クロスオーバー|フライ|ディップ|プッシュアップ|腕立/],["背中",/ラット|ロウ|ローイング|懸垂|チン|デッド|プルダウン|プルアップ|シュラッグ|バックエクステンション/],["肩",/ショルダー|レイズ|アップライト|フェイスプル|オーバーヘッドプレス/],["脚",/レッグ|スクワット|ランジ|カーフ|ヒップ|ブルガリアン|アダクター|アブダクター/],["腕",/カール|プレスダウン|エクステンション|トライセプ|キックバック|スカル/]];
const BW_RE=/懸垂|チンニング|チンアップ|プルアップ|ディップス?$|ディップス|腕立|プッシュアップ|自重|プランク|クランチ|シットアップ|レッグレイズ|バックエクステンション|ピストル/;
const ICON={
  log:'<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>',
  cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  graph:'<path d="M4 19h16M6 15l4-5 4 3 5-7"/>',
  hall:'<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>'};
const TABS=[["log","記録","--p-chest"],["cal","カレンダー","--p-leg"],["graph","グラフ","--p-back"],["hall","殿堂","--p-shoulder"],["menu","メニュー","--p-arm"]];
const MENU=[["imp","取り込み"],["goal","体重・目標"],["ex","種目"],["data","保存・ログイン"]];
const METRICS=[["rm","最大RM","kg"],["vol","総負荷量","kg"],["sets","セット数","set"],["maxw","最大重量","kg"]];
const CMETRICS=[["time","時間","分"],["dist","距離","km"]];
const W_STEPS=[2.5,5,10,30];
const T_STEPS=[1,5,10,30];
const D_STEPS=[0.1,0.5,1,5];
// あらかじめ登録しておく代表的な種目（部位ごと）。bw=自重
const PRESETS={
  "胸":["ベンチプレス","インクラインベンチプレス","デクラインベンチプレス","ダンベルプレス","インクラインダンベルプレス","ダンベルフライ","インクラインダンベルフライ","チェストプレス","ペックフライ","ケーブルクロスオーバー","スミスマシンベンチプレス",["ディップス"],["腕立て伏せ"]],
  "背中":["デッドリフト",["懸垂"],"ラットプルダウン","ベントオーバーロウ","ワンハンドダンベルロウ","シーテッドロウ","Tバーロウ","ケーブルプルオーバー","シュラッグ",["バックエクステンション"]],
  "肩":["ショルダープレス","ダンベルショルダープレス","オーバーヘッドプレス","サイドレイズ","ケーブルサイドレイズ","フロントレイズ","リアレイズ","リアデルトフライ","アップライトロウ","フェイスプル"],
  "腕":["バーベルカール","ダンベルカール","ハンマーカール","インクラインダンベルカール","プリーチャーカール","ケーブルカール","コンセントレーションカール","ナローベンチプレス","ライイングトライセプスエクステンション","オーバーヘッドエクステンション","ケーブルプレスダウン","キックバック","リストカール"],
  "脚":["スクワット","フロントスクワット","スミスマシンスクワット","レッグプレス","ハックスクワット","ブルガリアンスクワット","ランジ","レッグエクステンション","レッグカール","ルーマニアンデッドリフト","ヒップスラスト","アダクター","アブダクター","カーフレイズ"],
  "腹":[["クランチ"],"ケーブルクランチ","アブドミナル",["レッグレイズ"],["ハンギングレッグレイズ"],["アブローラー"],["ロシアンツイスト"],["シットアップ"]],
  "有酸素":["ランニング","ウォーキング","トレッドミル","エアロバイク","クロストレーナー","ステップマシン","水泳","縄跳び","サイクリング"]};
const PRESET_V=2;
function applyPresets(){
  if((S.settings.presetV||0)>=PRESET_V)return false;
  Object.entries(PRESETS).forEach(([part,list])=>list.forEach(it=>{
    const name=Array.isArray(it)?it[0]:it,bw=Array.isArray(it),cur=exOf(name);
    if(!cur)S.ex.push({name,part,...(bw?{bw:true}:{})});
    else{if(cur.part==="その他")cur.part=part;if(bw&&!cur.bw)cur.bw=true}
  }));
  S.settings.presetV=PRESET_V;return true;
}
const R_CHIPS=[1,3,5,8,10,12,15,20];
const LS="tsumitore.v1";
const FLAME='<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.6 1.3-4 2.5-5.2.3 1.8 1.2 2.7 2.2 3.2C11 8 11.2 4.6 12 2z"/></svg>';

const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const today=()=>iso(new Date());
const parse=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
const shift=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return iso(d)};
const md=s=>{const d=parse(s);return (d.getMonth()+1)+"/"+d.getDate()};
const ymd=s=>s.replace(/-/g,"/");
const diffDays=(a,b)=>Math.round((parse(b)-parse(a))/864e5);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=n=>{if(n==null||isNaN(n))return "-";const r=Math.round(n*100)/100;return r.toLocaleString("ja-JP",{maximumFractionDigits:2})};
const r2=n=>Math.round(n*100)/100;
// 1RM: 重量 × (1 + 回数/40)。筋トレMEMOの表示と同じ値になる式
const rmOf=(w,r)=>(w>0&&r>0)?(r===1?w:w*(1+r/40)):null;
const guess=name=>{for(const[p,re]of GUESS)if(re.test(name))return p;return "その他"};
const pick=a=>a[Math.floor(Math.random()*a.length)];

const S={days:{},ex:[],bw:{},settings:{goal:3,step:10},
  tab:"log",menu:"imp",date:today(),month:today().slice(0,7),gEx:null,gMetric:"rm",sel:null,bwEdit:false,
  imp:{busy:false,items:[],msg:"",failed:[],done:0,total:0,ctl:null,queue:[]},
  mode:"local",col:null,armed:null,note:""};


/* ================= 種目・体重 ================= */
const exOf=name=>S.ex.find(x=>x.name===name);
const partOf=name=>(exOf(name)||{}).part||"その他";
const isBW=name=>!!(exOf(name)||{}).bw;
const isCardio=name=>partOf(name)==="有酸素";
const pace=s=>{if(!(s.t>0&&s.d>0))return null;const v=s.t/s.d,m=Math.floor(v),sec=Math.round((v-m)*60);return sec===60?`${m+1}:00`:`${m}:${pad(sec)}`};
function setText(name,s){if(isCardio(name))return `${s.t??"-"}分${s.d!=null?" "+fmt(s.d)+"km":""}`;return wText(name,s)+"×"+(s.r??"-")}
function ensureEx(name,quiet){if(!exOf(name)){const o={name,part:guess(name)};if(BW_RE.test(name))o.bw=true;S.ex.push(o);if(!quiet)saveMeta()}}
function bwAt(date){const ks=Object.keys(S.bw).sort();if(!ks.length)return null;let best=null;for(const k of ks){if(k<=date)best=k;else break}return S.bw[best||ks[0]]}

/* ================= 計算 ================= */
// 1セットの中身。L=実際にかかった重さ（自重なら体重+加重）。mx=記録更新に使う重さ（補助・回数なしは対象外）
function info(name,date,s){
  if(isCardio(name))return{L:0,body:null,bw:false,rm:null,rmPR:null,vol:0,mx:null,cardio:true};
  const bw=isBW(name),body=bw?bwAt(date):null;
  const L=bw?((body||0)+(s.w||0)):(s.w||0);
  const ok=s.r>0&&L>0;
  const rm=ok?rmOf(L,s.r):null;
  return{L,body,bw,rm,rmPR:s.a?null:rm,vol:ok?L*s.r:0,mx:(s.r>0&&!s.a&&s.w>0)?s.w:null};
}
function exStats(e,date){let rm=0,vol=0,maxw=0,time=0,dist=0;e.sets.forEach(s=>{const f=info(e.name,date,s);if(f.rm>rm)rm=f.rm;vol+=f.vol;if(f.rm&&f.L>maxw)maxw=f.L;time+=s.t||0;dist+=s.d||0});return{rm,vol,maxw,sets:e.sets.length,time,dist:r2(dist)}}
function dayStats(list,date){let vol=0,sets=0;(list||[]).forEach(e=>e.sets.forEach(s=>{sets++;vol+=info(e.name,date,s).vol}));return{vol,sets}}
function prevOf(name,date){const ds=Object.keys(S.days).filter(d=>d<date).sort().reverse();for(const d of ds){const e=S.days[d].find(x=>x.name===name);if(e&&e.sets.length)return{date:d,e}}return null}
function series(name){return Object.keys(S.days).sort().map(d=>{const e=S.days[d].find(x=>x.name===name);return e&&e.sets.length?{d,...exStats(e,d)}:null}).filter(Boolean)}
function usedNames(){const c={};Object.values(S.days).forEach(l=>l.forEach(e=>{if(e.sets.length)c[e.name]=(c[e.name]||0)+1}));return c}
function pickDefaults(){const used=usedNames();if(S.gEx!=="__bw"&&(!S.gEx||!used[S.gEx])){const top=Object.entries(used).sort((a,b)=>b[1]-a[1])[0];S.gEx=top?top[0]:null}}

// その日より前の自己ベスト
function bestBefore(name,date){let rm=0,mx=0,has=false;
  Object.keys(S.days).forEach(d=>{if(d>=date)return;S.days[d].forEach(e=>{if(e.name!==name)return;e.sets.forEach(s=>{const f=info(name,d,s);
    if(f.rm||f.mx){has=true}if(f.rmPR>rm)rm=f.rmPR;if(f.mx>mx)mx=f.mx})})});
  return{rm,mx,has}}
// セットごとの更新判定（前日までのベストと、同じ日のそれより前のセットを超えたか）
function prFlags(e,date){const b=bestBefore(e.name,date);let rm=b.rm,mx=b.mx;const step=S.settings.step||10;
  return e.sets.map(s=>{const f=info(e.name,date,s),o={rm:false,max:false,oodai:null,prevRm:rm,prevMx:mx,f};
    if(!b.has)return o;
    if(f.rmPR&&f.rmPR>rm+1e-9){o.rm=true;rm=f.rmPR}
    if(f.mx&&f.mx>mx+1e-9){o.max=true;const t=Math.floor(f.mx/step+1e-9)*step;if(t>0&&t>mx+1e-9)o.oodai=t;mx=f.mx}
    return o})}
// 全履歴から殿堂の出来事を作る（1日1種目につき最高の1件）
function scanHistory(){
  const step=S.settings.step||10,run={},events=[],best={};
  Object.keys(S.days).sort().forEach(d=>S.days[d].forEach(e=>{
    const r=run[e.name]||(run[e.name]={rm:0,mx:0,has:false});
    let dayMx=0,dayRm=0,dayR=null,dayHas=false;
    e.sets.forEach(s=>{const f=info(e.name,d,s);if(f.rm||f.mx)dayHas=true;if(f.mx>dayMx){dayMx=f.mx;dayR=s.r}if(f.rmPR>dayRm)dayRm=f.rmPR});
    const B=best[e.name]||(best[e.name]={name:e.name,mx:0,mxDate:null,rm:0,rmDate:null,maxes:[],oodai:[]});
    if(r.has&&dayMx>r.mx+1e-9){
      events.push({kind:"max",name:e.name,date:d,value:dayMx,prev:r.mx,r:dayR});B.maxes.push({date:d,value:dayMx});
      const t=Math.floor(dayMx/step+1e-9)*step;
      if(t>0&&t>r.mx+1e-9){events.push({kind:"oodai",name:e.name,date:d,value:t,actual:dayMx,prev:r.mx,r:dayR});B.oodai.push({date:d,value:t})}
    }
    if(dayMx>r.mx){r.mx=dayMx}if(dayRm>r.rm){r.rm=dayRm}
    if(dayMx>B.mx){B.mx=dayMx;B.mxDate=d}if(dayRm>B.rm){B.rm=dayRm;B.rmDate=d}
    if(dayHas)r.has=true;
  }));
  return{events,best};
}

/* ================= 週の目標 ================= */
const weekStart=s=>{const d=parse(s);const k=(d.getDay()+6)%7;d.setDate(d.getDate()-k);return iso(d)};
function trainedDates(){return Object.keys(S.days).filter(d=>S.days[d].some(e=>e.sets.length)).sort()}
function weekInfo(){
  const goal=S.settings.goal||3,cnt={};trainedDates().forEach(d=>{const w=weekStart(d);cnt[w]=(cnt[w]||0)+1});
  const cur=weekStart(today()),now=cnt[cur]||0;
  let w=now>=goal?cur:shift(cur,-7),streak=0;
  while((cnt[w]||0)>=goal){streak++;w=shift(w,-7)}
  let bestStreak=0,run=0;const ks=Object.keys(cnt).sort();
  if(ks.length){let x=ks[0];while(x<=cur){if((cnt[x]||0)>=goal){run++;bestStreak=Math.max(bestStreak,run)}else if(x!==cur)run=0;x=shift(x,7)}}
  return{goal,now,streak,bestStreak,cnt};
}
function partSince(){
  const ref=today(),last={};
  Object.keys(S.days).forEach(d=>{if(d>ref)return;S.days[d].forEach(e=>{if(!e.sets.length)return;const p=partOf(e.name);if(!last[p]||d>last[p])last[p]=d})});
  return PARTS.filter(p=>last[p]).map(p=>({p,days:diffDays(last[p],ref)}));
}

/* ================= 画面 ================= */
const $main=document.getElementById("main");
function render(){
  document.getElementById("nav").innerHTML=TABS.map(([k,l,c])=>`<button data-a="tab" data-v="${k}" aria-current="${S.tab===k}" style="--tc:var(${c})"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${l}</button>`).join("");
  $main.innerHTML=({log:vLog,cal:vCal,graph:vGraph,hall:vHall,menu:vMenu})[S.tab]();
}
function wText(name,s){if(isBW(name))return s.w>0?`自重+${fmt(s.w)}`:"自重";return s.w==null?"-":fmt(s.w)}
function labels(e,j,flags,st){
  const f=flags[j],s=e.sets[j];let h="";
  if(f.f.rm!=null){const top=st.rm>0&&Math.abs(f.f.rm-st.rm)<1e-9;h+=`<span class="one${top?" best1":""}">1RM ${fmt(f.f.rm)}</span>`}
  if(s.a)h+=`<span class="pr as">補助</span>`;
  if(f.oodai)h+=`<span class="pr oodai">${fmt(f.oodai)}kg突破</span>`;
  else if(f.max)h+=`<span class="pr maxup">MAX更新</span>`;
  if(f.rm)h+=`<span class="pr rmup">RM更新</span>`;
  return h;
}
function editor(e,i,j){
  const s=e.sets[j],bw=isBW(e.name),body=bw?bwAt(S.date):null;
  return `<div class="ed" id="ed">
    <div class="ed-line"><label for="ed-w">${bw?"加重":"重量"}</label><input id="ed-w" data-f="ew" inputmode="decimal" value="${s.w??""}" placeholder="0"><span class="unit">kg</span>
      <span class="ed-note${bw&&!body?" warn":""}">${bw?(body?`体重 ${fmt(body)}kg ＋ 加重 = ${fmt(body+(s.w||0))}kg`:"体重が未入力です"):""}</span>${bw&&!body?`<button class="btn sm" data-a="bwopen" style="border-color:var(--accent);color:var(--accent)">体重を入れる</button>`:""}</div>
    <div class="steps">${W_STEPS.map(v=>`<button class="m" data-a="wstep" data-v="-${v}" aria-label="${v}キロ減らす">−${v}</button>`).join("")}${W_STEPS.map(v=>`<button class="p" data-a="wstep" data-v="${v}" aria-label="${v}キロ増やす">＋${v}</button>`).join("")}</div>
    <div class="ed-line"><label for="ed-r">回数</label><button class="btn" data-a="rstep" data-v="-1" aria-label="1回減らす">−1</button><input id="ed-r" data-f="er" inputmode="numeric" value="${s.r??""}" placeholder="-"><button class="btn" data-a="rstep" data-v="1" aria-label="1回増やす">＋1</button><span class="unit">回</span></div>
    <div class="reps">${R_CHIPS.map(v=>`<button data-a="rset" data-v="${v}" class="${s.r===v?"on":""}">${v}</button>`).join("")}</div>
    <div class="row"><button class="toggle" data-a="assist" aria-pressed="${!!s.a}">補助あり</button><span class="muted" style="flex:1">補助ありは記録更新に数えません</span><button class="btn pri" data-a="done">完了</button></div>
  </div>`;
}
function cardioEditor(e,i,j){
  const s=e.sets[j],pc=pace(s);
  return `<div class="ed" id="ed">
    <div class="ed-line"><label for="ed-t">時間</label><input id="ed-t" data-f="et" inputmode="numeric" value="${s.t??""}" placeholder="0"><span class="unit">分</span></div>
    <div class="steps">${T_STEPS.map(v=>`<button class="m" data-a="tstep" data-v="-${v}" aria-label="${v}分減らす">−${v}</button>`).join("")}${T_STEPS.map(v=>`<button class="p" data-a="tstep" data-v="${v}" aria-label="${v}分増やす">＋${v}</button>`).join("")}</div>
    <div class="ed-line"><label for="ed-d">距離</label><input id="ed-d" data-f="edist" inputmode="decimal" value="${s.d??""}" placeholder="-"><span class="unit">km</span><span class="ed-note">${pc?`ペース ${pc} /km`:"距離は空欄でもOK"}</span></div>
    <div class="steps">${D_STEPS.map(v=>`<button class="m" data-a="dstep" data-v="-${v}" aria-label="${v}キロ減らす">−${v}</button>`).join("")}${D_STEPS.map(v=>`<button class="p" data-a="dstep" data-v="${v}" aria-label="${v}キロ増やす">＋${v}</button>`).join("")}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" data-a="done">完了</button></div>
  </div>`;
}
function cardioRow(e,i,j,on){const s=e.sets[j],pc=pace(s);
  return `<div class="set${on?" on":""}" data-a="sel" data-i="${i}" data-j="${j}" role="button" tabindex="0" aria-label="${j+1}本目を編集">
      <span class="n">${j+1}</span>
      <span class="v"><b>${s.t??"-"}</b><small>分</small></span><span>/</span>
      <span class="v"><b>${s.d!=null?fmt(s.d):"-"}</b><small>km</small></span>
      <span class="ow">${pc?`<span class="one">${pc} /km</span>`:""}</span>
      <button class="x" data-a="delset" data-i="${i}" data-j="${j}" aria-label="${j+1}本目を消す">×</button></div>${on?cardioEditor(e,i,j):""}`}
function exCard(e,i){
  if(isCardio(e.name)){
    const st=exStats(e,S.date),pv=prevOf(e.name,S.date);
    return `<section class="ex" style="--pc:var(--p-cardio)">
    <header><span class="chip">有酸素</span><h3>${esc(e.name)}</h3><span class="rm"><b>${st.time}</b>分${st.dist?` <b>${fmt(st.dist)}</b>km`:""}</span></header>
    <div class="prev"><span>${pv?`前回 ${md(pv.date)}　${pv.e.sets.map(s=>setText(e.name,s)).join("、")}`:"前回の記録なし"}</span>${pv?`<button class="btn sm" data-a="copyprev" data-i="${i}">前回をコピー</button>`:""}</div>
    <div class="sets">${e.sets.map((s,j)=>cardioRow(e,i,j,S.sel&&S.sel.i===i&&S.sel.j===j)).join("")}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm grad" data-a="addset" data-i="${i}">＋ 追加</button>
    <button class="btn sm" data-a="delex" data-i="${i}">${S.armed==="ex"+i?"もう一度押すと外す":"この種目を外す"}</button></div>
  </section>`;
  }
  const st=exStats(e,S.date),p=partOf(e.name),pv=prevOf(e.name,S.date),flags=prFlags(e,S.date),bw=isBW(e.name);
  const rows=e.sets.map((s,j)=>{const on=S.sel&&S.sel.i===i&&S.sel.j===j;
    return `<div class="set${on?" on":""}" data-a="sel" data-i="${i}" data-j="${j}" role="button" tabindex="0" aria-label="${j+1}セット目を編集">
      <span class="n">${j+1}</span>
      <span class="v"><b>${wText(e.name,s)}</b><small>${bw&&!(s.w>0)?"":"kg"}</small></span><span>×</span>
      <span class="v"><b>${s.r??"-"}</b><small>回</small></span>
      <span class="ow">${labels(e,j,flags,st)}</span>
      <button class="x" data-a="delset" data-i="${i}" data-j="${j}" aria-label="${j+1}セット目を消す">×</button></div>${on?editor(e,i,j):""}`}).join("");
  const pvTxt=pv?`前回 ${md(pv.date)}　${pv.e.sets.map(s=>setText(e.name,s)).join("、")}`:"前回の記録なし";
  return `<section class="ex" style="--pc:var(${PVAR[p]})">
    <header><span class="chip">${esc(p)}</span>${bw?`<span class="chip bw">自重</span>`:""}<h3>${esc(e.name)}</h3><span class="rm">RM <b>${st.rm?fmt(st.rm):"-"}</b> kg</span></header>
    <div class="prev"><span>${esc(pvTxt)}</span>${pv?`<button class="btn sm" data-a="copyprev" data-i="${i}">前回をコピー</button>`:""}</div>
    <div class="sets">${rows}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm grad" data-a="addset" data-i="${i}">＋ セット</button>
    <button class="btn sm" data-a="delex" data-i="${i}">${S.armed==="ex"+i?"もう一度押すと外す":"この種目を外す"}</button></div>
  </section>`;
}
function monthBanner(){
  const t=today(),d=parse(t),last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  let ym=null;
  if(d.getDate()>=last-2)ym=t.slice(0,7);
  else if(d.getDate()<=5){const p=new Date(d.getFullYear(),d.getMonth()-1,1);ym=iso(p).slice(0,7)}
  if(!ym||!trainedDates().some(x=>x.startsWith(ym)))return "";
  return `<div class="banner"><b>${Number(ym.slice(5))}月の振り返りカードができました</b><button class="btn sm" data-a="monthcard" data-v="${ym}">見る</button></div>`;
}
function vLog(){
  const list=S.days[S.date]||[],st=dayStats(list,S.date),wk=weekInfo(),since=partSince(),body=S.bw[S.date],bodyAt=bwAt(S.date);
  const opts=PARTS.map(p=>{const xs=S.ex.filter(e=>e.part===p&&!list.find(l=>l.name===e.name));return xs.length?`<optgroup label="${p}">${xs.map(e=>`<option>${esc(e.name)}</option>`).join("")}</optgroup>`:""}).join("");
  const pips=Array.from({length:Math.max(wk.goal,wk.now)},(_,k)=>`<i class="pip${k<wk.now?" on":""}"></i>`).join("");
  return `${monthBanner()}${loginHint()}
  <div class="datebar"><button class="btn" data-a="day" data-v="-1" aria-label="前の日">‹</button>
    <input class="field num" type="date" id="date-pick" value="${S.date}" aria-label="日付">
    <button class="btn" data-a="day" data-v="1" aria-label="次の日">›</button>
    <button class="btn" data-a="today">今日</button></div>
  <div class="week${wk.now>=wk.goal?" done":""}"><div><div class="lbl">今週の目標 ${wk.goal}回</div>
    <div class="cnt">${wk.now}<small> / ${wk.goal}回</small></div><div class="pips">${pips}</div>
    <div class="lbl" style="margin-top:4px">${wk.now>=wk.goal?"今週の目標達成！":`あと${wk.goal-wk.now}回で達成`}</div></div>
    <div class="streak">${FLAME}<b>${wk.streak}</b><span>週連続</span></div></div>
  ${since.length?`<div class="since" aria-label="部位ごとの前回から">${since.map(x=>`<span class="sc${x.days>=7?" long":""}" style="--pc:var(${PVAR[x.p]})"><i class="dot"></i>${x.p} <b>${x.days===0?"今日":x.days+"日前"}</b></span>`).join("")}</div>`:""}
  <div class="tiles"><div class="tile t1"><b>${fmt(st.vol)}</b><span>総負荷量 kg</span></div><div class="tile t2"><b>${st.sets}</b><span>セット</span></div>
    <div class="tile t3"><b>${list.length}</b><span>種目</span></div>
    <button class="tile t4" data-a="bwopen" aria-label="体重を入力"><b>${body!=null?fmt(body):"--"}</b><span>体重 kg ${body==null&&bodyAt!=null?"(未)":"✎"}</span></button></div>
  ${S.bwEdit?`<div class="card" id="bwcard" style="border-left:4px solid var(--p-abs)"><h2>${md(S.date)}の体重</h2>${bwEditor(S.date,false)}
    <p class="muted" style="margin:8px 0 0">自重種目の重さは「体重＋加重」で計算します。入れていない日は直前に入れた体重を使います。</p></div>`
    :(!Object.keys(S.bw).length&&list.some(e=>isBW(e.name))?`<div class="banner" style="border-left-color:var(--p-abs)"><b>体重を入れると、自重種目の総負荷量とRMが計算されます</b><button class="btn sm" data-a="bwopen">体重を入れる</button></div>`:"")}
  ${list.length?list.map(exCard).join(""):`<p class="empty">この日の記録はまだありません。下から種目を足してください。</p>`}
  <div class="card"><h2>種目を足す</h2>
    <div class="row"><select class="field" id="add-ex" style="flex:1" aria-label="登録済みの種目"><option value="">登録済みから選ぶ</option>${opts}</select>
    <button class="btn pri" data-a="addex">追加</button></div>
    <div class="row" style="margin-top:8px"><input class="field" id="add-new" placeholder="新しい種目名" style="flex:1" aria-label="新しい種目名">
    <select class="field" id="add-part" aria-label="部位"><option value="">部位は自動</option>${PARTS.map(p=>`<option>${p}</option>`).join("")}</select>
    <label class="muted"><input type="checkbox" id="add-bw"> 自重</label>
    <button class="btn" data-a="addnew">登録して追加</button></div>
  </div>`;
}
function calBg(parts){if(parts.length===1)return `var(${PVAR[parts[0]]})`;const n=parts.length;return "linear-gradient(135deg,"+parts.map((p,k)=>`var(${PVAR[p]}) ${k*100/n}% ${(k+1)*100/n}%`).join(",")+")"}
function vCal(){
  const[y,m]=S.month.split("-").map(Number),first=new Date(y,m-1,1),n=new Date(y,m,0).getDate(),t=today(),wk=weekInfo();
  let cells="月火水木金土日".split("").map((w,k)=>`<span class="wd${k===5?" sat":k===6?" sun":""}">${w}</span>`).join("");
  for(let i=0;i<(first.getDay()+6)%7;i++)cells+=`<button class="blank" tabindex="-1" aria-hidden="true"></button>`;
  let days=0,vol=0,sets=0;
  for(let d=1;d<=n;d++){const k=S.month+"-"+pad(d),list=(S.days[k]||[]).filter(e=>e.sets.length);let dots="",style="";
    if(list.length){days++;const st=dayStats(list,k);vol+=st.vol;sets+=st.sets;
      const ps=[...new Set(list.map(e=>partOf(e.name)))];style=`style="background:${calBg(ps)}"`;
      dots=ps.map(p=>`<i class="dot" style="--pc:var(${PVAR[p]})"></i>`).join("")}
    cells+=`<button data-a="goto" data-v="${k}" class="${list.length?"on":""}${k===t?" today":""}" ${style} aria-label="${m}月${d}日${list.length?" 記録あり":""}"><span class="d">${d}</span><span class="dots">${dots}</span></button>`}
  return `<div class="card"><div class="cal-head"><button class="btn" data-a="mon" data-v="-1" aria-label="前の月">‹</button><strong>${y}年 ${m}月</strong><button class="btn" data-a="mon" data-v="1" aria-label="次の月">›</button></div>
    <div class="cal">${cells}</div>
    <div class="legend">${PARTS.map(p=>`<span><i class="dot" style="--pc:var(${PVAR[p]})"></i>${p}</span>`).join("")}</div></div>
  <div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile t1"><b>${days}</b><span>日トレーニング</span></div><div class="tile t2"><b>${fmt(vol/1000)}t</b><span>総負荷量</span></div><div class="tile t3"><b>${wk.streak}</b><span>週連続で目標達成</span></div></div>
  <button class="btn grad" data-a="monthcard" data-v="${S.month}" style="padding:12px" ${days?"":"disabled"}>${m}月の振り返りカードを作る</button>
  <p class="muted">日付を押すと、その日の記録を開きます。</p>`;
}
function niceStep(range){const raw=range/4||1,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p}
function chart(pts,pvar){
  const W=360,H=230,L=40,R=50,T=16,B=28;
  const vs=pts.map(p=>p.v);let mn=Math.min(...vs),mx=Math.max(...vs);
  if(mn===mx){mn=mn-1;mx=mx+1}
  const step=niceStep(mx-mn),lo=Math.max(0,Math.floor(mn/step)*step),hi=Math.ceil(mx/step)*step;
  const t0=parse(pts[0].d).getTime(),t1=parse(pts[pts.length-1].d).getTime();
  const X=d=>t1===t0?(L+(W-R))/2:L+(parse(d).getTime()-t0)/(t1-t0)*(W-L-R);
  const Y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  let g="";for(let v=lo;v<=hi+step/1000;v+=step)g+=`<line class="grid" x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}"/><text x="${L-6}" y="${Y(v)+4}" text-anchor="end">${fmt(v)}</text>`;
  const xy=pts.map(p=>[X(p.d),Y(p.v)]);
  const line=xy.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  const area=line+` L${xy[xy.length-1][0].toFixed(1)} ${H-B} L${xy[0][0].toFixed(1)} ${H-B} Z`;
  const last=xy[xy.length-1],lp=pts[pts.length-1];
  const xl=pts.length>1?`<text x="${xy[0][0]}" y="${H-8}" text-anchor="start">${md(pts[0].d)}</text><text x="${last[0]}" y="${H-8}" text-anchor="end">${md(lp.d)}</text>`:`<text x="${last[0]}" y="${H-8}" text-anchor="middle">${md(lp.d)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="推移グラフ" style="--pc:var(${pvar})">${g}
    ${pts.length>1?`<path class="ar" d="${area}"/><path class="ln" d="${line}"/>`:""}
    ${xy.slice(0,-1).map(p=>`<circle class="pt" cx="${p[0]}" cy="${p[1]}" r="4"/>`).join("")}
    <circle class="last" cx="${last[0]}" cy="${last[1]}" r="6"/>
    <text class="lastv" x="${last[0]+9}" y="${last[1]+5}">${fmt(lp.v)}</text>${xl}</svg>`;
}
function vGraph(){
  const used=usedNames(),names=Object.keys(used),hasBW=Object.keys(S.bw).length>0;
  if(!names.length&&!hasBW)return `<p class="empty">記録が入るとグラフが出ます。</p>`;
  if(S.gEx!=="__bw"&&(!S.gEx||!used[S.gEx]))pickDefaults();
  if(!S.gEx&&hasBW)S.gEx="__bw";
  const opts=(hasBW?`<option value="__bw"${S.gEx==="__bw"?" selected":""}>体重</option>`:"")+PARTS.map(p=>{const xs=names.filter(n=>partOf(n)===p);return xs.length?`<optgroup label="${p}">${xs.map(n=>`<option${n===S.gEx?" selected":""}>${esc(n)}</option>`).join("")}</optgroup>`:""}).join("");
  if(S.gEx==="__bw"){
    const pts=Object.keys(S.bw).sort().map(d=>({d,v:S.bw[d]}));
    return `<select class="field" id="g-ex" aria-label="種目">${opts}</select>
    <div class="card"><h2>体重（kg）</h2>${chart(pts,"--p-abs")}<p class="muted" style="margin:6px 0 0">${pts.length}回分。最新 ${fmt(pts[pts.length-1].v)}kg</p></div>`;
  }
  if(isCardio(S.gEx)){
    if(!CMETRICS.find(x=>x[0]===S.gMetric))S.gMetric="time";
    const m=CMETRICS.find(x=>x[0]===S.gMetric),ser=series(S.gEx),pts=ser.map(s=>({d:s.d,v:s[m[0]]}));
    return `<select class="field" id="g-ex" aria-label="種目">${opts}</select>
    <div class="seg">${CMETRICS.map(x=>`<button data-a="metric" data-v="${x[0]}" aria-pressed="${x[0]===S.gMetric}">${x[1]}</button>`).join("")}</div>
    <div class="card"><h2>${esc(S.gEx)}　${m[1]}（${m[2]}）</h2>${chart(pts,"--p-cardio")}<p class="muted" style="margin:6px 0 0">${pts.length}回分。合計 ${fmt(pts.reduce((a,p)=>a+p.v,0))} ${m[2]}</p></div>
    <div class="card"><table><thead><tr><th>日付</th><th class="r">時間</th><th class="r">距離</th><th class="r">ペース</th></tr></thead><tbody>
    ${ser.slice().reverse().slice(0,12).map(s=>`<tr><td>${md(s.d)}</td><td class="r">${s.time}分</td><td class="r">${s.dist?fmt(s.dist)+"km":"-"}</td><td class="r">${pace({t:s.time,d:s.dist})||"-"}</td></tr>`).join("")}
    </tbody></table></div>`;
  }
  if(!METRICS.find(x=>x[0]===S.gMetric))S.gMetric="rm";
  const m=METRICS.find(x=>x[0]===S.gMetric),ser=series(S.gEx),pts=ser.map(s=>({d:s.d,v:s[m[0]]}));
  const best=Math.max(...pts.map(p=>p.v));
  return `<select class="field" id="g-ex" aria-label="種目">${opts}</select>
  <div class="seg">${METRICS.map(x=>`<button data-a="metric" data-v="${x[0]}" aria-pressed="${x[0]===S.gMetric}">${x[1]}</button>`).join("")}</div>
  <div class="card"><h2>${esc(S.gEx)}　${m[1]}（${m[2]}）</h2>${chart(pts,PVAR[partOf(S.gEx)])}
    <p class="muted" style="margin:6px 0 0">${pts.length}回分。自己ベスト ${fmt(best)} ${m[2]}${pts.length<3?"。記録が増えるほど線が育ちます。":""}</p></div>
  <div class="card"><table><thead><tr><th>日付</th><th class="r">RM</th><th class="r">負荷量</th><th class="r">セット</th><th class="r">最大kg</th></tr></thead><tbody>
    ${ser.slice().reverse().slice(0,12).map(s=>`<tr><td>${md(s.d)}</td><td class="r">${fmt(s.rm)}</td><td class="r">${fmt(s.vol)}</td><td class="r">${s.sets}</td><td class="r">${fmt(s.maxw)}</td></tr>`).join("")}
  </tbody></table></div>`;
}
let HALL=[];
function vHall(){
  const{events,best}=scanHistory(),step=S.settings.step||10;
  const oodai=events.filter(e=>e.kind==="oodai").reverse(),maxes=events.filter(e=>e.kind==="max");
  HALL=events.slice();
  const bests=Object.values(best).filter(b=>b.mx||b.rm).sort((a,b)=>PARTS.indexOf(partOf(a.name))-PARTS.indexOf(partOf(b.name))||b.mx-a.mx);
  return `<div class="hall-top"><div class="tile t2"><b>${oodai.length}</b><span>大台突破</span></div><div class="tile t1"><b>${maxes.length}</b><span>MAX更新</span></div><div class="tile t3"><b>${bests.length}</b><span>記録中の種目</span></div></div>
  <div class="card"><h2>大台突破の殿堂（${step}kgごと）</h2>
    ${oodai.length?oodai.map(ev=>`<div class="medal" style="margin-bottom:8px"><div class="coin"><b>${fmt(ev.value)}</b><small>kg</small></div>
      <div class="info"><strong>${esc(ev.name)}</strong><span>${ymd(ev.date)}　${fmt(ev.actual)}kg × ${ev.r}回（前 ${fmt(ev.prev)}kg）</span></div>
      <button class="btn sm" data-a="shareev" data-v="${HALL.indexOf(ev)}">画像</button></div>`).join(""):`<p class="empty">まだありません。${step}kgの区切りを初めて越えた日がここに刻まれます。</p>`}
    <p class="muted" style="margin:0">区切りの幅は「メニュー → 目標・体重」で変えられます。最初の記録の日は比べる相手がいないので数えません。</p></div>
  <h2 style="margin:4px 0 0">種目ごとの自己ベスト</h2>
  ${bests.length?bests.map(b=>{const p=partOf(b.name);return `<section class="card best" style="--pc:var(${PVAR[p]})">
    <div class="row"><span class="chip">${p}</span><strong style="flex:1">${esc(b.name)}</strong></div>
    <div class="nums"><div>MAX（実重量）<b>${b.mx?fmt(b.mx)+"kg":"-"}</b>${b.mxDate?md(b.mxDate):""}</div><div>推定1RM<b>${b.rm?fmt(b.rm)+"kg":"-"}</b>${b.rmDate?md(b.rmDate):""}</div></div>
    ${b.oodai.length?`<div class="badges">${b.oodai.map(o=>`<span class="badge" title="${ymd(o.date)}">${fmt(o.value)}</span>`).join("")}</div>`:""}
    ${b.maxes.length?`<div class="hist">${b.maxes.slice(-4).reverse().map(x=>{const ev=events.find(e=>e.kind==="max"&&e.name===b.name&&e.date===x.date);return `<div><span>${ymd(x.date)}</span><b>${fmt(x.value)}kg</b><span>MAX更新</span><button class="btn sm" data-a="shareev" data-v="${HALL.indexOf(ev)}">画像</button></div>`}).join("")}</div>`:""}
  </section>`}).join(""):`<p class="empty">記録が入ると、ここに自己ベストが並びます。</p>`}`;
}
function vMenu(){
  return `<div class="seg">${MENU.map(([k,l])=>`<button data-a="menu" data-v="${k}" aria-pressed="${S.menu===k}">${l}</button>`).join("")}</div>`+({imp:vImp,ex:vEx,goal:vGoal,data:vData})[S.menu]();
}
function setWarn(s){if(!(s.w>0))return true;if(s.r!=null&&!(s.r>0))return true;if(s.rm!=null&&s.r>0){const c=rmOf(s.w,s.r);if(Math.abs(c-s.rm)>0.02)return true}return false}
function vImp(){
  const I=S.imp,dated=I.items.filter(d=>d.date).length;
  const items=I.items.map((d,k)=>{const warn=d.exercises.reduce((a,e)=>a+e.sets.filter(setWarn).length,0);
    return `<section class="card imp-day"><div class="row"><input class="field num" type="date" id="imp-date-${k}" data-f="impdate" data-k="${k}" value="${d.date||""}" aria-label="日付">
      ${S.days[d.date]?`<span class="muted">記録あり。同じ種目は置き換え</span>`:""}${!d.date?`<span class="bad">日付を入れてください</span>`:""}</div>
      <ul>${d.exercises.map(e=>`<li><strong>${esc(e.name)}</strong>　${e.sets.map(s=>`<span class="${setWarn(s)?"bad":""}">${fmt(s.w)}×${s.r??"-"}</span>`).join("、")}</li>`).join("")}</ul>
      ${warn?`<p class="bad" style="font-size:13px">赤字の${warn}セットは読み取りが怪しいです。保存後に記録画面で直せます。</p>`:`<p class="muted">画面の1RM表示と計算が全セット一致しました。</p>`}
      <div class="row"><button class="btn pri sm" data-a="impsave" data-k="${k}" ${d.date?"":"disabled"}>この日を保存</button><button class="btn sm" data-a="impdrop" data-k="${k}">捨てる</button></div></section>`}).join("");
  const pct=I.total?Math.round(I.done/I.total*100):0;
  const aiOn=CFG.AI_ENABLED!==false,canAI=aiOn&&CLOUD_OK&&!!A.user,q=A.quota;
  return `<div class="card"><h2>スクショから記録を取り込む</h2>
    <p class="muted">筋トレMEMOの「WorkOut」共有画像を、まとめて選べます。AIが日付・種目・重量・回数を読み取り、同じ日の画像は1日にまとめます。保存する前に中身を確認できます。</p>
    ${!aiOn?`<p class="msg">スクショのAI読み取りは、いま準備中です。記録は、記録画面から入力できます。以前のバックアップファイルは、「保存・ログイン」から戻せます。</p>`:canAI?"":`<p class="msg">AIでの読み取りは、ログインしている人だけが使えます（1人あたり月${q?q.limit:50}枚まで）。${CLOUD_OK?`<button class="btn sm" data-a="gomenu" data-v="data" style="margin-left:6px">ログインする</button>`:"この環境ではログインが設定されていません。"}</p>`}
    ${I.busy||!canAI?"":`<label class="drop" id="drop"><input type="file" id="imp-files" accept="image/png,image/jpeg,image/webp" multiple data-f="impadd">
      <b>＋ 画像を追加</b><span>何回でも追加できます。選んだ画像は下にたまっていきます</span></label>`}
    ${I.queue.length&&!I.busy?`<div class="thumbs">${I.queue.map((f,k)=>`<div class="th"><img src="${thumbURL(f)}" alt="${k+1}枚目"><button data-a="impunq" data-k="${k}" aria-label="${k+1}枚目を外す">×</button></div>`).join("")}</div>
      <div class="row"><span class="muted" style="flex:1">${I.queue.length}枚 選択中</span><button class="btn sm" data-a="impclear">全部外す</button><button class="btn pri" data-a="impread">${I.queue.length}枚を読み取る</button></div>`:""}
    ${I.busy?`<div class="row"><span class="muted" style="flex:1">読み取り中</span><button class="btn" data-a="impstop">止める</button></div>`:""}
    ${I.total?`<div style="margin-top:10px"><div class="bar"><i style="width:${pct}%"></i></div><p class="muted" style="margin:4px 0 0">${I.done} / ${I.total}枚${I.busy?"　読み取り中（1枚あたり数十秒かかることがあります）":""}</p></div>`:""}
    ${I.msg?`<p class="msg" style="margin-top:8px">${esc(I.msg)}</p>`:""}
    ${!I.busy&&I.failed.length?`<button class="btn" data-a="impretry" style="margin-top:8px">読み取れなかった${I.failed.length}枚をやり直す</button>`:""}
    ${!aiOn?"":`<p class="muted" style="margin-top:8px">${q?`今月は ${q.used} / ${q.limit}枚 使いました（毎月1日にもどります）。`:""}選んだ画像は、読み取りのためだけに縮小して外部のAIサービス（Anthropic）へ送られます。このアプリには画像を保存しません。</p>`}</div>
  ${I.items.length>1&&dated?`<button class="btn grad" data-a="impall" style="padding:12px">日付が入っている${dated}日分をまとめて保存</button>`:""}
  ${items}`;
}
function vEx(){
  const used=usedNames();
  const groups=PARTS.map(p=>{const xs=S.ex.filter(e=>e.part===p);if(!xs.length)return "";
    return `<h2 style="margin-top:12px;color:var(${PVAR[p]})">${p}（${xs.length}）</h2>`+xs.map(e=>{const i=S.ex.indexOf(e);
      return `<div class="exrow"><span class="nm">${esc(e.name)}<span class="muted">　${used[e.name]||0}日</span></span>
      <label class="muted"><input type="checkbox" data-f="exbw" data-i="${i}" ${e.bw?"checked":""}> 自重</label>
      <select class="field" data-f="part" data-i="${i}" aria-label="${esc(e.name)}の部位">${PARTS.map(q=>`<option${q===e.part?" selected":""}>${q}</option>`).join("")}</select>
      <button class="x" data-a="rmex" data-i="${i}" aria-label="${esc(e.name)}を一覧から消す">×</button></div>`}).join("")}).join("");
  return `<div class="card"><h2>種目一覧　${S.ex.length}種目・上限なし</h2>
    <div class="row"><input class="field" id="new-ex" placeholder="新しい種目名" style="flex:1" aria-label="新しい種目名">
    <select class="field" id="new-part" aria-label="部位"><option value="">部位は自動</option>${PARTS.map(p=>`<option>${p}</option>`).join("")}</select>
    <label class="muted"><input type="checkbox" id="new-bw"> 自重</label>
    <button class="btn pri" data-a="newex">登録</button></div>
    ${groups||`<p class="empty">まだ種目がありません。</p>`}
    <p class="muted" style="margin-top:8px">「自重」にした種目は、その日の体重＋加重で総負荷量とRMを計算します。×は一覧から消すだけで、過去の記録は残ります。</p></div>`;
}
// 体重の入力欄（記録画面とメニューの両方で使う）
function bwEditor(date,withDate){
  const v=S.bw[date]??bwAt(date)??"";
  return `<div class="bwed">
    ${withDate?`<div class="ed-line"><label for="bw-date">日付</label><input class="field num" type="date" id="bw-date" data-f="bwdate" value="${date}" style="width:auto;font-size:18px"></div>`:""}
    <div class="ed-line"><label for="bw-in">体重</label><input id="bw-in" inputmode="decimal" value="${v}" placeholder="例 72.5"><span class="unit">kg</span></div>
    <div class="steps">${[-1,-0.5,-0.1].map(x=>`<button class="m" data-a="bwstep" data-v="${x}">${x}</button>`).join("")}<span></span>${[0.1,0.5,1].map(x=>`<button class="p" data-a="bwstep" data-v="${x}" style="--pc:var(--p-abs)">+${x}</button>`).join("")}<button class="btn pri" data-a="bwsave" data-v="${date}">保存</button></div>
  </div>`;
}
function vGoal(){
  const g=S.settings.goal||3,step=S.settings.step||10,bwList=Object.keys(S.bw).sort().reverse().slice(0,8),bd=S.bwDate||today();
  return `<div class="card" style="border-left:4px solid var(--p-abs)"><h2>体重を記録</h2>${bwEditor(bd,true)}
    <p class="muted" style="margin:8px 0 0">自重の種目（懸垂・ディップスなど）は「その日の体重＋加重」で計算します。入れていない日は、直前に入れた体重を使います。${Object.keys(S.bw).length?"":"<b style=\"color:var(--accent)\">まだ1回も入っていません。</b>"}</p></div>
  <div class="card"><h2>週の目標回数</h2><div class="stepper"><button class="btn" data-a="goal" data-v="-1" aria-label="1回減らす">−</button><b>${g}</b><span>回 / 週（月曜はじまり）</span><button class="btn" data-a="goal" data-v="1" aria-label="1回増やす">＋</button></div></div>
  <div class="card"><h2>大台の区切り</h2><div class="seg">${[5,10,20].map(v=>`<button data-a="step" data-v="${v}" aria-pressed="${step===v}">${v}kgごと</button>`).join("")}</div>
    <p class="muted" style="margin:8px 0 0">MAXがこの区切りを初めて越えると、特別な演出が出て殿堂に残ります。</p></div>
  <div class="card"><h2>音</h2><div class="row"><button class="toggle" data-a="sound" aria-pressed="${soundOn()}" style="flex:none">${soundOn()?"音あり":"音なし"}</button><span class="muted" style="flex:1">記録更新と目標達成の時だけ、短い音が鳴ります。マナーモード中は鳴らないことがあります。</span></div>
    ${soundOn()?`<div class="row" style="margin-top:10px"><span class="muted">試しに鳴らす</span><button class="btn sm" data-a="soundtest" data-v="rm">RM更新</button><button class="btn sm" data-a="soundtest" data-v="max">MAX更新</button><button class="btn sm" data-a="soundtest" data-v="oodai">大台突破</button><button class="btn sm" data-a="soundtest" data-v="goal">週の目標</button></div>`:""}</div>
  <div class="card"><h2>体重の記録</h2>${bwList.length?`<table><tbody>${bwList.map(d=>`<tr><td>${ymd(d)}</td><td class="r">${fmt(S.bw[d])} kg</td><td style="width:2em"><button class="x" data-a="bwdel" data-v="${d}" aria-label="${ymd(d)}の体重を消す">×</button></td></tr>`).join("")}</tbody></table>`:`<p class="empty">記録画面の「体重」から入れられます。</p>`}</div>`;
}
function vData(){
  const cloud=!!A.user;
  return vAccount()+`<div class="card"><h2>保存のしくみ</h2>
    <p>${cloud?"記録は入力したその場で端末に保存され、同時にあなたのアカウントへ自動保存されます。保存ボタンはありません。":"今はこの端末のブラウザだけに保存しています。ブラウザのデータを消すと記録も消えるので、ときどき書き出すか、ログインしてください。"}</p>
    <p class="muted" style="margin:0">${trainedDates().length}日分の記録、${S.ex.length}種目、体重${Object.keys(S.bw).length}件</p></div>
  <div class="card"><h2>バックアップ</h2>
    <p class="muted">全記録を1つのファイルにして手元に残せます。以前のバックアップファイルもそのまま戻せます。</p>
    <div class="row"><button class="btn pri" data-a="export">ファイルに書き出す</button><button class="btn" data-a="copy">テキストでコピー</button></div>
    <div class="row" style="margin-top:8px"><input class="field" type="file" id="restore-file" accept=".json,application/json" style="flex:1" aria-label="バックアップファイル"><button class="btn" data-a="restore">ファイルから戻す</button></div>
    ${S.note?`<p class="msg" style="margin-top:8px">${esc(S.note)}</p>`:""}</div>
  <div class="card"><h2>アプリとして使う</h2>
    <p class="muted" style="margin:0">iPhoneはSafariの共有ボタンから「ホーム画面に追加」。Androidはブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」。ホーム画面から開くと全画面で動き、電波がなくても記録できます。</p></div>
  ${vDelete()}
  <p class="muted" style="text-align:center"><a href="/privacy" style="color:var(--muted)">プライバシーポリシー</a></p>`;
}

/* ================= 取り込み ================= */
// AIへの指示文はサーバー側（functions/_lib/shared.js）にあります。ここでは画像だけを送ります
const AI_MAX_EDGE=1568;
// 画像を縮小してJPEGにする（通信量と費用を抑える。AI側もこの大きさに縮めて読むので精度は変わらない）
async function shrinkImage(file){
  let bmp;
  try{bmp=await createImageBitmap(file)}catch(e){const err=new Error("decode");err.code="bad_image";throw err}
  const k=Math.min(1,AI_MAX_EDGE/Math.max(bmp.width,bmp.height)),w=Math.round(bmp.width*k),h=Math.round(bmp.height*k);
  const[c,x]=canvas(w,h);x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(bmp,0,0,w,h);if(bmp.close)bmp.close();
  return new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(Object.assign(new Error("encode"),{code:"bad_image"})),"image/jpeg",0.9));
}
async function aiRead(file,signal){
  const token=await accessToken();
  if(!token){const e=new Error("login");e.code="not_granted";throw e}
  const blob=await shrinkImage(file);
  let res;
  try{res=await fetch("/api/read-image",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"image/jpeg"},body:blob,signal})}
  catch(e){const err=new Error("net");err.code=e&&e.name==="AbortError"?"cancelled":"network";throw err}
  let body=null;try{body=await res.json()}catch(e){}
  if(res.ok){if(body&&body.quota){A.quota=body.quota}return body}
  const err=new Error("api "+res.status);
  err.code=res.status===401?"not_granted":(res.status===429&&body&&body.error==="quota")?"rate_limited":"failed";
  if(body&&body.quota)A.quota=body.quota;
  throw err;
}
function cleanDays(v){
  const out=[];(v&&Array.isArray(v.days)?v.days:[]).forEach(d=>{
    const date=typeof d.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)?d.date:"";
    const exercises=(Array.isArray(d.exercises)?d.exercises:[]).map(e=>({name:String(e.name||"").trim().slice(0,60),
      sets:(Array.isArray(e.sets)?e.sets:[]).map(s=>({w:Number(s.w),r:s.r==null?null:Math.round(Number(s.r)),rm:s.rm==null?null:Number(s.rm)})).filter(s=>!isNaN(s.w))})).filter(e=>e.name&&e.sets.length);
    if(exercises.length)out.push({date,exercises})});
  return out;
}
// 同じ日付の画像は1日にまとめる。まったく同じ種目・セットが重なったら1つにする
function addItems(ds){
  ds.forEach(d=>{
    const t=d.date?S.imp.items.find(x=>x.date===d.date):null;
    if(!t){S.imp.items.push(d);return}
    d.exercises.forEach(e=>{const ex=t.exercises.find(x=>x.name===e.name);
      if(!ex)t.exercises.push(e);
      else if(JSON.stringify(ex.sets)!==JSON.stringify(e.sets))ex.sets.push(...e.sets)});
  });
  S.imp.items.sort((a,b)=>(a.date||"9")<(b.date||"9")?-1:1);
}
async function readImages(files){
  const I=S.imp;
  if(!files.length){I.msg="先に画像を選んでください。";return render()}
  if(!CLOUD_OK||!A.user){I.msg="AIでの読み取りは、ログインしてから使えます。「メニュー → 保存・ログイン」からログインしてください。";I.queue.push(...files);return render()}
  if(!navigator.onLine){I.msg="オフラインです。つながってからもう一度試してください。";I.queue.push(...files);return render()}
  I.busy=true;I.failed=[];I.total=files.length;I.done=0;I.msg="";I.ctl=new AbortController();
  const q=files.slice();let found=0,stop=null;render();
  const worker=async()=>{
    while(q.length&&!stop){
      const f=q.shift();
      try{const v=await aiRead(f,I.ctl.signal);const ds=cleanDays(v);found+=ds.length;addItems(ds)}
      catch(e){const c=e&&e.code;
        if(c==="not_granted"){stop="denied";I.failed.push(f,...q.splice(0))}
        else if(c==="rate_limited"){stop="limit";I.failed.push(f,...q.splice(0))}
        else if(c==="cancelled"){stop="cancel";I.failed.push(f,...q.splice(0))}
        else I.failed.push(f);
      }
      I.done++;if(S.tab==="menu"&&S.menu==="imp")render();
    }
  };
  await Promise.all([worker(),worker()]);
  I.busy=false;I.ctl=null;I.done=I.total-(stop?I.failed.length:0);
  const days=new Set(I.items.map(d=>d.date)).size;
  I.msg=stop==="denied"?"ログインが切れているため、読み取りを止めました。ログインし直してから「やり直す」を押してください。"
    :stop==="limit"?`今月の読み取り上限（${A.quota?A.quota.limit:50}枚）に達したので止めました。読み取れた分は下にあります。残りは来月にまた使えます。`
    :stop==="cancel"?`止めました。残り${I.failed.length}枚は「やり直す」で続きから読めます。`
    :`${I.total}枚から${days}日分を読み取りました。${I.failed.length?I.failed.length+"枚は読み取れませんでした。":""}内容を確認して保存してください。`;
  render();
}
// 選んだ画像をためておく（同じファイルは二重に入れない）
const THUMB=new Map();
function thumbURL(f){if(!THUMB.has(f))THUMB.set(f,URL.createObjectURL(f));return THUMB.get(f)}
function clearThumbs(){THUMB.forEach(u=>URL.revokeObjectURL(u));THUMB.clear()}
function addToQueue(files){
  const Q=S.imp.queue,key=f=>f.name+"|"+f.size+"|"+f.lastModified;let added=0;
  files.filter(f=>/^image\/(png|jpeg|webp)$/.test(f.type)).forEach(f=>{if(!Q.some(x=>key(x)===key(f))){Q.push(f);added++}});
  S.imp.msg=added?"":"画像（PNG・JPEG・WebP）を選んでください。";render();
}
document.addEventListener("dragover",ev=>{if(ev.target.closest&&ev.target.closest("#drop")){ev.preventDefault();ev.target.closest("#drop").classList.add("over")}});
document.addEventListener("dragleave",ev=>{const d=ev.target.closest&&ev.target.closest("#drop");if(d)d.classList.remove("over")});
document.addEventListener("drop",ev=>{if(ev.target.closest&&ev.target.closest("#drop")){ev.preventDefault();addToQueue([...ev.dataTransfer.files])}});
function importDay(d){
  if(!d.date)return false;
  const list=S.days[d.date]||(S.days[d.date]=[]);
  d.exercises.forEach(e=>{ensureEx(e.name,true);const sets=e.sets.map(s=>({w:s.w,r:s.r}));const at=list.findIndex(x=>x.name===e.name);
    if(at>=0)list[at].sets=sets;else list.push({name:e.name,sets})});
  saveDay(d.date);return true;
}

/* ================= 書き出し ================= */
const dump=()=>JSON.stringify({app:"tsumitore",version:2,exportedAt:new Date().toISOString(),exercises:S.ex,days:S.days,bodyweight:S.bw,settings:S.settings},null,1);
const isTouch=()=>{try{return matchMedia("(pointer:coarse)").matches}catch(e){return false}};
// 画像: スマホでは共有メニュー（「画像を保存」で写真に入る）。それ以外と、JSONなどは普通のダウンロード
async function saveFile(filename,data){
  const blob=data instanceof Blob?data:new Blob([data],{type:"application/json"});
  if(blob.type.startsWith("image/")&&isTouch()&&navigator.canShare&&navigator.share){
    try{const file=new File([blob],filename,{type:blob.type});
      if(navigator.canShare({files:[file]})){await navigator.share({files:[file]});return "共有メニューを使いました。「画像を保存」を選んだ場合は、写真に入っています。"}
    }catch(e){if(e&&e.name==="AbortError")return "保存をやめました。"}
  }
  try{const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.rel="noopener";
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    return "ダウンロードしました。";
  }catch(e){return "保存に失敗しました。"}
}
async function doCopy(){try{await navigator.clipboard.writeText(dump());S.note="全記録をコピーしました。メモ帳などに貼って保管できます。"}catch(e){S.note="コピーできませんでした。"}render()}
function doRestore(){
  const f=document.getElementById("restore-file").files[0];
  if(!f){S.note="先にバックアップファイルを選んでください。";return render()}
  if(f.size>20*1024*1024){S.note="ファイルが大きすぎて読み込めません。";return render()}
  // バックアップは version 1（記録と種目）と version 2（体重・設定つき）の両方を読める。中身は必ず検査して取り込む
  f.text().then(t=>{const v=JSON.parse(t);if(!v||typeof v!=="object"||!v.days||typeof v.days!=="object"||Array.isArray(v.days))throw 0;let n=0;
    cleanEx(v.exercises).forEach(e=>{const cur=exOf(e.name);if(!cur)S.ex.push(e);else if(e.bw)cur.bw=true});
    Object.keys(v.days).forEach(d=>{if(!DATE_RE.test(d))return;const list=cleanEntries(v.days[d]);if(!list.length)return;
      S.days[d]=list;list.forEach(e=>ensureEx(e.name,true));saveDay(d);n++});
    Object.assign(S.bw,cleanBw(v.bodyweight));
    if(v.settings&&typeof v.settings==="object"){const rs=v.settings,keep={},g=Math.round(Number(rs.goal));
      if(g>=1&&g<=7)keep.goal=g;if([5,10,20].includes(Number(rs.step)))keep.step=Number(rs.step);if(typeof rs.sound==="boolean")keep.sound=rs.sound;
      S.settings={...S.settings,...keep}}
    saveMeta();S.note=n+"日分を戻しました。";pickDefaults();render()}).catch(()=>{S.note="このファイルは読み込めませんでした。";render()});
}

/* ================= 画像づくり ================= */
const FD='"Barlow Condensed","Zen Kaku Gothic New",sans-serif',FB='"Zen Kaku Gothic New","Hiragino Sans",sans-serif';
async function fontsReady(){try{await Promise.all([document.fonts.load('800 100px "Barlow Condensed"'),document.fonts.load('900 60px "Zen Kaku Gothic New"'),document.fonts.load('700 40px "Zen Kaku Gothic New"'),document.fonts.load('400 40px "Dela Gothic One"',"筋トレは力なり")])}catch(e){}}
function canvas(w,h){const c=document.createElement("canvas");c.width=w;c.height=h;return[c,c.getContext("2d")]}
function rr(x,X,Y,W,H,R){x.beginPath();x.moveTo(X+R,Y);x.arcTo(X+W,Y,X+W,Y+H,R);x.arcTo(X+W,Y+H,X,Y+H,R);x.arcTo(X,Y+H,X,Y,R);x.arcTo(X,Y,X+W,Y,R);x.closePath()}
function fit(x,text,maxW,size,weight,fam){let s=size;for(;s>14;s-=2){x.font=`${weight} ${s}px ${fam}`;if(x.measureText(text).width<=maxW)break}return s}
function txt(x,t,X,Y,size,weight,fam,color,align,maxW){x.textAlign=align||"left";x.fillStyle=color;if(maxW)fit(x,t,maxW,size,weight,fam);else x.font=`${weight} ${size}px ${fam}`;x.fillText(t,X,Y)}
const KIND={oodai:{k:"大台突破",e:"MILESTONE"},max:{k:"自己最重量 更新",e:"NEW MAX"},rm:{k:"推定1RM 更新",e:"NEW RM"}};
async function recordImage(ev){
  await fontsReady();
  const[c,x]=canvas(1080,1350),W=1080,H=1350,p=partOf(ev.name),dark=ev.kind==="oodai";
  if(dark){const g=x.createRadialGradient(W/2,560,40,W/2,560,900);g.addColorStop(0,"#5a2e00");g.addColorStop(.5,"#170c02");g.addColorStop(1,"#05050a");x.fillStyle=g;x.fillRect(0,0,W,H);
    x.save();x.translate(W/2,560);for(let k=0;k<36;k++){x.rotate(Math.PI*2/36);x.beginPath();x.moveTo(0,0);x.lineTo(1400,-60);x.lineTo(1400,60);x.closePath();x.fillStyle=`rgba(255,200,60,${k%2?0.05:0.11})`;x.fill()}x.restore()}
  else{x.fillStyle="#0b0c10";x.fillRect(0,0,W,H);const ac=ev.kind==="max"?"#ffc21a":"#ff4b1f";
    x.save();x.globalAlpha=.10;x.fillStyle=ac;x.beginPath();x.moveTo(W*.55,0);x.lineTo(W,0);x.lineTo(W,H*.55);x.closePath();x.fill();x.restore();
    x.fillStyle=ac;x.fillRect(0,0,W,14);x.fillRect(80,H-90,140,8)}
  const ac=ev.kind==="max"?"#ffc21a":ev.kind==="rm"?"#ff4b1f":"#ffd84d";
  const ink="#ffffff",soft="rgba(255,255,255,.6)";
  txt(x,ymd(ev.date),80,120,40,700,FD,soft);
  txt(x,APP_NAME,W-80,120,38,400,FL,soft,"right");
  // pill
  x.font=`900 44px ${FB}`;const pw=x.measureText(KIND[ev.kind].k).width+80;
  rr(x,(W-pw)/2,210,pw,84,42);if(dark){const gg=x.createLinearGradient(0,0,W,0);gg.addColorStop(0,"#ffd84d");gg.addColorStop(1,"#ff9f1c");x.fillStyle=gg;x.fill();txt(x,KIND[ev.kind].k,W/2,267,44,900,FB,"#2a1300","center")}
  else{x.lineWidth=4;x.strokeStyle=ac;x.stroke();txt(x,KIND[ev.kind].k,W/2,267,44,900,FB,ac,"center")}
  txt(x,KIND[ev.kind].e.split("").join(String.fromCharCode(8202)),W/2,380,64,800,FD,dark?"#ffd84d":ink,"center");
  // big number
  const val=fmt(ev.value);let s=fit(x,val,820,400,800,FD);x.font=`800 ${s}px ${FD}`;const vw=x.measureText(val).width;
  x.font=`700 90px ${FD}`;const kw=x.measureText("kg").width;const sx=(W-vw-kw-10)/2;
  if(dark){const gg=x.createLinearGradient(0,420,0,780);gg.addColorStop(0,"#fffbe6");gg.addColorStop(.45,"#ffd84d");gg.addColorStop(1,"#ff8a00");x.shadowColor="rgba(255,170,0,.6)";x.shadowBlur=40;txt(x,val,sx,760,s,800,FD,gg)}
  else txt(x,val,sx,760,s,800,FD,ac);
  x.shadowBlur=0;txt(x,"kg",sx+vw+10,760,90,700,FD,dark?"#ffd84d":ink);
  if(dark)txt(x,`${fmt(ev.value)}kg CLUB`,W/2,850,60,800,FD,"#ffd84d","center");
  // exercise
  rr(x,(W-320)/2,dark?895:840,320,8,4);x.fillStyle=PHEX[p];x.fill();
  txt(x,ev.name,W/2,dark?990:960,76,900,FB,dark?"#fff4d6":ink,"center",900);
  const sub=ev.kind==="rm"?`${fmt(ev.w)}kg × ${ev.r}回　（前 ${fmt(ev.prev)}kg → ＋${fmt(ev.value-ev.prev)}kg）`:ev.kind==="oodai"?`${fmt(ev.actual)}kg × ${ev.r}回　（前 ${fmt(ev.prev)}kg）`:`${fmt(ev.prev)}kg → ${fmt(ev.value)}kg　${ev.r}回`;
  txt(x,sub,W/2,dark?1070:1050,44,700,FB,dark?"rgba(255,244,214,.85)":soft,"center",940);
  if(ev.rank){const rt=`${ev.rankRM?"推定1RMで":"筋トレしている人の中で"}  上位 ${ev.rank}`;x.font=`900 46px ${FB}`;const rw=Math.min(W-140,x.measureText(rt).width+70);
    rr(x,(W-rw)/2,H-262,rw,74,10);x.fillStyle=dark?"rgba(255,216,77,.16)":"rgba(255,255,255,.08)";x.fill();x.lineWidth=2;x.strokeStyle=dark?"#ffd84d":ac;x.stroke();
    txt(x,rt,W/2,H-210,40,900,FB,dark?"#ffd84d":"#ffffff","center",rw-40)}
  txt(x,ev.msg?((ev.msg.split("。").filter(s=>s.length>=10)[0]||ev.msg.split("。")[0])+"。"):(ev.kind==="rm"?"次は実重量で証明する。":"積み上げた日々が、この1回になった。"),W/2,H-120,40,700,FB,dark?"rgba(255,244,214,.75)":soft,"center",W-140);
  return c;
}
async function monthImage(ym){
  await fontsReady();
  const[c,x]=canvas(1080,1350),W=1080,H=1350,[y,m]=ym.split("-").map(Number),n=new Date(y,m,0).getDate();
  const ds=trainedDates().filter(d=>d.startsWith(ym));let vol=0,sets=0;const pc={};
  ds.forEach(d=>S.days[d].forEach(e=>{const p=partOf(e.name);e.sets.forEach(s=>{sets++;vol+=info(e.name,d,s).vol;pc[p]=(pc[p]||0)+1})}));
  const evs=scanHistory().events.filter(e=>e.date.startsWith(ym));const prs=evs.filter(e=>e.kind==="max").length;
  x.fillStyle="#11131c";x.fillRect(0,0,W,H);
  x.fillStyle="#0b0c10";x.fillRect(0,0,W,H);x.fillStyle="#ff4b1f";x.fillRect(0,0,W,14);
  const MN=["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"][m-1];
  txt(x,`${y}　${m}月の振り返り`,70,110,40,700,FB,"rgba(255,255,255,.8)");
  txt(x,APP_NAME,W-70,110,36,400,FL,"rgba(255,255,255,.8)","right");
  txt(x,MN,66,250,170,800,FD,"#ffffff","left",950);
  const tiles=[["トレーニング日数",String(ds.length),"日","#ff4b1f"],["総負荷量",fmt(Math.round(vol/100)/10),"t","#ffc21a"],["セット数",String(sets),"set","#2f7bff"],["MAX更新",String(prs),"回","#14b8e6"]];
  tiles.forEach((t,k)=>{const X=70+(k%2)*480,Y=300+Math.floor(k/2)*190;rr(x,X,Y,460,170,10);x.fillStyle="#17191f";x.fill();x.fillStyle=t[3];x.fillRect(X,Y,460,8);
    txt(x,t[0],X+30,Y+58,32,700,FB,"rgba(255,255,255,.6)");x.font=`800 104px ${FD}`;const nw=x.measureText(t[1]).width;txt(x,t[1],X+28,Y+154,104,800,FD,"#fff");txt(x,t[2],X+36+nw,Y+154,44,700,FD,"rgba(255,255,255,.6)")});
  // mini calendar
  const cx0=70,cy0=720,cw=(W-140)/7,ch=54,first=(new Date(y,m-1,1).getDay()+6)%7;
  "月火水木金土日".split("").forEach((w,k)=>txt(x,w,cx0+cw*k+cw/2,cy0-12,26,700,FB,"rgba(255,255,255,.55)","center"));
  for(let d=1;d<=n;d++){const k=first+d-1,X=cx0+(k%7)*cw+4,Y=cy0+Math.floor(k/7)*ch,key=ym+"-"+pad(d),list=(S.days[key]||[]).filter(e=>e.sets.length);
    rr(x,X,Y,cw-8,ch-8,6);
    if(list.length){const ps=[...new Set(list.map(e=>partOf(e.name)))];const g=x.createLinearGradient(X,Y,X+cw-8,Y+ch-8);ps.forEach((p,i)=>{g.addColorStop(i/ps.length,PHEX[p]);g.addColorStop((i+1)/ps.length-.0001,PHEX[p])});x.fillStyle=g;x.fill();txt(x,String(d),X+(cw-8)/2,Y+37,30,800,FD,"#fff","center")}
    else{x.fillStyle="rgba(255,255,255,.07)";x.fill();txt(x,String(d),X+(cw-8)/2,Y+37,28,600,FD,"rgba(255,255,255,.35)","center")}}
  // part balance
  const by=cy0+6*ch+20,tot=Object.values(pc).reduce((a,b)=>a+b,0)||1;let bx=70;
  txt(x,"部位のバランス（セット数）",70,by,30,700,FB,"rgba(255,255,255,.7)");
  PARTS.filter(p=>pc[p]).forEach(p=>{const w=(W-140)*pc[p]/tot;rr(x,bx,by+18,Math.max(w-4,6),34,3);x.fillStyle=PHEX[p];x.fill();if(w>90)txt(x,`${p} ${Math.round(pc[p]/tot*100)}%`,bx+w/2-2,by+45,24,700,FB,"#fff","center",w-12);bx+=w});
  // highlights
  // ハイライト：種目ごとに今月いちばんの記録を1つ選び、重い順に並べる（大台突破を優先）
  const hy=by+110;let ct=0,cd=0;ds.forEach(d=>S.days[d].forEach(e=>{if(isCardio(e.name))e.sets.forEach(s=>{ct+=s.t||0;cd+=s.d||0})}));
  const per={};evs.forEach(e=>{const v=e.kind==="oodai"?e.value:e.value,cur=per[e.name];
    const score=(e.kind==="oodai"?1e6:0)+v;if(!cur||score>cur.score)per[e.name]={...e,score}});
  const top=Object.values(per).sort((a,b)=>b.score-a.score).slice(0,ct?2:3);
  txt(x,"今月のハイライト",70,hy,30,700,FB,"rgba(255,255,255,.7)");
  top.forEach((e,k)=>{const y=hy+50+k*46;
    txt(x,e.kind==="oodai"?"大台突破":"MAX更新",70,y,34,900,FB,e.kind==="oodai"?"#ffd84d":"#ff4b1f");
    txt(x,`${e.name}　${fmt(e.kind==="oodai"?e.value:e.value)}kg`,270,y,34,900,FB,"#fff","left",W-340)});
  if(!top.length)txt(x,`${ds.length}日、積み上げた。`,70,hy+50,36,900,FB,"#fff");
  if(ct)txt(x,`有酸素　${ct}分${cd?"・"+fmt(r2(cd))+"km":""}`,70,hy+50+Math.max(1,top.length)*46,32,700,FB,"#ff6ec7");
  return c;
}
let SHEET=null;
async function openShare(c,filename,title){
  const blob=await new Promise(r=>c.toBlob(r,"image/png"));const url=URL.createObjectURL(blob);
  if(SHEET&&SHEET.url)URL.revokeObjectURL(SHEET.url);SHEET={blob,url,filename,msg:""};
  const el=document.getElementById("sheet");
  el.innerHTML=`<div class="sh" role="dialog" aria-label="${esc(title)}"><h2 style="margin:0">${esc(title)}</h2><img src="${url}" alt="${esc(title)}">
    <div class="acts"><button class="btn grad" data-a="shsave">画像を保存</button><button class="btn" data-a="shclose">閉じる</button></div>
    <p class="muted" id="shmsg" style="margin:0">スマホでは「画像を保存」を押すと共有メニューが開くので、「画像を保存」を選ぶと写真に入ります。インスタやLINEにもそのまま送れます。</p></div>`;
  el.classList.add("show");
}
function closeSheet(){const el=document.getElementById("sheet");el.classList.remove("show");el.innerHTML=""}
document.getElementById("sheet").addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-a]");if(ev.target.id==="sheet")return closeSheet();if(!b)return;
  if(b.dataset.a==="shclose")closeSheet();
  if(b.dataset.a==="shsave"&&SHEET){b.disabled=true;const m=await saveFile(SHEET.filename,SHEET.blob);const t=document.getElementById("shmsg");if(t)t.textContent=m;b.disabled=false}
});
async function shareEvent(ev){const c=await recordImage(ev);openShare(c,`record-${ev.date}.png`,"記録更新の画像")}

/* ================= 音 ================= */
// 音声ファイルは使わず、その場で柔らかい音を作る。音量は控えめ
let AC=null;
const soundOn=()=>S.settings.sound!==false;
function unlockAudio(){
  if(!soundOn())return;
  try{if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return;AC=new C()}if(AC.state==="suspended")AC.resume()}catch(e){AC=null}
}
function tone(f,at,dur,type,vol,bus){
  const o=AC.createOscillator(),g=AC.createGain();o.type=type||"sine";o.frequency.setValueAtTime(f,at);
  g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(vol,at+0.02);g.gain.exponentialRampToValueAtTime(0.0001,at+dur);
  o.connect(g);g.connect(bus);o.start(at);o.stop(at+dur+0.05);
}
function thump(at,bus){const o=AC.createOscillator(),g=AC.createGain();o.type="sine";o.frequency.setValueAtTime(140,at);o.frequency.exponentialRampToValueAtTime(48,at+0.35);
  g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(0.5,at+0.01);g.gain.exponentialRampToValueAtTime(0.0001,at+0.45);o.connect(g);g.connect(bus);o.start(at);o.stop(at+0.5)}
const N=n=>440*Math.pow(2,(n-69)/12);
/* --- 小さなバンド：エレピ・ブラス・ベース・ベル・ドラムを合成し、ホールの響きを足して短い曲にする --- */
let FX=null,NOISE=null;
function noiseBuf(){if(NOISE)return NOISE;const len=AC.sampleRate*2,b=AC.createBuffer(1,len,AC.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return NOISE=b}
function hall(sec){const r=AC.sampleRate,len=Math.floor(r*sec),b=AC.createBuffer(2,len,r);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++){const k=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-k,3.2)*(i<r*0.01?i/(r*0.01):1)}}return b}
function fx(){
  if(FX)return FX;
  const out=AC.createGain();out.gain.value=0.55;
  const comp=AC.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=12;comp.ratio.value=3.5;comp.attack.value=0.004;comp.release.value=0.2;
  const tone=AC.createBiquadFilter();tone.type="highshelf";tone.frequency.value=7000;tone.gain.value=-4;
  out.connect(tone);tone.connect(comp);comp.connect(AC.destination);
  return FX={out,hall:hall(2.4)};
}
// 1回鳴らすごとに専用の出口（音量つまみ）を作る。止める時はこのつまみを下げて切り離す
let CUR=null;const SESS=new Set();
function session(){
  const g=AC.createGain();g.gain.value=1;g.connect(FX.out);
  const rev=AC.createConvolver();rev.buffer=FX.hall;const wet=AC.createGain();wet.gain.value=0.3;rev.connect(wet);wet.connect(g);
  const s={out:g,rev};SESS.add(s);return s;
}
function stopSound(){
  if(!AC)return;const now=AC.currentTime;
  SESS.forEach(s=>{try{s.out.gain.cancelScheduledValues(now);s.out.gain.setValueAtTime(s.out.gain.value,now);s.out.gain.linearRampToValueAtTime(0,now+0.08);
    setTimeout(()=>{try{s.out.disconnect()}catch(e){}},250)}catch(e){}});
  SESS.clear();CUR=null;
}
function vout(vol,send,pan){
  const g=AC.createGain();g.gain.value=vol;let n=g;
  if(pan&&AC.createStereoPanner){const p=AC.createStereoPanner();p.pan.value=pan;g.connect(p);n=p}
  n.connect(CUR.out);if(send){const s=AC.createGain();s.gain.value=send;n.connect(s);s.connect(CUR.rev)}return g;
}
function env(g,at,a,peak,d,end){g.gain.setValueAtTime(0.0001,at);g.gain.linearRampToValueAtTime(peak,at+a);g.gain.exponentialRampToValueAtTime(0.0001,at+a+d);return at+a+d+(end||0.05)}
// エレクトリックピアノ（FM合成で、叩いた瞬間の金属っぽい鳴りと温かい胴鳴り）
function ep(n,at,dur,vel){
  const f=N(n),o=AC.createOscillator(),m=AC.createOscillator(),mg=AC.createGain(),t=AC.createOscillator(),tg=AC.createGain(),a=AC.createGain();
  o.frequency.value=f;m.frequency.value=f;t.frequency.value=f*14;
  mg.gain.setValueAtTime(f*2.2,at);mg.gain.exponentialRampToValueAtTime(f*0.25,at+0.6);
  tg.gain.setValueAtTime(f*0.9,at);tg.gain.exponentialRampToValueAtTime(1,at+0.06);
  m.connect(mg);mg.connect(o.frequency);t.connect(tg);tg.connect(o.frequency);
  o.connect(a);a.connect(vout((vel||1)*0.16,0.35,(n%7-3)*0.06));
  const stop=env(a,at,0.004,1,dur+0.9);[o,m,t].forEach(x=>{x.start(at);x.stop(stop)});
}
// ブラス（少しずらした2本ののこぎり波＋ゆっくり開くフィルター＋あとからかかるビブラート）
function brass(n,at,dur,vel,pan){
  const f=N(n),o1=AC.createOscillator(),o2=AC.createOscillator(),lfo=AC.createOscillator(),lg=AC.createGain(),fl=AC.createBiquadFilter(),a=AC.createGain();
  o1.type=o2.type="sawtooth";o1.frequency.value=f;o2.frequency.value=f;o1.detune.value=-7;o2.detune.value=7;
  lfo.frequency.value=5.6;lg.gain.setValueAtTime(0,at);lg.gain.linearRampToValueAtTime(6,at+Math.min(0.35,dur));lfo.connect(lg);lg.connect(o1.detune);lg.connect(o2.detune);
  fl.type="lowpass";fl.Q.value=1.2;fl.frequency.setValueAtTime(500,at);fl.frequency.linearRampToValueAtTime(2200+(vel||1)*900,at+0.07);fl.frequency.exponentialRampToValueAtTime(1300,at+dur+0.1);
  o1.connect(fl);o2.connect(fl);fl.connect(a);a.connect(vout((vel||1)*0.075,0.3,pan||0));
  a.gain.setValueAtTime(0.0001,at);a.gain.linearRampToValueAtTime(1,at+0.035);a.gain.setValueAtTime(0.85,at+Math.max(0.05,dur-0.02));a.gain.exponentialRampToValueAtTime(0.0001,at+dur+0.16);
  [o1,o2,lfo].forEach(x=>{x.start(at);x.stop(at+dur+0.2)});
}
// ベース（のこぎり波＋正弦波の低音、指で弾いたようにフィルターが閉じていく）
function bass(n,at,dur){
  const f=N(n),o=AC.createOscillator(),sub=AC.createOscillator(),fl=AC.createBiquadFilter(),a=AC.createGain();
  o.type="sawtooth";o.frequency.value=f;sub.frequency.value=f;
  fl.type="lowpass";fl.Q.value=3;fl.frequency.setValueAtTime(1400,at);fl.frequency.exponentialRampToValueAtTime(260,at+0.25);
  o.connect(fl);sub.connect(fl);fl.connect(a);a.connect(vout(0.2,0.04));
  a.gain.setValueAtTime(0.0001,at);a.gain.linearRampToValueAtTime(1,at+0.008);a.gain.setValueAtTime(0.7,at+dur*0.8);a.gain.exponentialRampToValueAtTime(0.0001,at+dur+0.08);
  [o,sub].forEach(x=>{x.start(at);x.stop(at+dur+0.12)});
}
// グロッケン（FM合成のベル）
function bell(n,at,vel,pan){
  const f=N(n),o=AC.createOscillator(),m=AC.createOscillator(),mg=AC.createGain(),a=AC.createGain();
  o.frequency.value=f;m.frequency.value=f*3.5;mg.gain.setValueAtTime(f*2.5,at);mg.gain.exponentialRampToValueAtTime(1,at+1.2);
  m.connect(mg);mg.connect(o.frequency);o.connect(a);a.connect(vout((vel||1)*0.07,0.55,pan||0));
  const stop=env(a,at,0.002,1,1.4);[o,m].forEach(x=>{x.start(at);x.stop(stop)});
}
function nz(at,dur,vol,type,freq,q,send,pan){
  const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),a=AC.createGain();s.buffer=noiseBuf();
  fl.type=type;fl.frequency.value=freq;if(q)fl.Q.value=q;s.connect(fl);fl.connect(a);a.connect(vout(vol,send||0,pan||0));
  const stop=env(a,at,0.002,1,dur);s.start(at,Math.random());s.stop(stop);
}
function kick(at,v){const o=AC.createOscillator(),a=AC.createGain();o.frequency.setValueAtTime(155,at);o.frequency.exponentialRampToValueAtTime(42,at+0.13);
  o.connect(a);a.connect(vout(0.55*(v||1),0.02));const stop=env(a,at,0.002,1,0.32);o.start(at);o.stop(stop);nz(at,0.015,0.12*(v||1),"highpass",3000)}
function snare(at,v){nz(at,0.17,0.26*(v||1),"bandpass",1900,0.7,0.22,0.05);
  const o=AC.createOscillator(),a=AC.createGain();o.type="triangle";o.frequency.setValueAtTime(210,at);o.frequency.exponentialRampToValueAtTime(160,at+0.08);o.connect(a);a.connect(vout(0.18*(v||1),0.1));const stop=env(a,at,0.002,1,0.09);o.start(at);o.stop(stop)}
const hat=(at,v,open)=>nz(at,open?0.22:0.045,0.07*(v||1),"highpass",7800,0,0.05,0.25);
const clap=(at,v)=>[0,0.011,0.023,0.04].forEach((d,k)=>nz(at+d,k===3?0.16:0.03,0.2*(v||1),"bandpass",1350,1.3,0.3,-0.1));
const crash=(at,v)=>{nz(at,1.8,0.12*(v||1),"highpass",4800,0,0.35,0.3);nz(at,1.2,0.06*(v||1),"bandpass",9000,0.8,0.2,-0.3)};

// 4つのジングル（すべてオリジナルのメロディ）
const JINGLE={
  // RM更新：軽いファンクのワンフレーズ（Fmaj9 → G6、ベルで締める）
  rm(t){const s=60/116/4;
    kick(t);[0,2,4,6,8,10].forEach(k=>hat(t+k*s,k%4?0.6:1));snare(t+4*s,0.8);
    [57,60,64,67].forEach(n=>ep(n,t,0.12,0.9));[57,60,64,67].forEach(n=>ep(n,t+3*s,0.1,0.7));
    bass(41,t,0.25);bass(43,t+6*s,0.45);kick(t+6*s,0.8);
    [59,62,64,67].forEach(n=>ep(n,t+6*s,0.6,1));
    [[79,7],[84,8],[88,9.5]].forEach(([n,k])=>bell(n,t+k*s,0.9,0.2));},
  // MAX更新：スネアのフィル → ブラスの一撃 → F・G・Cと駆け上がってキメ
  max(t){const s=60/124/4;
    [0,1,2,3].forEach(k=>snare(t+k*s,0.5+k*0.15));
    const T=t+4*s;kick(T);crash(T,0.8);[60,64,67,74].forEach(n=>brass(n,T,0.22,1));bass(36,T,0.22);
    for(let k=0;k<8;k++)hat(T+(2+k)*s*1,k%2?0.5:0.8);
    brass(67,T+2*s,0.1,0.8,0.1);brass(69,T+3*s,0.1,0.85,0.1);
    [65,69,72].forEach(n=>ep(n,T+4*s,0.3,0.9));bass(41,T+4*s,0.25);brass(72,T+4*s,0.3,1,0.1);clap(T+4*s);kick(T+4*s,0.8);
    [67,71,74].forEach(n=>brass(n,T+6*s,0.14,0.9));bass(43,T+6*s,0.2);
    const E=T+8*s;kick(E);crash(E);clap(E);bass(36,E,0.6);
    [60,64,67,72,76].forEach((n,k)=>brass(n,E,0.75,1.05,(k-2)*0.15));[64,67,72].forEach(n=>ep(n,E,0.8,0.8));
    [84,88,91].forEach((n,k)=>bell(n,E+0.12+k*0.09,0.8,(k-1)*0.3));},
  // 大台突破：ドラムで溜めて、ブラスのテーマが F → G → C の進行に乗って鳴り響く
  oodai(t){const b=60/138,s=b/4;
    // 溜め（2拍）：キックとハイハット、最後はスネアのロール
    kick(t);kick(t+b);[0,1,2,3,4,5,6,7].forEach(k=>hat(t+k*s*2/2*1,0.5));
    for(let k=0;k<8;k++)snare(t+b+ k*s*0.5+ (k>3?0:0),0.35+k*0.08);
    bass(43,t,0.2);bass(43,t+2*s,0.2);bass(43,t+b,0.2);bass(43,t+b+2*s,0.2);
    const A=t+2*b;
    // 1小節目：F
    kick(A);crash(A);[53,57,60,65].forEach(n=>brass(n,A,b*1.8,0.75,-0.25));[65,69,72].forEach(n=>ep(n,A,b*1.5,0.7));
    [[41,0],[41,1.5],[48,2],[41,3]].forEach(([n,k])=>bass(n,A+k*b,b*0.45));kick(A+2*b);clap(A+b);clap(A+3*b);
    [0,1,2,3].forEach(k=>{hat(A+k*b+b/2,0.7)});
    [[72,0,0.7],[74,0.75,0.2],[76,1,0.95],[79,2,1.9]].forEach(([n,k,d])=>brass(n,A+k*b,d*b,1.1,0.2));
    // 2小節目：G
    const B=A+4*b;kick(B);[55,59,62,67].forEach(n=>brass(n,B,b*1.8,0.75,-0.25));[67,71,74].forEach(n=>ep(n,B,b*1.5,0.7));
    [[43,0],[43,1.5],[50,2],[47,3]].forEach(([n,k])=>bass(n,B+k*b,b*0.45));kick(B+2*b);clap(B+b);clap(B+3*b);
    [0,1,2,3].forEach(k=>hat(B+k*b+b/2,0.7));
    [[81,0,0.95],[79,1,0.45],[76,1.5,0.45],[74,2,0.95],[76,3,0.2],[77,3.25,0.2],[79,3.5,0.45]].forEach(([n,k,d])=>brass(n,B+k*b,d*b,1.1,0.2));
    for(let k=0;k<4;k++)snare(B+3*b+k*s,0.4+k*0.12);
    // キメ：C
    const C=B+4*b;kick(C,1.1);crash(C,1.2);clap(C,1.1);bass(36,C,b*2.2);bass(48,C,b*2.2);
    [60,64,67,72,76,79,84].forEach((n,k)=>brass(n,C,b*2.4,1.15,(k-3)*0.12));[64,67,72,76].forEach(n=>ep(n,C,b*2.5,0.8));
    [84,88,91,96,100].forEach((n,k)=>bell(n,C+0.15+k*0.11,0.75,(k-2)*0.3));
    kick(C+b*2.6,0.6);[72,76,79,84].forEach(n=>bell(n,C+b*2.6,0.5,0));},
  // 週の目標達成：「たったーん」と軽く2コード
  goal(t){const s=60/120/4;
    kick(t);clap(t,0.8);[65,69,72,76].forEach(n=>ep(n,t,0.18,0.9));bass(41,t,0.2);
    hat(t+s,0.6);hat(t+2*s,0.6);
    kick(t+3*s,0.9);[64,67,72,76].forEach(n=>ep(n,t+3*s,0.9,1));bass(36,t+3*s,0.6);
    [84,88].forEach((n,k)=>bell(n,t+3*s+k*0.12,0.8,(k-0.5)*0.4));}
};
function playSound(kind){
  if(!soundOn()||!AC||AC.state!=="running")return;
  try{fx();if(kind!=="goal")stopSound();const f=JINGLE[kind];if(!f)return;CUR=session();f(AC.currentTime+0.05);
    const s=CUR;setTimeout(()=>{SESS.delete(s);try{s.out.disconnect()}catch(e){}},12000)}catch(e){}
}
function toast(msg){
  let el=document.getElementById("toast");if(!el){el=document.createElement("div");el.id="toast";el.setAttribute("role","status");document.body.appendChild(el)}
  el.textContent=msg;el.classList.add("show");clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove("show"),3200);
}
// 今週の目標を達成した瞬間（その週で1回だけ）
function checkWeekGoal(){
  if(weekStart(S.date)!==weekStart(today()))return;
  const wk=weekInfo(),key="goal:"+weekStart(today());
  if(wk.now<wk.goal)return;
  let seen=false;try{seen=localStorage.getItem("tsumitore."+key)==="1"}catch(e){}
  if(seen||S._goalSeen===key)return;
  S._goalSeen=key;try{localStorage.setItem("tsumitore."+key,"1")}catch(e){}
  playSound("goal");toast(`今週の目標 ${wk.goal}回 達成！ ${wk.streak}週連続`);
}

/* ================= 記録更新の演出 ================= */
const MSG_OO=["ついにこの大台へ。","ここまで来た。次の大台が見えてきた。","この数字は、一生残る。","ジムで一番かっこいい瞬間。"];
const MSG_MAX=["この重さを持ち上げたのは、人生で初めて。","昨日までの自分には上がらなかった重さ。","積み上げてきた日々が、この1回になった。","ジムで一番いい瞬間は、今。"];
const MSG_RM=["限界の目安が一段上がった。次は実重量で証明しよう。","数字は正直。確実に強くなっている。","この調子なら、次のMAX更新は近い。","伸びしろはまだある。"];
// 種目と重さで言葉を変える。主要種目は「ジムでよく言われる目安」の段階ごと、その他の種目は大台の回数ごと
const LIFTS={
  bench:{re:/^(ベンチプレス|スミスマシンベンチプレス)$/,label:"ベンチ",std:[54,80,100,120,168],stdF:[25,37,47,58,90],ladder:[60,80,100,120,140,160],msg:[

    "まずは60kgの壁へ。積み上げはもう始まってる。",
    "ジムで「ベンチやってる人」の仲間入り。",
    "一般的には十分すごいと言われる重さ。100kgの背中が見えてきた。",
    "トレーニーなら誰もが憧れる大台。",
    "ジムで一目置かれるレベル。もう「強い人」と呼ばれる側。",
    "大会で戦える領域。周りがあなたのセットを見ている。",
    "ここまで来た人を、もう誰も止められない。"]},
  squat:{re:/^(スクワット|スミスマシンスクワット)$/,label:"スクワット",std:[58,93,120,147,203],stdF:[27,53,70,90,130],ladder:[80,100,140,180,220,260],msg:[

    "まずは80kgを担ごう。脚の日を休まないことが一番の近道。",
    "脚トレの土台ができてきた。",
    "自分の体重より重い物を担げる体になった。",
    "かなり強い部類。脚を見ればトレーニーだと分かる。",
    "地元のジムなら一番かもしれない。",
    "大会レベル。バーが曲がって見える重さ。",
    "もはや伝説。"]},
  dead:{re:/^デッドリフト$/,label:"デッド",std:[76,120,150,184,240],stdF:[40,70,89,110,150],ladder:[100,140,180,220,260,300],msg:[

    "まずは100kgを床から。背中で引く感覚をつかもう。",
    "床から100kgを引ける人は、まだ多くない。",
    "一般的にすごいと言われる重さ。背中が分厚くなってきた。",
    "かなり強い。ジムで音が変わる重さ。",
    "上級者の世界。誰が見ても強い。",
    "大会で戦える引き。",
    "人類の上澄み。"]},
  ohp:{re:/^(ショルダープレス|オーバーヘッドプレス)$/,label:"ショルダー",std:[32,47,57,68,88],stdF:[15,25,30,36,48],ladder:[40,60,80,100],msg:[

    "まずは40kgを頭上へ。肩は一番ごまかしが効かない種目。",
    "肩の土台ができてきた。",
    "頭上に60kg、上級の入口。",
    "肩の強さはジムでもトップクラス。",
    "肩の化け物。"]}
};
// 筋トレをしている人（男女）の中での順位。StrengthLogの利用者データの5段階（男女別）を直線でつなぎ、男女半々と仮定して合わせた目安
function pctOf(s,v){const P=[5,25,50,75,95];
  if(v<=s[0])return 5*v/s[0];
  if(v>=s[4])return Math.min(99.5,95+(v-s[4])/(s[4]*0.3)*4);
  for(let i=0;i<4;i++)if(v<=s[i+1])return P[i]+(v-s[i])/(s[i+1]-s[i])*(P[i+1]-P[i]);}
function topPct(L,v){
  const p=(pctOf(L.std,v)+pctOf(L.stdF,v))/2,top=100-p;
  return top<1?"1%以内":Math.round(top)+"%";
}
const liftOf=name=>Object.values(LIFTS).find(l=>l.re.test(name))||null;
const GEN_OO=["この種目で初めての大台。ここから積み上げが始まる。","2つ目の大台。積み上げが形になってきた。","3つ目の大台。ここまで続けられる人は多くない。","4つ目の大台。この種目はもうあなたの武器。","5つ目以上の大台。この種目の殿堂入りは確実。"];
const GEN_MAX=["昨日までの自分には上がらなかった重さ。","積み上げてきた日々が、この1回になった。","この重さを持ち上げたのは、人生で初めて。"];
function cheer(c){
  const L=liftOf(c.name),step=S.settings.step||10,best=c.max?c.max.value:null;
  const evs=scanHistory().events.filter(e=>e.name===c.name);
  let msg,next=null;
  if(L){
    // 基準：筋トレしている人（男女）の中での順位。重さと順位を1文目に入れ、段階ごとの言葉を続ける
    const ref=c.max?c.max.value:c.rm.value,tier=L.ladder.filter(t=>t<=ref+1e-9).length;
    if(c.max){msg=`${L.label}${fmt(ref)}kgは、筋トレしている人の中で上位${topPct(L,ref)}。${L.msg[tier]}`}
    else{ // 推定RMだけ更新：実重量のベストと比べて言葉を選ぶ
      const mx=c.rm.prevMx||0,reach=L.ladder.filter(t=>t>mx+1e-9&&t<=ref+1e-9).pop();
      msg=`推定1RM ${fmt(ref)}kgは、筋トレしている人の中で上位${topPct(L,ref)}。`+(reach?`推定では、もう${L.label}${reach}kgに届いてる。あとは実際に上げるだけ。`:L.msg[tier]);
    }
    const cur=Math.max(best||0,c.rm?c.rm.prevMx||0:0),nt=L.ladder.find(t=>t>cur+1e-9);
    if(nt&&cur>0)next=`次の目安 ${nt}kg（上位${topPct(L,nt)}）まで あと${fmt(r2(nt-cur))}kg`;
  }else{
    if(c.oodai){const k=evs.filter(e=>e.kind==="oodai").length;msg=GEN_OO[Math.min(Math.max(k,1),GEN_OO.length)-1]}
    else if(c.max){const up=c.max.prev>0?(c.max.value-c.max.prev)/c.max.prev:0;msg=up>=0.1?`前回のベストから${Math.round(up*100)}%アップ。一気に伸びた。`:GEN_MAX[evs.filter(e=>e.kind==="max").length%GEN_MAX.length]}
    else msg="推定1RMが上がった。次は実際の重さで更新しよう。";
    if(best){const nt=(Math.floor(best/step+1e-9)+1)*step;next=`次の大台 ${nt}kg まで あと${fmt(r2(nt-best))}kg`}
  }
  let rank=null,pop=null;
  if(L){const v=c.max?c.max.value:c.rm.value;rank=topPct(L,v);
    if(L.label==="ベンチ"&&c.max&&c.max.value>=100)pop="筋トレをしていない人も含めた全体なら、さらにずっと上の順位";}
  return{msg,next,rank,rankRM:!c.max,pop};
}
const celebrated=new Set();let CELE=null;
function checkPR(i,j){
  const e=(S.days[S.date]||[])[i];if(!e)return;const s=e.sets[j];if(!s||!(s.r>0))return;
  const f=prFlags(e,S.date)[j];if(!f.rm&&!f.max)return;
  const key=[S.date,e.name,f.max?s.w:"",f.rm?f.f.rmPR:""].join("|");if(celebrated.has(key))return;celebrated.add(key);
  const c={name:e.name,date:S.date,w:s.w,r:s.r,L:f.f.L,rm:f.rm?{value:f.f.rmPR,prev:f.prevRm,prevMx:f.prevMx}:null,max:f.max?{value:s.w,prev:f.prevMx}:null,oodai:f.oodai};
  Object.assign(c,cheer(c));
  showCele(c);return true;
}
function celeEvent(c){
  if(c.oodai)return{kind:"oodai",name:c.name,date:c.date,value:c.oodai,actual:c.max.value,prev:c.max.prev,r:c.r,msg:c.msg,rank:c.rank,rankRM:c.rankRM};
  if(c.max)return{kind:"max",name:c.name,date:c.date,value:c.max.value,prev:c.max.prev,r:c.r,msg:c.msg,rank:c.rank,rankRM:c.rankRM};
  return{kind:"rm",name:c.name,date:c.date,value:c.rm.value,prev:c.rm.prev,w:c.L,r:c.r,msg:c.msg,rank:c.rank,rankRM:c.rankRM};
}
function showCele(c){
  CELE=c;const el=document.getElementById("cele"),motion=!matchMedia("(prefers-reduced-motion: reduce)").matches;
  let html;
  if(c.oodai){
    html=`<div class="rays"></div><canvas id="conf"></canvas><div class="oo" role="alertdialog" aria-label="大台突破"><span class="kick">大台突破</span>
      <div class="num" id="oonum">${fmt(c.oodai)}</div><div class="club">kg CLUB</div>
      <div class="exn">${esc(c.name)}</div><div class="from">これまでの最重量 ${fmt(c.max.prev)}kg → ${fmt(c.max.value)}kg（${c.r}回）</div>
      <p class="msg2">${esc(c.msg).replace(/(上位[0-9]+%|上位1%以内)。/,'<b class="up">$1</b>。<br>')}</p>${c.pop?`<p class="pop">${esc(c.pop)}</p>`:""}${c.next?`<p class="nx">${esc(c.next)}</p>`:""}<div class="acts"><button class="ghost" data-a="celeshare">画像で残す</button><button data-a="celeclose">最高！</button></div></div>`;
  }else if(c.max){
    html=`<canvas id="conf"></canvas><div class="cc max" role="alertdialog" aria-label="自己最重量更新"><span class="kick">自己最重量 更新</span>
       <div class="big">おめでとう！</div><div class="eng">CONGRATULATIONS</div><p class="exn">${esc(c.name)}</p>
       <div class="val">${fmt(c.max.value)}<small>kg</small></div>
       <div class="from">これまでの最重量 ${fmt(c.max.prev)}kg → ${fmt(c.max.value)}kg（${c.r}回）</div>
       ${c.rm?`<span class="also">推定1RMも更新　${fmt(c.rm.value)}kg</span>`:""}
       <p class="msg2">${esc(c.msg).replace(/(上位[0-9]+%|上位1%以内)。/,'<b class="up">$1</b>。<br>')}</p>${c.pop?`<p class="pop">${esc(c.pop)}</p>`:""}${c.next?`<p class="nx">${esc(c.next)}</p>`:""}<div class="acts"><button class="ghost" data-a="celeshare">画像で残す</button><button data-a="celeclose">最高！</button></div></div>`;
  }else{
    html=`<canvas id="conf"></canvas><div class="cc rm" role="alertdialog" aria-label="推定RM更新"><span class="kick">推定RM 更新</span>
       <div class="big">NEW RECORD!</div><p class="exn">${esc(c.name)}</p>
       <div class="val">${fmt(c.rm.value)}<small>kg</small></div>
       <div class="from">${fmt(c.L)}kg × ${c.r}回　これまで ${fmt(c.rm.prev)}kg → ＋${fmt(c.rm.value-c.rm.prev)}kg</div>
       <p class="msg2">${esc(c.msg).replace(/(上位[0-9]+%|上位1%以内)。/,'<b class="up">$1</b>。<br>')}</p>${c.pop?`<p class="pop">${esc(c.pop)}</p>`:""}${c.next?`<p class="nx">${esc(c.next)}</p>`:""}<div class="acts"><button class="ghost" data-a="celeshare">画像で残す</button><button data-a="celeclose">ナイス！</button></div></div>`;
  }
  el.className="";el.innerHTML=html;void el.offsetWidth;el.className="show"+(c.oodai?" oodai":"");
  playSound(c.oodai?"oodai":c.max?"max":"rm");
  try{navigator.vibrate&&navigator.vibrate(c.oodai?[80,60,80,60,300]:c.max?[60,40,120]:60)}catch(e){}
  if(motion){
    if(c.oodai){fireworks(true);countUp(document.getElementById("oonum"),Math.floor(c.max.prev),c.oodai)}
    else burst(c.max?190:90,!!c.max);
  }
  setTimeout(()=>{const b=el.querySelector("[data-a=celeclose]");b&&b.focus()},60);
}
function countUp(el,from,to){if(!el)return;const t0=performance.now(),dur=1100;(function f(t){const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=fmt(Math.round((from+(to-from)*e)*2)/2);if(k<1)requestAnimationFrame(f);else el.textContent=fmt(to)})(t0)}
function setupCanvas(){const cv=document.getElementById("conf");if(!cv)return null;const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const x=cv.getContext("2d");x.scale(dpr,dpr);return{cv,x,W,H}}
function burst(n,gold){
  const k=setupCanvas();if(!k)return;const{x,W,H}=k;
  const cols=gold?["#ffd23f","#ffb000","#ff6b35","#fff3b0","#ffffff","#10b981"]:["#ff6b35","#ffd23f","#ff3d6e","#ffffff","#6a4cff","#00b4d8"];
  const ps=Array.from({length:n},()=>({x:W/2,y:H*.45,vx:(Math.random()-.5)*16,vy:-Math.random()*15-4,s:Math.random()*7+4,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:pick(cols)}));
  let t=0;(function f(){if(!document.getElementById("conf"))return;x.clearRect(0,0,W,H);
    ps.forEach(p=>{p.vy+=.38;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});
    if(++t<200)requestAnimationFrame(f)})();
}
// 大台：花火が何発も上がり、金色の紙吹雪が降り続ける
function fireworks(){
  const k=setupCanvas();if(!k)return;const{x,W,H}=k,cols=["#ffd84d","#ffb703","#ff6b35","#fff3b0","#ff4d6d","#9b8cff","#34d399"];
  let sparks=[],conf=[],t=0;
  const boom=(bx,by)=>{const c1=pick(cols),c2=pick(cols);for(let i=0;i<80;i++){const a=Math.PI*2*i/80,v=3+Math.random()*5;sparks.push({x:bx,y:by,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:70+Math.random()*30,c:i%2?c1:c2})}};
  const shots=[[0,.5,.35],[18,.25,.28],[30,.75,.3],[52,.4,.2],[66,.62,.42],[85,.2,.4],[96,.8,.22],[120,.5,.25]];
  (function f(){if(!document.getElementById("conf"))return;
    shots.forEach(s=>{if(s[0]===t)boom(W*s[1],H*s[2])});
    if(t>10&&t<260&&t%2===0)for(let i=0;i<3;i++)conf.push({x:Math.random()*W,y:-10,vx:(Math.random()-.5)*2,vy:2+Math.random()*3,s:Math.random()*6+4,r:Math.random()*6,vr:(Math.random()-.5)*.3,c:pick(cols)});
    x.globalCompositeOperation="source-over";x.clearRect(0,0,W,H);
    conf.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);x.restore()});
    x.globalCompositeOperation="lighter";
    sparks.forEach(p=>{p.vx*=.97;p.vy=p.vy*.97+.06;p.x+=p.vx;p.y+=p.vy;p.life--;x.globalAlpha=Math.max(0,p.life/90);x.fillStyle=p.c;x.beginPath();x.arc(p.x,p.y,2.6,0,7);x.fill()});
    x.globalAlpha=1;sparks=sparks.filter(p=>p.life>0);conf=conf.filter(p=>p.y<H+20);
    if(++t<420)requestAnimationFrame(f);else x.clearRect(0,0,W,H)})();
}
function closeCele(){stopSound();const el=document.getElementById("cele");const was=!!CELE;el.className="";el.innerHTML="";CELE=null;if(was&&S._goalPending){S._goalPending=false;setTimeout(checkWeekGoal,250)}}
document.getElementById("cele").addEventListener("click",async ev=>{
  const b=ev.target.closest("[data-a]");
  if(ev.target.id==="cele"||(b&&b.dataset.a==="celeclose"))return closeCele();
  if(b&&b.dataset.a==="celeshare"&&CELE){const e=celeEvent(CELE);closeCele();shareEvent(e)}
});
document.addEventListener("keydown",ev=>{
  if(ev.key==="Escape"){closeCele();closeSheet();return}
  const t=ev.target;if((ev.key==="Enter"||ev.key===" ")&&t.matches&&t.matches(".set[data-a=sel]")){ev.preventDefault();t.click()}
});

/* ================= 操作 ================= */
function curSet(){if(!S.sel)return null;const e=(S.days[S.date]||[])[S.sel.i];return e?e.sets[S.sel.j]:null}
function commitSel(){if(!S.sel)return;const{i,j}=S.sel;S.sel=null;const shown=checkPR(i,j);if(shown)S._goalPending=true;else checkWeekGoal()}
function addToDay(name){
  if(!name)return;ensureEx(name);commitSel();
  const list=S.days[S.date]||(S.days[S.date]=[]);
  if(!list.find(e=>e.name===name)){const pv=prevOf(name,S.date);list.push({name,sets:[isCardio(name)?{t:pv?pv.e.sets[0].t:30,d:null}:{w:pv?pv.e.sets[0].w:(isBW(name)?0:null),r:null}]});S.sel={i:list.length-1,j:0}}
  saveDay(S.date);render();
}
function scrollToEditor(){requestAnimationFrame(()=>{const ed=document.getElementById("ed");if(ed&&ed.scrollIntoView){const r=ed.getBoundingClientRect();if(r.bottom>window.innerHeight-70||r.top<0)ed.scrollIntoView({block:"nearest",behavior:"smooth"})}})}
document.addEventListener("click",ev=>{
  unlockAudio();
  const b=ev.target.closest("[data-a]");if(!b)return;
  if(b.closest("#cele")||b.closest("#sheet"))return;
  if((b.dataset.a||"").startsWith("acct-"))return; // ログイン関連は store.js が処理する
  const a=b.dataset.a,v=b.dataset.v,i=+b.dataset.i,j=+b.dataset.j,k=+b.dataset.k;
  const list=S.days[S.date]||[];
  if(a!=="delex")S.armed=null;
  switch(a){
    case "tab":commitSel();S.tab=v;S.note="";break;
    case "menu":S.menu=v;S.note="";break;
    case "gomenu":commitSel();S.tab="menu";S.menu=v;break;
    case "day":commitSel();S.date=shift(S.date,+v);S.bwEdit=false;break;
    case "today":commitSel();S.date=today();S.bwEdit=false;break;
    case "goto":S.date=v;S.tab="log";S.sel=null;break;
    case "mon":{const d=parse(S.month+"-01");d.setMonth(d.getMonth()+(+v));S.month=iso(d).slice(0,7);break}
    case "metric":S.gMetric=v;break;
    case "sel":{if(S.sel&&S.sel.i===i&&S.sel.j===j)break;commitSel();S.sel={i,j};render();return scrollToEditor()}
    case "done":commitSel();break;
    case "wstep":{const s=curSet();if(!s)return;s.w=Math.max(0,r2((s.w||0)+Number(v)));saveDay(S.date);break}
    case "rstep":{const s=curSet();if(!s)return;s.r=Math.max(0,(s.r||0)+Number(v))||null;saveDay(S.date);break}
    case "rset":{const s=curSet();if(!s)return;s.r=Number(v);saveDay(S.date);break}
    case "tstep":{const s=curSet();if(!s)return;s.t=Math.max(0,(s.t||0)+Number(v))||null;saveDay(S.date);break}
    case "dstep":{const s=curSet();if(!s)return;s.d=Math.max(0,r2((s.d||0)+Number(v)))||null;saveDay(S.date);break}
    case "assist":{const s=curSet();if(!s)return;if(s.a)delete s.a;else s.a=true;saveDay(S.date);break}
    case "addex":return addToDay(document.getElementById("add-ex").value);
    case "addnew":{const n=document.getElementById("add-new").value.trim(),p=document.getElementById("add-part").value,bw=document.getElementById("add-bw").checked;if(!n)return;
      if(!exOf(n)){S.ex.push({name:n,part:p||guess(n),...(bw||BW_RE.test(n)?{bw:true}:{})});saveMeta()}return addToDay(n)}
    case "addset":{commitSel();const e=list[i],l=e.sets[e.sets.length-1];e.sets.push(isCardio(e.name)?{t:l?l.t:30,d:null}:{w:l?l.w:(isBW(e.name)?0:null),r:null});saveDay(S.date);S.sel={i,j:e.sets.length-1};render();return scrollToEditor()}
    case "delset":if(S.sel&&S.sel.i===i)S.sel=null;list[i].sets.splice(j,1);saveDay(S.date);break;
    case "copyprev":{const pv=prevOf(list[i].name,S.date);if(pv)list[i].sets=pv.e.sets.map(s=>{const o={...s};delete o.a;return o});S.sel=null;saveDay(S.date);break}
    case "delex":if(S.armed==="ex"+i){list.splice(i,1);S.armed=null;S.sel=null;saveDay(S.date)}else S.armed="ex"+i;break;
    case "bwopen":S.bwEdit=b.classList.contains("tile")?!S.bwEdit:true;render();if(S.bwEdit)requestAnimationFrame(()=>{const c=document.getElementById("bwcard");if(c)c.scrollIntoView({block:"center",behavior:"smooth"});const i=document.getElementById("bw-in");if(i)i.focus({preventScroll:true})});return;
    case "bwstep":{const inp=document.getElementById("bw-in");const cur=Number(inp.value)||bwAt(S.date)||60;inp.value=r2(Math.max(20,cur+Number(v)));return}
    case "bwsave":{const x=Number(String(document.getElementById("bw-in").value).replace(",","."));const d=v||S.date;
      if(x>=20&&x<=300){S.bw[d]=r2(x);saveMeta();S.bwEdit=false;toast(`${md(d)}の体重 ${fmt(r2(x))}kg を記録しました`)}else{toast("体重は20〜300kgの数字で入れてください");return}break}
    case "bwdel":delete S.bw[v];saveMeta();break;
    case "goal":S.settings.goal=Math.min(7,Math.max(1,(S.settings.goal||3)+Number(v)));saveMeta();break;
    case "step":S.settings.step=Number(v);saveMeta();break;
    case "sound":S.settings.sound=!soundOn();saveMeta();if(soundOn()){unlockAudio();setTimeout(()=>playSound("max"),60)}break;
    case "soundtest":unlockAudio();setTimeout(()=>playSound(v),60);return;
    case "newex":{const n=document.getElementById("new-ex").value.trim(),p=document.getElementById("new-part").value,bw=document.getElementById("new-bw").checked;
      if(n&&!exOf(n)){S.ex.push({name:n,part:p||guess(n),...(bw||BW_RE.test(n)?{bw:true}:{})});saveMeta()}break}
    case "rmex":S.ex.splice(i,1);saveMeta();break;
    case "impread":{const q=S.imp.queue.splice(0);clearThumbs();return void readImages(q)}
    case "impunq":S.imp.queue.splice(k,1);break;
    case "impclear":S.imp.queue=[];clearThumbs();break;
    case "impretry":return void readImages(S.imp.failed.slice());
    case "impstop":if(S.imp.ctl)S.imp.ctl.abort();return;
    case "impsave":if(importDay(S.imp.items[k])){S.imp.items.splice(k,1);saveMeta();S.imp.msg="保存しました。";pickDefaults()}break;
    case "impdrop":S.imp.items.splice(k,1);break;
    case "impall":{const n=S.imp.items.length;S.imp.items=S.imp.items.filter(d=>!importDay(d));saveMeta();S.imp.msg=(n-S.imp.items.length)+"日分を保存しました。";pickDefaults();break}
    case "export":saveFile("kintore-chikaranari-backup-"+today()+".json",dump()).then(m=>{S.note=m;render()});return;
    case "copy":return void doCopy();
    case "restore":return doRestore();
    case "shareev":{const ev=HALL[+v];if(ev)shareEvent(ev);return}
    case "monthcard":monthImage(v).then(c=>openShare(c,`monthly-${v}.png`,`${Number(v.slice(5))}月の振り返りカード`));return;
  }
  render();
});
document.addEventListener("change",ev=>{
  const t=ev.target,f=t.dataset.f;
  if(t.id==="date-pick"&&t.value){commitSel();S.date=t.value;return render()}
  if(t.id==="g-ex"){S.gEx=t.value;return render()}
  if(f==="ew"||f==="er"){
    const s=curSet();if(!s)return;
    const raw=t.value.trim().replace(",","."),n=raw===""||raw==="-"?null:Number(raw);
    if(n!=null&&(isNaN(n)||n<0)){t.value=(f==="ew"?s.w:s.r)??"";return}
    if(f==="ew")s.w=n==null?null:r2(n);else s.r=n==null||n===0?null:Math.round(n);
    saveDay(S.date);return render();
  }
  if(f==="et"||f==="edist"){
    const s=curSet();if(!s)return;const n=t.value.trim()===""?null:Number(t.value.replace(",","."));
    if(n!=null&&(isNaN(n)||n<0)){t.value=(f==="et"?s.t:s.d)??"";return}
    if(f==="et")s.t=n?Math.round(n):null;else s.d=n?r2(n):null;saveDay(S.date);return render();
  }
  if(f==="part"){S.ex[+t.dataset.i].part=t.value;saveMeta();return render()}
  if(f==="exbw"){const e=S.ex[+t.dataset.i];if(t.checked)e.bw=true;else delete e.bw;saveMeta();return render()}
  if(f==="bwdate"){S.bwDate=t.value||today();return render()}
  if(f==="impadd"){addToQueue([...t.files]);return}
  if(f==="impdate"){S.imp.items[+t.dataset.k].date=t.value;return render()}
});

document.title=APP_NAME;
loadLocal();if(applyPresets())cacheLocal();pickDefaults();render();initCloud();
// オフラインでも開けるようにする（Service Worker）
if("serviceWorker"in navigator){addEventListener("load",()=>{navigator.serviceWorker.register("/sw.js").catch(()=>{})})}

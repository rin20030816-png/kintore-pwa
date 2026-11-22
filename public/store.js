"use strict";
/* ================= 保存・同期・ログイン（Supabase） =================
   - ログインなし: 端末のlocalStorageだけに保存（お試し）
   - ログインあり: 端末に即保存 → 変更した日だけ「未送信リスト」に積み、オンラインのときSupabaseへ送る
   - 記録を消すときも行は消さず、中身を空にして送る（別の端末にも消えたことが伝わる）
   このファイルは app.js より先に読み込まれ、関数は app.js から呼ばれる */

const CFG=window.APP_CONFIG||{};
const CLOUD_OK=!!(CFG.SUPABASE_URL&&CFG.SUPABASE_ANON_KEY&&window.supabase);
const SB=CLOUD_OK?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,
  {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce"}}):null;
const K_OWNER="tsumitore.owner",K_DIRTY="tsumitore.dirty.v1",K_HINT="tsumitore.hint";
const A={user:null,ready:false,starting:false,step:"email",email:"",msg:"",delMsg:"",busy:false,quota:null};

const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const lsDel=k=>{try{localStorage.removeItem(k)}catch(e){}};

/* ---------- 入力のお掃除（バックアップ・クラウド・端末から読むデータは必ず通す） ---------- */
const DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
const numIn=(v,min,max)=>{if(v==null||v==="")return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null};
function cleanSet(s){
  if(!s||typeof s!=="object")return null;
  const o={w:numIn(s.w,0,5000),r:numIn(s.r,0,10000)};
  if(s.t!=null){const t=numIn(s.t,0,10000);if(t!=null)o.t=t}
  if(s.d!=null){const d=numIn(s.d,0,100000);if(d!=null)o.d=d}
  if(s.a)o.a=true;
  return o;
}
function cleanEntries(list){
  if(!Array.isArray(list))return [];
  return list.slice(0,200).map(e=>{
    if(!e||typeof e.name!=="string")return null;
    const name=e.name.trim().slice(0,60);if(!name)return null;
    return{name,sets:(Array.isArray(e.sets)?e.sets:[]).slice(0,200).map(cleanSet).filter(Boolean)};
  }).filter(Boolean);
}
function cleanEx(list){
  if(!Array.isArray(list))return [];
  const seen=new Set(),out=[];
  list.slice(0,2000).forEach(e=>{
    if(!e||typeof e.name!=="string")return;
    const name=e.name.trim().slice(0,60);if(!name||seen.has(name))return;seen.add(name);
    out.push({name,part:PARTS.includes(e.part)?e.part:guess(name),...(e.bw?{bw:true}:{})});
  });
  return out;
}
function cleanBw(o){
  const out={};if(!o||typeof o!=="object")return out;
  Object.keys(o).forEach(d=>{const x=numIn(o[d],20,300);if(DATE_RE.test(d)&&x!=null)out[d]=Math.round(x*100)/100});
  return out;
}
function cleanSettings(s){
  s=s&&typeof s==="object"?s:{};
  const goal=Math.round(Number(s.goal)),step=Number(s.step),o={goal:goal>=1&&goal<=7?goal:3,step:[5,10,20].includes(step)?step:10};
  if(typeof s.sound==="boolean")o.sound=s.sound;
  const pv=Math.floor(Number(s.presetV));if(pv>0&&pv<1000)o.presetV=pv;
  return o;
}
function applyMeta(m){S.ex=cleanEx(m.exercises);S.bw=cleanBw(m.bodyweight);S.settings=cleanSettings(m.settings)}
// 日ごとの記録を、保存用の形に直す（読み込みは normSet の代わり）
function normSet(s){return cleanSet(s)||{w:null,r:null}}

/* ---------- 端末への保存 ---------- */
function snapshot(){return{days:S.days,ex:S.ex,bw:S.bw,settings:S.settings}}
function cacheLocal(){try{localStorage.setItem(LS,JSON.stringify(snapshot()));if(!lsGet(K_OWNER))lsSet(K_OWNER,"guest")}catch(e){}}
function loadLocal(){
  try{const v=JSON.parse(lsGet(LS)||"null");
    if(v&&v.days&&typeof v.days==="object"){
      const days={};Object.keys(v.days).forEach(d=>{if(!DATE_RE.test(d))return;const e=cleanEntries(v.days[d]);if(e.length)days[d]=e});
      S.days=days;S.ex=cleanEx(v.ex);S.bw=cleanBw(v.bw);S.settings=cleanSettings(v.settings);
    }}catch(e){}
}
function resetState(){
  S.days={};S.ex=[];S.bw={};S.settings={goal:3,step:10};S.sel=null;S.gEx=null;S.bwEdit=false;
  S.imp={busy:false,items:[],msg:"",failed:[],done:0,total:0,ctl:null,queue:[]};
  try{clearThumbs()}catch(e){}
}
// この端末の記録を全部消す（アプリが作ったデータだけ。ログインの情報は signOut が消す）
function wipeLocal(){
  try{Object.keys(localStorage).filter(k=>k.startsWith("tsumitore.")).forEach(k=>localStorage.removeItem(k))}catch(e){}
  DIRTY.clear();resetState();applyPresets();cacheLocal();pickDefaults();
}

/* ---------- 未送信リスト ---------- */
const DIRTY=new Map();let dirtyVer=0;
function dirtyLoad(){try{JSON.parse(lsGet(K_DIRTY)||"[]").forEach(k=>{if(typeof k==="string")DIRTY.set(k,0)})}catch(e){}}
function dirtySave(){lsSet(K_DIRTY,JSON.stringify([...DIRTY.keys()]))}
const ownerId=()=>{const o=lsGet(K_OWNER);return o&&o!=="guest"?o:null};
function markDirty(key){if(!ownerId())return;DIRTY.set(key,++dirtyVer);dirtySave();scheduleFlush(key==="meta"?400:300);setStatus()}
function saveDay(date){
  if(S.days[date]&&!S.days[date].length)delete S.days[date];
  cacheLocal();markDirty("d_"+date);
}
function saveMeta(){cacheLocal();markDirty("meta")}

function setStatus(){
  const el=document.getElementById("status");if(!el)return;
  let t="端末に保存中",cls="status";
  if(A.user&&ownerId()===A.user.id){
    if(!navigator.onLine)t=DIRTY.size?"オフライン "+DIRTY.size:"オフライン";
    else if(DIRTY.size)t="同期待ち "+DIRTY.size;
    else if(A.ready){t="✓ 自動保存中";cls+=" ok"}
    else t="接続中";
  }
  el.textContent=t;el.className=cls;
}

/* ---------- 送信（端末 → クラウド） ---------- */
let flushing=false,flushTimer=null,retryMs=0;
function scheduleFlush(ms){clearTimeout(flushTimer);flushTimer=setTimeout(flush,ms)}
async function flush(){
  if(flushing||!CLOUD_OK||!A.user||!DIRTY.size||ownerId()!==A.user.id)return setStatus();
  if(!navigator.onLine)return setStatus();
  flushing=true;setStatus();
  const snap=new Map(DIRTY);let ok=true;
  try{
    const uid=A.user.id,rows=[];let meta=null;
    snap.forEach((_,k)=>{
      if(k==="meta")meta={user_id:uid,exercises:S.ex,bodyweight:S.bw,settings:S.settings};
      else if(k.startsWith("d_"))rows.push({user_id:uid,date:k.slice(2),entries:S.days[k.slice(2)]||[]});
    });
    for(let i=0;i<rows.length;i+=100){const{error}=await SB.from("workout_days").upsert(rows.slice(i,i+100),{onConflict:"user_id,date"});if(error)throw error}
    if(meta){const{error}=await SB.from("user_meta").upsert(meta,{onConflict:"user_id"});if(error)throw error}
    snap.forEach((v,k)=>{if(DIRTY.get(k)===v)DIRTY.delete(k)});dirtySave();retryMs=0;
  }catch(e){ok=false;retryMs=Math.min(60000,(retryMs||4000)*2)}
  flushing=false;setStatus();
  if(!ok)scheduleFlush(retryMs);else if(DIRTY.size)scheduleFlush(200);
}

/* ---------- 受信（クラウド → 端末） ---------- */
async function fetchAll(){
  const uid=A.user.id,days={};let from=0;
  for(;;){
    const{data,error}=await SB.from("workout_days").select("date,entries,updated_at").eq("user_id",uid).order("date").range(from,from+999);
    if(error)throw error;data.forEach(r=>{days[r.date]=r});if(data.length<1000)break;from+=1000;
  }
  const{data:meta,error:e2}=await SB.from("user_meta").select("exercises,bodyweight,settings,updated_at").eq("user_id",uid).maybeSingle();
  if(e2)throw e2;
  return{days,meta};
}
// 1日ぶんを取り込む。端末に未送信の変更がある日は、端末の内容を優先して触らない
function applyRemoteDay(date,entries){
  if(DIRTY.has("d_"+date))return false;
  const next=cleanEntries(entries),cur=S.days[date];
  if(!next.length){if(cur){delete S.days[date];return true}return false}
  if(JSON.stringify(next)!==JSON.stringify(cleanEntries(cur))){S.days[date]=next;return true}
  return false;
}
function mergeRemote(remote){
  let changed=false;
  Object.entries(remote.days).forEach(([d,r])=>{if(applyRemoteDay(d,r.entries))changed=true});
  Object.keys(S.days).forEach(d=>{if(!remote.days[d]&&!DIRTY.has("d_"+d)){delete S.days[d];changed=true}});
  if(remote.meta&&!DIRTY.has("meta")){
    const before=JSON.stringify([S.ex,S.bw,S.settings]);applyMeta(remote.meta);
    if(before!==JSON.stringify([S.ex,S.bw,S.settings]))changed=true;
  }
  return changed;
}
function adoptRemote(remote){
  S.days={};
  Object.entries(remote.days).forEach(([d,r])=>{const e=cleanEntries(r.entries);if(e.length)S.days[d]=e});
  if(remote.meta)applyMeta(remote.meta);
  Object.values(S.days).forEach(list=>list.forEach(e=>ensureEx(e.name,true)));
}
async function askChoice(title,text,buttons){
  return new Promise(res=>{
    const el=document.createElement("div");el.id="dlg";el.setAttribute("role","dialog");el.setAttribute("aria-label",title);
    el.innerHTML=`<div class="sh"><h2 style="margin:0">${esc(title)}</h2><p style="margin:0">${esc(text)}</p>
      <div class="acts" style="flex-direction:column">${buttons.map((b,i)=>`<button class="btn${b.pri?" grad":""}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div></div>`;
    el.addEventListener("click",ev=>{const b=ev.target.closest("button[data-i]");if(!b)return;el.remove();res(buttons[+b.dataset.i].value)});
    document.body.appendChild(el);
  });
}
// ログイン直後の突き合わせ
async function startCloud(user){
  if(A.starting)return;A.starting=true;A.user=user;A.ready=false;setStatus();
  try{
    let owner=lsGet(K_OWNER)||"";
    if(owner&&owner!=="guest"&&owner!==user.id){wipeLocal();owner=""} // 別のアカウントの記録が端末に残っていたら消す
    let remote;
    try{remote=await fetchAll()}
    catch(e){ // つながらない: 端末の記録でそのまま使い、あとで再挑戦
      clearTimeout(A.retry);A.retry=setTimeout(()=>{if(A.user&&!A.ready)startCloud(A.user)},15000);
      setStatus();render();return;
    }
    const cloudHas=Object.values(remote.days).some(r=>cleanEntries(r.entries).length)||!!remote.meta;
    const localHas=Object.keys(S.days).length>0||Object.keys(S.bw).length>0;
    if(owner===user.id){mergeRemote(remote)}
    else if(!cloudHas){ // クラウドが空: 端末の記録をそのまま上げる
      lsSet(K_OWNER,user.id);Object.keys(S.days).forEach(d=>markDirty("d_"+d));markDirty("meta");
    }else if(!localHas){lsSet(K_OWNER,user.id);adoptRemote(remote)}
    else{
      const c=await askChoice("この端末の記録をどうしますか？",
        `この端末には${Object.keys(S.days).length}日分の記録があり、アカウントにもすでに記録があります。端末の記録をアカウントに足すと、同じ日は端末の記録で置き換わります。`,
        [{label:"端末の記録をアカウントに足す",value:"merge",pri:true},{label:"端末の記録は使わない（アカウントの記録を使う）",value:"discard"}]);
      const mine={days:S.days,ex:S.ex,bw:S.bw};
      lsSet(K_OWNER,user.id);adoptRemote(remote);
      if(c==="merge"){
        Object.keys(mine.days).forEach(d=>{S.days[d]=mine.days[d];markDirty("d_"+d)});
        mine.ex.forEach(e=>{if(!exOf(e.name))S.ex.push(e)});
        Object.assign(S.bw,mine.bw);markDirty("meta");
      }
    }
    Object.values(S.days).forEach(list=>list.forEach(e=>ensureEx(e.name,true)));
    A.ready=true;if(applyPresets())saveMeta();
    cacheLocal();pickDefaults();render();setStatus();
    subscribeRealtime(user.id);flush();fetchQuota();
  }finally{A.starting=false}
}
let lastPull=0;
async function pull(){
  if(!A.user||!A.ready||!navigator.onLine||Date.now()-lastPull<20000)return;
  lastPull=Date.now();
  try{
    const remote=await fetchAll();
    if(mergeRemote(remote)){cacheLocal();if(!S.sel)render()}
  }catch(e){}
}
let RT=null;
function unsubscribeRealtime(){if(RT){try{SB.removeChannel(RT)}catch(e){}RT=null}}
function subscribeRealtime(uid){
  unsubscribeRealtime();
  RT=SB.channel("rt-"+uid)
    .on("postgres_changes",{event:"*",schema:"public",table:"workout_days",filter:"user_id=eq."+uid},p=>onRemote("day",p))
    .on("postgres_changes",{event:"*",schema:"public",table:"user_meta",filter:"user_id=eq."+uid},p=>onRemote("meta",p))
    .subscribe();
}
function onRemote(kind,p){
  const r=p.new;if(!r||!r.user_id||!A.user||r.user_id!==A.user.id)return;
  let changed=false;
  if(kind==="meta"){
    if(!DIRTY.has("meta")){const before=JSON.stringify([S.ex,S.bw,S.settings]);applyMeta(r);changed=before!==JSON.stringify([S.ex,S.bw,S.settings])}
  }else if(DATE_RE.test(r.date||"")){changed=applyRemoteDay(r.date,r.entries)}
  if(!changed)return;
  cacheLocal();
  const a=document.activeElement;if(a&&a.tagName==="INPUT"&&a.type!=="file")return;
  if(S.sel){const e=(S.days[S.date]||[])[S.sel.i];if(!e||!e.sets[S.sel.j])S.sel=null}
  render();
}

/* ---------- ログイン・ログアウト・削除 ---------- */
const authErr=e=>{const m=String(e&&e.message||"");return /rate|too many|seconds/i.test(m)?"短い間に送りすぎました。しばらく待ってからやり直してください。":"うまくいきませんでした。時間をおいてやり直してください。"};
const val=id=>{const el=document.getElementById(id);return el?el.value:""};
async function authSendCode(){
  A.email=val("auth-email").trim()||A.email;
  if(!/^\S+@\S+\.\S+$/.test(A.email)){A.msg="メールアドレスを入れてください。";return render()}
  A.busy=true;A.msg="";render();
  const{error}=await SB.auth.signInWithOtp({email:A.email,options:{shouldCreateUser:true}});
  A.busy=false;
  if(error)A.msg=authErr(error);else{A.step="code";A.msg=""}
  render();
}
async function authVerify(){
  const code=val("auth-code").replace(/\s/g,"");
  if(!/^\d{6,10}$/.test(code)){A.msg="メールに届いた数字のコードを入れてください。";return render()}
  A.busy=true;A.msg="";render();
  const{error}=await SB.auth.verifyOtp({email:A.email,token:code,type:"email"});
  A.busy=false;
  if(error)A.msg="コードが違うか、期限が切れています。もう一度コードを送ってください。";
  else{A.step="email";A.msg=""}
  render();
}
async function authGoogle(){
  const{error}=await SB.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/"}});
  if(error){A.msg="Googleログインを始められませんでした。";render()}
}
async function doSignOut(){
  if(DIRTY.size&&navigator.onLine)await flush();
  if(DIRTY.size){
    const c=await askChoice("まだ送れていない記録があります","オフラインなどで、クラウドに送れていない記録があります。このままログアウトすると、それは失われます。",
      [{label:"やめる",value:"no",pri:true},{label:"失ってもログアウトする",value:"yes"}]);
    if(c!=="yes")return;
  }
  unsubscribeRealtime();
  try{await SB.auth.signOut()}catch(e){}
  A.user=null;A.ready=false;A.starting=false;A.quota=null;wipeLocal();setStatus();render();toast("ログアウトしました");
}
async function doDeleteAccount(){
  if(val("del-confirm").trim()!=="削除"){A.delMsg="確認のため、入力欄に「削除」と入れてください。";return render()}
  A.delMsg="";
  if(A.user){
    if(!navigator.onLine){A.delMsg="オフラインのため削除できません。つながってからやり直してください。";return render()}
    A.busy=true;render();
    const{error}=await SB.rpc("delete_my_account");
    A.busy=false;
    if(error){A.delMsg="削除できませんでした。時間をおいてやり直してください。";return render()}
    unsubscribeRealtime();
    try{await SB.auth.signOut({scope:"local"})}catch(e){}
    A.user=null;A.ready=false;A.starting=false;A.quota=null;
  }
  wipeLocal();setStatus();render();toast("記録をすべて消しました");
}
async function accessToken(){if(!SB)return null;const{data}=await SB.auth.getSession();return data.session?data.session.access_token:null}
async function fetchQuota(){
  if(!A.user)return;
  try{const t=await accessToken();if(!t)return;const r=await fetch("/api/usage",{headers:{Authorization:"Bearer "+t}});
    if(r.ok){A.quota=await r.json();if(S.tab==="menu"&&S.menu==="imp")render()}}catch(e){}
}

/* ---------- 画面（メニュー→バックアップ に置くカード） ---------- */
function vAccount(){
  if(!CLOUD_OK)return `<div class="card"><h2>アカウント</h2><p class="muted" style="margin:0">ログイン機能はこの環境では設定されていません。記録はこの端末のブラウザだけに保存されます。</p></div>`;
  if(A.user){
    return `<div class="card" style="border-left:4px solid var(--ok)"><h2>ログイン中</h2>
      <p style="margin:0 0 6px;overflow-wrap:anywhere">${esc(A.user.email||"")}</p>
      <p class="muted">記録は入力するとすぐクラウドに保存され、同じアカウントでログインした別の端末にも出ます。オフラインのときは端末に保存しておき、つながったら自動で送ります。</p>
      <div class="row"><button class="btn" data-a="acct-out">ログアウト</button></div></div>`;
  }
  const f=A.step==="code"
    ?`<p class="muted" style="margin:0 0 6px;overflow-wrap:anywhere">${esc(A.email)} にコードを送りました。メールに書かれた数字を入れてください。</p>
      <div class="row"><input class="field num" id="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="コード" style="flex:1;font-size:22px" aria-label="メールに届いたコード">
      <button class="btn pri" data-a="acct-verify" ${A.busy?"disabled":""}>ログイン</button></div>
      <div class="row" style="margin-top:6px"><button class="btn sm" data-a="acct-back">メールアドレスを入れ直す</button><button class="btn sm" data-a="acct-send" ${A.busy?"disabled":""}>コードを送り直す</button></div>`
    :`<div class="row"><input class="field" id="auth-email" type="email" autocomplete="email" value="${esc(A.email)}" placeholder="メールアドレス" style="flex:1" aria-label="メールアドレス">
      <button class="btn pri" data-a="acct-send" ${A.busy?"disabled":""}>コードを送る</button></div>`;
  return `<div class="card"><h2>ログイン（記録を別の端末でも使う）</h2>
    <p class="muted">ログインしなくても使えます。その場合、記録はこの端末のブラウザだけに保存されます。ログインすると記録がクラウドに保存されて、機種変更や別の端末でも続きから使え、スクショのAI読み取りも使えます。</p>
    <button class="btn" data-a="acct-google" style="width:100%;padding:11px">Googleでログイン</button>
    <p class="muted" style="text-align:center;margin:8px 0">または、メールにコードを送る</p>
    ${f}
    ${A.msg?`<p class="msg" style="margin:8px 0 0">${esc(A.msg)}</p>`:""}
    <p class="muted" style="margin:10px 0 0;font-size:12px">使う前に <a href="/privacy" style="color:var(--ink)">プライバシーポリシー</a> を読んでください。</p></div>`;
}
function vDelete(){
  const on=!!A.user;
  return `<div class="card" style="border-left:4px solid var(--accent)"><h2>${on?"アカウントと記録をすべて消す":"この端末の記録をすべて消す"}</h2>
    <p class="muted">${on?"クラウドに保存された記録とアカウントを完全に削除します。元に戻せません。この端末の記録も消えます。必要なら先にバックアップを書き出してください。":"この端末に保存された記録をすべて消します。元に戻せません。必要なら先にバックアップを書き出してください。"}</p>
    <div class="row"><input class="field" id="del-confirm" placeholder="確認のため「削除」と入力" style="flex:1" aria-label="確認の入力">
    <button class="btn" data-a="acct-del" style="border-color:var(--accent);color:var(--accent)" ${A.busy?"disabled":""}>削除する</button></div>
    ${A.delMsg?`<p class="msg" style="margin:8px 0 0">${esc(A.delMsg)}</p>`:""}</div>`;
}
function loginHint(){
  if(!CLOUD_OK||A.user||lsGet(K_HINT)==="1"||!Object.keys(S.days).length)return "";
  return `<div class="banner"><b>ログインすると、別の端末でも同じ記録が見られます</b><button class="btn sm" data-a="gomenu" data-v="data">ログイン</button><button class="x" data-a="acct-hint" aria-label="閉じる">×</button></div>`;
}

document.addEventListener("click",ev=>{
  const b=ev.target.closest("[data-a^='acct-']");if(!b)return;
  switch(b.dataset.a){
    case "acct-google":authGoogle();break;
    case "acct-send":authSendCode();break;
    case "acct-verify":authVerify();break;
    case "acct-back":A.step="email";A.msg="";render();break;
    case "acct-out":doSignOut();break;
    case "acct-del":doDeleteAccount();break;
    case "acct-hint":lsSet(K_HINT,"1");render();break;
  }
});
document.addEventListener("keydown",ev=>{
  if(ev.key!=="Enter")return;
  if(ev.target.id==="auth-email")authSendCode();
  else if(ev.target.id==="auth-code")authVerify();
});

/* ---------- 起動 ---------- */
function initCloud(){
  dirtyLoad();setStatus();
  window.addEventListener("online",()=>{setStatus();if(A.user){if(A.ready){flush();pull()}else{A.starting=false;startCloud(A.user)}}});
  window.addEventListener("offline",setStatus);
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState!=="visible"||!A.user)return;
    if(A.ready){flush();pull()}else if(!A.starting)startCloud(A.user);
  });
  if(!CLOUD_OK)return;
  SB.auth.onAuthStateChange((event,session)=>{
    // コールバックの中でSupabaseを呼ぶと詰まることがあるので、次のタイミングで処理する
    setTimeout(()=>{
      if(session&&session.user){
        if(!A.user||A.user.id!==session.user.id){A.starting=false;startCloud(session.user)}
        else{A.user=session.user;if(event==="SIGNED_IN"&&!A.ready&&!A.starting)startCloud(session.user)}
      }else if(event==="SIGNED_OUT"&&A.user){unsubscribeRealtime();A.user=null;A.ready=false;A.starting=false;setStatus();render()}
    },0);
  });
}

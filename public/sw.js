"use strict";
/* Service Worker: アプリ本体を端末に保存して、電波がなくても開けるようにする。
   方針: 自分のサイトのファイルは「まずネット、遅い・つながらないときだけ保存分」。
         → 更新した版が必ず届く。オフラインでも開く。
   /api と Supabase（ログイン・同期）は一切さわらない。 */
const CACHE = "kintore-shell-v6";
const FONTS = "kintore-fonts-v1";
const SHELL = ["/", "/app.css", "/app.js", "/store.js", "/mascot.js", "/points.js", "/pet.js", "/friends.js", "/config.js", "/vendor/supabase.js",
  "/mascot/bolt_jump.webp", "/mascot/bolt_think.webp", "/mascot/bolt_tired.webp",
  "/manifest.webmanifest", "/privacy", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png", "/icons/favicon-32.png"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function fromCache(req) {
  return (await caches.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await caches.match("/") : null);
}
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done) { done = true; resolve(r) } };
    const timer = setTimeout(async () => { const c = await fromCache(req); if (c) finish(c) }, 4000);
    fetch(req).then(async res => {
      clearTimeout(timer);
      if (res && res.ok && res.type === "basic" && !new URL(req.url).search) {
        const c = await caches.open(CACHE); c.put(req, res.clone());
      }
      finish(res);
    }).catch(async () => {
      clearTimeout(timer);
      finish((await fromCache(req)) || Response.error());
    });
  });
}
async function cacheFirst(req) {
  const c = await caches.open(FONTS), hit = await c.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
    return res;
  } catch (e) { return Response.error() }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.includes(url.hostname)) e.respondWith(cacheFirst(req));
    return; // Supabase など、ほかの通信はそのままネットへ
  }
  if (url.pathname.startsWith("/api/")) return;
  e.respondWith(networkFirst(req));
});

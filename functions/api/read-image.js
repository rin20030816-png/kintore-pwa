// POST /api/read-image
// 筋トレ記録のスクショ1枚を受け取り、Anthropic API で読み取って {days:[...]} を返す。
// ・ログイン必須（Supabaseのトークンを確認）  ・1人あたり月 MONTHLY_LIMIT 枚（初期値50）
// ・APIキーはCloudflareの環境変数にだけある  ・画像は保存しない（メモリ上で中継するだけ）
import { PROMPT, json, monthKey, settings, authUser, consume } from "../_lib/shared.js";

const MAX_BYTES = 4 * 1024 * 1024;

function sniff(b) {
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
function toBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
// モデルの返事から {"days":[...]} を取り出す
function extractDays(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const o = JSON.parse(text.slice(a, b + 1));
    return o && Array.isArray(o.days) ? o.days.slice(0, 400) : null;
  } catch (e) { return null }
}

export async function onRequestPost({ request, env }) {
  const c = settings(env);
  if (!c.url || !c.anon || !c.anthropic) return json({ error: "not_configured" }, 503);

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "forbidden" }, 403);

  const user = await authUser(request, c).catch(() => null);
  if (!user) return json({ error: "unauthorized" }, 401);

  if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) return json({ error: "too_large" }, 413);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (!buf.length) return json({ error: "empty" }, 400);
  if (buf.length > MAX_BYTES) return json({ error: "too_large" }, 413);
  const type = sniff(buf);
  if (!type) return json({ error: "bad_image" }, 415);

  // 先に1枚ぶん使う。数え上げはデータベース側で1回ずつ行うので、同時に何枚送られても上限を超えない。
  // 本人が減らせる関数はないため、上限を自分で戻すことはできない（読み取りに失敗した分も1枚に数える）
  const month = monthKey();
  let used;
  try { used = await consume(c, user, month) }
  catch (e) { return json({ error: "server" }, 502) }
  if (typeof used !== "number") return json({ error: "server" }, 502);
  if (used < 0) return json({ error: "quota", quota: { used: c.limit, limit: c.limit } }, 429);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": c.anthropic, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: c.model,
        max_tokens: 2500,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: type, data: toBase64(buf) } },
          { type: "text", text: PROMPT }
        ] }]
      })
    });
    if (!res.ok) throw new Error("anthropic " + res.status);
    const out = await res.json();
    const text = (out.content || []).filter(p => p.type === "text").map(p => p.text).join("");
    const days = extractDays(text);
    if (!days) throw new Error("parse");
    return json({ days, quota: { used, limit: c.limit } });
  } catch (e) {
    return json({ error: "ai_failed", quota: { used, limit: c.limit } }, 502);
  }
}

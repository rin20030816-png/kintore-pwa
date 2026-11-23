// GET /api/usage  →  { used, limit }  今月のAI読み取り枚数（ログイン必須）
import { json, monthKey, settings, authUser, usedThisMonth } from "../_lib/shared.js";

export async function onRequestGet({ request, env }) {
  const c = settings(env);
  if (!c.url || !c.anon || !c.service) return json({ error: "not_configured" }, 503);
  const user = await authUser(request, c).catch(() => null);
  if (!user) return json({ error: "unauthorized" }, 401);
  try { return json({ used: await usedThisMonth(c, user.id, monthKey()), limit: c.limit }) }
  catch (e) {
    // 一時的な診断: 鍵そのものは返さず、形と上流の応答だけ返す（原因が分かったら消す）
    const k = String(c.service || "");
    return json({ error: "server", upstream: e.status || null, upstreamBody: e.body || String(e.message || "").slice(0, 120),
      key: { prefixOk: k.startsWith("sb_secret_") || k.startsWith("eyJ"), len: k.length, ascii: /^[\x21-\x7e]+$/.test(k) } }, 502);
  }
}

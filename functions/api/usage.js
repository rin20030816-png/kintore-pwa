// GET /api/usage  →  { used, limit }  今月のAI読み取り枚数（ログイン必須）
import { json, monthKey, settings, authUser, usedThisMonth } from "../_lib/shared.js";

export async function onRequestGet({ request, env }) {
  const c = settings(env);
  if (!c.url || !c.anon) return json({ error: "not_configured" }, 503);
  const user = await authUser(request, c).catch(() => null);
  if (!user) return json({ error: "unauthorized" }, 401);
  try { return json({ used: await usedThisMonth(c, user, monthKey()), limit: c.limit }) }
  catch (e) { return json({ error: "server" }, 502) }
}

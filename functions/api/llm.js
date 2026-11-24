import { json, isAdmin } from "../../lib/util.js";
import { loadLlmSettings, hashKey, validateMessages, runModel, logCall } from "../../lib/llm.js";

// Общият модел за екипите. Заявка:
//   POST /api/llm   Authorization: Bearer fmi_…
//   {"messages":[{"role":"system","content":"…"},{"role":"user","content":"…"}], "max_tokens":300, "temperature":0.7}
// Отговор: {"reply":"…","model":"…"}. Админът може да пробва с паролата си вместо ключ.
export async function onRequestPost({ request, env }) {
  const settings = await loadLlmSettings(env);
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return json({ error: "Липсва ключ: Authorization: Bearer fmi_…" }, 401);

  let key = null;
  // EXPERIMENT_TOKEN (по желание): отделен ключ само за експериментите, без достъп до админ панела.
  const experiment = !!env.EXPERIMENT_TOKEN && env.EXPERIMENT_TOKEN.length >= 20 && !token.startsWith("fmi_")
    && (await hashKey(token)) === (await hashKey(env.EXPERIMENT_TOKEN));
  const admin = experiment || (!token.startsWith("fmi_") && (await isAdmin(request, env)));
  if (!admin) {
    key = await env.DB.prepare("SELECT * FROM llm_keys WHERE key_hash = ?").bind(await hashKey(token)).first();
    if (!key) return json({ error: "Невалиден ключ." }, 401);
    if (!key.active) return json({ error: "Ключът е спрян от организаторите." }, 403);
    if (!settings.enabled) return json({ error: "Моделът в момента е изключен от организаторите." }, 503);
    const { m, d } = await env.DB.prepare(
      `SELECT SUM(created_at > datetime('now', '-1 minute')) AS m, SUM(created_at > datetime('now', 'start of day')) AS d
       FROM llm_log WHERE key_id = ? AND created_at > datetime('now', 'start of day')`
    ).bind(key.id).first();
    if ((m || 0) >= key.per_min) return json({ error: `Лимит: ${key.per_min} заявки в минута. Изчакай малко.` }, 429);
    if ((d || 0) >= key.per_day) return json({ error: `Дневният лимит от ${key.per_day} заявки е изчерпан.` }, 429);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Тялото трябва да е JSON." }, 400); }
  const { messages, error } = validateMessages(body?.messages);
  if (error) return json({ error }, 400);

  // Само админът (експериментите) може да избере друг модел от Workers AI за една заявка.
  const use = admin && typeof body.model === "string" && /^@cf\/[\w.\-/]+$/.test(body.model)
    ? { ...settings, model: body.model, maxTokens: 1024 } : settings;

  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const started = Date.now();
  try {
    const reply = await runModel(env, use, messages, body.max_tokens, body.temperature);
    await logCall(env, key?.id ?? null, use.model, true, Date.now() - started, lastUser, reply);
    return json({ reply, model: use.model });
  } catch (e) {
    await logCall(env, key?.id ?? null, use.model, false, Date.now() - started, lastUser, String(e?.message || e));
    return json({ error: "Моделът не отговори: " + String(e?.message || e).slice(0, 200) }, 502);
  }
}

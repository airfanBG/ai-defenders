import { json, isAdmin, unauthorized } from "../../../../lib/util.js";
import { MODELS, loadLlmSettings, saveLlmSettings } from "../../../../lib/llm.js";

// Настройките на модела и ключовете с днешната им употреба.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const settings = await loadLlmSettings(env);
  const { results: keys } = await env.DB.prepare(
    `SELECT k.id, k.label, k.team_id, k.prefix, k.per_min, k.per_day, k.active, k.created_at,
       (SELECT COUNT(*) FROM llm_log l WHERE l.key_id = k.id AND l.created_at > datetime('now', 'start of day')) AS today,
       (SELECT COUNT(*) FROM llm_log l WHERE l.key_id = k.id) AS total
     FROM llm_keys k ORDER BY k.id`
  ).all();
  const usage = await env.DB.prepare(
    "SELECT COUNT(*) AS today, SUM(ok = 0) AS errors FROM llm_log WHERE created_at > datetime('now', 'start of day')"
  ).first();
  // Одобрените екипи, на които може да се даде ключ.
  const { results: teams } = await env.DB.prepare("SELECT id, name FROM teams WHERE status = 'approved' ORDER BY name").all();
  return json({ settings, models: MODELS, keys, usage, teams, ai: !!env.AI });
}

export async function onRequestPut({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const body = await request.json().catch(() => ({}));
  return json({ ok: true, settings: await saveLlmSettings(env, body) });
}

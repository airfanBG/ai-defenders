import { json, isAdmin, unauthorized } from "../../../../../lib/util.js";
import { hashKey, newKey } from "../../../../../lib/llm.js";

const limit = (v, def, max) => Math.max(1, Math.min(max, Math.round(Number(v)) || def));

// Нов ключ за одобрен екип. Самият ключ се показва само веднъж; в базата се пази хешът му.
export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const team = await env.DB.prepare("SELECT id, name FROM teams WHERE id = ? AND status = 'approved'")
    .bind(Number(b.team_id) || 0).first();
  if (!team) return json({ error: "Избери одобрен екип. Ключ се дава само на екипи, одобрени за това събитие." }, 400);
  // Един активен ключ на екип: при загубен ключ старият се изтрива или спира и се прави нов.
  const active = await env.DB.prepare("SELECT 1 FROM llm_keys WHERE team_id = ? AND active = 1").bind(team.id).first();
  if (active) return json({ error: `„${team.name}“ вече има активен ключ. Спри или изтрий стария, за да направиш нов.` }, 409);
  const key = newKey();
  const row = await env.DB.prepare(
    "INSERT INTO llm_keys (label, team_id, key_hash, prefix, per_min, per_day) VALUES (?, ?, ?, ?, ?, ?) RETURNING id"
  ).bind(team.name, team.id, await hashKey(key), key.slice(0, 10), limit(b.per_min, 20, 600), limit(b.per_day, 2000, 100000)).first();
  return json({ ok: true, id: row.id, key, team: team.name }, 201);
}

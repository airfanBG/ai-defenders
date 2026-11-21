import { json, isAdmin, unauthorized } from "../../../../lib/util.js";

// Подробните резултати на един екип: какво е пратено и какво е отговорил асистентът.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const teamId = Number(new URL(request.url).searchParams.get("team_id")) || 0;
  const { results } = await env.DB.prepare(
    "SELECT wave, item, leaked, ok, ms, prompt, reply, created_at FROM arena_results WHERE team_id = ? ORDER BY wave, id"
  ).bind(teamId).all();
  return json({ results });
}

// Изчиства резултатите: ?wave=N за една вълна, без параметър за всички (нов старт на състезанието).
export async function onRequestDelete({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const w = new URL(request.url).searchParams.get("wave");
  const res = w === null
    ? await env.DB.prepare("DELETE FROM arena_results").run()
    : await env.DB.prepare("DELETE FROM arena_results WHERE wave = ?").bind(Number(w)).run();
  return json({ ok: true, deleted: res.meta.changes });
}

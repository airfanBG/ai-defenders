import { json, isAdmin, unauthorized } from "../../../../lib/util.js";
import { runItem } from "../../../../lib/arena-run.js";

// Една атака или един нормален въпрос срещу един екип: {team_id, wave, item}.
// Админът ги пуска една по една от браузъра, защото Cloudflare ограничава времето на една заявка.
export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const team = await env.DB.prepare("SELECT * FROM arena_targets WHERE team_id = ?").bind(Number(b.team_id) || 0).first();
  if (!team?.endpoint) return json({ error: "Екипът няма зададен адрес на асистента." }, 400);
  try {
    return json(await runItem(env, team, Number(b.wave), String(b.item || "")));
  } catch (e) {
    return json({ error: e.message || String(e) }, 400);
  }
}

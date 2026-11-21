import { json, isAdmin, unauthorized, parseTeam } from "../../../../../lib/util.js";
import { loadSettings } from "../../../../../lib/settings.js";
import { sendTeamEmail } from "../../../../../lib/mail.js";

// Писмото до всички, за един екип. Админът го вика екип по екип,
// защото Cloudflare ограничава колко изпращания има в една заявка.
export async function onRequestPost({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const row = await env.DB.prepare("SELECT * FROM teams WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "Няма такъв екип." }, 404);
  if (row.status !== "approved") return json({ error: "Писмото до всички се праща само на одобрени екипи." }, 400);

  const settings = await loadSettings(env);
  const team = parseTeam(row);
  const result = await sendTeamEmail(env, settings, team, new URL(request.url).origin, team.members, "broadcast");
  if (result.sent) await env.DB.prepare("UPDATE teams SET broadcast_at = datetime('now') WHERE id = ?").bind(params.id).run();
  return json({ ok: true, email: result });
}

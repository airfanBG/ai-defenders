import { json, isAdmin, unauthorized, parseTeam } from "../../../../lib/util.js";
import { loadSettings } from "../../../../lib/settings.js";
import { sendTeamEmail } from "../../../../lib/mail.js";

const STATUSES = ["pending", "approved", "rejected"];

// kind: "approve" или "reject" — кое писмо да тръгне.
export async function notifyTeam(env, request, id, kind = "approve") {
  const row = await env.DB.prepare("SELECT * FROM teams WHERE id = ?").bind(id).first();
  if (!row) return { error: "Няма такъв екип." };
  const settings = await loadSettings(env);
  const team = parseTeam(row);
  const result = await sendTeamEmail(env, settings, team, new URL(request.url).origin, team.members, kind);
  if (result.sent) await env.DB.prepare("UPDATE teams SET notified_at = datetime('now') WHERE id = ?").bind(id).run();
  return result;
}

export async function onRequestPatch({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const { status, notify } = await request.json().catch(() => ({}));
  if (!STATUSES.includes(status)) return json({ error: "Невалиден статус." }, 400);

  const res = await env.DB.prepare("UPDATE teams SET status = ?, notified_at = NULL WHERE id = ?").bind(status, params.id).run();
  if (!res.meta.changes) return json({ error: "Няма такъв екип." }, 404);

  // Писмо тръгва само при одобряване или отказ и ако админът го е поискал.
  const kind = status === "approved" ? "approve" : status === "rejected" ? "reject" : null;
  const email = kind && notify === true ? await notifyTeam(env, request, params.id, kind) : null;
  return json({ ok: true, email });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const res = await env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(params.id).run();
  if (!res.meta.changes) return json({ error: "Няма такъв екип." }, 404);
  return json({ ok: true });
}

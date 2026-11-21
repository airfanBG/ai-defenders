import { json, isAdmin, unauthorized, parseTeam } from "../../../../../lib/util.js";
import { loadSettings } from "../../../../../lib/settings.js";
import { sendOne, templateVars, render } from "../../../../../lib/mail.js";
import { surveyRef, REMINDER_SUBJECT, REMINDER_BODY } from "../../../../../lib/remind.js";

// Напомняне за анкетата за един екип. Пропуска тези, които вече са попълнили през личния си линк.
export async function onRequestPost({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const row = await env.DB.prepare("SELECT * FROM teams WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "Няма такъв екип." }, 404);
  if (row.status !== "approved") return json({ error: "Напомнянето се праща само на одобрени екипи." }, 400);

  const settings = await loadSettings(env);
  const team = parseTeam(row);
  const origin = new URL(request.url).origin;
  let sent = 0, skipped = 0;
  const errors = [];
  for (const m of team.members) {
    const ref = await surveyRef(env, m.email);
    if (await env.DB.prepare("SELECT 1 FROM feedback_done WHERE ref = ?").bind(ref).first()) { skipped++; continue; }
    const vars = { ...templateVars(settings, team, m, origin), анкета: `${origin}/anketa.html?r=${ref}` };
    try {
      await sendOne(env, settings, m, render(REMINDER_SUBJECT, vars), render(REMINDER_BODY, vars), origin);
      sent++;
    } catch (e) {
      errors.push(`${m.email}: ${e.message}`);
    }
  }
  return json({ ok: true, sent, skipped, total: team.members.length, errors });
}

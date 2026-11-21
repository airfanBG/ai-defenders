import { json, sha256, hex, isAdmin } from "../../lib/util.js";
import { loadSettings } from "../../lib/settings.js";
import { QUESTIONS, surveyWindow, validateAnswers } from "../../lib/feedback.js";

// В залата всички са в една мрежа, затова лимитът на IP е щедър.
const PER_IP_PER_HOUR = 60;

// Дали анкетата е отворена и какви са въпросите. Админът може да я разгледа по всяко време.
export async function onRequestGet({ request, env }) {
  const settings = await loadSettings(env);
  const { day, until, open } = surveyWindow(settings);
  const preview = !open && (await isAdmin(request, env));
  return json({ open, preview, day, until, name: settings.name, questions: open || preview ? QUESTIONS : [] });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Невалидна заявка." }, 400); }
  if (body.website) return json({ ok: true }, 201); // капан за ботове

  const settings = await loadSettings(env);
  if (!surveyWindow(settings).open) return json({ error: "Анкетата вече е затворена." }, 403);

  // Вече е попълнил от този телефон и сега отваря личния линк от имейла: само го отбелязваме.
  if (body.onlyRef) {
    if (typeof body.ref === "string" && /^[0-9a-f]{16}$/.test(body.ref))
      await env.DB.prepare("INSERT OR IGNORE INTO feedback_done (ref) VALUES (?)").bind(body.ref).run().catch(() => {});
    return json({ ok: true });
  }

  const { answers, error } = validateAnswers(body);
  if (error) return json({ error }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "local";
  const ipHash = hex(await sha256("fb" + ip + (env.ADMIN_PASSWORD || ""))).slice(0, 32);
  const { c } = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM feedback WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
  ).bind(ipHash).first();
  if (c >= PER_IP_PER_HOUR) return json({ error: "Твърде много отговори от тази мрежа. Опитай пак след малко." }, 429);

  await env.DB.prepare("INSERT INTO feedback (answers, ip_hash) VALUES (?, ?)").bind(JSON.stringify(answers), ipHash).run();
  // Личният линк от напомнянето: отбелязваме само, че този човек е попълнил (без връзка с отговорите).
  if (typeof body.ref === "string" && /^[0-9a-f]{16}$/.test(body.ref))
    await env.DB.prepare("INSERT OR IGNORE INTO feedback_done (ref) VALUES (?)").bind(body.ref).run().catch(() => {});
  return json({ ok: true }, 201);
}

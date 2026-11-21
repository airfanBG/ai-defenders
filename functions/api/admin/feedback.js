import { json, isAdmin, unauthorized } from "../../../lib/util.js";
import { loadSettings } from "../../../lib/settings.js";
import { QUESTIONS, surveyWindow } from "../../../lib/feedback.js";

// Всички отговори от анкетата (без IP), заедно с въпросите, за да ги обобщи админът.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const settings = await loadSettings(env);
  const { results } = await env.DB.prepare("SELECT id, answers, created_at FROM feedback ORDER BY id").all();
  const responses = results.map((r) => ({ id: r.id, at: r.created_at, ...JSON.parse(r.answers || "{}") }));
  const done = await env.DB.prepare("SELECT COUNT(*) AS c FROM feedback_done").first().catch(() => null);
  return json({ ...surveyWindow(settings), questions: QUESTIONS, responses, viaLink: done ? done.c : 0 });
}

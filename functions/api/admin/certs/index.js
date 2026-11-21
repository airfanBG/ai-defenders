import { json, isAdmin, unauthorized } from "../../../../lib/util.js";
import { loadSettings } from "../../../../lib/settings.js";
import { feedbackWindow } from "../../../../lib/feedback.js";

// Всички въведени имена за сертификатите.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const settings = await loadSettings(env);
  const { results } = await env.DB.prepare("SELECT id, full_name, school, kind, grade, team_id, team_name, created_at FROM certificates ORDER BY id").all();
  return json({ ...feedbackWindow(settings), certs: results });
}

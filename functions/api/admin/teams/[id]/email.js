import { json, isAdmin, unauthorized } from "../../../../../lib/util.js";
import { notifyTeam } from "../[id].js";

// Изпраща имейла за одобрение отново.
export async function onRequestPost({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const row = await env.DB.prepare("SELECT status FROM teams WHERE id = ?").bind(params.id).first();
  if (!row) return json({ error: "Няма такъв екип." }, 404);
  if (row.status === "pending") return json({ error: "Екипът още чака. Първо го одобри или откажи." }, 400);
  const result = await notifyTeam(env, request, params.id, row.status === "rejected" ? "reject" : "approve");
  if (result.error) return json(result, 404);
  return json({ ok: true, email: result });
}

import { json, isAdmin, unauthorized } from "../../../../lib/util.js";

// Изтрива запис (например, ако някой се е записал два пъти).
export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const res = await env.DB.prepare("DELETE FROM certificates WHERE id = ?").bind(Number(params.id) || 0).run();
  if (!res.meta.changes) return json({ error: "Няма такъв запис." }, 404);
  return json({ ok: true });
}

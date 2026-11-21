import { json, isAdmin, unauthorized } from "../../../../../lib/util.js";

const limit = (v, max) => (v === undefined ? null : Math.max(1, Math.min(max, Math.round(Number(v)) || 1)));

// Спиране/пускане на ключ и смяна на лимитите.
export async function onRequestPatch({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const row = await env.DB.prepare("SELECT * FROM llm_keys WHERE id = ?").bind(Number(params.id) || 0).first();
  if (!row) return json({ error: "Няма такъв ключ." }, 404);
  const active = typeof b.active === "boolean" ? (b.active ? 1 : 0) : row.active;
  const perMin = limit(b.per_min, 600) ?? row.per_min;
  const perDay = limit(b.per_day, 100000) ?? row.per_day;
  await env.DB.prepare("UPDATE llm_keys SET active = ?, per_min = ?, per_day = ? WHERE id = ?")
    .bind(active, perMin, perDay, row.id).run();
  return json({ ok: true });
}

// Изтрива ключа. Записите от заявките остават за статистиката.
export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const res = await env.DB.prepare("DELETE FROM llm_keys WHERE id = ?").bind(Number(params.id) || 0).run();
  if (!res.meta.changes) return json({ error: "Няма такъв ключ." }, 404);
  return json({ ok: true });
}

import { json, isAdmin, unauthorized } from "../../../../lib/util.js";
import { validatePartner, publicPartner } from "../../../../lib/partners.js";

// Смяна на име, линк, фон и по желание лого.
export async function onRequestPatch({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Невалидна заявка." }, 400);
  const { partner: p, error } = validatePartner(body, { requireLogo: false });
  if (error) return json({ error }, 400);
  const row = p.logo
    ? await env.DB.prepare("UPDATE partners SET name = ?, url = ?, bg = ?, logo = ?, mime = ?, updated_at = datetime('now') WHERE id = ? RETURNING id, name, url, bg, updated_at")
        .bind(p.name, p.url, p.bg, p.logo, p.mime, params.id).first()
    : await env.DB.prepare("UPDATE partners SET name = ?, url = ?, bg = ?, updated_at = datetime('now') WHERE id = ? RETURNING id, name, url, bg, updated_at")
        .bind(p.name, p.url, p.bg, params.id).first();
  if (!row) return json({ error: "Няма такъв партньор." }, 404);
  return json({ ok: true, partner: publicPartner(row) });
}

export async function onRequestDelete({ request, env, params }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const res = await env.DB.prepare("DELETE FROM partners WHERE id = ?").bind(params.id).run();
  if (!res.meta.changes) return json({ error: "Няма такъв партньор." }, 404);
  return json({ ok: true });
}

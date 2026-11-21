import { json, isAdmin, unauthorized } from "../../../../lib/util.js";
import { validatePartner, publicPartner } from "../../../../lib/partners.js";

// Добавя партньор най-отзад.
export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Невалидна заявка." }, 400);
  const { partner: p, error } = validatePartner(body, { requireLogo: true });
  if (error) return json({ error }, 400);
  const { next } = await env.DB.prepare("SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM partners").first();
  const row = await env.DB.prepare(
    "INSERT INTO partners (name, url, bg, sort, logo, mime) VALUES (?, ?, ?, ?, ?, ?) RETURNING id, name, url, bg, updated_at"
  ).bind(p.name, p.url, p.bg, next, p.logo, p.mime).first();
  return json({ ok: true, partner: publicPartner(row) }, 201);
}

// Подрежда наново: { ids: [3, 1, 2] }.
export async function onRequestPut({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const { ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || !ids.every(Number.isInteger)) return json({ error: "Невалиден ред." }, 400);
  await env.DB.batch(ids.map((id, i) => env.DB.prepare("UPDATE partners SET sort = ? WHERE id = ?").bind(i + 1, id)));
  return json({ ok: true });
}

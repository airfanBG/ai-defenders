import { json, isAdmin, unauthorized } from "../../../../lib/util.js";
import { HELP, ATTACKS, GENERATED, FAQ, WEIGHTS, newSecret, newAccessCode, score } from "../../../../lib/arena.js";
import { DEMOS } from "../../../../lib/arena-run.js";

// Всичко за таба „Арена“: одобрените екипи с адреса и тайната им, атаките и точките до момента.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const { results: teams } = await env.DB.prepare(
    `SELECT t.id AS team_id, t.name, a.endpoint, a.secret, a.access_code FROM teams t
     LEFT JOIN arena_targets a ON a.team_id = t.id WHERE t.status = 'approved' ORDER BY t.name`
  ).all();
  const { results: rows } = await env.DB.prepare("SELECT team_id, wave, item, leaked, ok, ms FROM arena_results").all();
  for (const t of teams) {
    const mine = rows.filter((r) => r.team_id === t.team_id);
    t.score = score(mine);
    t.done = Object.fromEntries([0, 1, 2, 3, 4].map((w) => [w, mine.filter((r) => r.wave === w).length]));
  }
  const items = {
    0: HELP.map((h) => ({ id: h.id, text: h.q })),
    ...Object.fromEntries([1, 2, 3, 4].map((w) => [w, [...ATTACKS, ...GENERATED].filter((a) => a.wave === w).map(({ id, text }) => ({ id, text }))])),
  };
  return json({ teams, items, faq: FAQ, weights: WEIGHTS });
}

// Адрес и/или нова тайна за един екип: {team_id, endpoint?, newSecret?: true}.
export async function onRequestPut({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const b = await request.json().catch(() => ({}));
  const team = await env.DB.prepare("SELECT id FROM teams WHERE id = ? AND status = 'approved'").bind(Number(b.team_id) || 0).first();
  if (!team) return json({ error: "Няма такъв одобрен екип." }, 404);
  const cur = await env.DB.prepare("SELECT * FROM arena_targets WHERE team_id = ?").bind(team.id).first();
  let endpoint = cur?.endpoint ?? null;
  if (typeof b.endpoint === "string") {
    endpoint = b.endpoint.trim() || null;
    if (endpoint && !DEMOS.includes(endpoint) && !/^https?:\/\/[^\s]+$/i.test(endpoint))
      return json({ error: "Адресът трябва да започва с https:// (или demo, demo:filter, demo:smart за пробните асистенти)." }, 400);
  }
  // Новата тайна идва с нов код за достъп.
  const fresh = b.newSecret || !cur;
  const secret = fresh ? newSecret() : cur.secret;
  const accessCode = fresh || !cur.access_code ? newAccessCode() : cur.access_code;
  await env.DB.prepare(
    `INSERT INTO arena_targets (team_id, endpoint, secret, access_code) VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET endpoint = excluded.endpoint, secret = excluded.secret,
       access_code = excluded.access_code, updated_at = datetime('now')`
  ).bind(team.id, endpoint, secret, accessCode).run();
  return json({ ok: true, endpoint, secret, access_code: accessCode });
}

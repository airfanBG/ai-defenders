import { json } from "../../../lib/util.js";
import { hashKey } from "../../../lib/llm.js";
import { newSecret, newAccessCode, score } from "../../../lib/arena.js";

// Страницата на екипа: всичко се отключва с ключа за модела (Authorization: Bearer fmi_…).
export async function teamFromKey(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token.startsWith("fmi_")) return null;
  return env.DB.prepare(
    `SELECT k.team_id, t.name FROM llm_keys k JOIN teams t ON t.id = k.team_id
     WHERE k.key_hash = ? AND k.active = 1 AND t.status = 'approved'`
  ).bind(await hashKey(token)).first();
}

const denied = () => json({ error: "Невалиден или спрян ключ. Ключа ви го дават организаторите." }, 401);

// Тайната, кодът за достъп, адресът и резултатите на екипа (само неговите).
export async function onRequestGet({ request, env }) {
  const team = await teamFromKey(request, env);
  if (!team) return denied();
  let target = await env.DB.prepare("SELECT endpoint, secret, access_code FROM arena_targets WHERE team_id = ?").bind(team.team_id).first();
  if (!target) {
    // Първо влизане: екипът получава своята тайна и своя код за достъп.
    target = { endpoint: null, secret: newSecret(), access_code: newAccessCode() };
    await env.DB.prepare("INSERT INTO arena_targets (team_id, endpoint, secret, access_code) VALUES (?, NULL, ?, ?)")
      .bind(team.team_id, target.secret, target.access_code).run();
  } else if (!target.access_code) {
    target.access_code = newAccessCode();
    await env.DB.prepare("UPDATE arena_targets SET access_code = ? WHERE team_id = ?").bind(target.access_code, team.team_id).run();
  }
  const { results } = await env.DB.prepare(
    "SELECT wave, item, leaked, ok, ms, prompt, reply FROM arena_results WHERE team_id = ? ORDER BY wave, id"
  ).bind(team.team_id).all();
  return json({ team: team.name, secret: target.secret, access_code: target.access_code, endpoint: target.endpoint, score: score(results), results });
}

// Екипът сам записва адреса на асистента си (при Cloudflare Tunnel той се сменя при всяко пускане).
export async function onRequestPut({ request, env }) {
  const team = await teamFromKey(request, env);
  if (!team) return denied();
  const b = await request.json().catch(() => ({}));
  const endpoint = typeof b.endpoint === "string" ? b.endpoint.trim() : "";
  if (!/^https:\/\/[^\s]+$/i.test(endpoint)) return json({ error: "Адресът трябва да започва с https://, например https://нещо.trycloudflare.com" }, 400);
  await env.DB.prepare(
    `INSERT INTO arena_targets (team_id, endpoint, secret, access_code) VALUES (?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET endpoint = excluded.endpoint, updated_at = datetime('now')`
  ).bind(team.team_id, endpoint, newSecret(), newAccessCode()).run();
  return json({ ok: true, endpoint });
}

import { json } from "../../../lib/util.js";
import { loadSettings } from "../../../lib/settings.js";
import { score, WEIGHTS } from "../../../lib/arena.js";

// Публичното класиране: само имена и точки, без тайни, адреси и отговори.
export async function onRequestGet({ env }) {
  const settings = await loadSettings(env);
  const { results: teams } = await env.DB.prepare(
    `SELECT t.id, t.name FROM teams t JOIN arena_targets a ON a.team_id = t.id
     WHERE t.status = 'approved' AND a.endpoint IS NOT NULL`
  ).all();
  const { results: rows } = await env.DB.prepare("SELECT team_id, wave, leaked, ok, ms FROM arena_results").all();
  const waves = [...new Set(rows.map((r) => r.wave))].sort();
  const board = teams.map((t) => {
    const s = score(rows.filter((r) => r.team_id === t.id));
    return { name: t.name, ...s };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "bg"));
  return json({ name: settings.name, weights: WEIGHTS, waves, board, at: new Date().toISOString() });
}

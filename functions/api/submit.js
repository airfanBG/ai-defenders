import { json, isAdmin } from "../../lib/util.js";
import { loadSettings } from "../../lib/settings.js";
import { submitWindow, freezeTime, sofiaTime, validateSubmission } from "../../lib/submit.js";

// Дали предаването е отворено, до колко е code freeze и кои екипи могат да предават.
export async function onRequestGet({ request, env }) {
  const settings = await loadSettings(env);
  const { day, open } = submitWindow(settings);
  const preview = !open && (await isAdmin(request, env));
  let teams = [];
  if (open || preview) {
    const { results } = await env.DB.prepare("SELECT id, name FROM teams WHERE status = 'approved'").all();
    teams = results.sort((a, b) => a.name.localeCompare(b.name, "bg"));
  }
  return json({ open, preview, day, name: settings.name, freeze: freezeTime(settings), now: sofiaTime(), teams });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Невалидна заявка." }, 400); }
  if (body.website) return json({ ok: true }, 201); // капан за ботове

  const settings = await loadSettings(env);
  if (!submitWindow(settings).open) return json({ error: "Предаването е отворено само в деня на хакатона." }, 403);

  const { data, error } = validateSubmission(body);
  if (error) return json({ error }, 400);

  let key, teamId = null, teamName;
  if (body.teamId === "other") {
    teamName = typeof body.otherName === "string" ? body.otherName.trim().slice(0, 40) : "";
    if (teamName.length < 2) return json({ error: "Напиши името на екипа си." }, 400);
    key = "name:" + teamName.toLowerCase();
  } else {
    const team = await env.DB.prepare("SELECT id, name, members FROM teams WHERE id = ? AND status = 'approved'")
      .bind(Number(body.teamId) || 0).first();
    if (!team) return json({ error: "Избери екипа си от списъка." }, 400);
    const emails = JSON.parse(team.members || "[]").map((m) => String(m.email || "").toLowerCase());
    if (!emails.includes(data.email)) return json({ error: `Този имейл не е от екип „${team.name}“. Ползвай имейла, с който си записан(а).` }, 400);
    key = "id:" + team.id; teamId = team.id; teamName = team.name;
  }

  const freeze = freezeTime(settings);
  const late = freeze && sofiaTime() > freeze ? 1 : 0;
  const prev = await env.DB.prepare("SELECT id FROM submissions WHERE team_key = ?").bind(key).first();
  await env.DB.prepare(
    `INSERT INTO submissions (team_key, team_id, team_name, email, repo, demo, description, today, late)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_key) DO UPDATE SET team_name = excluded.team_name, email = excluded.email, repo = excluded.repo,
       demo = excluded.demo, description = excluded.description, today = excluded.today, late = excluded.late,
       updated_at = datetime('now')`
  ).bind(key, teamId, teamName, data.email, data.repo, data.demo || null, data.description, data.today || null, late).run();
  return json({ ok: true, team: teamName, updated: !!prev, late: !!late }, 201);
}

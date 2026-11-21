import { json } from "../../lib/util.js";
import { loadSettings } from "../../lib/settings.js";
import { freezeTime, juryKey, teamsWithSubmissions } from "../../lib/submit.js";

// Предадените решения за журито. Достъп само с ключа от линка (QR в админа), без имейли.
export async function onRequestGet({ request, env }) {
  const k = new URL(request.url).searchParams.get("k") || "";
  const key = await juryKey(env);
  if (!key || k !== key) return json({ error: "Линкът за журито не е валиден. Сканирайте пак QR кода от организаторите." }, 403);
  const settings = await loadSettings(env);
  const rows = (await teamsWithSubmissions(env)).map(({ table, name, s }) => ({
    table, name,
    s: s && { repo: s.repo, demo: s.demo, description: s.description, today: s.today, late: !!s.late, at: s.updated_at },
  }));
  return json({ name: settings.name, freeze: freezeTime(settings), rows });
}

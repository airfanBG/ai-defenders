import { json, sha256, hex, isAdmin } from "../../lib/util.js";
import { loadSettings } from "../../lib/settings.js";
import { feedbackWindow } from "../../lib/feedback.js";

// В залата всички са в една мрежа, затова лимитът на IP е щедър.
const PER_IP_PER_HOUR = 60;
// Позволените стойности за клас/курс (същите са в sertifikat.html).
export const GRADES = {
  "ученик": ["8 клас", "9 клас", "10 клас", "11 клас", "12 клас"],
  "студент": ["1 курс", "2 курс", "3 курс", "4 курс", "5 курс", "6 курс", "магистър", "докторант"],
};
// "мария иванова" → "Мария Иванова". Думи, писани с главни/смесени букви, не се пипат.
const capitalize = (s) => s.split(" ").map((w) => (w === w.toLocaleLowerCase("bg") ? w.charAt(0).toLocaleUpperCase("bg") + w.slice(1) : w)).join(" ");
const str = (v, max) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

// Отворено е в деня на хакатона, като анкетата. Админът може да го разгледа по всяко време.
export async function onRequestGet({ request, env }) {
  const settings = await loadSettings(env);
  const { day, open } = feedbackWindow(settings);
  const preview = !open && (await isAdmin(request, env));
  let teams = [];
  if (open || preview) {
    const { results } = await env.DB.prepare("SELECT id, name FROM teams WHERE status = 'approved'").all();
    teams = results.sort((a, b) => a.name.localeCompare(b.name, "bg"));
  }
  return json({ open, preview, day, name: settings.name, teams, grades: GRADES });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Невалидна заявка." }, 400); }
  if (body.website) return json({ ok: true }, 201); // капан за ботове

  const settings = await loadSettings(env);
  if (!feedbackWindow(settings).open) return json({ error: "Формата е отворена само в деня на хакатона." }, 403);

  const fullName = capitalize(str(body.fullName, 100));
  const school = str(body.school, 150);
  if (fullName.length < 5 || fullName.split(" ").length < 2) return json({ error: "Напиши трите си имена, както да излязат на сертификата." }, 400);
  const kind = GRADES[body.kind] ? body.kind : "";
  if (!kind) return json({ error: "Избери дали си ученик или студент." }, 400);
  const grade = GRADES[kind].includes(body.grade) ? body.grade : "";
  if (!grade) return json({ error: kind === "ученик" ? "Избери в кой клас си." : "Избери в кой курс си." }, 400);
  if (school.length < 2) return json({ error: kind === "ученик" ? "Напиши училището си." : "Напиши университета си." }, 400);

  // Екипът е задължителен: от списъка или написан на ръка („моят екип не е в списъка“).
  let teamId = null, teamName = null;
  if (body.teamId === "other") {
    teamName = str(body.otherTeam, 40);
    if (teamName.length < 2) return json({ error: "Напиши името на екипа си." }, 400);
  } else {
    const team = await env.DB.prepare("SELECT id, name FROM teams WHERE id = ? AND status = 'approved'").bind(Number(body.teamId) || 0).first();
    if (!team) return json({ error: "Избери екипа си." }, 400);
    teamId = team.id; teamName = team.name;
  }

  const ip = request.headers.get("cf-connecting-ip") || "local";
  const ipHash = hex(await sha256("cert" + ip + (env.ADMIN_PASSWORD || ""))).slice(0, 32);
  const { c } = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM certificates WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
  ).bind(ipHash).first();
  if (c >= PER_IP_PER_HOUR) return json({ error: "Твърде много записи от тази мрежа. Опитай пак след малко." }, 429);

  await env.DB.prepare("INSERT INTO certificates (full_name, school, kind, grade, team_id, team_name, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(fullName, school, kind, grade, teamId, teamName, ipHash).run();
  return json({ ok: true, fullName }, 201);
}

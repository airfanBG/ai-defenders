import { json, sha256, hex } from "../../lib/util.js";
import { loadSettings } from "../../lib/settings.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RATE_LIMIT_PER_HOUR = 3;

function registrationOpen(settings) {
  return Date.now() < Date.parse(settings.regCloses);
}

// Публичен списък: само одобрените отбори и само имената им.
export async function onRequestGet({ env }) {
  const settings = await loadSettings(env);
  const { results } = await env.DB.prepare(
    "SELECT name, json_array_length(members) AS size FROM teams WHERE status = 'approved' ORDER BY created_at"
  ).all();
  const { total } = await env.DB.prepare("SELECT COUNT(*) AS total FROM teams WHERE status != 'rejected'").first();
  return json({ teams: results, total, max: settings.maxTeams, open: registrationOpen(settings), regCloses: settings.regCloses });
}

function str(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function validate(body, settings) {
  const name = str(body.name, 41);
  if (name.length < 2 || name.length > 40) return { error: "Името на екипа трябва да е между 2 и 40 символа." };

  const { minMembers: min, maxMembers: max } = settings;
  if (!Array.isArray(body.members) || body.members.length < min || body.members.length > max)
    return { error: min === max ? `Екипът трябва да е точно ${min} души.` : `Екипът трябва да е от ${min} до ${max} души.` };

  const members = [];
  const emails = new Set();
  for (const [i, m] of body.members.entries()) {
    const member = {
      name: str(m?.name, 60),
      email: str(m?.email, 120).toLowerCase(),
      school: str(m?.school, 100),
      grade: str(m?.grade, 30),
    };
    const n = i + 1;
    if (member.name.length < 2) return { error: `Член ${n}: напиши име.` };
    if (!EMAIL_RE.test(member.email)) return { error: `Член ${n}: имейлът не изглежда валиден.` };
    if (!member.school) return { error: `Член ${n}: напиши специалност, училище или работа.` };
    if (emails.has(member.email)) return { error: `Член ${n}: този имейл вече е в екипа.` };
    emails.add(member.email);
    members.push(member);
  }

  if (body.consent !== true) return { error: "Трябва да се съгласиш с регламента." };

  return { team: { name, members, mentor: str(body.mentor, 80), idea: str(body.idea, 500) } };
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Невалидна заявка." }, 400);
  }

  // Капан за ботове: скрито поле, което хората не виждат.
  if (body.website) return json({ ok: true }, 201);

  const settings = await loadSettings(env);
  if (!registrationOpen(settings)) return json({ error: "Регистрацията е затворена." }, 403);

  const { team, error } = validate(body, settings);
  if (error) return json({ error }, 400);

  const ip = request.headers.get("cf-connecting-ip") || "local";
  const ipHash = hex(await sha256(ip + (env.ADMIN_PASSWORD || ""))).slice(0, 32);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM teams WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')"
  ).bind(ipHash).first();
  if (recent.c >= RATE_LIMIT_PER_HOUR) return json({ error: "Твърде много регистрации. Опитай пак след час." }, 429);

  const { total } = await env.DB.prepare("SELECT COUNT(*) AS total FROM teams WHERE status != 'rejected'").first();
  if (total >= settings.maxTeams) return json({ error: "Местата свършиха. Пиши ни, ако искаш да си в списъка с чакащи." }, 409);

  try {
    await env.DB.prepare("INSERT INTO teams (name, members, mentor, idea, ip_hash) VALUES (?, ?, ?, ?, ?)")
      .bind(team.name, JSON.stringify(team.members), team.mentor || null, team.idea || null, ipHash)
      .run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) return json({ error: "Екип с това име вече има. Измислете друго." }, 409);
    throw e;
  }

  return json({ ok: true }, 201);
}

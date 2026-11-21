// Предаването на решенията: кога е отворено, кога е code freeze и проверка на полетата.
import { feedbackWindow } from "./feedback.js";

// Отворено е през целия ден на хакатона (като анкетата). След code freeze още се приема, но се маркира.
export const submitWindow = feedbackWindow;

// Часът на code freeze от програмата в „Настройки“ („16:30“) или "" ако го няма.
export function freezeTime(settings) {
  for (const d of settings.schedule || []) for (const [t, what] of d.items || [])
    if (/freeze/i.test(what) && /^\d{1,2}:\d{2}$/.test(t)) return t.padStart(5, "0");
  return "";
}

export const sofiaTime = (d = new Date()) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const URL_RE = /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i;

// Връща { data } или { error }.
export function validateSubmission(body) {
  const repo = str(body?.repo, 300);
  const demo = str(body?.demo, 300);
  const description = str(body?.description, 1000);
  const today = str(body?.today, 800);
  const email = str(body?.email, 120).toLowerCase();
  if (!URL_RE.test(repo)) return { error: "Сложи пълен линк към кода, например https://github.com/екип/проект." };
  if (demo && !URL_RE.test(demo)) return { error: "Линкът към демото не изглежда като адрес (https://…). Остави го празен, ако нямате." };
  if (description.length < 20) return { error: "Описанието е твърде кратко: 1–2 изречения за проблема, целта, решението и резултатите." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Попълни имейла, с който си записан(а) в екипа." };
  return { data: { repo, demo, description, today, email } };
}

// Ключът в линка за журито. Изчислява се от паролата на админа, затова не се пази никъде
// и се сменя, ако се смени паролата.
export async function juryKey(env) {
  if (!env.ADMIN_PASSWORD) return "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("jury:" + env.ADMIN_PASSWORD));
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Одобрените екипи с номерата на масите (азбучно, като табелките) и предаденото от тях.
export async function teamsWithSubmissions(env) {
  const { results: teams } = await env.DB.prepare("SELECT id, name FROM teams WHERE status = 'approved'").all();
  const { results: subs } = await env.DB.prepare("SELECT * FROM submissions ORDER BY updated_at").all();
  teams.sort((a, b) => a.name.localeCompare(b.name, "bg"));
  const byId = new Map(subs.filter((s) => s.team_id).map((s) => [s.team_id, s]));
  const ids = new Set(teams.map((t) => t.id));
  return [
    ...teams.map((t, i) => ({ table: i + 1, name: t.name, s: byId.get(t.id) || null })),
    ...subs.filter((s) => !s.team_id || !ids.has(s.team_id)).map((s) => ({ table: null, name: s.team_name, s })),
  ];
}

// Изпращане на имейли. Два начина:
// 1) Gmail SMTP (препоръчително): тайни SMTP_USER (gmail адрес) и SMTP_PASS (парола за приложения).
//    Подател е самият Gmail адрес, затова писмата минават проверките и не влизат в спам.
// 2) Brevo: таен BREVO_API_KEY и потвърден в Brevo подател.
import { WorkerMailer } from "worker-mailer";

const pad = (n) => String(n).padStart(2, "0");
const DAYS = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];

// Датите се показват в българско време, независимо къде върви сървърът.
function sofia(iso) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Sofia", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
    }).formatToParts(new Date(iso)).map((p) => [p.type, p.value])
  );
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  return { date: `${parts.day}.${parts.month}.${parts.year}`, time: `${parts.hour}:${parts.minute}`, weekday: DAYS[wd] };
}

export const PLACEHOLDERS = ["хакатон", "име", "екип", "членове", "дата", "час", "място", "програма", "сайт", "контакт", "discord"];

export function templateVars(settings, team, member, origin) {
  const start = sofia(settings.start);
  const schedule = settings.schedule
    .map((d) => `${d.day}\n` + d.items.map(([t, w]) => `  ${t}  ${w}`).join("\n"))
    .join("\n\n");
  return {
    хакатон: settings.name,
    име: member.name.split(" ")[0],
    екип: team.name,
    членове: team.members.map((m) => m.name).join(", "),
    дата: `${start.date} (${start.weekday})`,
    час: start.time,
    място: settings.place || "ще бъде обявено",
    програма: schedule,
    сайт: origin + "/",
    контакт: settings.email || "",
    discord: settings.discord || "",
  };
}

export function render(text, vars) {
  return text.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (m, key) => (key in vars ? vars[key] : m));
}

const escHtml = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const linkify = (t) => t.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" style="color:#d6337a">${u}</a>`);
const mapsUrl = (q) => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

// Един ред от шаблона. Редът с 📍 става маркер като в Google Maps, а мястото е линк към картата.
function htmlLine(raw, origin) {
  const pin = raw.match(/^\s*📍\uFE0F?\s*((?:[^:\s][^:]{0,14}:\s*)?)(.+)$/u);
  if (pin) {
    const [, label, place] = pin;
    const icon = `<img src="${origin}/mail/pin.png" width="14" height="20" alt="" style="vertical-align:-4px;margin-right:6px;border:0">`;
    return `${icon}${escHtml(label)}<a href="${mapsUrl(place.trim())}" style="color:#111">${escHtml(place.trim())}</a>`;
  }
  const lead = raw.match(/^ */)[0].length;
  return "&nbsp;".repeat(lead) + linkify(escHtml(raw.slice(lead)));
}

// Пощенските програми (Gmail, Outlook) не уважават white-space: pre-wrap,
// затова всеки ред става <br>, а всеки празен ред започва нов абзац.
export function toHtml(text, origin = "") {
  const blocks = text.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  const html = blocks.map((block) => {
    const lines = block.split("\n").map((l) => htmlLine(l, origin));
    // „1. Какъв е проблемът?“ → удебелено заглавие на точката.
    if (/^\d+\.\s/.test(block)) lines[0] = `<b style="font-size:16px">${lines[0]}</b>`;
    return `<p style="margin:0 0 16px">${lines.join("<br>")}</p>`;
  }).join("\n");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:640px">${html}</div>`;
}

export function mailProvider(env) {
  if (env.SMTP_USER && env.SMTP_PASS) return "gmail";
  if (env.BREVO_API_KEY) return "brevo";
  return null;
}

// Google показва паролата за приложения на групи с особени интервали (не обикновени),
// които се копират заедно с нея. Оставяме само видимите ASCII знаци.
function appPassword(raw) {
  return raw.replace(/[^\x21-\x7e]/g, "");
}

async function sendSmtp(env, settings, to, subject, body, origin) {
  const user = env.SMTP_USER.trim();
  try {
    await WorkerMailer.send(
      {
        host: env.SMTP_HOST || "smtp.gmail.com",
        port: Number(env.SMTP_PORT || 465),
        secure: true,
        credentials: { username: user, password: appPassword(env.SMTP_PASS) },
        authType: "plain",
      },
      {
        from: { name: settings.mail.senderName || settings.name, email: user },
        reply: settings.email || user,
        to: { name: to.name, email: to.email },
        subject,
        text: body,
        html: toHtml(body, origin),
      }
    );
  } catch (e) {
    const msg = String(e?.message || e);
    const hint = /auth|535|534|credentials/i.test(msg) ? " Провери SMTP_USER и паролата за приложения (16 знака от Google)." : "";
    throw new Error(`Gmail отказа: ${msg}.${hint}`);
  }
}

export async function sendOne(env, settings, to, subject, body, origin = "") {
  if (mailProvider(env) === "gmail") return sendSmtp(env, settings, to, subject, body, origin);
  const key = (env.BREVO_API_KEY || "").trim(); // при поставяне понякога се хваща интервал или нов ред
  if (!key) throw new Error("Имейлите не са настроени: липсва BREVO_API_KEY.");
  const mail = settings.mail;
  if (!mail.senderEmail) throw new Error("Попълни имейл на подателя в настройките.");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: mail.senderName || settings.name, email: mail.senderEmail },
      replyTo: { email: settings.email || mail.senderEmail },
      to: [{ email: to.email, name: to.name }],
      subject,
      textContent: body,
      htmlContent: toHtml(body, origin),
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const hint = res.status === 401 ? " Провери дали ключът е от „API Keys“ (започва с xkeysib-), а не SMTP ключ." : "";
    throw new Error(`Brevo отказа (${res.status}): ${data.message || "неизвестна грешка"}.${hint}`);
  }
}

// Праща персонален имейл на всеки член. Връща колко са изпратени и грешките.
// kind: "approve" (записани сте), "reject" (местата са заети) или "broadcast" (писмо до всички).
const TEMPLATES = {
  approve: ["subject", "body"],
  reject: ["rejectSubject", "rejectBody"],
  broadcast: ["broadcastSubject", "broadcastBody"],
};

export async function sendTeamEmail(env, settings, team, origin, recipients = team.members, kind = "approve") {
  const [subjectKey, bodyKey] = TEMPLATES[kind] || TEMPLATES.approve;
  const subject = settings.mail[subjectKey];
  const text = settings.mail[bodyKey];
  let sent = 0;
  const errors = [];
  for (const m of recipients) {
    const vars = templateVars(settings, team, m, origin);
    try {
      await sendOne(env, settings, m, render(subject, vars), render(text, vars), origin);
      sent++;
    } catch (e) {
      errors.push(`${m.email}: ${e.message}`);
    }
  }
  return { sent, total: recipients.length, errors };
}

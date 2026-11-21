import { json, isAdmin, unauthorized } from "../../../lib/util.js";
import { loadSettings, validateSettings } from "../../../lib/settings.js";
import { mailProvider } from "../../../lib/mail.js";

// Пълните настройки, включително шаблона за имейл.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const provider = mailProvider(env);
  return json({ ...(await loadSettings(env)), mailReady: Boolean(provider), provider, smtpUser: provider === "gmail" ? env.SMTP_USER.trim() : "" });
}

export async function onRequestPut({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: "Невалидна заявка." }, 400);

  const { settings, error } = validateSettings(body);
  if (error) return json({ error }, 400);

  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(JSON.stringify(settings)).run();
  return json({ ok: true, settings });
}

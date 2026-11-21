import { json, isAdmin, unauthorized } from "../../../lib/util.js";

const LABELS = {
  requests: "изпратено към Brevo", delivered: "доставено", opened: "отворено", clicks: "цъкнат линк",
  deferred: "отложено", softBounces: "временно отказано", hardBounces: "отказано", blocked: "блокирано",
  invalid: "невалиден адрес", spam: "отбелязано като спам", error: "грешка", unsubscribed: "отписан",
};

// Последните събития от Brevo: какво е станало с всяко писмо.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const key = (env.BREVO_API_KEY || "").trim();
  if (!key) return json({ error: "Липсва BREVO_API_KEY." }, 400);

  const res = await fetch("https://api.brevo.com/v3/smtp/statistics/events?limit=30&sort=desc", {
    headers: { "api-key": key, accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return json({ error: `Brevo отказа (${res.status}): ${data.message || "неизвестна грешка"}` }, 502);

  const events = (data.events || []).map((e) => ({
    date: e.date, email: e.email, subject: e.subject, from: e.from,
    event: LABELS[e.event] || e.event, bad: !["requests", "delivered", "opened", "clicks"].includes(e.event),
    reason: e.reason || "",
  }));
  // Състояние на акаунта и подателите: най-честите причини писмата да не тръгват.
  const h = { headers: { "api-key": key, accept: "application/json" } };
  const [acc, snd] = await Promise.all([
    fetch("https://api.brevo.com/v3/account", h).then((r) => r.json()).catch(() => ({})),
    fetch("https://api.brevo.com/v3/senders", h).then((r) => r.json()).catch(() => ({})),
  ]);
  const account = {
    relayEnabled: acc.relay ? acc.relay.enabled : null,
    plan: (acc.plan || []).map((p) => `${p.type}${p.credits != null ? ` (${p.credits} кредита)` : ""}`).join(", "),
  };
  const senders = (snd.senders || []).map((x) => ({ email: x.email, active: x.active }));
  return json({ events, account, senders });
}

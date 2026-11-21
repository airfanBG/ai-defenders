import { json, isAdmin, unauthorized } from "../../../lib/util.js";
import { loadSettings } from "../../../lib/settings.js";
import { sendTeamEmail } from "../../../lib/mail.js";

// Пробен имейл с измислен екип, за да видиш как изглежда шаблонът.
export async function onRequestPost({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const { to, kind } = await request.json().catch(() => ({}));
  if (typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return json({ error: "Напиши валиден имейл." }, 400);

  const settings = await loadSettings(env);
  const team = {
    name: "Тестов екип",
    members: [{ name: "Тест Тестов", email: to }, { name: "Мария Примерова", email: "" }],
  };
  // Пращаме само на първия член: на твоя адрес.
  const result = await sendTeamEmail(env, settings, team, new URL(request.url).origin, [team.members[0]], ["reject", "broadcast"].includes(kind) ? kind : "approve");
  if (!result.sent) return json({ error: result.errors[0] || "Не успях да изпратя." }, 502);
  return json({ ok: true });
}

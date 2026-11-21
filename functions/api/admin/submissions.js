import { json, isAdmin, unauthorized } from "../../../lib/util.js";
import { loadSettings } from "../../../lib/settings.js";
import { submitWindow, freezeTime, juryKey } from "../../../lib/submit.js";

// Всички предадени решения за таба „Решения“ в админа, плюс ключа за линка на журито.
export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();
  const settings = await loadSettings(env);
  const { results } = await env.DB.prepare("SELECT * FROM submissions ORDER BY updated_at").all();
  return json({ ...submitWindow(settings), freeze: freezeTime(settings), juryKey: await juryKey(env), submissions: results });
}

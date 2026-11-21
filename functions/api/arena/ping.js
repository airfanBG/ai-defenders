import { json } from "../../../lib/util.js";
import { teamFromKey } from "./me.js";

// Проба на връзката: пращаме един нормален въпрос до асистента на екипа и връщаме отговора.
// Не се записва в класирането.
export async function onRequestPost({ request, env }) {
  const team = await teamFromKey(request, env);
  if (!team) return json({ error: "Невалиден или спрян ключ." }, 401);
  const target = await env.DB.prepare("SELECT endpoint FROM arena_targets WHERE team_id = ?").bind(team.team_id).first();
  if (!target?.endpoint) return json({ error: "Първо запишете адреса на асистента." }, 400);
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(target.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "fmi-arena/1" },
      body: JSON.stringify({ message: "Здравей! Кога е срокът за кандидатстване?" }),
      signal: ctrl.signal,
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) return json({ ok: false, ms, error: `Асистентът върна HTTP ${res.status}: ${text.slice(0, 200)}` });
    let data;
    try { data = JSON.parse(text); } catch { return json({ ok: false, ms, error: "Отговорът не е JSON. Трябва да е {\"reply\": \"…\"}." }); }
    if (typeof data.reply !== "string") return json({ ok: false, ms, error: "Липсва полето reply в отговора." });
    return json({ ok: true, ms, reply: data.reply.slice(0, 1000) });
  } catch (e) {
    return json({ ok: false, ms: Date.now() - started, error: e.name === "AbortError" ? "Няма отговор за 20 секунди. Пуснат ли е асистентът и тунелът?" : "Не се свързах: " + e.message });
  } finally {
    clearTimeout(timer);
  }
}

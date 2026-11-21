// Общият модел за хакатона „Пазителят на тайната“: настройки, ключове на екипите и самата заявка.
// Моделът е от Cloudflare Workers AI (binding AI в wrangler.toml). Екипите не говорят с него
// директно, а през /api/llm с личен ключ, за да има лимити и запис.
import { sha256, hex } from "./util.js";

// Моделите, между които админът избира. Всички са от каталога на Workers AI (проверено 21.11.2026:
// wrangler ai models list). Cloudflare спира стари модели, затова списъкът се преглежда преди събитие.
// Пробвани на български: Mistral Small отговаря за 1–2 с, Llama 3.3 70B за 1–8 с.
// Gemma 4 и Qwen 3.8 „мислят“ 20–75 с на отговор, а EuroLLM не приема чат, затова не са тук.
export const MODELS = [
  ["@cf/mistralai/mistral-small-3.1-24b-instruct", "Mistral Small 3.1 24B (бърз, добър на български)"],
  ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "Llama 3.3 70B (по-голям, по-бавен и по-скъп)"],
];

const DEFAULTS = { enabled: false, model: MODELS[0][0], maxTokens: 512 };

export async function loadLlmSettings(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'llm'").first();
  const s = { ...DEFAULTS, ...(row ? JSON.parse(row.value) : {}) };
  // Модел, махнат от списъка (например спрян от Cloudflare), се сменя с първия от списъка.
  if (!MODELS.some(([id]) => id === s.model)) s.model = DEFAULTS.model;
  return s;
}

export async function saveLlmSettings(env, b) {
  const s = {
    enabled: b.enabled === true,
    model: MODELS.some(([id]) => id === b.model) ? b.model : DEFAULTS.model,
    maxTokens: Math.max(64, Math.min(2048, Number(b.maxTokens) || DEFAULTS.maxTokens)),
  };
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('llm', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(JSON.stringify(s)).run();
  return s;
}

export const hashKey = async (key) => hex(await sha256("llmkey:" + key));

export function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return "fmi_" + hex(bytes);
}

// Проверява съобщенията: само позволените роли и разумна дължина.
export function validateMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) return { error: "Липсва messages: списък от {role, content}." };
  if (messages.length > 50) return { error: "Твърде много съобщения (до 50)." };
  let total = 0;
  const out = [];
  for (const m of messages) {
    if (!m || !["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string")
      return { error: "Всяко съобщение трябва да е {role: system|user|assistant, content: текст}." };
    total += m.content.length;
    out.push({ role: m.role, content: m.content });
  }
  if (total > 20000) return { error: "Текстът е твърде дълъг (до 20 000 знака общо)." };
  return { messages: out };
}

export async function runModel(env, settings, messages, maxTokens, temperature) {
  if (!env.AI) throw new Error("Workers AI не е свързан (липсва binding AI).");
  const t = Number(temperature);
  const out = await env.AI.run(settings.model, {
    messages,
    max_tokens: Math.max(16, Math.min(settings.maxTokens, Number(maxTokens) || settings.maxTokens)),
    ...(Number.isFinite(t) ? { temperature: Math.max(0, Math.min(2, t)) } : {}),
  });
  // Старите модели връщат {response}, новите — като OpenAI: {choices:[{message:{content}}]}.
  if (typeof out?.response === "string") return out.response;
  const msg = out?.choices?.[0]?.message;
  if (typeof msg?.content === "string") return msg.content;
  if (out?.response != null) return typeof out.response === "object" ? JSON.stringify(out.response) : String(out.response);
  return "";
}

export async function logCall(env, keyId, model, ok, ms, prompt, reply) {
  await env.DB.prepare("INSERT INTO llm_log (key_id, model, ok, ms, prompt, reply) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(keyId, model, ok ? 1 : 0, ms, String(prompt || "").slice(0, 500), String(reply || "").slice(0, 500)).run()
    .catch(() => {});
}

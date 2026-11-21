export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare("SELECT logo, mime FROM partners WHERE id = ?").bind(params.id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const bytes = Uint8Array.from(atob(row.logo), (c) => c.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "content-type": row.mime,
      "x-content-type-options": "nosniff",
      // Адресът съдържа ?v=<дата на промяна>, така че може да се кешира дълго.
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

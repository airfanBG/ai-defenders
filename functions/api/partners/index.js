import { json } from "../../../lib/util.js";
import { publicPartner } from "../../../lib/partners.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT id, name, url, bg, updated_at FROM partners ORDER BY sort, id").all();
  return json({ partners: results.map(publicPartner) });
}

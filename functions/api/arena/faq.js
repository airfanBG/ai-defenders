import { json } from "../../../lib/util.js";
import { FAQ } from "../../../lib/arena.js";

// Справката, по която асистентите отговарят. Публична: шаблоните я теглят при старт.
export function onRequestGet() {
  return json({ faq: FAQ });
}

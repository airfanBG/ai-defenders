import { json } from "../../lib/util.js";
import { loadSettings, publicSettings } from "../../lib/settings.js";

export async function onRequestGet({ env }) {
  return json(publicSettings(await loadSettings(env)));
}

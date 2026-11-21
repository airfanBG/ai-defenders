import { json, isAdmin, unauthorized, parseTeam } from "../../../../lib/util.js";

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(teams) {
  const head = ["Екип", "Статус", "Член", "Имейл", "Специалност/училище/работа", "Курс/клас", "Ментор", "Идея", "Регистриран"];
  const rows = [head];
  for (const t of teams) {
    for (const m of t.members) {
      rows.push([t.name, t.status, m.name, m.email, m.school, m.grade, t.mentor, t.idea, t.created_at]);
    }
  }
  // BOM, за да отвори Excel кирилицата правилно.
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return unauthorized();

  const { results } = await env.DB.prepare(
    "SELECT id, name, members, mentor, idea, status, created_at, notified_at, broadcast_at FROM teams ORDER BY created_at DESC"
  ).all();
  const teams = results.map(parseTeam);

  if (new URL(request.url).searchParams.get("format") === "csv") {
    return new Response(toCsv(teams), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="ekipi.csv"',
        "cache-control": "no-store",
      },
    });
  }
  return json({ teams });
}

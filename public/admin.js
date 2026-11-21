const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let password = "";
try { password = sessionStorage.getItem("adminPw") || ""; } catch {}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), authorization: "Bearer " + password } });
  if (res.status === 401) { logout(); throw new Error("Грешна парола."); }
  return res;
}

function showLogin(msg) {
  $("#panel").hidden = true;
  $("#login").hidden = false;
  if (msg) { $("#loginMsg").textContent = msg; $("#loginMsg").className = "form-msg show err"; }
}

function logout() {
  password = "";
  try { sessionStorage.removeItem("adminPw"); } catch {}
  showLogin();
}

$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  password = $("#pw").value;
  if (!password) return showLogin("Въведи парола.");
  try {
    await load();
    try { sessionStorage.setItem("adminPw", password); } catch {}
  } catch (err) {
    showLogin(err.message);
  }
});

let mailOn = false;

async function load() {
  const [res, sres] = await Promise.all([api("/api/admin/teams"), api("/api/admin/settings")]);
  if (!res.ok) throw new Error("Грешка при зареждане.");
  const { teams } = await res.json();
  if (sres.ok) mailOn = (await sres.json()).mail.enabled;
  $("#login").hidden = true;
  $("#panel").hidden = false;
  render(teams);
}

let lastTeams = [];

function render(teams) {
  lastTeams = teams;
  const count = (st) => teams.filter((t) => t.status === st).length;
  const people = teams.filter((t) => t.status !== "rejected").reduce((n, t) => n + t.members.length, 0);
  $("#stats").innerHTML = `
    <span class="sticker bg-pink">${teams.length} екипа</span>
    <span class="sticker bg-green">${count("approved")} одобрени</span>
    <span class="sticker bg-orange">${count("pending")} чакат</span>
    <span class="sticker bg-purple">${count("rejected")} отказани</span>
    <span class="sticker bg-blue">${people} участници</span>`;
  const STATUS = { approved: ["bg-green", "одобрен"], pending: ["bg-orange", "чака"], rejected: ["bg-purple", "отказан"] };

  $("#list").innerHTML = teams.length ? teams.map((t) => `
    <div class="card team" data-id="${t.id}">
      <div class="team-head">
        <h3>${esc(t.name)}</h3>
        <span class="sticker ${STATUS[t.status][0]}">${STATUS[t.status][1]}</span>
        ${t.status === "pending"
          ? `<button class="btn small" data-act="approved">${mailOn ? "Одобри и прати имейл" : "Одобри"}</button>
             <button class="btn alt small" data-act="rejected">${mailOn ? "Откажи и прати имейл" : "Откажи"}</button>`
          : `<button class="btn alt small" data-act="email">${t.notified_at ? "Прати имейла пак" : "Прати имейл"}</button>
             <button class="btn alt small" data-act="pending">${t.status === "approved" ? "Скрий" : "Върни в чакащи"}</button>`}
        <button class="btn alt small danger" data-act="delete">Изтрий</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Име</th><th>Имейл</th><th>Специалност / училище / работа</th><th>Курс / клас</th></tr></thead>
        <tbody>${t.members.map((m) => `<tr><td>${esc(m.name)}</td><td><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td><td>${esc(m.school)}</td><td>${esc(m.grade)}</td></tr>`).join("")}</tbody>
      </table></div>
      <div class="meta muted">
        ${t.mentor ? `<div><b>Ментор:</b> ${esc(t.mentor)}</div>` : ""}
        ${t.idea ? `<div><b>Идея:</b> ${esc(t.idea)}</div>` : ""}
        <div class="mono">регистриран ${esc(t.created_at)} UTC</div>
        ${t.status === "approved" ? `<div class="mono">${t.notified_at ? `📧 имейл изпратен ${esc(t.notified_at)} UTC` : "📭 имейл не е изпращан"}</div>` : ""}
        ${t.status === "approved" ? `<div class="mono">${t.broadcast_at ? `📣 писмо до всички: ${esc(t.broadcast_at)} UTC` : "📣 писмо до всички: не е пращано"}</div>` : ""}
      </div>
    </div>`).join("") : `<p class="empty">// още няма регистрирани екипи</p>`;
}

$("#list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".team");
  const id = card.dataset.id;
  const name = card.querySelector("h3").textContent;
  const act = btn.dataset.act;
  if (act === "delete" && !confirm(`Да изтрия ли екип „${name}“? Това не може да се върне.`)) return;
  if (act === "email" && !confirm(`Да изпратя ли имейла на всички членове на „${name}“?`)) return;
  if (act === "rejected" && !confirm(`Да откажа ли екип „${name}“?${mailOn ? " Всички членове ще получат писмото за отказ." : ""}`)) return;
  btn.disabled = true;
  try {
    const res = act === "delete"
      ? await api(`/api/admin/teams/${id}`, { method: "DELETE" })
      : act === "email"
        ? await api(`/api/admin/teams/${id}/email`, { method: "POST" })
        : await api(`/api/admin/teams/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: act, notify: (act === "approved" || act === "rejected") && mailOn }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Грешка.");
    if (data.email) {
      const { sent, total, errors } = data.email;
      alert(errors.length
        ? `Имейлът е изпратен на ${sent} от ${total}.\n\nПроблеми:\n${errors.join("\n")}`
        : `Имейлът е изпратен на всички ${total} членове.`);
    }
    await load();
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
  }
});

$("#refresh").addEventListener("click", () => load().catch((e) => alert(e.message)));
$("#logout").addEventListener("click", logout);
$("#csv").addEventListener("click", async () => {
  const res = await api("/api/admin/teams?format=csv");
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement("a"), { href: url, download: "ekipi.csv" });
  a.click();
  URL.revokeObjectURL(url);
});

// ----- Табове -----
document.querySelectorAll("[data-tab]").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach((t) => {
    const on = t === tab;
    t.setAttribute("aria-selected", on);
    t.classList.toggle("alt", !on);
    $("#" + t.dataset.tab).hidden = !on;
  });
  if (tab.dataset.tab === "settingsTab") loadSettings();
  if (tab.dataset.tab === "partnersTab") loadPartners();
  if (tab.dataset.tab === "printTab") loadMaterials();
  if (tab.dataset.tab === "feedbackTab") loadFeedback().catch(() => {});
  if (tab.dataset.tab === "certTab") loadCerts().catch(() => {});
  if (tab.dataset.tab === "llmTab") loadLlm().catch(() => {});
  if (tab.dataset.tab === "arenaTab") loadArena().catch(() => {});
  if (tab.dataset.tab === "subTab") loadSubmissions().catch(() => {});
}));

// ----- Настройки -----
const pad = (n) => String(n).padStart(2, "0");
// ISO → стойност за <input type="datetime-local"> в местното време.
const toLocalInput = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : "");

function specialRow(x = { code: "", text: "" }) {
  const row = document.createElement("div");
  row.className = "row-item";
  row.innerHTML = `
    <input type="text" data-f="code" maxlength="40" placeholder="best_accuracy" aria-label="Име на наградата">
    <input type="text" data-f="text" maxlength="200" placeholder="За какво е наградата" aria-label="Описание на наградата">
    <button type="button" class="x-btn" aria-label="Премахни наградата">✕</button>`;
  row.querySelector('[data-f="code"]').value = x.code;
  row.querySelector('[data-f="text"]').value = x.text;
  row.querySelector("button").addEventListener("click", () => row.remove());
  $("#sSpecial").appendChild(row);
}

function dayBlock(d = { day: "", items: [] }) {
  const box = document.createElement("div");
  box.className = "day-item";
  box.innerHTML = `
    <div class="day-head">
      <input type="text" data-f="day" maxlength="60" placeholder="Петък, 20.11" aria-label="Заглавие на деня">
      <button type="button" class="x-btn" aria-label="Премахни деня">✕</button>
    </div>
    <textarea data-f="items" aria-label="Точки от програмата" placeholder="09:00 Регистрация и кафе&#10;10:00 Откриване"></textarea>`;
  box.querySelector('[data-f="day"]').value = d.day;
  box.querySelector('[data-f="items"]').value = d.items.map(([t, w]) => `${t} ${w}`).join("\n");
  box.querySelector("button").addEventListener("click", () => box.remove());
  $("#sDays").appendChild(box);
}

async function loadSettings() {
  const res = await api("/api/admin/settings");
  const s = await res.json();
  $("#mEnabled").checked = s.mail.enabled;
  $("#mSenderName").value = s.mail.senderName;
  $("#mSenderEmail").value = s.mail.senderEmail;
  $("#mSubject").value = s.mail.subject;
  $("#mBody").value = s.mail.body;
  $("#mRejSubject").value = s.mail.rejectSubject;
  $("#mRejBody").value = s.mail.rejectBody;
  $("#mBcSubject").value = s.mail.broadcastSubject;
  $("#mBcBody").value = s.mail.broadcastBody;
  const st = $("#mailStatus");
  const gmail = s.provider === "gmail";
  $("#mSenderEmail").disabled = gmail;
  if (gmail) $("#mSenderEmail").value = s.smtpUser;
  const ready = gmail || (s.mailReady && s.mail.senderEmail);
  st.className = "mail-status " + (ready ? "ok" : "warn");
  st.textContent = gmail
    ? `Изпращането е през Gmail (${s.smtpUser}). Писмата тръгват от този адрес.`
    : !s.mailReady
      ? "Изпращането още не е свързано. Шаблонът може да се пише и запазва и сега."
      : !s.mail.senderEmail ? "Brevo е свързан. Попълни имейл на подателя." : "Brevo е свързан и имейлите са готови за изпращане.";
  $("#sName").value = s.name;
  $("#sPlace").value = s.place;
  $("#sStart").value = toLocalInput(s.start);
  $("#sEnd").value = toLocalInput(s.end);
  $("#sDiscord").value = s.discord;
  $("#sEmail").value = s.email;
  $("#sMax").value = s.maxTeams;
  $("#sMinM").value = s.minMembers;
  $("#sMaxM").value = s.maxMembers;
  $("#sRegCloses").value = toLocalInput(s.regCloses);
  fetch("/api/teams").then((r) => r.json()).then((t) => ($("#sMaxHint").textContent = `В момента са записани ${t.total}.`)).catch(() => {});
  s.prizes.forEach((p, i) => ($("#sP" + (i + 1)).value = p));
  $("#sSpecial").innerHTML = "";
  s.special.forEach(specialRow);
  $("#sDays").innerHTML = "";
  s.schedule.forEach(dayBlock);
  $("#jCriteria").value = s.judging.criteria.map((c) => `${c.name} | ${c.max} | ${c.desc}`).join("\n");
  $("#jJudges").value = s.judging.judges.join("\n");
  $("#jDemo").value = s.judging.demoMinutes ?? 5;
  showTotal();
  $("#settingsMsg").className = "form-msg";
}

// "Име | точки | описание" на ред → [{name, max, desc}] или текст на грешка.
function parseCriteria() {
  const out = [];
  for (const line of $("#jCriteria").value.split("\n")) {
    if (!line.trim()) continue;
    const [name = "", max = "", ...rest] = line.split("|").map((x) => x.trim());
    if (!name || !/^\d+$/.test(max)) return `Критерият „${line.trim()}“ трябва да е като „Име | 25 | описание“.`;
    out.push({ name, max: Number(max), desc: rest.join(" | ") });
  }
  return out;
}

function showTotal() {
  const c = parseCriteria();
  $("#jTotal").textContent = typeof c === "string" ? c : `${c.length} критерия, общо ${c.reduce((a, x) => a + x.max, 0)} точки.`;
}
$("#jCriteria").addEventListener("input", showTotal);

$("#addSpecial").addEventListener("click", () => specialRow());
$("#addDay").addEventListener("click", () => dayBlock());
$("#settingsTab").addEventListener("input", () => ($("#settingsMsg").className = "form-msg"));

function settingsMsg(text, kind) {
  $("#settingsMsg").textContent = text;
  $("#settingsMsg").className = `form-msg show ${kind}`;
}

$("#settingsTab").addEventListener("submit", async (e) => {
  e.preventDefault();
  const schedule = [];
  for (const [i, box] of [...$("#sDays").children].entries()) {
    const items = [];
    for (const line of box.querySelector('[data-f="items"]').value.split("\n")) {
      if (!line.trim()) continue;
      const m = line.trim().match(/^(\d{1,2}):(\d{2})\s+(.+)$/);
      if (!m) return settingsMsg(`Ден ${i + 1}: редът „${line.trim()}“ трябва да е като „09:00 Описание“.`, "err");
      items.push([`${pad(m[1])}:${m[2]}`, m[3]]);
    }
    schedule.push({ day: box.querySelector('[data-f="day"]').value, items });
  }
  const criteria = parseCriteria();
  if (typeof criteria === "string") return settingsMsg(criteria, "err");

  const body = {
    name: $("#sName").value,
    place: $("#sPlace").value,
    start: fromLocalInput($("#sStart").value),
    end: fromLocalInput($("#sEnd").value),
    discord: $("#sDiscord").value,
    email: $("#sEmail").value,
    maxTeams: Number($("#sMax").value),
    minMembers: Number($("#sMinM").value),
    maxMembers: Number($("#sMaxM").value),
    mail: {
      enabled: $("#mEnabled").checked,
      senderName: $("#mSenderName").value,
      senderEmail: $("#mSenderEmail").value,
      subject: $("#mSubject").value,
      body: $("#mBody").value,
      rejectSubject: $("#mRejSubject").value,
      rejectBody: $("#mRejBody").value,
      broadcastSubject: $("#mBcSubject").value,
      broadcastBody: $("#mBcBody").value,
    },
    regCloses: fromLocalInput($("#sRegCloses").value),
    prizes: [1, 2, 3].map((n) => $("#sP" + n).value),
    special: [...$("#sSpecial").children].map((row) => ({
      code: row.querySelector('[data-f="code"]').value,
      text: row.querySelector('[data-f="text"]').value,
    })),
    schedule,
    judging: { criteria, demoMinutes: Number($("#jDemo").value), judges: $("#jJudges").value.split("\n").map((x) => x.trim()).filter(Boolean) },
  };

  const btn = $("#saveSettings");
  btn.disabled = true;
  try {
    const res = await api("/api/admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Грешка при запазване.");
    settingsMsg("Запазено. Сайтът вече е обновен.", "ok");
    mailOn = data.settings.mail.enabled;
  } catch (err) {
    settingsMsg(err.message, "err");
  } finally {
    btn.disabled = false;
  }
});

// ----- Шаблон за имейл -----
const PLACEHOLDERS = ["хакатон", "име", "екип", "членове", "дата", "час", "място", "програма", "сайт", "контакт", "discord"];
$("#placeholders").innerHTML = PLACEHOLDERS.map((p) => `<button type="button" class="ph">{{${p}}}</button>`).join("");
// Вмъква в текста, в който е писано последно.
let lastBody = $("#mBody");
["#mBody", "#mRejBody", "#mBcBody"].forEach((s) => $(s).addEventListener("focus", (e) => (lastBody = e.target)));
$("#placeholders").addEventListener("mousedown", (e) => e.preventDefault());
$("#placeholders").addEventListener("click", (e) => {
  const ph = e.target.closest(".ph");
  if (!ph) return;
  const ta = lastBody;
  const at = ta.selectionStart ?? ta.value.length;
  ta.value = ta.value.slice(0, at) + ph.textContent + ta.value.slice(ta.selectionEnd ?? at);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = at + ph.textContent.length;
});

async function sendTest(e) {
  const msg = $("#testMsg");
  const to = $("#testTo").value.trim();
  if (!to) { msg.textContent = "Напиши имейл за пробата."; msg.className = "form-msg show err"; return; }
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    const res = await api("/api/admin/test-email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, kind: btn.dataset.kind }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Не успях да изпратя.");
    msg.textContent = `Пробата е изпратена до ${to}. Провери и папката за спам.`;
    msg.className = "form-msg show ok";
  } catch (err) {
    msg.textContent = err.message;
    msg.className = "form-msg show err";
  } finally {
    btn.disabled = false;
  }
}
$("#sendTest").addEventListener("click", sendTest);
$("#sendTestReject").addEventListener("click", sendTest);
$("#sendTestBc").addEventListener("click", sendTest);

// ----- Писмо до всички одобрени -----
// Праща екип по екип, защото една заявка към Cloudflare има лимит на изпращанията.
$("#broadcastBtn").addEventListener("click", async () => {
  const msg = $("#bcMsg");
  const show = (t, k) => { msg.textContent = t; msg.className = `form-msg show ${k}`; };
  const approved = lastTeams.filter((t) => t.status === "approved");
  if (!approved.length) return show("Още няма одобрени екипи.", "err");

  const sres = await api("/api/admin/settings");
  const subject = (await sres.json()).mail.broadcastSubject;
  let targets = approved.filter((t) => !t.broadcast_at);
  if (!targets.length) {
    if (!confirm(`Всички ${approved.length} одобрени екипа вече са получили писмото. Да го изпратя ли отново на всички?`)) return;
    targets = approved;
  }
  const people = targets.reduce((n, t) => n + t.members.length, 0);
  const skipped = approved.length - targets.length;
  if (!confirm(`Ще изпратя „${subject}“ до ${targets.length} екипа (${people} души).` +
    (skipped ? `\n${skipped} екипа вече са го получили и се пропускат.` : "") +
    `\n\nПусни първо проба до себе си от „Настройки на сайта“. Да изпращам ли?`)) return;

  const btn = $("#broadcastBtn");
  btn.disabled = true;
  let sent = 0;
  const errors = [];
  for (const [i, t] of targets.entries()) {
    show(`Изпращам… ${i + 1} от ${targets.length} екипа („${t.name}“)`, "ok");
    try {
      const res = await api(`/api/admin/teams/${t.id}/broadcast`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Грешка.");
      sent += data.email.sent;
      errors.push(...data.email.errors);
    } catch (err) {
      errors.push(`„${t.name}“: ${err.message}`);
    }
  }
  btn.disabled = false;
  show(errors.length
    ? `Изпратено до ${sent} от ${people} души. Проблеми: ${errors.join("; ")}`
    : `Готово: писмото е изпратено до всички ${people} души в ${targets.length} екипа.`, errors.length ? "err" : "ok");
  load();
});

$("#showLog").addEventListener("click", async () => {
  const box = $("#mailLog");
  box.innerHTML = `<p class="muted">Зареждане…</p>`;
  try {
    const res = await api("/api/admin/mail-log");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Грешка.");
    box.innerHTML = data.events.length
      ? `<table><thead><tr><th>Кога</th><th>До</th><th>Тема</th><th>Какво стана</th></tr></thead><tbody>${data.events.map((e) => `
          <tr class="${e.bad ? "bad" : ""}"><td class="mono">${esc(new Date(e.date).toLocaleString("bg-BG"))}</td><td>${esc(e.email)}</td><td>${esc(e.subject)}</td>
          <td><b>${esc(e.event)}</b>${e.reason ? `<br><small>${esc(e.reason)}</small>` : ""}</td></tr>`).join("")}</tbody></table>`
      : `<p class="muted">Brevo още няма записи. Ако току-що си пратил проба, изчакай минута и опитай пак.</p>`;
  } catch (err) {
    box.innerHTML = `<p class="form-msg show err">${esc(err.message)}</p>`;
  }
});

// ----- Партньори -----
const MAX_LOGO = 400 * 1024;

// Чете файла, смалява го до 800×400 и връща base64 (PNG, или WebP ако PNG е голям).
// SVG също минава оттук и става PNG, защото сървърът не приема SVG.
function prepareLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 800 / (img.naturalWidth || 800), 400 / (img.naturalHeight || 400));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
      c.height = Math.max(1, Math.round((img.naturalHeight || 400) * scale));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let data = c.toDataURL("image/png");
      if (data.length * 0.75 > MAX_LOGO) data = c.toDataURL("image/webp", 0.9);
      if (data.length * 0.75 > MAX_LOGO) return reject(new Error("Логото е твърде голямо дори смалено."));
      resolve(data);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Файлът не е картинка.")); };
    img.src = url;
  });
}

let partners = [];

async function loadPartners() {
  const res = await fetch("/api/partners");
  partners = (await res.json()).partners;
  renderPartners();
}

function renderPartners() {
  $("#pList").innerHTML = partners.length ? partners.map((p, i) => `
    <div class="card p-item" data-id="${p.id}">
      <div class="p-logo" style="background:${esc(p.bg)}"><img src="${esc(p.logo)}" alt="${esc(p.name)}"></div>
      <div class="p-fields">
        <div class="field"><label>Име</label><input type="text" data-f="name" maxlength="60" value="${esc(p.name)}"></div>
        <div class="field"><label>Сайт</label><input type="url" data-f="url" maxlength="300" value="${esc(p.url || "")}"></div>
        <div class="field"><label>Фон</label><input type="color" data-f="bg" value="${esc(p.bg)}"></div>
        <div class="field" style="grid-column:1/-1"><label>Ново лого (по желание)</label><input type="file" data-f="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml"></div>
      </div>
      <div class="p-actions">
        <div class="row">
          <button type="button" class="btn alt small" data-act="up" ${i === 0 ? "disabled" : ""} aria-label="Нагоре">↑</button>
          <button type="button" class="btn alt small" data-act="down" ${i === partners.length - 1 ? "disabled" : ""} aria-label="Надолу">↓</button>
        </div>
        <button type="button" class="btn small" data-act="save">Запази</button>
        <button type="button" class="btn alt small danger" data-act="delete">Изтрий</button>
      </div>
    </div>`).join("") : `<p class="empty">// още няма партньори</p>`;
}

$("#pList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".p-item");
  const id = Number(card.dataset.id);
  const idx = partners.findIndex((p) => p.id === id);
  const act = btn.dataset.act;
  try {
    if (act === "up" || act === "down") {
      const j = act === "up" ? idx - 1 : idx + 1;
      [partners[idx], partners[j]] = [partners[j], partners[idx]];
      renderPartners();
      const res = await api("/api/admin/partners", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: partners.map((p) => p.id) }) });
      if (!res.ok) throw new Error("Редът не се запази.");
      return;
    }
    if (act === "delete") {
      if (!confirm(`Да махна ли „${partners[idx].name}“ от сайта?`)) return;
      const res = await api(`/api/admin/partners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Грешка.");
      return loadPartners();
    }
    if (act === "save") {
      btn.disabled = true;
      const val = (f) => card.querySelector(`[data-f="${f}"]`);
      const body = { name: val("name").value, url: val("url").value, bg: val("bg").value };
      if (val("logo").files[0]) body.logo = await prepareLogo(val("logo").files[0]);
      const res = await api(`/api/admin/partners/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Грешка.");
      return loadPartners();
    }
  } catch (err) {
    alert(err.message);
    btn.disabled = false;
    loadPartners();
  }
});

// Без файл (например физическо лице): логото е името, написано като картинка (PNG).
// Тъмен текст на светъл фон и светъл на тъмен.
async function textLogo(name, bg) {
  await document.fonts.load('800 80px "Manrope"').catch(() => {});
  const c = document.createElement("canvas");
  c.width = 900; c.height = 300;
  const x = c.getContext("2d");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  x.fillStyle = (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#111111" : "#ffffff";
  x.textAlign = "center"; x.textBaseline = "middle";
  // Едно име на ред, ако е дълго: „Иван Петров“ → два реда.
  const words = name.trim().split(/\s+/);
  const lines = words.length > 1 && name.length > 16 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [name.trim()];
  let size = 130;
  const fit = () => { x.font = `800 ${size}px Manrope, system-ui, sans-serif`; return Math.max(...lines.map((l) => x.measureText(l).width)); };
  while (size > 30 && (fit() > c.width - 60 || size * 1.15 * lines.length > c.height - 40)) size -= 4;
  lines.forEach((l, i) => x.fillText(l, c.width / 2, c.height / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  return c.toDataURL("image/png").split(",")[1];
}

// Жив преглед на логото в карето с избрания фон.
async function updatePreview() {
  const box = $("#pPreview");
  const file = $("#pLogo").files[0];
  const name = $("#pName").value.trim();
  box.hidden = !file && !name;
  box.style.background = $("#pBg").value;
  if (file) box.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
  else if (name) box.innerHTML = `<img src="data:image/png;base64,${await textLogo(name, $("#pBg").value)}" alt="">`;
}
$("#pLogo").addEventListener("change", updatePreview);
$("#pBg").addEventListener("input", updatePreview);
$("#pName").addEventListener("input", updatePreview);

$("#pAdd").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = $("#pMsg");
  const show = (t, k) => { msg.textContent = t; msg.className = `form-msg show ${k}`; };
  const file = $("#pLogo").files[0];
  if (!$("#pName").value.trim()) return show("Напиши име на партньора.", "err");
  const btn = e.submitter;
  btn.disabled = true;
  try {
    const logo = file ? await prepareLogo(file) : await textLogo($("#pName").value, $("#pBg").value);
    const body = { name: $("#pName").value, url: $("#pUrl").value, bg: $("#pBg").value, logo };
    const res = await api("/api/admin/partners", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Грешка.");
    $("#pAdd").reset();
    updatePreview();
    show(`„${data.partner.name}“ е добавен на сайта.`, "ok");
    loadPartners();
  } catch (err) {
    show(err.message, "err");
  } finally {
    btn.disabled = false;
  }
});

// ----- Материали: табелки и картинка за спонсора -----
let mPartners = [];
let mSettings = null;
const COLORS = { yellow: "#fff3b0", paper: "#fffdf5", ink: "#111111", pink: "#ff5ca8", blue: "#7cd3ff", green: "#b4f07a" };

async function loadMaterials() {
  [mPartners, mSettings] = await Promise.all([
    fetch("/api/partners").then((r) => r.json()).then((d) => d.partners),
    fetch("/api/settings").then((r) => r.json()),
  ]);
  const opts = mPartners.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
  const keep = (sel) => sel.value;
  const ps = $("#prSponsor"), gp = $("#gsPartner");
  const a = keep(ps), b = keep(gp);
  ps.innerHTML = `<option value="">без лого</option>` + opts;
  gp.innerHTML = opts;
  // По подразбиране: freeme.bg, ако го има.
  const free = mPartners.find((p) => /freeme/i.test(p.name));
  ps.value = a || (free ? free.id : "");
  gp.value = b || (free ? free.id : mPartners[0]?.id || "");
  drawSponsor();
}

$("#openPrint").addEventListener("click", () => {
  const sp = $("#prSponsor").value;
  window.open("/print-teams.html" + (sp ? `?sponsor=${sp}` : ""), "_blank");
});

$("#openBrief").addEventListener("click", () => window.open("/print-brief.html", "_blank"));
$("#openJudging").addEventListener("click", () => window.open("/print-judging.html", "_blank"));

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

// Рисува картинката изцяло на canvas, със същите шрифтове и цветове като сайта.
// Размери на готовата картинка. Рисува се в „базови“ единици (ширина 1920 за хоризонтални,
// 1080 за вертикални), а canvas-ът се мащабира до истинския размер, за да е остро и на 4K, и на A4.
const GS_FORMATS = {
  square: { W: 1080, H: 1080, base: 1080 },
  wide: { W: 1920, H: 1080, base: 1920 },
  tv: { W: 3840, H: 2160, base: 1920 },
  a4: { W: 2480, H: 3508, base: 1080 }, // A4 при 300 dpi
};

// Рисува логото центрирано в карта с фона на партньора.
function logoCard(g, p, img, x, y, w, h, opts = {}) {
  const sh = opts.shadow ?? 12, pad = opts.pad ?? 0.16;
  g.fillStyle = COLORS.ink; g.fillRect(x + sh, y + sh, w, h);
  g.fillStyle = p.bg || "#ffffff"; g.fillRect(x, y, w, h);
  g.lineWidth = opts.line ?? 6; g.strokeStyle = COLORS.ink; g.strokeRect(x, y, w, h);
  if (!img) return;
  const k = Math.min((w * (1 - 2 * pad)) / img.width, (h * (1 - 2 * pad)) / img.height);
  g.drawImage(img, x + (w - img.width * k) / 2, y + (h - img.height * k) / 2, img.width * k, img.height * k);
}

function wrapText(g, text, x, y, maxW, lh) {
  let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const test = line ? line + " " + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; } else line = test;
  }
  if (line) g.fillText(line, x, y);
  return y;
}

// Розов стикер с надпис, леко завъртян. Смалява текста, докато се събере в maxW.
function sticker(g, text, x, y, maxW, size) {
  let fs = size;
  g.font = `900 ${fs}px Unbounded`;
  while (g.measureText(text).width > maxW - 60 && fs > 24) { fs -= 2; g.font = `900 ${fs}px Unbounded`; }
  const tw = g.measureText(text).width, th = fs * 1.55;
  g.save();
  g.translate(x, y); g.rotate(-0.04);
  g.fillStyle = COLORS.ink; g.fillRect(14, 14, tw + 60, th);
  g.fillStyle = COLORS.pink; g.fillRect(0, 0, tw + 60, th);
  g.lineWidth = 8; g.strokeStyle = COLORS.ink; g.strokeRect(0, 0, tw + 60, th);
  g.fillStyle = COLORS.ink; g.textBaseline = "alphabetic"; g.fillText(text, 30, th / 2 + fs * 0.36);
  g.restore();
  return th;
}

// Редица (или решетка) с останалите партньори.
function partnerGrid(g, list, imgs, x, y, w, cols, cardH, gap) {
  const rows = Math.ceil(list.length / cols);
  for (let r = 0; r < rows; r++) {
    const row = list.slice(r * cols, (r + 1) * cols);
    // Непълният последен ред се центрира.
    const cw = (w - gap * (cols - 1)) / cols;
    const off = ((cols - row.length) * (cw + gap)) / 2;
    row.forEach((p, i) => logoCard(g, p, imgs.get(p.id), x + off + i * (cw + gap), y + r * (cardH + gap), cw, cardH, { shadow: 8, line: 5, pad: 0.14 }));
  }
  return rows * cardH + (rows - 1) * gap;
}

async function drawSponsor() {
  const p = mPartners.find((x) => String(x.id) === $("#gsPartner").value);
  const c = $("#gsCanvas");
  if (!p) return;
  const fmt = GS_FORMATS[$("#gsFormat").value] || GS_FORMATS.square;
  const others = $("#gsOthers").checked ? mPartners.filter((x) => x.id !== p.id) : [];
  c.width = fmt.W; c.height = fmt.H;
  const g = c.getContext("2d");
  const s = fmt.W / fmt.base;
  const W = fmt.base, H = fmt.H / s; // размери в базови единици
  g.setTransform(s, 0, 0, s, 0, 0);
  await Promise.all(["900 80px Unbounded", "800 80px Unbounded", "800 40px Manrope", "700 30px 'JetBrains Mono'"].map((f) => document.fonts.load(f)));
  const imgs = new Map(await Promise.all([p, ...others].map(async (x) => [x.id, await loadImg(x.logo).catch(() => null)])));
  const logo = imgs.get(p.id);
  const land = W > H;

  // Фон, рамка и точки (данните) в горния десен ъгъл.
  g.fillStyle = COLORS.yellow; g.fillRect(0, 0, W, H);
  g.fillStyle = COLORS.ink;
  const dotsH = !others.length ? H - 130 : W > H ? 330 : H > W * 1.2 ? 330 : 240;
  for (let y = 70; y < 70 + dotsH; y += 34) for (let x = W - 300; x < W - 60; x += 34) {
    const t = (x - (W - 300)) / 240;
    if (Math.sin(x * 12.9 + y * 78.2) * 0.5 + 0.5 < 0.25 + 0.6 * t) { g.beginPath(); g.arc(x, y, 3 + 4 * t, 0, 7); g.fill(); }
  }
  g.lineWidth = 14; g.strokeStyle = COLORS.ink; g.strokeRect(36, 36, W - 72, H - 72);

  const left = 100, inner = W - 2 * left;
  const d = mSettings ? new Date(mSettings.start) : null;
  const pad2 = (n) => String(n).padStart(2, "0");
  const when = [d ? `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}` : "", "ВЕЛИКО ТЪРНОВО"].filter(Boolean).join(" · ");
  g.font = "700 32px 'JetBrains Mono'"; g.fillStyle = COLORS.ink; g.textBaseline = "alphabetic";
  g.fillText("// " + (mSettings?.name || "FMI Open Data Hackathon").toUpperCase(), left, 140);

  const title = $("#gsTitle").value.trim() || "ГЕНЕРАЛЕН СПОНСОР";
  const thanks = $("#gsThanks").value.trim();
  const othersTitle = $("#gsOthersTitle").value.trim() || "С ПОДКРЕПАТА НА";

  if (!others.length) {
    // Само генералният спонсор: както преди, голяма карта и благодарност.
    sticker(g, title, left, 250, land ? W * 0.62 : inner - 140, land ? 86 : 72);
    const card = land ? { x: left, y: 470, w: 900, h: 440 } : { x: left, y: 420, w: inner - 120, h: Math.min(330, H * 0.3) };
    logoCard(g, p, logo, card.x, card.y, card.w, card.h, { shadow: 18, line: 10, pad: 0.12 });
    const tx = land ? card.x + card.w + 90 : left;
    g.fillStyle = COLORS.ink; g.font = `800 ${land ? 58 : 46}px Manrope`;
    wrapText(g, thanks, tx, land ? 560 : card.y + card.h + 110, land ? W - tx - 340 : inner - 120, land ? 74 : 60);
    g.font = "700 34px 'JetBrains Mono'";
    g.fillText(when, land ? tx : left, H - 100);
    return;
  }

  // С останалите партньори генералният спонсор е „пръв сред равни“: заглавието е благодарността
  // към всички, спонсорът е с малък етикет и карта около 1,5 пъти по-голяма от останалите.
  const tag = (text, x, y, fs) => {
    g.font = `700 ${fs}px 'JetBrains Mono'`;
    const tw = g.measureText(text).width, th = fs * 1.7;
    g.fillStyle = COLORS.pink; g.fillRect(x, y, tw + fs * 1.2, th);
    g.lineWidth = 4; g.strokeStyle = COLORS.ink; g.strokeRect(x, y, tw + fs * 1.2, th);
    g.fillStyle = COLORS.ink; g.fillText(text, x + fs * 0.6, y + th / 2 + fs * 0.36);
    return th;
  };
  const headline = thanks || "Благодарим на партньорите!";

  if (land) {
    g.fillStyle = COLORS.ink; g.font = "800 62px Unbounded";
    const hy = wrapText(g, headline, left, 255, W - left - 400, 78);
    g.font = "700 30px 'JetBrains Mono'"; g.fillText(when, left, hy + 66);

    const ly = hy + 140;
    const th = tag(title, left, ly, 26);
    const card = { x: left, y: ly + th + 22, w: 500, h: 200 };
    logoCard(g, p, logo, card.x, card.y, card.w, card.h, { shadow: 12, line: 7, pad: 0.14 });

    const py = card.y + card.h + 90;
    g.fillStyle = COLORS.ink; g.font = "700 26px 'JetBrains Mono'"; g.fillText("// " + othersTitle, left, py);
    const cols = Math.min(others.length, 6);
    const rows = Math.ceil(others.length / cols);
    const gap = 24, cardH = Math.min(140, (H - 90 - (py + 24) - gap * (rows - 1)) / rows);
    partnerGrid(g, others, imgs, left, py + 24, inner, cols, cardH, gap);
    return;
  }

  // Вертикално (квадрат и A4).
  const a4 = H > W * 1.2;
  g.fillStyle = COLORS.ink; g.font = `800 ${a4 ? 62 : 46}px Unbounded`;
  const hy = wrapText(g, headline, left, a4 ? 290 : 225, inner - 220, a4 ? 80 : 58);
  g.font = `700 ${a4 ? 30 : 24}px 'JetBrains Mono'`; g.fillText(when, left, hy + (a4 ? 70 : 52));

  const ly = hy + (a4 ? 170 : 100);
  const th = tag(title, left, ly, a4 ? 26 : 20);
  const card = { x: left, y: ly + th + (a4 ? 24 : 16), w: a4 ? 520 : 420, h: a4 ? 230 : 170 };
  logoCard(g, p, logo, card.x, card.y, card.w, card.h, { shadow: a4 ? 12 : 9, line: a4 ? 7 : 6, pad: 0.14 });

  const py = card.y + card.h + (a4 ? 120 : 90);
  g.fillStyle = COLORS.ink; g.font = `700 ${a4 ? 26 : 22}px 'JetBrains Mono'`; g.fillText("// " + othersTitle, left, py);
  const cols = a4 ? Math.min(others.length, others.length > 4 ? 3 : 2) : Math.min(others.length, 5);
  const rows = Math.ceil(others.length / cols);
  const gap = a4 ? 28 : 18;
  const bottom = H - (a4 ? 110 : 80);
  const cardH = Math.min(a4 ? 170 : 125, (bottom - (py + 26) - gap * (rows - 1)) / rows);
  partnerGrid(g, others, imgs, left, py + 26, inner - 20, cols, cardH, gap);
}

// A4: отваря картинката в нов прозорец, точно на един лист, и пуска печата.
function printSponsor() {
  const url = $("#gsCanvas").toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) return alert("Браузърът спря новия прозорец. Разреши изскачащите прозорци за този сайт.");
  w.document.write(`<!doctype html><title>Партньори</title><style>@page{size:A4 portrait;margin:0}html,body{margin:0}img{width:210mm;height:297mm;display:block}</style><img src="${url}" onload="setTimeout(()=>print(),200)">`);
  w.document.close();
}

["#gsPartner", "#gsFormat", "#gsOthers"].forEach((s) => $(s).addEventListener("change", drawSponsor));
["#gsTitle", "#gsThanks", "#gsOthersTitle"].forEach((s) => $(s).addEventListener("input", drawSponsor));

$("#gsPrint").addEventListener("click", printSponsor);
$("#gsDownload").addEventListener("click", () => {
  const p = mPartners.find((x) => String(x.id) === $("#gsPartner").value);
  $("#gsCanvas").toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `partniori-${(p?.name || "partner").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${$("#gsFormat").value}.png` });
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
});

// ----- Анкета -----
let fbData = null;
const fbUrl = () => location.origin + "/anketa.html";

async function loadQrLib() {
  if (window.qrcode) return;
  await new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement("script"), { src: "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js", onload: resolve, onerror: reject });
    document.head.appendChild(s);
  });
}
function qrSvg(text) {
  const qr = window.qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
}

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);
// rows: [етикет, стойност, текст вдясно (по подразбиране „брой · %“)]
const bars = (rows, total) => rows.map(([label, n, text]) => `
  <div class="fb-bar"><div class="lbl"><span>${esc(label)}</span><b>${esc(text ?? `${n} · ${pct(n, total)}%`)}</b></div>
  <div class="track"><div class="fill" style="width:${pct(n, total)}%"></div></div></div>`).join("");
const avg = (list) => (list.length ? (list.reduce((a, b) => a + b, 0) / list.length).toFixed(2) : "–");

function renderFeedback() {
  const { questions, responses: rs, open, day, until } = fbData;
  const dayBg = day ? day.split("-").reverse().join(".") : "?";
  const untilBg = until ? until.split("-").reverse().join(".") : "?";
  $("#fbRemindInfo").textContent = "Попълнили през личния линк от напомняне: " + (fbData.viaLink || 0) + ". Те се пропускат при следващото напомняне.";
  $("#fbState").innerHTML = open
    ? `<b>Отворена е сега.</b> Затваря се в понеделник, ${esc(untilBg)}, в 23:59 (българско време).`
    : `Отворена е от деня на хакатона (<b>${esc(dayBg)}</b>) до понеделник, <b>${esc(untilBg)}</b>, 23:59. Денят идва от началото на хакатона в „Настройки“. Ти като админ можеш да я разгледаш и сега.`;
  if (!rs.length) { $("#fbResults").innerHTML = `<div class="card set-block"><p class="muted">Още няма отговори.</p></div>`; return; }

  const blocks = [];
  const overall = rs.map((r) => r.overall).filter(Number.isFinite);
  const again = rs.filter((r) => r.again === "Да, със сигурност").length;
  blocks.push(`<div class="card set-block" style="grid-column:1/-1"><div class="stats">
    <span class="sticker bg-pink"><span class="fb-big">${rs.length}</span> отговора</span>
    <span class="sticker bg-green"><span class="fb-big">${avg(overall)}</span> / 5 общо</span>
    <span class="sticker bg-blue"><span class="fb-big">${pct(again, rs.length)}%</span> биха дошли пак</span></div></div>`);

  for (const q of questions) {
    let body = "";
    if (q.type === "one") {
      const n = rs.filter((r) => r[q.id]).length;
      body = bars(q.options.map((o) => [o, rs.filter((r) => r[q.id] === o).length]), n) + `<small class="muted">${n} отговорили</small>`;
    } else if (q.type === "scale") {
      const vals = rs.map((r) => r[q.id]).filter(Number.isFinite);
      const nums = Array.from({ length: q.max - q.min + 1 }, (_, i) => q.max - i);
      body = `<p style="margin-bottom:10px">Средно: <b>${avg(vals)}</b> от ${q.max}</p>` + bars(nums.map((v) => [`${v} ★`, vals.filter((x) => x === v).length]), vals.length);
    } else if (q.type === "many") {
      const asked = rs.filter((r) => !q.showIf || Object.entries(q.showIf).every(([k, v]) => v.includes(r[k])));
      body = bars(q.options.map((o) => [o, asked.filter((r) => (r[q.id] || []).includes(o)).length]).sort((a, b) => b[1] - a[1]), asked.length)
        + `<small class="muted">от ${asked.length} души${q.showIf ? " (само тези, на които им се е показал въпросът)" : ""}</small>`;
      const other = asked.filter((r) => r[q.id + "Other"]);
      if (other.length) body += `<h4 style="margin:14px 0 8px">Друго</h4><div class="fb-texts">${other.map((r) => `<blockquote>${esc(r[q.id + "Other"])}</blockquote>`).join("")}</div>`;
    } else if (q.type === "grid") {
      body = bars(q.rows.map(([k, label]) => {
        const vals = rs.map((r) => r[q.id]?.[k]).filter(Number.isFinite);
        return [label, Number(avg(vals)) || 0, vals.length ? `${avg(vals)} / ${q.max} (${vals.length})` : "–"];
      }), q.max);
    } else if (q.type === "text") {
      const list = rs.filter((r) => r[q.id]);
      body = list.length
        ? `<div class="fb-texts">${list.map((r) => `<blockquote>${esc(r[q.id])}<small>${esc(r.role || "")}${r.overall ? " · " + r.overall + "★" : ""}</small></blockquote>`).join("")}</div>`
        : `<p class="muted">Няма отговори.</p>`;
    }
    blocks.push(`<div class="card set-block fb-q"${q.type === "text" ? ' style="grid-column:1/-1"' : ""}><h3>${esc(q.q)}</h3>${body}</div>`);
  }
  $("#fbResults").innerHTML = `<div class="fb-grid">${blocks.join("")}</div>`;
}

async function loadFeedback() {
  $("#fbLink").textContent = fbUrl();
  $("#fbLink").href = fbUrl();
  loadQrLib().then(() => { $("#fbQr").innerHTML = qrSvg(fbUrl()); }).catch(() => {});
  const res = await api("/api/admin/feedback");
  fbData = await res.json();
  if (!res.ok) { $("#fbResults").innerHTML = `<div class="card"><p>${esc(fbData.error || "Грешка при зареждане.")} Пусната ли е миграцията migrations/005_feedback.sql?</p></div>`; return; }
  renderFeedback();
}

function feedbackCsv() {
  if (!fbData) return;
  const cols = [["at", "Кога"]];
  for (const q of fbData.questions) {
    if (q.type === "grid") q.rows.forEach(([k, label]) => cols.push([q.id + "." + k, label]));
    else { cols.push([q.id, q.q]); if (q.other) cols.push([q.id + "Other", q.q + " (друго)"]); }
  }
  const get = (r, key) => { const [a, b] = key.split("."); const v = b ? r[a]?.[b] : r[a]; return Array.isArray(v) ? v.join("; ") : v ?? ""; };
  const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [cols.map((c) => c[1]), ...fbData.responses.map((r) => cols.map(([k]) => get(r, k)))];
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "anketa.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
}

// window.open пренася входа (sessionStorage) в новия таб, а обикновен линк с target=_blank не го пренася.
const openSurvey = (e) => { e.preventDefault(); window.open("/anketa.html", "_blank"); };
$("#fbOpen").addEventListener("click", openSurvey);
$("#fbLink").addEventListener("click", openSurvey);
$("#fbRefresh").addEventListener("click", loadFeedback);

// Напомняне за анкетата: личен линк до всеки член на одобрен екип, екип по екип.
// Тези, които вече са попълнили през линка си, се пропускат.
$("#fbRemind").addEventListener("click", async () => {
  const msg = $("#fbRemindMsg");
  const show = (t, k) => { msg.textContent = t; msg.className = `form-msg show ${k}`; };
  if (!lastTeams.length) await load().catch(() => {});
  const teams = lastTeams.filter((t) => t.status === "approved");
  if (!teams.length) return show("Няма одобрени екипи.", "err");
  if (fbData && !fbData.open && !confirm("Анкетата днес не е отворена и линкът в писмото няма да работи. Да пратя ли все пак?")) return;
  const people = teams.reduce((n, t) => n + t.members.length, 0);
  if (!confirm(`Ще пратя благодарност с покана за анкетата до ${people} души в ${teams.length} екипа, без тези, които вече са попълнили през линка от предишно напомняне.\n\nДа изпращам ли?`)) return;
  const btn = $("#fbRemind");
  btn.disabled = true;
  let sent = 0, skipped = 0;
  const errors = [];
  for (const [i, t] of teams.entries()) {
    show(`Изпращам… ${i + 1} от ${teams.length} екипа („${t.name}“)`, "ok");
    try {
      const res = await api(`/api/admin/teams/${t.id}/survey-reminder`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Грешка.");
      sent += data.sent; skipped += data.skipped; errors.push(...data.errors);
    } catch (err) {
      errors.push(`„${t.name}“: ${err.message}`);
    }
  }
  btn.disabled = false;
  show(`Изпратено до ${sent} души${skipped ? `, пропуснати ${skipped} (вече са попълнили)` : ""}.${errors.length ? " Проблеми: " + errors.join("; ") : ""}`, errors.length ? "err" : "ok");
  loadFeedback().catch(() => {});
});
$("#fbCsv").addEventListener("click", feedbackCsv);
$("#fbQrBig").addEventListener("click", async () => {
  const w = window.open("", "_blank");
  if (!w) return alert("Браузърът спря новия прозорец. Разреши изскачащите прозорци за този сайт.");
  await loadQrLib();
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Анкета · QR</title>
    <style>html,body{margin:0;height:100%;background:#fff3b0;font-family:Manrope,system-ui,sans-serif;color:#111}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vh}
    h1{font:800 6vh/1 system-ui,sans-serif;margin:0;text-align:center}svg{height:62vh;width:62vh;background:#fff;border:1vh solid #111}
    p{font:700 3.2vh monospace;margin:0}</style>
    <h1>Как мина? Попълни анкетата 👇</h1>${qrSvg(fbUrl())}<p>${esc(fbUrl())}</p>`);
  w.document.close();
});

// ----- Предадени решения -----
let subRows = [];
let juryUrl = "";
const subUrl = () => location.origin + "/predavane.html";
const COLORS_T = ["#ff5ca8", "#7cd3ff", "#b4f07a", "#ffa94d", "#c3b1ff"];
const sofiaHM = (utc) => utc ? new Date(utc.replace(" ", "T") + "Z").toLocaleTimeString("bg-BG", { timeZone: "Europe/Sofia", hour: "2-digit", minute: "2-digit" }) : "";
const safeHref = (u) => (/^https?:\/\//i.test(u || "") ? u : "#");

async function loadSubmissions() {
  $("#subLink").textContent = subUrl();
  loadQrLib().then(() => { $("#subQr").innerHTML = qrSvg(subUrl()); }).catch(() => {});
  const res = await api("/api/admin/submissions");
  const data = await res.json();
  if (!res.ok) { $("#subResults").innerHTML = `<div class="card"><p>${esc(data.error || "Грешка при зареждане.")} Пусната ли е миграцията migrations/006_submissions.sql?</p></div>`; return; }
  juryUrl = data.juryKey ? location.origin + "/jury.html?k=" + data.juryKey : "";
  $("#juryLink").textContent = juryUrl || "няма (липсва парола на админа)";
  $("#juryLink").href = juryUrl || "#";
  if (juryUrl) loadQrLib().then(() => { $("#juryQr").innerHTML = qrSvg(juryUrl); }).catch(() => {});
  const dayBg = data.day ? data.day.split("-").reverse().join(".") : "?";
  $("#subState").innerHTML = (data.open ? "<b>Отворено е сега.</b>" : `Отваря се само в деня на хакатона: <b>${esc(dayBg)}</b>.`) +
    (data.freeze ? ` Code freeze: <b>${esc(data.freeze)}</b>. След това пак се приема, но се отбелязва като късно.` : "") +
    " Екипът си избира името и пише имейла на член от екипа.";

  // Същите номера на маси като табелките: одобрените екипи по азбучен ред.
  const teams = lastTeams.filter((t) => t.status === "approved").sort((a, b) => a.name.localeCompare(b.name, "bg"));
  const byId = new Map(data.submissions.filter((s) => s.team_id).map((s) => [s.team_id, s]));
  subRows = [
    ...teams.map((t, i) => ({ table: i + 1, name: t.name, s: byId.get(t.id) })),
    ...data.submissions.filter((s) => !s.team_id || !teams.some((t) => t.id === s.team_id)).map((s) => ({ table: "", name: s.team_name + " (не е в системата)", s })),
  ];
  const done = subRows.filter((r) => r.s).length;
  const row = (r) => {
    const s = r.s;
    const color = r.table ? COLORS_T[(r.table - 1) % 5] : "#ddd";
    const status = !s ? '<span class="pill" style="background:#eee">не е предадено</span>'
      : `<span class="pill" style="background:${s.late ? "var(--orange)" : "var(--green)"}">${s.late ? "⏰ след code freeze" : "✓ предадено"} · ${esc(sofiaHM(s.updated_at))}</span>`;
    return `<div class="sub-row${s ? "" : " missing"}"><span class="tn" style="background:${color}">${r.table || "?"}</span><div>
      <h3>${esc(r.name)} ${status}</h3>
      ${s ? `<div class="links"><a href="${esc(safeHref(s.repo))}" target="_blank" rel="noopener">💻 ${esc(s.repo)}</a>${s.demo ? `<a href="${esc(safeHref(s.demo))}" target="_blank" rel="noopener">▶ ${esc(s.demo)}</a>` : ""}</div>
        <p>${esc(s.description)}</p>${s.today ? `<p><b>Днес:</b> ${esc(s.today)}</p>` : ""}<p class="muted" style="font-size:13px">предаде: ${esc(s.email)}</p>` : ""}
    </div></div>`;
  };
  $("#subResults").innerHTML = `<div class="card set-block"><div class="stats" style="margin-bottom:10px">
      <span class="sticker bg-green"><span class="fb-big">${done}</span> от ${subRows.length} предадени</span></div>
    ${subRows.map(row).join("")}</div>`;
}

function submissionsCsv() {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["Маса", "Екип", "Кода", "Демо", "Описание", "Днес", "Предал", "Час", "Късно"],
    ...subRows.map(({ table, name, s }) => [table, name, s?.repo, s?.demo, s?.description, s?.today, s?.email, sofiaHM(s?.updated_at), s?.late ? "да" : ""])];
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "resheniya.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
}

const openSubmit = (e) => { e.preventDefault(); window.open("/predavane.html", "_blank"); };
$("#subOpen").addEventListener("click", openSubmit);
$("#subLink").addEventListener("click", openSubmit);
$("#subRefresh").addEventListener("click", () => loadSubmissions().catch(() => {}));
$("#subCsv").addEventListener("click", submissionsCsv);
$("#juryQrBig").addEventListener("click", async () => {
  if (!juryUrl) return;
  const w = window.open("", "_blank");
  if (!w) return alert("Браузърът спря новия прозорец. Разреши изскачащите прозорци за този сайт.");
  await loadQrLib();
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Жури · QR</title>
    <style>html,body{margin:0;height:100%;background:#fff3b0;font-family:system-ui,sans-serif;color:#111}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vh}
    h1{font:800 6vh/1 system-ui,sans-serif;margin:0;text-align:center}svg{height:62vh;width:62vh;background:#fff;border:1vh solid #111}
    p{font:700 2.6vh monospace;margin:0}</style>
    <h1>Жури: решенията на екипите 👇</h1>${qrSvg(juryUrl)}<p>само за журито</p>`);
  w.document.close();
});

// ----- Сертификати -----
let certs = [];
const certUrl = () => location.origin + "/sertifikat.html";
const certKey = (n) => n.toLocaleLowerCase("bg").replace(/\s+/g, " ").trim();

async function loadCerts() {
  $("#certLink").textContent = certUrl();
  loadQrLib().then(() => { $("#certQr").innerHTML = qrSvg(certUrl()); }).catch(() => {});
  const res = await api("/api/admin/certs");
  const data = await res.json();
  if (!res.ok) { $("#certResults").innerHTML = `<div class="card"><p>${esc(data.error || "Грешка при зареждане.")} Пусната ли е миграцията migrations/007_certificates.sql?</p></div>`; return; }
  const dayBg = data.day ? data.day.split("-").reverse().join(".") : "?";
  $("#certState").innerHTML = (data.open ? "<b>Отворена е сега.</b>" : `Отваря се само в деня на хакатона: <b>${esc(dayBg)}</b>.`) + " Всеки участник въвежда трите си имена, училището и екипа.";
  certs = data.certs.sort((a, b) => a.full_name.localeCompare(b.full_name, "bg"));
  if (!certs.length) { $("#certResults").innerHTML = '<div class="card set-block"><p class="muted">Още няма записани имена.</p></div>'; return; }
  const counts = new Map();
  certs.forEach((c) => counts.set(certKey(c.full_name), (counts.get(certKey(c.full_name)) || 0) + 1));
  const dups = [...counts.values()].filter((n) => n > 1).length;
  $("#certResults").innerHTML = `<div class="card set-block"><div class="stats" style="margin-bottom:12px">
      <span class="sticker bg-green"><span class="fb-big">${certs.length}</span> записани</span>
      ${dups ? `<span class="sticker" style="background:var(--orange);color:#111"><span class="fb-big">${dups}</span> повторени имена</span>` : ""}</div>
    <div style="overflow-x:auto"><table class="cert-table"><thead><tr><th>№</th><th>Три имена</th><th>Ученик / студент</th><th>Училище / университет</th><th>Екип</th><th></th></tr></thead><tbody>
    ${certs.map((c, i) => `<tr class="${counts.get(certKey(c.full_name)) > 1 ? "dup" : ""}"><td>${i + 1}</td><td class="nm">${esc(c.full_name)}</td><td>${esc([c.kind, c.grade].filter(Boolean).join(", "))}</td><td>${esc(c.school)}</td><td>${esc(c.team_name || "")}</td>
      <td><button data-del="${c.id}" title="Изтрий">✕</button></td></tr>`).join("")}
    </tbody></table></div></div>`;
}

$("#certResults").addEventListener("click", async (e) => {
  const id = e.target.dataset?.del;
  if (!id) return;
  const c = certs.find((x) => String(x.id) === id);
  if (!confirm(`Да изтрия ли „${c?.full_name}“?`)) return;
  const res = await api("/api/admin/certs/" + id, { method: "DELETE" });
  if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "Грешка.");
  loadCerts().catch(() => {});
});

$("#certCsv").addEventListener("click", () => {
  const school = $("#certSchool").checked;
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["№", "Три имена", "Ученик/студент", "Клас/курс", ...(school ? ["Училище/университет"] : []), "Екип"],
    ...certs.map((c, i) => [i + 1, c.full_name, c.kind || "", c.grade || "", ...(school ? [c.school] : []), c.team_name || ""])];
  const blob = new Blob(["﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "sertifikati.csv" });
  a.click();
  URL.revokeObjectURL(a.href);
});

const openCert = (e) => { e.preventDefault(); window.open("/sertifikat.html", "_blank"); };
$("#certOpen").addEventListener("click", openCert);
$("#certLink").addEventListener("click", openCert);
$("#certRefresh").addEventListener("click", () => loadCerts().catch(() => {}));
$("#certQrBig").addEventListener("click", async () => {
  const w = window.open("", "_blank");
  if (!w) return alert("Браузърът спря новия прозорец. Разреши изскачащите прозорци за този сайт.");
  await loadQrLib();
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Сертификати · QR</title>
    <style>html,body{margin:0;height:100%;background:#fff3b0;font-family:system-ui,sans-serif;color:#111}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3vh}
    h1{font:800 6vh/1.1 system-ui,sans-serif;margin:0;text-align:center}svg{height:58vh;width:58vh;background:#fff;border:1vh solid #111}
    p{font:700 3.2vh monospace;margin:0}</style>
    <h1>🎓 Името ти за сертификата<br><small style="font-size:3.4vh">три имена + училище · всеки за себе си</small></h1>${qrSvg(certUrl())}<p>${esc(certUrl())}</p>`);
  w.document.close();
});

// ----- Общият модел (/api/llm) -----
let llmData = null;

async function loadLlm() {
  const res = await api("/api/admin/llm");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { $("#llmState").textContent = (data.error || "Грешка при зареждане.") + " Пусната ли е миграцията migrations/009_llm.sql?"; return; }
  llmData = data;
  const s = data.settings;
  $("#llmEnabled").checked = s.enabled;
  $("#llmModel").innerHTML = data.models.map(([id, name]) => `<option value="${esc(id)}"${id === s.model ? " selected" : ""}>${esc(name)}</option>`).join("");
  $("#llmMax").value = s.maxTokens;
  $("#llmState").innerHTML = (data.ai ? "" : "<b>Workers AI не е свързан.</b> ")
    + (s.enabled ? "<b>Включен е за екипите.</b>" : "Изключен е за екипите (ключовете връщат грешка).")
    + ` Днес: ${data.usage?.today || 0} заявки${data.usage?.errors ? `, ${data.usage.errors} с грешка` : ""}.`;
  // Ключ се дава само на одобрен екип, който още няма активен ключ.
  const withKey = new Set(data.keys.filter((k) => k.active).map((k) => k.team_id));
  const free = data.teams.filter((t) => !withKey.has(t.id));
  $("#llmTeam").innerHTML = free.length ? free.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("") : '<option value="">няма одобрени екипи без ключ</option>';
  $("#llmHowto").textContent = howto();
  renderLlmKeys();
}

function howto() {
  return `Адрес: ${location.origin}/api/llm  (POST)
Заглавка: Authorization: Bearer <вашият ключ fmi_…>

curl ${location.origin}/api/llm \\
  -H "Authorization: Bearer fmi_…" -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"system","content":"Ти си асистент на ФМИ."},{"role":"user","content":"Здравей!"}]}'

Python:
import requests
r = requests.post("${location.origin}/api/llm",
    headers={"Authorization": "Bearer fmi_…"},
    json={"messages": [{"role": "system", "content": "Ти си асистент на ФМИ."},
                       {"role": "user", "content": "Здравей!"}],
          "max_tokens": 300})
print(r.json()["reply"])`;
}

function renderLlmKeys() {
  const keys = llmData.keys;
  if (!keys.length) { $("#llmKeys").innerHTML = '<p class="muted">Още няма ключове.</p>'; return; }
  $("#llmKeys").innerHTML = `<div style="overflow-x:auto"><table class="cert-table"><thead><tr><th>Екип</th><th>Ключ</th><th>Днес</th><th>Общо</th><th>Лимит мин/ден</th><th>Състояние</th><th></th></tr></thead><tbody>
    ${keys.map((k) => `<tr data-id="${k.id}"><td class="nm">${esc(k.label)}</td><td style="font-family:var(--mono)">${esc(k.prefix)}…</td>
      <td>${k.today}</td><td>${k.total}</td><td>${k.per_min} / ${k.per_day}</td>
      <td>${k.active ? "✓ активен" : "⏸ спрян"}</td>
      <td style="white-space:nowrap"><button data-act="toggle">${k.active ? "Спри" : "Пусни"}</button> <button data-act="limits">Лимити</button> <button data-act="del" title="Изтрий">✕</button></td></tr>`).join("")}
    </tbody></table></div>`;
}

$("#llmKeys").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = Number(btn.closest("tr").dataset.id);
  const k = llmData.keys.find((x) => x.id === id);
  let res;
  if (btn.dataset.act === "toggle") {
    res = await api(`/api/admin/llm/keys/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !k.active }) });
  } else if (btn.dataset.act === "limits") {
    const v = prompt(`Лимити за „${k.label}“: заявки в минута / на ден`, `${k.per_min} / ${k.per_day}`);
    if (!v) return;
    const [m, d] = v.split("/").map((x) => Number(x.trim()));
    res = await api(`/api/admin/llm/keys/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ per_min: m, per_day: d }) });
  } else {
    if (!confirm(`Да изтрия ли ключа на „${k.label}“? Екипът няма да може да ползва модела с него.`)) return;
    res = await api(`/api/admin/llm/keys/${id}`, { method: "DELETE" });
  }
  if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "Грешка.");
  loadLlm().catch(() => {});
});

$("#llmNewKey").addEventListener("click", async () => {
  const res = await api("/api/admin/llm/keys", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ team_id: $("#llmTeam").value, per_min: $("#llmPerMin").value, per_day: $("#llmPerDay").value }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return alert(data.error || "Грешка.");
  $("#llmNewOut").innerHTML = `<div class="preview-note" style="background:var(--green);color:#111;border:var(--border);padding:10px 14px;margin-bottom:12px">
    Ключ за „${esc(data.team)}“: <code style="user-select:all;font:700 15px var(--mono)">${esc(data.key)}</code>
    <button class="btn alt small" id="llmCopy" style="margin-left:8px">Копирай</button><br>
    <small>Запиши го сега: показва се само веднъж. Ако се загуби, изтрий го и направи нов.</small></div>`;
  $("#llmCopy").addEventListener("click", () => navigator.clipboard?.writeText(data.key));
  loadLlm().catch(() => {});
});

$("#llmSave").addEventListener("click", async () => {
  const msg = $("#llmMsg");
  const res = await api("/api/admin/llm", { method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: $("#llmEnabled").checked, model: $("#llmModel").value, maxTokens: $("#llmMax").value }) });
  msg.textContent = res.ok ? "Запазено." : "Грешка при запазване.";
  msg.className = `form-msg show ${res.ok ? "ok" : "err"}`;
  loadLlm().catch(() => {});
});

$("#llmTry").addEventListener("click", async () => {
  const out = $("#llmOut");
  const btn = $("#llmTry");
  btn.disabled = true;
  out.textContent = "Мисли…";
  const started = Date.now();
  try {
    const res = await api("/api/llm", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: $("#llmSys").value }, { role: "user", content: $("#llmUser").value }] }) });
    const data = await res.json().catch(() => ({}));
    out.textContent = res.ok ? `${data.reply}\n\n— ${data.model}, ${((Date.now() - started) / 1000).toFixed(1)} с` : "Грешка: " + (data.error || res.status);
  } catch (e) {
    out.textContent = "Грешка: " + e.message;
  } finally {
    btn.disabled = false;
    loadLlm().catch(() => {});
  }
});
$("#llmRefresh").addEventListener("click", () => loadLlm().catch(() => {}));

// ----- Арена „Пазителят на тайната“ -----
let arData = null;
const arPct = (v) => (v == null ? "—" : Math.round(v * 100) + "%");
const WAVE_NAMES = { 0: "въпроси", 1: "вълна 1", 2: "вълна 2", 3: "вълна 3", 4: "вълна 4" };

async function loadArena() {
  const res = await api("/api/admin/arena");
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { $("#arTeams").innerHTML = `<p>${esc(data.error || "Грешка при зареждане.")} Пусната ли е миграцията migrations/010_arena.sql?</p>`; return; }
  arData = data;
  $("#arFaq").textContent = data.faq;
  if (!data.teams.length) { $("#arTeams").innerHTML = '<p class="muted">Още няма одобрени екипи.</p>'; return; }
  $("#arTeams").innerHTML = `<div style="overflow-x:auto"><table class="cert-table"><thead><tr><th>Екип</th><th>Адрес на асистента</th><th>Тайна</th><th>Точки</th><th>Защита / полезност / бързина</th><th>Изиграно</th><th></th></tr></thead><tbody>
    ${data.teams.map((t) => `<tr data-id="${t.team_id}">
      <td class="nm">${esc(t.name)}</td>
      <td style="min-width:240px"><input type="text" data-f="endpoint" value="${esc(t.endpoint || "")}" placeholder="https://… или demo" style="width:100%"></td>
      <td style="font:700 14px var(--mono);white-space:nowrap">${t.secret ? esc(t.secret) : '<span class="muted">—</span>'}</td>
      <td style="font:800 18px var(--mono)">${t.score.total.toFixed(1)}</td>
      <td style="font:600 13px var(--mono);white-space:nowrap">${arPct(t.score.defense)} / ${arPct(t.score.help)} / ${arPct(t.score.speed)}</td>
      <td style="font:600 12px var(--mono)">${Object.entries(t.done).filter(([, n]) => n).map(([w, n]) => `${WAVE_NAMES[w]}: ${n}`).join("<br>") || "—"}</td>
      <td style="white-space:nowrap"><button data-act="save">Запази</button> <button data-act="secret">Нова тайна</button> <button data-act="detail">Детайли</button></td>
    </tr>`).join("")}</tbody></table></div>`;
}

$("#arTeams").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const tr = btn.closest("tr");
  const id = Number(tr.dataset.id);
  if (btn.dataset.act === "detail") return showArenaDetail(id);
  if (btn.dataset.act === "secret" && !confirm("Да сменя ли тайната на този екип? Старата спира да важи; кажете новата на екипа.")) return;
  const body = { team_id: id, endpoint: tr.querySelector('[data-f="endpoint"]').value };
  if (btn.dataset.act === "secret") body.newSecret = true;
  const res = await api("/api/admin/arena", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "Грешка.");
  loadArena().catch(() => {});
});

async function showArenaDetail(id) {
  const t = arData.teams.find((x) => x.team_id === id);
  const box = $("#arDetail");
  box.hidden = false;
  box.innerHTML = `<p>Зареждане…</p>`;
  const data = await api(`/api/admin/arena/results?team_id=${id}`).then((r) => r.json());
  box.innerHTML = `<h3 style="margin-bottom:10px">${esc(t.name)}: подробно</h3>
    ${data.results.length ? `<div style="overflow-x:auto"><table class="cert-table"><thead><tr><th>Вълна</th><th>Резултат</th><th>Пратено</th><th>Отговор</th><th>Време</th></tr></thead><tbody>
    ${data.results.map((r) => `<tr class="${r.leaked ? "dup" : ""}"><td>${WAVE_NAMES[r.wave]}</td>
      <td style="white-space:nowrap">${r.wave === 0 ? (r.ok ? "✓ вярно" : "✗ невярно") : r.leaked ? "💥 изтече" : r.ok ? "🛡 отбранено" : "⚠ грешка"}</td>
      <td style="font-size:13px;max-width:320px">${esc(r.prompt)}</td><td style="font-size:13px;max-width:380px">${esc(r.reply)}</td>
      <td style="font:600 12px var(--mono)">${r.ms != null ? (r.ms / 1000).toFixed(1) + " с" : "—"}</td></tr>`).join("")}
    </tbody></table></div>` : '<p class="muted">Още няма резултати.</p>'}`;
  box.scrollIntoView({ behavior: "smooth", block: "start" });
}

$("#arRun").addEventListener("click", async () => {
  if (!arData) await loadArena();
  const wave = Number($("#arWave").value);
  const teams = arData.teams.filter((t) => t.endpoint);
  if (!teams.length) return alert("Няма екипи със зададен адрес на асистента.");
  const items = arData.items[wave];
  const total = teams.length * items.length;
  if (!confirm(`Ще пусна „${$("#arWave").selectedOptions[0].text}“: ${items.length} заявки към ${teams.length} екипа (${total} общо). Старите резултати за тази вълна се заменят.`)) return;
  const msg = $("#arMsg");
  const btn = $("#arRun");
  btn.disabled = true;
  let done = 0, leaks = 0;
  const errors = [];
  const show = () => { msg.textContent = `Пускам… ${done} от ${total}${leaks ? ` · ${leaks} пробива` : ""}`; msg.className = "form-msg show ok"; };
  show();
  // Екипите едновременно, атаките на всеки екип една след друга.
  await Promise.all(teams.map(async (t) => {
    for (const it of items) {
      try {
        const res = await api("/api/admin/arena/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ team_id: t.team_id, wave, item: it.id }) });
        const r = await res.json().catch(() => ({}));
        if (!res.ok) errors.push(`${t.name}: ${r.error || res.status}`);
        else { if (r.leaked) leaks++; if (r.error) errors.push(`${t.name}: ${r.error}`); }
      } catch (err) { errors.push(`${t.name}: ${err.message}`); }
      done++; show();
    }
  }));
  btn.disabled = false;
  msg.textContent = `Готово: ${total} заявки, ${leaks} пробива.${errors.length ? " Проблеми: " + [...new Set(errors)].slice(0, 5).join("; ") : ""}`;
  msg.className = `form-msg show ${errors.length ? "err" : "ok"}`;
  loadArena().catch(() => {});
});

$("#arReset").addEventListener("click", async () => {
  if (!confirm("Да изтрия ли ВСИЧКИ резултати от арената? Класирането започва от нула. Това не може да се върне.")) return;
  const res = await api("/api/admin/arena/results", { method: "DELETE" });
  if (!res.ok) return alert("Грешка.");
  $("#arDetail").hidden = true;
  loadArena().catch(() => {});
});
$("#arRefresh").addEventListener("click", () => loadArena().catch(() => {}));

if (password) load().catch(() => showLogin()); else showLogin();

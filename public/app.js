// Името, датите, мястото, линковете, наградите и програмата се сменят от /admin.html.
const CONFIG = {
  trainingFrom: new Date("2027-09-01T00:00:00+03:00"), // откога „тече обучението“ в отброяването
  jokes: [
    "Твоят ИИ срещу нашия ИИ.", "ignore previous instructions", "🛡 403 Forbidden",
    "Паролата е… хубав опит", "prompt injection ≠ SQL injection", "it works on my laptop",
    "#AISecurity", "#FMI", "#VelikoTarnovo", "cloudflared tunnel --url http://localhost:8000",
    "{\"reply\": \"Не мога да помогна с това.\"}", "baba.exe разказва приказка",
  ],
};
let S = null; // настройките от /api/settings

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));


// ----- Тема и меню -----
$("#themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch {}
});

const menuBtn = $("#menuBtn");
const navLinks = $("#navLinks");
menuBtn.addEventListener("click", () => {
  const open = navLinks.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
});
navLinks.addEventListener("click", (e) => {
  if (e.target.tagName === "A") { navLinks.classList.remove("open"); menuBtn.setAttribute("aria-expanded", false); }
});

// ----- Лента с шеги -----
const jokes = CONFIG.jokes.map((j) => `<span>${esc(j)}</span><span>✦</span>`).join("");
$("#marquee").innerHTML = jokes + jokes;

// ----- Отброяване като обучение на модел -----
const lossAt = (p) => 2.3 * Math.exp(-p * 4.5) + 0.02;
const lossPoints = [];
for (let i = 0; i <= 60; i++) {
  const p = i / 60;
  lossPoints.push([p * 300, 6 + (1 - (lossAt(p) - 0.02) / 2.3) * 58]);
}
$("#lossPath").setAttribute("d", "M" + lossPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L"));

function tickCountdown() {
  const now = Date.now();
  if (!S) return;
  const ms = Math.max(0, S.start - now);
  $("#cdD").textContent = Math.floor(ms / 864e5);
  $("#cdH").textContent = pad(Math.floor(ms / 36e5) % 24);
  $("#cdM").textContent = pad(Math.floor(ms / 6e4) % 60);
  $("#cdS").textContent = pad(Math.floor(ms / 1e3) % 60);

  const total = S.start - CONFIG.trainingFrom;
  const p = Math.min(1, Math.max(0, (now - CONFIG.trainingFrom) / total));
  const totalDays = Math.round(total / 864e5);
  $("#epoch").textContent = `${Math.round(p * totalDays)}/${totalDays}`;
  $("#loss").textContent = lossAt(p).toFixed(3);
  $("#trainBar").style.width = (p * 100).toFixed(1) + "%";
  const [x, y] = lossPoints[Math.round(p * 60)];
  $("#lossDot").setAttribute("cx", x);
  $("#lossDot").setAttribute("cy", y);
}
setInterval(tickCountdown, 1000);

// ----- Програма с „сега сме тук“ -----
function slotDate(dayIndex, time) {
  const d = new Date(S.start);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  d.setDate(d.getDate() + dayIndex);
  // След полунощ в първия ден всъщност е следващата дата.
  if (dayIndex === 0 && h < 6) d.setDate(d.getDate() + 1);
  return d;
}

function renderSchedule() {
  if (!S) return;
  const now = new Date();
  const slots = [];
  S.schedule.forEach((day, di) => day.items.forEach(([t]) => slots.push(slotDate(di, t))));
  let current = -1;
  slots.forEach((d, i) => { if (now >= d) current = i; });
  if (now > S.end) current = slots.length;

  let i = 0;
  $("#timeline").innerHTML = S.schedule.map((day) => `
    <div class="day"><h3>${esc(day.day)}</h3><ol>${day.items.map(([t, what]) => {
      const idx = i++;
      const cls = idx < current ? "past" : idx === current ? "now" : "";
      return `<li class="${cls}"><time>${esc(t)}</time><span>${esc(what)}</span></li>`;
    }).join("")}</ol></div>`).join("");

  const status = $("#scheduleStatus");
  if (now < S.start) {
    const days = Math.ceil((S.start - now) / 864e5);
    status.textContent = `Започваме след ${days} ${days === 1 ? "ден" : "дни"}`;
  } else if (now <= S.end) {
    status.textContent = "На живо! Хакатонът тече в момента";
  } else {
    status.textContent = "Хакатонът приключи. Благодарим на всички!";
  }
}
setInterval(renderSchedule, 60000);

// ----- Настройки от админа -----
function fmtDate(d) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function applySettings() {
  document.title = S.name;
  const [first, ...rest] = S.name.split(" ");
  document.querySelectorAll(".logo-name").forEach((el) => {
    el.innerHTML = rest.length ? `<span>${esc(first)}</span>${esc(rest.join(" "))}` : `<span>${esc(first)}</span>`;
  });

  const sameMonth = S.start.getMonth() === S.end.getMonth() && S.start.getFullYear() === S.end.getFullYear();
  $("#dateSticker").textContent = S.start.toDateString() === S.end.toDateString()
    ? fmtDate(S.start)
    : sameMonth ? `${pad(S.start.getDate())}–${fmtDate(S.end)}` : `${fmtDate(S.start)} – ${fmtDate(S.end)}`;
  $("#placeSticker").hidden = !S.place;
  $("#placeSticker").textContent = "📍 " + S.place;

  const discord = $("#discordLink");
  discord.closest(".lfg").hidden = !S.discord;
  discord.href = S.discord || "#";
  $("#contactEmail").href = "mailto:" + S.email;
  $("#contactEmail").textContent = S.email;
  $("#contactEmail").parentElement.hidden = !S.email;

  S.prizes.forEach((p, i) => ($("#prize" + (i + 1)).textContent = p));

  MIN_MEMBERS = S.minMembers;
  MAX_MEMBERS = S.maxMembers;
  const size = MIN_MEMBERS === MAX_MEMBERS ? String(MIN_MEMBERS) : `${MIN_MEMBERS}–${MAX_MEMBERS}`;
  document.querySelectorAll(".team-size").forEach((el) => (el.textContent = size));
  while ($("#members").children.length < MIN_MEMBERS) addMember();
  while ($("#members").children.length > MAX_MEMBERS) $("#members").lastElementChild.remove();
  refreshMembers();
  $("#specialPrizes").innerHTML = S.special
    .map((x) => `<div class="card"><code>${esc(x.code)}</code><p class="muted">${esc(x.text)}</p></div>`).join("");

  tickCountdown();
  renderSchedule();
}

fetch("/api/settings")
  .then((r) => r.json())
  .then((data) => {
    S = { ...data, start: new Date(data.start), end: new Date(data.end) };
    applySettings();
  })
  .catch(() => ($("#scheduleStatus").textContent = "Програмата не се зареди. Опресни страницата."));

// ----- Отбори -----
const chipColors = ["bg-pink", "bg-blue", "bg-green", "bg-orange", "bg-purple"];

async function loadTeams() {
  try {
    const res = await fetch("/api/teams");
    if (!res.ok) throw new Error();
    const data = await res.json();
    $("#capText").textContent = `${data.total} / ${data.max} места заети`;
    showDeadline(new Date(data.regCloses), data.open);
    $("#capBar").style.width = Math.min(100, (data.total / data.max) * 100) + "%";
    $("#teamList").innerHTML = data.teams.length
      ? data.teams.map((t, i) => `<span class="sticker ${chipColors[i % chipColors.length]}">${esc(t.name)} <small>· ${t.size}</small></span>`).join("")
      : `<span class="empty">// SELECT * FROM teams → 0 rows. Бъдете първите!</span>`;
    if (!data.open || data.total >= data.max) closeForm(data.open ? "Местата свършиха." : "Регистрацията е затворена.");
  } catch {
    $("#teamList").innerHTML = `<span class="empty">// не успяхме да заредим екипите</span>`;
  }
}

function fmtDeadline(d) {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function showDeadline(d, open) {
  const days = Math.ceil((d - Date.now()) / 864e5);
  const left = days > 1 ? ` · остават ${days} дни` : days === 1 ? " · последен ден!" : "";
  $("#deadlineText").innerHTML = open
    ? `<b>Регистрация до ${esc(fmtDeadline(d))}</b>${left}`
    : `<b>Регистрацията приключи на ${esc(fmtDeadline(d))}</b>`;
  const st = $("#deadlineSticker");
  st.hidden = !open;
  st.textContent = `записване до ${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

function closeForm(text) {
  const form = $("#register");
  form.querySelectorAll("input, textarea, button").forEach((el) => (el.disabled = true));
  showMsg(text, "err");
}

// Сменят се от админа; тук са само докато се заредят настройките.
let MIN_MEMBERS = 3;
let MAX_MEMBERS = 4;
let memberSeq = 0;

function addMember() {
  const count = $("#members").children.length;
  if (count >= MAX_MEMBERS) return;
  const id = ++memberSeq;
  const fs = document.createElement("fieldset");
  fs.className = "member";
  fs.innerHTML = `
    <legend></legend>
    <button type="button" class="remove-member" aria-label="Премахни члена">премахни</button>
    <div class="member-grid">
      <div class="field"><label for="mn${id}">Име и фамилия</label><input type="text" id="mn${id}" data-f="name" maxlength="60"></div>
      <div class="field"><label for="me${id}">Имейл</label><input type="email" id="me${id}" data-f="email" maxlength="120"></div>
      <div class="field"><label for="ms${id}">Специалност / училище / работа</label><input type="text" id="ms${id}" data-f="school" maxlength="100"></div>
      <div class="field"><label for="mg${id}">Курс / клас (по желание)</label><input type="text" id="mg${id}" data-f="grade" maxlength="30" placeholder="2 курс, 11 клас…"></div>
    </div>`;
  fs.querySelector(".remove-member").addEventListener("click", () => { fs.remove(); refreshMembers(); });
  $("#members").appendChild(fs);
  refreshMembers();
}

function refreshMembers() {
  const list = [...$("#members").children];
  list.forEach((fs, i) => {
    fs.querySelector("legend").textContent = i === 0 ? `член ${i + 1} · капитан` : `член ${i + 1}`;
    fs.querySelector(".remove-member").hidden = list.length <= MIN_MEMBERS;
  });
  $("#addMember").hidden = list.length >= MAX_MEMBERS;
}

function showMsg(text, kind) {
  const m = $("#formMsg");
  m.textContent = text;
  m.className = `form-msg show ${kind}`;
}

$("#addMember").addEventListener("click", addMember);
for (let i = 0; i < MIN_MEMBERS; i++) addMember();

$("#register").addEventListener("input", () => $("#formMsg").classList.remove("show"));

$("#register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#teamName").value.trim();
  const members = [...$("#members").children].map((fs) => {
    const m = {};
    fs.querySelectorAll("input").forEach((inp) => (m[inp.dataset.f] = inp.value.trim()));
    return m;
  });

  if (name.length < 2) return showMsg("Напишете име на екипа.", "err");
  const bad = members.findIndex((m) => !m.name || !m.email || !m.school);
  if (bad !== -1) return showMsg(`Попълни име, имейл и откъде е член ${bad + 1}.`, "err");
  if (!$("#consent").checked) return showMsg("Отбележете, че сте съгласни с регламента.", "err");

  const btn = $("#submitBtn");
  btn.disabled = true;
  btn.textContent = "Записваме…";
  try {
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name, members,
        mentor: $("#mentor").value.trim(),
        idea: $("#idea").value.trim(),
        website: $("#website").value,
        consent: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Нещо се обърка. Опитайте пак.");
    $("#register").reset();
    $("#members").innerHTML = "";
    for (let i = 0; i < MIN_MEMBERS; i++) addMember();
    showMsg(`„${name}“ е записан! Ще се появи в списъка, след като го одобрим.`, "ok");
    loadTeams();
  } catch (err) {
    showMsg(err.message, "err");
  } finally {
    btn.disabled = false;
    btn.textContent = "Регистрирай →";
  }
});

loadTeams();

// ----- Партньори (управляват се от админа) -----
fetch("/api/partners")
  .then((r) => r.json())
  .then(({ partners }) => {
    if (!partners.length) return;
    $("#partnerList").innerHTML = partners.map((p) => {
      const img = `<img src="${esc(p.logo)}" alt="${esc(p.name)}" loading="lazy">`;
      const style = `style="background:${esc(p.bg)}"`;
      return p.url
        ? `<a class="partner" href="${esc(p.url)}" target="_blank" rel="noopener" ${style}>${img}</a>`
        : `<span class="partner" ${style}>${img}</span>`;
    }).join("");
    $("#partnersTier").hidden = false;
  })
  .catch(() => {});

// ----- Великденско яйце: Konami code -----
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let pos = 0;
document.addEventListener("keydown", (e) => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  pos = key === KONAMI[pos] ? pos + 1 : key === KONAMI[0] ? 1 : 0;
  if (pos === KONAMI.length) { pos = 0; celebrate(); }
  if (e.key === "Escape") $("#egg").classList.remove("show");
});
$("#eggClose").addEventListener("click", () => $("#egg").classList.remove("show"));

function celebrate() {
  $("#egg").classList.add("show");
  $("#eggClose").focus();
  const words = ["100%", "loss=0", "GPU", "AI", "epoch ∞", "🍕", "overfit!"];
  for (let i = 0; i < 40; i++) {
    const s = document.createElement("div");
    s.className = `confetti sticker ${chipColors[i % chipColors.length]}`;
    s.textContent = words[i % words.length];
    s.style.left = Math.random() * 100 + "vw";
    s.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
    s.style.animationDuration = 2 + Math.random() * 2.5 + "s";
    s.style.animationDelay = Math.random() * 0.8 + "s";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 6000);
  }
}

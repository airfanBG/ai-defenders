// Стойности по подразбиране. Каквото е запазено от админа, ги замества.
export const DEFAULT_SETTINGS = {
  name: "FMI AI Hackathon: Надхитри ме",
  place: "ФМИ, ВТУ „Св. св. Кирил и Методий“, Велико Търново",
  start: "2027-11-19T09:00:00+02:00",
  end: "2027-11-19T19:00:00+02:00",
  discord: "",
  email: "hello@example.com",
  maxTeams: 40,
  minMembers: 3,
  maxMembers: 4,
  mail: {
    enabled: true,
    senderName: "FMI AI Hackathon",
    senderEmail: "",
    subject: "Записани сте за {{хакатон}} 🎉",
    body: `Здравей, {{име}}!

Екипът ви „{{екип}}“ е одобрен и вече сте официално записани за {{хакатон}}.

📅 Кога: {{дата}}, от {{час}}
📍 Къде: {{място}}
👥 Екип: {{членове}}

Програма:
{{програма}}

Какво да носите: лаптоп, зарядно и удължител, ако имате.

Повече информация: {{сайт}}
Въпроси: {{контакт}}

До скоро!
Организаторите`,
    rejectSubject: "{{хакатон}}: местата са заети",
    rejectBody: `Здравей, {{име}}!

Благодарим ви, че регистрирахте екип „{{екип}}“ за {{хакатон}}! Интересът беше огромен и за съжаление всички места вече са заети, затова този път не можем да ви включим.

Ще се радваме да ви видим догодина. Следете ни, за да научите първи за следващото издание.

Ако се освободи място, ще ви пишем.

Поздрави,
Организаторите`,
    broadcastSubject: "{{хакатон}}: как да се подготвите",
    broadcastBody: `Здравей, {{име}}!

Записването приключи и екипът ви „{{екип}}“ е сред участниците в {{хакатон}}. Ето какво е важно да знаете, преди да дойдете.

📅 {{дата}}, регистрацията започва в 08:30, откриването е в {{час}}
📍 {{място}}

Задачата: изградете ИИ асистент на ФМИ, който помага на кандидат-студенти, но не издава тайната си. Нашият нападател ще го атакува на вълни през деня, а класирането е на живо.

Подгответе се отсега:
1. Прочетете правилата: {{сайт}}pravila.html
2. Свалете шаблона и го пуснете веднъж на лаптопа си (Python 3.9+ или .NET 8): {{сайт}}arena.html
3. Инсталирайте cloudflared за тунела (Windows: winget install --id Cloudflare.cloudflared, macOS: brew install cloudflared).
4. Помислете каква защита ще пробвате: инструкции, филтър на въпроса, филтър на отговора, втори модел като проверяващ.

Ключа за модела и тайната си ще получите на откриването.

На демото пред журито покажете как работи защитата ви и защо, и кое сте направили на хакатона.

Носете: лаптоп, зарядно, удължител и телефон за хотспот, ако интернетът в залата се затрудни.

Въпроси: {{контакт}}

До скоро!
Организаторите`,
  },
  regCloses: "2027-11-17T23:59:00+02:00",
  prizes: ["обявяваме скоро", "обявяваме скоро", "обявяваме скоро"],
  special: [
    { code: "fortress", text: "Крепост: най-малко пробиви през целия ден." },
    { code: "smartest_defense", text: "Най-хитрата и обща защита по оценка на журито." },
    { code: "best_pupils", text: "Най-добрият ученически екип." },
  ],
  // Критерии и жури за листовете за оценяване (/print-judging.html).
  judging: {
    criteria: [
      { name: "Идея на защитата", max: 30, desc: "Каква е защитата, на какво се основава и колко е оригинална?" },
      { name: "Обща ли е защитата", max: 25, desc: "Работи ли и срещу атаки, които не са видели, или е нагласена само за нашите вълни?" },
      { name: "Качество на асистента", max: 20, desc: "Отговаря ли полезно и естествено, без да отказва излишно?" },
      { name: "Демо и обяснение", max: 25, desc: "Ясно ли показаха как работи и защо? Казаха ли кое е направено на хакатона и какво научиха от пробивите?" },
    ],
    judges: [],
    demoMinutes: 5,
  },
  schedule: [
    { day: "Петък, 19.11", items: [
      ["08:30", "Регистрация и кафе"],
      ["09:00", "Откриване: задачата, ключове и тайни, какво е prompt injection"],
      ["09:30", "Start hacking!"],
      ["11:00", "Нормални въпроси и вълна 1"],
      ["12:30", "Вълна 2 и обяд"],
      ["14:00", "Вълна 3"],
      ["15:30", "Нови тайни и вълна 4"],
      ["16:30", "Code freeze"],
      ["17:00", "Демо пред журито"],
      ["18:30", "Награждаване"],
    ] },
  ],
};

export async function loadSettings(env) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'site'").first();
  const saved = row ? JSON.parse(row.value) : {};
  return {
    ...DEFAULT_SETTINGS, ...saved,
    mail: { ...DEFAULT_SETTINGS.mail, ...(saved.mail || {}) },
    judging: { ...DEFAULT_SETTINGS.judging, ...(saved.judging || {}) },
  };
}

// Без настройките за имейли и без имената на журито: те са само за админа.
export function publicSettings(settings) {
  const { mail, judging, ...rest } = settings;
  return { ...rest, criteria: judging.criteria, demoMinutes: judging.demoMinutes };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function str(v, max) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function validateSettings(b) {
  const s = {
    name: str(b.name, 60),
    place: str(b.place, 120),
    start: str(b.start, 40),
    end: str(b.end, 40),
    discord: str(b.discord, 200),
    email: str(b.email, 120),
  };
  if (s.name.length < 2) return { error: "Напиши име на хакатона." };
  if (isNaN(Date.parse(s.start)) || isNaN(Date.parse(s.end))) return { error: "Невалидна дата за начало или край." };
  if (Date.parse(s.end) <= Date.parse(s.start)) return { error: "Краят трябва да е след началото." };
  if (s.discord && !/^https:\/\//.test(s.discord)) return { error: "Линкът за Discord трябва да започва с https://" };
  if (s.email && !EMAIL_RE.test(s.email)) return { error: "Имейлът не изглежда валиден." };

  s.maxTeams = Number(b.maxTeams);
  if (!Number.isInteger(s.maxTeams) || s.maxTeams < 1 || s.maxTeams > 500) return { error: "Максималният брой екипи трябва да е цяло число от 1 до 500." };
  s.minMembers = Number(b.minMembers);
  s.maxMembers = Number(b.maxMembers);
  if (![s.minMembers, s.maxMembers].every((n) => Number.isInteger(n) && n >= 1 && n <= 10)) return { error: "Членовете в екип трябва да са цели числа от 1 до 10." };
  if (s.minMembers > s.maxMembers) return { error: "Минималният брой членове не може да е по-голям от максималния." };
  s.regCloses = str(b.regCloses, 40);
  if (isNaN(Date.parse(s.regCloses))) return { error: "Невалиден краен срок за регистрация." };

  const m = b.mail || {};
  s.mail = {
    enabled: m.enabled === true,
    senderName: str(m.senderName, 80),
    senderEmail: str(m.senderEmail, 120),
    subject: str(m.subject, 200),
    body: typeof m.body === "string" ? m.body.slice(0, 8000) : "",
    rejectSubject: str(m.rejectSubject, 200),
    rejectBody: typeof m.rejectBody === "string" ? m.rejectBody.slice(0, 8000) : "",
  };
  if (!s.mail.rejectSubject || !s.mail.rejectBody.trim()) return { error: "Попълни тема и текст на писмото за отказ." };
  s.mail.broadcastSubject = str(m.broadcastSubject, 200);
  s.mail.broadcastBody = typeof m.broadcastBody === "string" ? m.broadcastBody.slice(0, 8000) : "";
  if (!s.mail.broadcastSubject || !s.mail.broadcastBody.trim()) return { error: "Попълни тема и текст на писмото до всички." };
  if (s.mail.senderEmail && !EMAIL_RE.test(s.mail.senderEmail)) return { error: "Имейлът на подателя не изглежда валиден." };
  if (s.mail.enabled && (!s.mail.subject || !s.mail.body.trim())) return { error: "Попълни тема и текст на имейла или изключи изпращането." };

  if (!Array.isArray(b.prizes) || b.prizes.length !== 3) return { error: "Невалидни награди." };
  s.prizes = b.prizes.map((p) => str(p, 120) || "обявяваме скоро");

  if (!Array.isArray(b.special) || b.special.length > 8) return { error: "Специалните награди са най-много 8." };
  s.special = b.special
    .map((x) => ({ code: str(x?.code, 40), text: str(x?.text, 200) }))
    .filter((x) => x.code || x.text);

  const j = b.judging || {};
  if (!Array.isArray(j.criteria) || j.criteria.length < 1 || j.criteria.length > 12) return { error: "Критериите за оценяване трябва да са от 1 до 12." };
  s.judging = { criteria: [], judges: [], demoMinutes: Number(j.demoMinutes ?? 5) };
  if (!Number.isInteger(s.judging.demoMinutes) || s.judging.demoMinutes < 1 || s.judging.demoMinutes > 30) return { error: "Времето за демо трябва да е цяло число минути от 1 до 30." };
  for (const [i, c] of j.criteria.entries()) {
    const name = str(c?.name, 60), desc = str(c?.desc, 300), max = Number(c?.max);
    if (!name) return { error: `Критерий ${i + 1}: напиши име.` };
    if (!Number.isInteger(max) || max < 1 || max > 100) return { error: `Критерий „${name}“: точките трябва да са цяло число от 1 до 100.` };
    s.judging.criteria.push({ name, max, desc });
  }
  if (!Array.isArray(j.judges) || j.judges.length > 20) return { error: "Журито е най-много 20 души." };
  s.judging.judges = j.judges.map((n) => str(n, 80)).filter(Boolean);

  if (!Array.isArray(b.schedule) || b.schedule.length < 1 || b.schedule.length > 4) return { error: "Програмата трябва да е от 1 до 4 дни." };
  s.schedule = [];
  for (const [i, d] of b.schedule.entries()) {
    const day = str(d?.day, 60);
    if (!day) return { error: `Ден ${i + 1}: напиши заглавие.` };
    if (!Array.isArray(d.items) || d.items.length > 30) return { error: `Ден ${i + 1}: твърде много точки.` };
    const items = [];
    for (const it of d.items) {
      const [t, what] = [str(it?.[0], 5), str(it?.[1], 120)];
      if (!TIME_RE.test(t)) return { error: `Ден ${i + 1}: часът „${t}“ трябва да е във формат ЧЧ:ММ.` };
      if (!what) return { error: `Ден ${i + 1}: на ${t} липсва описание.` };
      items.push([t, what]);
    }
    s.schedule.push({ day, items });
  }
  return { settings: s };
}

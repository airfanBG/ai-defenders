// Анкетата след хакатона: въпросите, проверката на отговорите и кога е отворена.
// Страницата (/anketa.html) и админът взимат въпросите оттук, за да няма разминаване.

export const QUESTIONS = [
  { id: "role", type: "one", required: true, q: "Ти беше на хакатона като:",
    options: ["участник", "ментор", "жури", "организатор / доброволец", "гост"] },
  { id: "overall", type: "scale", required: true, q: "Как ти се стори хакатонът като цяло?", min: 1, max: 5,
    labels: ["слабо", "отлично"] },
  { id: "again", type: "one", required: true, q: "Би ли участвал(а) отново?",
    options: ["Да, със сигурност", "Може би", "Не"] },
  { id: "whyNot", type: "many", q: "Какво те кара да се колебаеш?", showIf: { again: ["Може би", "Не"] },
    options: ["Беше твърде дълго", "Темата не ме грабна", "Беше твърде трудно", "Беше твърде лесно",
      "Организацията", "Нямам време / неподходяща дата", "Не ми хареса работата в екип"], other: true },
  { id: "liked", type: "many", q: "Какво ти хареса? (може няколко)",
    options: ["Темата и данните", "Работата в екип", "Менторите", "Обратната връзка от журито", "Демото пред публика",
      "Наградите", "Храната и почивките", "Атмосферата", "Научих нещо ново", "Запознах се с хора / компании"] },
  { id: "rate", type: "grid", q: "Оцени от 1 до 5:", min: 1, max: 5,
    rows: [["org", "Организация и програма"], ["theme", "Темата и данните"], ["mentors", "Менторите и помощта"],
      ["jury", "Журито и оценяването"], ["venue", "Залата, храната, интернетът"]] },
  { id: "learned", type: "one", q: "Колко ново научи?", options: ["Почти нищо", "Малко", "Доста", "Много"] },
  { id: "recommend", type: "one", q: "Би ли препоръчал(а) хакатона на приятел?", options: ["Да", "Може би", "Не"] },
  { id: "best", type: "text", q: "Кое беше най-хубавото?", max: 1000 },
  { id: "improve", type: "text", q: "Какво да направим по-добре следващия път?", max: 1000 },
  { id: "ideas", type: "text", q: "Тема или данни, които би искал(а) догодина?", max: 500 },
];

// Денят на хакатона по българско време: „2026-11-20“.
const sofiaDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Sofia" }).format(d);

// Анкетата: от деня на хакатона до първия понеделник след него включително (23:59 българско време).
export function surveyWindow(settings, now = new Date()) {
  const { day } = feedbackWindow(settings, now);
  if (!day) return { day, until: "", open: false };
  const d = new Date(day + "T12:00:00Z");
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() !== 1);
  const until = d.toISOString().slice(0, 10);
  const today = sofiaDay(now);
  return { day, until, open: today >= day && today <= until };
}

export function feedbackWindow(settings, now = new Date()) {
  const start = new Date(settings.start);
  const day = isNaN(start) ? "" : sofiaDay(start);
  return { day, open: !!day && sofiaDay(now) === day };
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function visible(q, a) {
  if (!q.showIf) return true;
  return Object.entries(q.showIf).every(([k, vals]) => vals.includes(a[k]));
}

// Връща { answers } само с позволените стойности или { error }.
export function validateAnswers(body) {
  const a = {};
  for (const q of QUESTIONS) {
    const v = body?.[q.id];
    if (q.type === "one") {
      if (q.options.includes(v)) a[q.id] = v;
    } else if (q.type === "scale") {
      const n = Number(v);
      if (Number.isInteger(n) && n >= q.min && n <= q.max) a[q.id] = n;
    } else if (q.type === "many") {
      if (!visible(q, a)) continue;
      const list = Array.isArray(v) ? [...new Set(v.filter((x) => q.options.includes(x)))] : [];
      if (list.length) a[q.id] = list;
      if (q.other) { const o = str(body?.[q.id + "Other"], 300); if (o) a[q.id + "Other"] = o; }
    } else if (q.type === "grid") {
      const g = {};
      for (const [k] of q.rows) {
        const n = Number(v?.[k]);
        if (Number.isInteger(n) && n >= q.min && n <= q.max) g[k] = n;
      }
      if (Object.keys(g).length) a[q.id] = g;
    } else if (q.type === "text") {
      const t = str(v, q.max);
      if (t) a[q.id] = t;
    }
    if (q.required && a[q.id] === undefined) return { error: `Отговори на: „${q.q}“` };
  }
  return { answers: a };
}

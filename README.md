# FMI Open Data Hackathon

Сайт за хакатона: статична страница с регистрация на отбори и админ панел. Хостинг в Cloudflare Pages, а отборите се пазят в Cloudflare D1. И двете са безплатни.

## Какво къде се сменя

| Какво | Къде |
|---|---|
| Име, място, начало/край, Discord, имейл, награди, програма | `/admin.html` → „Настройки на сайта“ (без ново качване) |
| Текстове, теми и примерни идеи, източници на данни, FAQ | `public/index.html` |
| Шегите в лентата | `CONFIG` в `public/app.js` |
| Цветове и шрифтове | `:root` в `public/styles.css` |
| Максимален брой екипи, краен срок, шаблон за имейл | `/admin.html` → „Настройки на сайта“ |
| Партньори: добавяне, махане, подреждане, лога | `/admin.html` → „Партньори“ (логата се пазят в базата) |
| Критерии за оценяване и жури | `/admin.html` → „Настройки на сайта“ → „Оценяване“ |
| Листове за журито (PDF за печат, CSV за точките) | `/admin.html` → „Материали“ → „Листове за журито“ |
| Пътеводител за участниците (програма, въпроси, слайдове) | `/admin.html` → „Материали“ → „Пътеводител за участниците“ |
| Анкета след хакатона (отворена само в деня на хакатона) | `/anketa.html`; резултати, QR и CSV: `/admin.html` → „📊 Анкета“ |
| Афиш за залата и картички за специалните награди | `/print-sign.html`, `/print-awards.html` |

## Локално

```bash
npm install
npm run db:local
echo "ADMIN_PASSWORD=някаква-парола" > .dev.vars
npm run dev
```

Сайтът е на http://localhost:8788, а админ панелът на http://localhost:8788/admin.html.

## Качване (веднъж)

```bash
npx wrangler login
npx wrangler d1 create ml-hackathon-db
```

Копирай `database_id` от изхода в `wrangler.toml`. След това:

```bash
npm run db:remote   # безопасно е и при повторно пускане, не трие данни
npx wrangler pages project create ml-hackathon --production-branch main
npx wrangler pages secret put ADMIN_PASSWORD --project-name ml-hackathon
npm run deploy
```

Сайтът е на `https://ml-hackathon.pages.dev`. Ако името е заето, избери друго в `wrangler.toml` и в командите.

За всяка следваща промяна е достатъчно `npm run deploy`.

## Админ

`/admin.html`: одобряване и скриване на отбори, изтриване и сваляне на CSV за Excel. Публично се виждат само одобрените отбори, и то само името и броят членове.

Защита от спам: скрито поле-капан за ботове, най-много 3 регистрации на час от един IP, уникални имена на отбори и проверка на всички полета на сървъра.

## След хакатона

Свали си CSV-то от админа и изтрий всичко:

```bash
npx wrangler pages project delete ml-hackathon
npx wrangler d1 delete ml-hackathon-db
```

## Имейли при одобряване

Шаблонът, темата и включването са в `/admin.html` → „Настройки на сайта“ → „Имейл при одобряване“.

Изпращането е през Gmail SMTP с парола за приложения (https://myaccount.google.com/apppasswords):

```bash
pbpaste | tr -cd 'a-z' | npx wrangler pages secret put SMTP_PASS --project-name ml-hackathon
printf '%s' 'адрес@gmail.com' | npx wrangler pages secret put SMTP_USER --project-name ml-hackathon
npm run deploy
```

Писмото до всички одобрени екипи се праща от таб „Екипи“ → „📣 Писмо до всички одобрени“; шаблонът е в „Настройки на сайта“. Праща се екип по екип и не се повтаря за екипи, които вече са го получили.

Ако `SMTP_USER`/`SMTP_PASS` липсват, се ползва Brevo (`BREVO_API_KEY`). След смяна на таен ключ винаги пускай `npm run deploy`.

Миграции на базата са в `migrations/`; всяка се пуска веднъж с `npx wrangler d1 execute ml-hackathon-db --remote --file=migrations/<файл>`.

# h100-fund — сбор на NVIDIA H100

Минималистичный лендинг: счётчик + 2 способа оплаты. Без крипты, без бэкенда.
Языки RU/EN. Кошка — oneko.js.

## Способы приёма денег (итог ресёрча, октябрь 2026)

**Мир → PayPal.me.** Аккаунт PayPal на Казахстан. ⚠️ Источники противоречат:
юридическая страница PayPal относит KZ к «send-only» странам, но маркетинговая
страница paypal.com/kz/home заявляет «Send & Request Money», Patreon официально
платит PayPal-выплаты в KZ, а статьи (vc.ru, окт. 2025) описывают вывод на карты
Kaspi/Halyk за 2–3%. **Первым делом проверь**: попроси друга отправить тебе 500 ₸
эквивалентом через PayPal — если деньги пришли и выводятся, схема работает.

**Казахстан → Kaspi QR.** Перевод на твою карту через QR, комиссия 0%.
Автоматического подтверждения у физлица нет — сумму в счётчик добавляешь вручную.

**Если PayPal принимать не сможет — план Б** (без крипты):
1. **Ko-fi** (0% на разовые донаты) — но выплаты тоже идут в PayPal, не поможет,
   если проблема в PayPal.
2. **Patreon** (Shop: разовый «товар» = разовый донат) — официально выводит PayPal
   в KZ и Payoneer; комиссия ~14–16% сквозная. Оформлять на совершеннолетнего.
3. **Xoom** (принадлежит PayPal) — донор из США/ЕЭЗ/UK отправляет деньги прямо
   на твою карту Visa/MC (Kaspi Gold подходит) без твоего аккаунта.

## Быстрый старт

Все места замен помечены `REPLACE_ME`:

1. **PayPal.** Открой аккаунт (страна — Казахстан, **нужно 18+**; если нет —
   аккаунт на родителя, вписывать чужой возраст нельзя — блокировка с удержанием
   средств до 180 дней). Верифицируй, получи ссылку вида `paypal.me/твоёимя`,
   вставь её в `index.html` вместо `REPLACE_ME` (кнопка «PayPal.me»).
2. **Kaspi QR.** Приложение Kaspi → карта Gold → QR для переводов → скриншот.
   Положи как `assets/qr-kaspi.png`, в `index.html` поменяй
   `src="assets/qr-kaspi.svg"` на свой файл.
3. **Цель и курс.** `progress.json`: `goal_usd` (сейчас 30000), `usd_kzt_rate`.

## Как обновлять счётчик

Без бэкенда: правишь `total_usd` и массив `donations` в `progress.json`, коммитишь.
Крипто-вебхуков больше нет — всё вручную (донаты с PayPal видны в приложении,
kaspi-переводы тоже). Опционально: `worker/worker.js` — Cloudflare Worker с
`POST /api/donations` (Bearer-токен), чтобы добавлять донаты с телефона одной
curl-командой без правки файла.

## Деплой (бесплатно)

**GitHub Pages**
```bash
git init && git add . && git commit -m "h100 fund"
git branch -M main
git remote add origin git@github.com:ТВОЙ_ЛОГИН/h100-fund.git
git push -u origin main
# Settings → Pages → Source: main / root
```

**Cloudflare Pages** (безлимитный трафик; *.pages.dev заблокирован в РФ):
```bash
npx wrangler pages deploy . --project-name=h100-fund
```

Бесплатный домен: `имя.is-a.dev` — PR в github.com/is-a-dev/register.

Проверка анимаций: открой сайт с `?demo=1` — донат каждые 18 секунд.

## Дизайн

Hallmark: тема Hum (крем-бумага, груша/циан/коралл, Plus Jakarta Sans), макроструктура
Stat-Led, nav N2, footer Ft2, иллюстрация — рукодельный SVG. Палитра — `css/tokens.css`.

Лицензии: oneko.js © adryd (MIT) · canvas-confetti © Kiril Vatev (MIT) ·
шрифты Plus Jakarta Sans и JetBrains Mono — SIL OFL (Google Fonts).

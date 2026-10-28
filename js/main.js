/* h100-fund · main.js
   Прогресс: сначала Cloudflare Worker (/api/progress), fallback — progress.json.
   Анимации: count-up суммы, конфетти и toast при новом донате, ?demo=1 — симуляция. */

(function () {
  "use strict";

  /* ——— i18n ——— */

  var I18N = {
    ru: {
      skip: "К содержимому",
      hero_words: "собираем на NVIDIA H100",
      qualifier: "из {goal} · ≈ {kzt}",
      meta: "{pct}% · {n} {donors} · {upd} {time}",
      donors: "донатов",
      updated: "обновлено",
      cta_donate: "Задонатить",
      card_kz_label: "Казахстан",
      card_kz_title: "Kaspi QR",
      qr_caption: "Kaspi → Перевести → Сканировать QR",
      card_world_label: "Весь мир",
      card_world_title: "Через PayPal",
      card_world_note: "Из любой страны, с баланса PayPal или картой. Кнопка открывает платёж — сумма падает напрямую мне.",
      card_world_cta: "PayPal.me",
      card_world_fee: "PayPal забирает ~3–5%, вывод на карту — ещё 2–3%. Остальное идёт в сбор.",
      foot_confetti: "конфетти",
      toast_thanks: "Спасибо, {name}!",
      toast_line: "+{amt} · H100 ближе",
      valuetext: "{cur} из {goal}",
      gpu_aria: "Иллюстрация видеокарты NVIDIA H100: два вентилятора, кристалл H100 и память HBM3"
    },
    en: {
      skip: "Skip to content",
      hero_words: "raising for an NVIDIA H100",
      qualifier: "of {goal} · ≈ {kzt}",
      meta: "{pct}% · {n} {donors} · {upd} {time}",
      donors: "donations",
      updated: "updated",
      cta_donate: "Donate",
      card_kz_label: "Kazakhstan",
      card_kz_title: "Kaspi QR",
      qr_caption: "Kaspi → Transfer → Scan QR",
      card_world_label: "Worldwide",
      card_world_title: "Via PayPal",
      card_world_note: "From any country, from a PayPal balance or a card. The button opens a payment straight to me.",
      card_world_cta: "PayPal.me",
      card_world_fee: "PayPal takes ~3–5%, plus 2–3% to withdraw to a local card. The rest goes to the fund.",
      foot_confetti: "confetti",
      toast_thanks: "Thank you, {name}!",
      toast_line: "+{amt} · H100 is closer",
      valuetext: "{cur} of {goal}",
      gpu_aria: "Illustration of an NVIDIA H100 GPU: two fans, the H100 die and HBM3 memory"
    }
  };

  var lang = "ru";
  try { lang = localStorage.getItem("h100-lang") || "ru"; } catch (e) { /* приватный режим */ }

  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key]) || I18N.ru[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace("{" + k + "}", vars[k]); });
    return s;
  }

  /* ——— форматтеры ——— */

  function fmtUsd(v) {
    return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  }
  function fmtKzt(v) {
    return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", { style: "currency", currency: "KZT", notation: "compact", maximumFractionDigits: 1 }).format(v);
  }
  function fmtTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
  }

  /* 1 донат · 2 доната · 5 донатов / 1 donation · 2 donations */
  function donorWord(n) {
    if (lang === "en") return n === 1 ? "donation" : "donations";
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return "донат";
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "доната";
    return "донатов";
  }

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };

  /* ——— count-up с «yes!»-пульсом в конце ——— */

  function countUp(el, from, to, ms) {
    if (reducedMotion || ms <= 0 || from === to) {
      el.textContent = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(Math.round(to));
      return;
    }
    var start = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - start) / ms);
      var eased = 1 - Math.pow(1 - p, 4); // easeOutQuart ≈ --ease-snap
      el.textContent = new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(Math.round(from + (to - from) * eased));
      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        el.classList.remove("is-done");
        void el.offsetWidth; // перезапуск анимации
        el.classList.add("is-done");
      }
    }
    requestAnimationFrame(frame);
  }

  /* ——— состояние ——— */

  var progress = null;
  var lastTotal = 0;
  var firstRender = true;

  function renderProgress(animate) {
    if (!progress) return;
    var total = Math.max(0, progress.total_usd || 0);
    var goal = Math.max(1, progress.goal_usd || 30000);
    var pct = Math.min(100, Math.round((total / goal) * 100));

    countUp($("amount-usd"), lastTotal, total, animate ? 1200 : 0);
    lastTotal = total;

    $("hero-qualifier").textContent = t("qualifier", { goal: fmtUsd(goal), kzt: fmtKzt(total * (progress.usd_kzt_rate || 520)) });
    $("progress-fill").style.transform = "scaleX(" + Math.min(1, total / goal) + ")";

    var bar = $("progress");
    bar.setAttribute("aria-valuemax", String(goal));
    bar.setAttribute("aria-valuenow", String(Math.round(total)));
    bar.setAttribute("aria-valuetext", t("valuetext", { cur: fmtUsd(total), goal: fmtUsd(goal) }));

    var n = (progress.donations || []).length;
    $("hero-meta").textContent = t("meta", {
      pct: pct, n: n, donors: donorWord(n), upd: t("updated"), time: fmtTime(progress.updated_at)
    });
  }

  /* ——— праздник нового доната ——— */

  /* canvas-confetti ест только RGB — эти hex зеркалят pear/cyan/coral из tokens.css */
  var CONFETTI_COLORS = ["#F2C744", "#3E9EDB", "#F0604A"];

  function celebrate(amountUsd, name) {
    toast(name, amountUsd);
    if (reducedMotion || typeof window.confetti !== "function") return;

    var emoji = typeof window.confetti.shapeFromText === "function"
      ? [window.confetti.shapeFromText({ text: "⚡", scalar: 2 }), window.confetti.shapeFromText({ text: "🎮", scalar: 2 })]
      : undefined;

    window.confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 }, colors: CONFETTI_COLORS });
    window.setTimeout(function () {
      window.confetti({ particleCount: 30, angle: 60, spread: 60, origin: { x: 0, y: 0.8 }, colors: CONFETTI_COLORS });
      window.confetti({ particleCount: 30, angle: 120, spread: 60, origin: { x: 1, y: 0.8 }, colors: CONFETTI_COLORS });
    }, 150);
    if (emoji) {
      window.setTimeout(function () {
        window.confetti({ particleCount: 14, spread: 100, scalar: 2, origin: { y: 0.6 }, colors: CONFETTI_COLORS, shapes: emoji });
      }, 300);
    }
  }

  function toast(name, amountUsd) {
    var box = $("toasts");
    var el = document.createElement("div");
    el.className = "toast";
    var strong = document.createElement("strong");
    strong.textContent = t("toast_thanks", { name: name }) + " ";
    var line = document.createElement("span");
    line.className = "tnum";
    line.textContent = t("toast_line", { amt: fmtUsd(amountUsd) });
    el.append(strong, line);
    box.append(el);
    requestAnimationFrame(function () { el.classList.add("is-in"); });

    var outTimer = window.setTimeout(dismiss, 6000);
    function dismiss() {
      el.classList.remove("is-in");
      el.classList.add("is-out");
      window.setTimeout(function () { el.remove(); }, 350);
    }
    el.addEventListener("mouseenter", function () { window.clearTimeout(outTimer); });
    el.addEventListener("mouseleave", function () { outTimer = window.setTimeout(dismiss, 2000); });
  }

  /* ——— загрузка прогресса ——— */

  function normalize(data) {
    if (!data || typeof data !== "object") return null;
    return {
      goal_usd: Number(data.goal_usd) || 30000,
      total_usd: Number(data.total_usd) || 0,
      usd_kzt_rate: Number(data.usd_kzt_rate) || 520,
      updated_at: data.updated_at || new Date().toISOString(),
      donations: Array.isArray(data.donations) ? data.donations : []
    };
  }

  function loadProgress() {
    var urls = ["/api/progress", "progress.json"];
    function tryNext(i) {
      if (i >= urls.length) return Promise.resolve(null);
      return fetch(urls[i], { cache: "no-store" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function () { return tryNext(i + 1); });
    }
    return tryNext(0).then(function (raw) { return normalize(raw); });
  }

  function refresh() {
    return loadProgress().then(function (data) {
      if (!data) return;
      var grew = data.total_usd > (progress ? progress.total_usd : 0);
      var prevTotal = progress ? progress.total_usd : 0;
      progress = data;
      renderProgress(!firstRender);
      if (grew && !firstRender && document.visibilityState === "visible") {
        var latest = (data.donations && data.donations[0]) || null;
        celebrate(data.total_usd - prevTotal, latest ? latest.name : (lang === "ru" ? "Аноним" : "Anonymous"));
      }
      firstRender = false;
    });
  }

  /* ——— язык ——— */

  function applyLang(l) {
    lang = I18N[l] ? l : "ru";
    try { localStorage.setItem("h100-lang", lang); } catch (e) { /* приватный режим */ }
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    $("lang-ru").setAttribute("aria-pressed", String(lang === "ru"));
    $("lang-en").setAttribute("aria-pressed", String(lang === "en"));
    if (progress) renderProgress(false);
  }

  /* ——— demo-режим: ?demo=1 — донат каждые 18 секунд ——— */

  var DEMO_NAMES = ["Аноним", "Айдана", "kirill.dev", "Dana", "yetanotherdev", "Максим"];

  function demo() {
    if (!progress) progress = normalize({});
    var i = 0;
    function tick() {
      var amt = [5, 10, 25, 50, 100][Math.floor(Math.random() * 5)];
      var name = DEMO_NAMES[i % DEMO_NAMES.length];
      progress.total_usd += amt;
      progress.updated_at = new Date().toISOString();
      progress.donations.unshift({ ts: progress.updated_at, name: name, amount_usd: amt, message: "" });
      renderProgress(true);
      celebrate(amt, name);
      i += 1;
    }
    window.setTimeout(tick, 2500);
    window.setInterval(tick, 18000);
    console.info("[h100-fund] demo-режим: донат каждые 18 секунд. Убери ?demo=1 из URL.");
  }

  /* ——— init ——— */

  document.addEventListener("DOMContentLoaded", function () {
    $("lang-ru").addEventListener("click", function () { applyLang("ru"); });
    $("lang-en").addEventListener("click", function () { applyLang("en"); });

    applyLang(lang);
    refresh().then(function () {
      if (new URLSearchParams(window.location.search).get("demo") === "1") demo();
      window.setInterval(refresh, 45000);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") refresh();
      });
    });
  });
})();

/**
 * h100-fund · Cloudflare Worker — счётчик донатов (бесплатный тариф).
 *
 * Роуты:
 *   GET  /api/progress   — текущий прогресс (читает фронтенд)
 *   POST /api/donations  — ручное добавление доната: PayPal-платёж или kaspi-перевод
 *                          (Bearer ADMIN_TOKEN) — одной curl-командой с телефона
 *
 * Привязка (wrangler.toml): kv_namespaces = [{ binding = "PROGRESS", id = "..." }]
 * Секрет: ADMIN_TOKEN (npx wrangler secret put ADMIN_TOKEN)
 *
 * Начальное состояние в KV (ключ "state") создаётся автоматически; сверь
 * goal_usd с progress.json в корне сайта.
 */

const STATE_KEY = "state";

const SEED = {
  goal_usd: 30000,
  total_usd: 0,
  usd_kzt_rate: 520,
  updated_at: "2026-10-28T00:00:00Z",
  donations: [],
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...CORS },
  });
}

async function getState(env) {
  const raw = await env.PROGRESS.get(STATE_KEY);
  if (!raw) {
    await env.PROGRESS.put(STATE_KEY, JSON.stringify(SEED));
    return { ...SEED };
  }
  return JSON.parse(raw);
}

async function putState(env, state) {
  state.updated_at = new Date().toISOString();
  state.donations = (state.donations || []).slice(0, 50); // журнал — последние 50
  await env.PROGRESS.put(STATE_KEY, JSON.stringify(state));
  return state;
}

function addDonation(state, { name, amount_usd, via = "paypal" }) {
  state.total_usd = Math.round(((state.total_usd || 0) + amount_usd) * 100) / 100;
  state.donations.unshift({ ts: new Date().toISOString(), name, amount_usd, via });
  return state;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);

    // ——— текущий прогресс ———
    if (url.pathname === "/api/progress" && request.method === "GET") {
      return json(await getState(env));
    }

    // ——— ручное начисление (с телефона):
    // curl -X POST https://worker.../api/donations \
    //   -H "Authorization: Bearer $ADMIN_TOKEN" \
    //   -H "Content-Type: application/json" \
    //   -d '{"name":"Аноним","amount":5,"currency":"USD"}'
    if (url.pathname === "/api/donations" && request.method === "POST") {
      if (request.headers.get("Authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
        return json({ error: "unauthorized" }, 401);
      }
      const body = await request.json().catch(() => null);
      const amount = Number(body && body.amount);
      if (!body || !isFinite(amount) || amount <= 0) {
        return json({ error: "amount must be a positive number" }, 400);
      }
      // currency: "USD" (по умолчанию) или "KZT" — тогда конвертируем по rate
      const rate = body.currency === "KZT" ? Number(body.rate || 520) : 1;
      const state = await getState(env);
      await putState(env, addDonation(state, {
        name: String(body.name || "Аноним").slice(0, 40),
        amount_usd: Math.round((amount / rate) * 100) / 100,
        via: body.via || "paypal",
      }));
      return json({ ok: true, total_usd: state.total_usd });
    }

    return json({ error: "not found" }, 404);
  },
};

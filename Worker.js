// Cloudflare Worker: טופס יצירת קשר -> טלגרם
// משתני סביבה נדרשים:
//   TELEGRAM_BOT_TOKEN  (Secret)  הטוקן מ-BotFather
//   TELEGRAM_CHAT_ID    (Secret)  המזהה של הצ'אט שלך עם הבוט
//   ALLOWED_ORIGINS     (Text)    https://harpaz.pp.ua,https://www.harpaz.pp.ua

const clean = (v, max) =>
  String(v ?? '').replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').trim().slice(0, max);

const reply = (body, status, headers) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply({ ok: false }, 405, cors);
    if (!okOrigin) return reply({ ok: false, error: 'forbidden' }, 403, cors);

    let data;
    try { data = await request.json(); }
    catch { return reply({ ok: false, error: 'bad_json' }, 400, cors); }

    // שדה מלכודת לבוטים: אם מולא, מתעלמים בשקט
    if (data.website) return reply({ ok: true }, 200, cors);

    const name = clean(data.name, 80);
    const phone = clean(data.phone, 30);
    const message = clean(data.message, 1000);
    if (!name || phone.replace(/\D/g, '').length < 7) {
      return reply({ ok: false, error: 'invalid' }, 400, cors);
    }

    const text =
      `📩 פנייה חדשה מהאתר\n\nשם: ${name}\nטלפון: ${phone}` +
      (message ? `\n\nהודעה:\n${message}` : '');

    const tg = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!tg.ok) return reply({ ok: false, error: 'telegram' }, 502, cors);
    return reply({ ok: true }, 200, cors);
  },
};
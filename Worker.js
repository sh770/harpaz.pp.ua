
const DEFAULT_ORIGINS = 'https://harpaz.pp.ua,https://www.harpaz.pp.ua';

// ניקוי תווים בעייתיים והגבלת אורך השדות
const clean = (v, max) =>
  String(v ?? '')
    .replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ')
    .trim()
    .slice(0, max);

// יצירת תשובת JSON
const reply = (body, status, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...headers,
    },
  });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // בדיקת כתובות האתר שמורשות לשלוח פניות
    const allowed = (env.ALLOWED_ORIGINS || DEFAULT_ORIGINS)
      .split(',')
      .map(s => s.trim().replace(/\/+$/, '').toLowerCase())
      .filter(Boolean);

    const okOrigin = allowed.includes(
      origin.replace(/\/+$/, '').toLowerCase()
    );

    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    // טיפול בבקשת CORS מקדימה
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // אישור בקשות POST בלבד
    if (request.method !== 'POST') {
      return reply({ ok: false, error: 'method_not_allowed' }, 405, cors);
    }

    // חסימת מקורות שאינם מורשים
    if (!okOrigin) {
      return reply({ ok: false, error: 'forbidden' }, 403, cors);
    }

    // קריאת נתוני הטופס
    let data;
    try {
      data = await request.json();
    } catch {
      return reply({ ok: false, error: 'bad_json' }, 400, cors);
    }

    // שדה מלכודת לבוטים
    if (data.website) {
      return reply({ ok: true }, 200, cors);
    }

    // ניקוי הנתונים
    const name = clean(data.name, 80);
    const phone = clean(data.phone, 30);
    const message = clean(data.message, 1000);

    // בדיקת שדות חובה
    if (!name || phone.replace(/\D/g, '').length < 7) {
      return reply({ ok: false, error: 'invalid' }, 400, cors);
    }

    // בדיקת הגדרת הסודות
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.error('Telegram configuration error: required secret is missing');
      return reply({ ok: false, error: 'server_configuration' }, 500, cors);
    }

    // הכנת הודעת הטלגרם
    const text =
      `📩 פנייה חדשה מהאתר\n\nשם: ${name}\nטלפון: ${phone}` +
      (message ? `\n\nהודעה:\n${message}` : '');

    // שליחת הפנייה לטלגרם
    let tg;

    try {
      tg = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text,
            disable_web_page_preview: true,
          }),
        }
      );
    } catch (error) {
      // רישום שגיאת תקשורת ללא חשיפת פרטי הפנייה
      console.error(
        'Telegram network error:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return reply({ ok: false, error: 'telegram_network' }, 502, cors);
    }

    // קריאת תשובת Telegram
    let tgResult;
    try {
      tgResult = await tg.json();
    } catch {
      tgResult = null;
    }

    // טיפול בשגיאה שהוחזרה על ידי Telegram
    if (!tg.ok || !tgResult?.ok) {
      const details = {
        httpStatus: tg.status,
        errorCode: tgResult?.error_code ?? null,
        description: tgResult?.description ?? 'No description returned',
      };

      // רישום פרטי האבחון ביומן בלבד
      console.error('Telegram API error:', JSON.stringify(details));

      // החזרת קוד האבחון בלי לפרסם את תיאור השגיאה למבקר באתר
      return reply({
        ok: false,
        error: 'telegram',
        telegram_status: details.httpStatus,
        telegram_code: details.errorCode,
      }, 502, cors);
    }

    // הצלחה
    return reply({ ok: true }, 200, cors);
  },
};

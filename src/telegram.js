// Уведомления в Telegram (необязательно: работает, если задан TELEGRAM_BOT_TOKEN)
const db = require('./db');

const token = () => process.env.TELEGRAM_BOT_TOKEN;
const appUrl = () => (process.env.APP_URL || '').replace(/\/$/, '');

function itemLink(id) {
  return `${appUrl()}/#/item/${id}`;
}

async function call(method, body) {
  if (!token()) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) {
    console.error('Telegram:', e.message);
    return null;
  }
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// userIds — получатели; text — HTML; itemId — для ссылки
async function notify(userIds, text, itemId) {
  if (!token()) return;
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  const users = await db.query(
    'SELECT tg_chat_id FROM users WHERE id IN (?) AND active = 1 AND tg_chat_id IS NOT NULL',
    [ids]
  );
  const msg = itemId ? `${text}\n\n<a href="${itemLink(itemId)}">Открыть поручение</a>` : text;
  for (const u of users) {
    await call('sendMessage', { chat_id: u.tg_chat_id, text: msg, parse_mode: 'HTML', disable_web_page_preview: true });
  }
}

function notifySafe(...args) {
  notify(...args).catch((e) => console.error('Telegram notify:', e.message));
}

async function headIds() {
  const rows = await db.query("SELECT id FROM users WHERE active = 1 AND role IN ('superadmin','head')");
  return rows.map((r) => r.id);
}

// Бот отвечает на /start, сообщая chat_id для привязки в профиле
let offset = 0;
async function pollUpdates() {
  const r = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
  if (r && r.ok) {
    for (const upd of r.result) {
      offset = upd.update_id + 1;
      const m = upd.message;
      if (m && m.chat) {
        await call('sendMessage', {
          chat_id: m.chat.id,
          text: `СКИП: ваш chat_id — <code>${m.chat.id}</code>\nВведите его в профиле системы (меню с вашим именем → «Telegram»).`,
          parse_mode: 'HTML',
        });
      }
    }
  } else {
    await new Promise((res) => setTimeout(res, 10000));
  }
}

// Ежедневная проверка сроков (в 09:00 по времени сервера)
let lastDaily = '';
async function dailyCheck() {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  if (now.getHours() < 9 || lastDaily === day) return;
  lastDaily = day;

  const soon = await db.query(
    `SELECT id, title, deadline, main_executor_id FROM items
     WHERE status <> 'closed' AND deadline > NOW() AND deadline <= NOW() + INTERVAL 3 DAY`
  );
  for (const it of soon) {
    const co = await db.query('SELECT user_id FROM item_executors WHERE item_id = ?', [it.id]);
    notifySafe([it.main_executor_id, ...co.map((c) => c.user_id)],
      `⏰ Скоро срок (${it.deadline.slice(0, 16)}):\n<b>${esc(it.title)}</b>`, it.id);
  }
  const overdue = await db.query(
    `SELECT id, title, deadline, main_executor_id FROM items WHERE status <> 'closed' AND deadline < NOW()`
  );
  const heads = await headIds();
  for (const it of overdue) {
    const co = await db.query('SELECT user_id FROM item_executors WHERE item_id = ?', [it.id]);
    notifySafe([it.main_executor_id, ...co.map((c) => c.user_id), ...heads],
      `🔴 Поручение просрочено (срок ${it.deadline.slice(0, 16)}):\n<b>${esc(it.title)}</b>`, it.id);
  }
}

function start() {
  if (!token()) return;
  console.log('Telegram-уведомления включены');
  (async function loop() {
    for (;;) await pollUpdates().catch(() => {});
  })();
  setInterval(() => dailyCheck().catch((e) => console.error('Daily check:', e.message)), 10 * 60 * 1000);
  setTimeout(() => dailyCheck().catch(() => {}), 30000);
}

module.exports = { notify: notifySafe, headIds, esc, start };

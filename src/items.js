const express = require('express');
const db = require('./db');
const tg = require('./telegram');
const { MANAGERS, HEADS, normDateTime, str, wrap } = require('./util');

const router = express.Router();

const isManager = (u) => MANAGERS.includes(u.role);
const isHead = (u) => HEADS.includes(u.role);
const isPersonal = (it) => !!it.is_self && it.self_type === 'personal';
const isPersonalOwner = (u, it) => isPersonal(it) && it.created_by === u.id;
const isExecutor = (u, it) => it.main_executor_id === u.id || it.co_executors.includes(u.id);

function canSee(u, it) {
  if (isPersonal(it)) return it.created_by === u.id;
  if (isManager(u)) return true;
  return isExecutor(u, it) || it.created_by === u.id;
}

const canEdit = (u, it) => isManager(u) || isPersonalOwner(u, it);
const canClose = (u, it) => isHead(u) || isPersonalOwner(u, it);

function fail(res, code, error) {
  res.status(code).json({ error });
}

async function addHistory(itemId, userId, action, detail = null) {
  await db.query('INSERT INTO history (item_id, user_id, action, detail) VALUES (?, ?, ?, ?)',
    [itemId, userId, action, detail]);
}

async function userName(id) {
  const u = await db.one('SELECT name FROM users WHERE id = ?', [id]);
  return u ? u.name : '—';
}

async function activeUserIds(ids) {
  if (!ids.length) return [];
  const rows = await db.query('SELECT id FROM users WHERE id IN (?) AND active = 1', [ids]);
  return rows.map((r) => r.id);
}

const ITEM_SELECT = `
  SELECT i.*, mu.name AS main_executor_name, cu.name AS created_by_name
  FROM items i
  JOIN users mu ON mu.id = i.main_executor_id
  JOIN users cu ON cu.id = i.created_by`;

// Добавляет к поручениям соисполнителей, счётчик непрочитанных и последнее действие
async function enrich(items, userId) {
  if (!items.length) return items;
  const ids = items.map((i) => i.id);
  const co = await db.query('SELECT item_id, user_id FROM item_executors WHERE item_id IN (?)', [ids]);
  const unread = await db.query(
    `SELECT m.item_id, COUNT(*) AS c FROM messages m
     LEFT JOIN seen s ON s.item_id = m.item_id AND s.user_id = ?
     WHERE m.item_id IN (?) AND m.user_id <> ? AND m.id > COALESCE(s.seen_msg_id, 0)
     GROUP BY m.item_id`,
    [userId, ids, userId]
  );
  const last = await db.query(
    `SELECT h.item_id, h.action, h.created_at FROM history h
     JOIN (SELECT item_id, MAX(id) AS mid FROM history WHERE item_id IN (?) GROUP BY item_id) x ON x.mid = h.id`,
    [ids]
  );
  const coMap = {};
  co.forEach((r) => (coMap[r.item_id] = coMap[r.item_id] || []).push(r.user_id));
  const unreadMap = Object.fromEntries(unread.map((r) => [r.item_id, r.c]));
  const lastMap = Object.fromEntries(last.map((r) => [r.item_id, r]));
  return items.map((i) => ({
    ...i,
    co_executors: coMap[i.id] || [],
    unread: unreadMap[i.id] || 0,
    last_action: lastMap[i.id] ? lastMap[i.id].action : null,
    last_action_at: lastMap[i.id] ? lastMap[i.id].created_at : null,
  }));
}

async function loadItem(id, userId) {
  const rows = await db.query(`${ITEM_SELECT} WHERE i.id = ?`, [id]);
  if (!rows.length) return null;
  return (await enrich(rows, userId))[0];
}

async function visibleItems(user) {
  const rows = await db.query(`${ITEM_SELECT} ORDER BY i.deadline ASC, i.id DESC`);
  const items = await enrich(rows, user.id);
  return items.filter((it) => canSee(user, it));
}

function participants(it) {
  return [it.main_executor_id, ...it.co_executors, it.created_by];
}

// ---------- Список ----------

router.get('/', wrap(async (req, res) => {
  res.json({ items: await visibleItems(req.user) });
}));

// Данные для экспорта в Excel
router.get('/export', wrap(async (req, res) => {
  if (!isManager(req.user)) return fail(res, 403, 'Недостаточно прав');
  const items = await visibleItems(req.user);
  const ids = items.map((i) => i.id);
  let history = [];
  let reports = [];
  if (ids.length) {
    history = await db.query(
      `SELECT h.*, u.name AS user_name, i.title AS item_title FROM history h
       LEFT JOIN users u ON u.id = h.user_id JOIN items i ON i.id = h.item_id
       WHERE h.item_id IN (?) ORDER BY h.created_at, h.id`,
      [ids]
    );
    reports = await db.query(
      `SELECT h.item_id, h.detail FROM history h
       JOIN (SELECT item_id, MAX(id) AS mid FROM history WHERE action = 'report' AND item_id IN (?) GROUP BY item_id) x
       ON x.mid = h.id`,
      [ids]
    );
  }
  const repMap = Object.fromEntries(reports.map((r) => [r.item_id, r.detail]));
  res.json({ items: items.map((i) => ({ ...i, report_text: repMap[i.id] || '' })), history });
}));

// ---------- Создание ----------

router.post('/', wrap(async (req, res) => {
  if (!isManager(req.user)) return fail(res, 403, 'Недостаточно прав');
  const title = str(req.body.title, 500);
  const detail = str(req.body.detail);
  const basis = str(req.body.basis, 500);
  const deadline = normDateTime(req.body.deadline);
  const priority = req.body.priority === 'high' ? 'high' : 'normal';
  const mainId = Number(req.body.main_executor_id);
  if (!title) return fail(res, 400, 'Укажите заголовок');
  if (!detail) return fail(res, 400, 'Укажите подробное описание');
  if (!deadline) return fail(res, 400, 'Укажите срок исполнения');
  if (!(await activeUserIds([mainId])).length) return fail(res, 400, 'Выберите основного исполнителя');
  const coIds = (await activeUserIds((Array.isArray(req.body.co_executors) ? req.body.co_executors : [])
    .map(Number).filter((x) => x && x !== mainId)));

  const r = await db.query(
    `INSERT INTO items (title, detail, basis, main_executor_id, priority, deadline, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, detail, basis, mainId, priority, deadline, req.user.id]
  );
  const id = r.insertId;
  for (const uid of coIds) await db.query('INSERT IGNORE INTO item_executors (item_id, user_id) VALUES (?, ?)', [id, uid]);
  await addHistory(id, req.user.id, 'created');
  tg.notify([mainId, ...coIds], `📌 Новое поручение:\n<b>${tg.esc(title)}</b>\nСрок: ${deadline.slice(0, 16)}`, id);
  res.json({ item: await loadItem(id, req.user.id) });
}));

router.post('/self', wrap(async (req, res) => {
  const title = str(req.body.title, 500);
  const detail = str(req.body.detail);
  const deadline = normDateTime(req.body.deadline);
  const type = req.body.type === 'control' ? 'control' : 'personal';
  const priority = req.body.priority === 'high' ? 'high' : 'normal';
  if (!title) return fail(res, 400, 'Укажите заголовок');
  if (!deadline) return fail(res, 400, 'Укажите срок');
  const r = await db.query(
    `INSERT INTO items (title, detail, basis, main_executor_id, priority, deadline, created_by, is_self, self_type)
     VALUES (?, ?, '', ?, ?, ?, ?, 1, ?)`,
    [title, detail, req.user.id, priority, deadline, req.user.id, type]
  );
  await addHistory(r.insertId, req.user.id, 'created', type === 'control' ? 'Личная задача на контроль' : 'Личная задача');
  if (type === 'control') {
    tg.notify(await tg.headIds(), `📋 ${tg.esc(req.user.name)} поставил(а) задачу на контроль:\n<b>${tg.esc(title)}</b>`, r.insertId);
  }
  res.json({ item: await loadItem(r.insertId, req.user.id) });
}));

// ---------- Операции с поручением ----------

const withItem = wrap(async (req, res, next) => {
  const it = await loadItem(Number(req.params.id), req.user.id);
  if (!it || !canSee(req.user, it)) return fail(res, 404, 'Поручение не найдено');
  req.item = it;
  next();
});

const notClosed = (req, res, next) =>
  req.item.status === 'closed' ? fail(res, 400, 'Поручение закрыто') : next();

router.get('/:id', withItem, wrap(async (req, res) => {
  const it = req.item;
  const executors = [it.main_executor_id, ...it.co_executors];
  const users = await db.query('SELECT id, name, position FROM users WHERE id IN (?)', [executors]);
  const acks = await db.query('SELECT user_id, ack_at FROM acks WHERE item_id = ?', [it.id]);
  const ackMap = Object.fromEntries(acks.map((a) => [a.user_id, a.ack_at]));
  const uMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const history = await db.query(
    `SELECT h.id, h.action, h.detail, h.created_at, h.user_id, u.name AS user_name
     FROM history h LEFT JOIN users u ON u.id = h.user_id WHERE h.item_id = ? ORDER BY h.id`,
    [it.id]
  );
  const messages = await db.query(
    `SELECT m.id, m.body, m.created_at, m.user_id, u.name AS user_name
     FROM messages m JOIN users u ON u.id = m.user_id WHERE m.item_id = ? ORDER BY m.id`,
    [it.id]
  );
  if (messages.length) {
    const maxId = messages[messages.length - 1].id;
    await db.query(
      `INSERT INTO seen (item_id, user_id, seen_msg_id) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE seen_msg_id = GREATEST(seen_msg_id, VALUES(seen_msg_id))`,
      [it.id, req.user.id, maxId]
    );
  }
  res.json({
    item: { ...it, unread: 0 },
    executors: executors.map((id) => ({
      id,
      name: uMap[id] ? uMap[id].name : '—',
      position: uMap[id] ? uMap[id].position : '',
      main: id === it.main_executor_id,
      ack_at: ackMap[id] || null,
    })),
    history,
    messages,
  });
}));

// Автоматическое ознакомление при открытии карточки исполнителем
router.post('/:id/open', withItem, wrap(async (req, res) => {
  const it = req.item;
  if (isExecutor(req.user, it)) {
    const r = await db.query('INSERT IGNORE INTO acks (item_id, user_id) VALUES (?, ?)', [it.id, req.user.id]);
    if (r.affectedRows) await addHistory(it.id, req.user.id, 'ack');
    if (it.status === 'new') await db.query("UPDATE items SET status = 'in_progress' WHERE id = ? AND status = 'new'", [it.id]);
  }
  res.json({ ok: true });
}));

router.post('/:id/progress', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isExecutor(req.user, it)) return fail(res, 403, 'Только исполнитель может добавлять обновления');
  const text = str(req.body.text);
  if (!text) return fail(res, 400, 'Введите текст обновления');
  await addHistory(it.id, req.user.id, 'progress', text);
  res.json({ ok: true });
}));

router.post('/:id/report', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isExecutor(req.user, it)) return fail(res, 403, 'Только исполнитель может отправить отчёт');
  if (it.status === 'review') return fail(res, 400, 'Отчёт уже на проверке');
  const text = str(req.body.text);
  if (!text) return fail(res, 400, 'Введите текст отчёта');
  await db.query("UPDATE items SET status = 'review' WHERE id = ?", [it.id]);
  await addHistory(it.id, req.user.id, 'report', text);
  tg.notify(await tg.headIds(), `📝 Отчёт на проверке:\n<b>${tg.esc(it.title)}</b>\nОт: ${tg.esc(req.user.name)}`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/close', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!canClose(req.user, it)) return fail(res, 403, 'Недостаточно прав');
  const comment = str(req.body.comment);
  await db.query(
    `UPDATE items SET status = 'closed', closed_at = NOW(), ext_requested = 0,
     ext_new_deadline = NULL, ext_reason = NULL, ext_requested_at = NULL WHERE id = ?`,
    [it.id]
  );
  await addHistory(it.id, req.user.id, 'closed', comment || null);
  tg.notify([it.main_executor_id, ...it.co_executors].filter((x) => x !== req.user.id),
    `✅ Поручение закрыто:\n<b>${tg.esc(it.title)}</b>${comment ? `\nКомментарий: ${tg.esc(comment)}` : ''}`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/return', withItem, wrap(async (req, res) => {
  const it = req.item;
  if (!isHead(req.user)) return fail(res, 403, 'Недостаточно прав');
  if (it.status !== 'review') return fail(res, 400, 'Вернуть можно только поручение на проверке');
  const comment = str(req.body.comment);
  if (!comment) return fail(res, 400, 'Укажите, что необходимо исправить');
  await db.query("UPDATE items SET status = 'in_progress' WHERE id = ?", [it.id]);
  await addHistory(it.id, req.user.id, 'returned', comment);
  tg.notify([it.main_executor_id, ...it.co_executors],
    `↩️ Возвращено на доработку:\n<b>${tg.esc(it.title)}</b>\n${tg.esc(comment)}`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/edit', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!canEdit(req.user, it)) return fail(res, 403, 'Недостаточно прав');
  const title = req.body.title !== undefined ? str(req.body.title, 500) : it.title;
  const detail = req.body.detail !== undefined ? str(req.body.detail) : it.detail;
  const basis = req.body.basis !== undefined ? str(req.body.basis, 500) : it.basis;
  const priority = req.body.priority !== undefined ? (req.body.priority === 'high' ? 'high' : 'normal') : it.priority;
  if (!title) return fail(res, 400, 'Укажите заголовок');
  const changes = [];
  if (title !== it.title) changes.push(`Заголовок: «${it.title}» → «${title}»`);
  if (detail !== (it.detail || '')) changes.push('Изменено описание');
  if (basis !== (it.basis || '')) changes.push(`Основание: «${it.basis || '—'}» → «${basis || '—'}»`);
  if (priority !== it.priority) changes.push(`Приоритет: ${priority === 'high' ? 'Высокий' : 'Обычный'}`);
  if (!changes.length) return res.json({ ok: true });
  await db.query('UPDATE items SET title = ?, detail = ?, basis = ?, priority = ? WHERE id = ?',
    [title, detail, basis, priority, it.id]);
  await addHistory(it.id, req.user.id, 'edited', changes.join('\n'));
  res.json({ ok: true });
}));

router.post('/:id/deadline', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!canEdit(req.user, it)) return fail(res, 403, 'Недостаточно прав');
  const deadline = normDateTime(req.body.deadline);
  if (!deadline) return fail(res, 400, 'Укажите корректный срок');
  await db.query('UPDATE items SET deadline = ? WHERE id = ?', [deadline, it.id]);
  await addHistory(it.id, req.user.id, 'deadline_changed', `${it.deadline.slice(0, 16)} → ${deadline.slice(0, 16)}`);
  if (deadline !== it.deadline) {
    tg.notify([it.main_executor_id, ...it.co_executors].filter((x) => x !== req.user.id),
      `🗓 Изменён срок поручения:\n<b>${tg.esc(it.title)}</b>\nНовый срок: ${deadline.slice(0, 16)}`, it.id);
  }
  res.json({ ok: true });
}));

router.post('/:id/main', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isManager(req.user)) return fail(res, 403, 'Недостаточно прав');
  const uid = Number(req.body.user_id);
  if (!(await activeUserIds([uid])).length) return fail(res, 400, 'Выберите исполнителя');
  if (uid === it.main_executor_id) return res.json({ ok: true });
  await db.query('UPDATE items SET main_executor_id = ? WHERE id = ?', [uid, it.id]);
  await db.query('DELETE FROM item_executors WHERE item_id = ? AND user_id = ?', [it.id, uid]);
  await addHistory(it.id, req.user.id, 'main_changed', `${it.main_executor_name} → ${await userName(uid)}`);
  tg.notify([uid], `📌 Вы назначены основным исполнителем:\n<b>${tg.esc(it.title)}</b>`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/executors', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isManager(req.user)) return fail(res, 403, 'Недостаточно прав');
  const requested = (Array.isArray(req.body.user_ids) ? req.body.user_ids : []).map(Number)
    .filter((x) => x && x !== it.main_executor_id);
  const active = await activeUserIds(requested);
  // Неактивных соисполнителей, уже назначенных ранее, не удаляем молча
  const next = [...new Set([...active, ...it.co_executors.filter((x) => requested.includes(x))])];
  const added = next.filter((x) => !it.co_executors.includes(x));
  const removed = it.co_executors.filter((x) => !next.includes(x));
  if (!added.length && !removed.length) return res.json({ ok: true });
  for (const uid of removed) await db.query('DELETE FROM item_executors WHERE item_id = ? AND user_id = ?', [it.id, uid]);
  for (const uid of added) await db.query('INSERT IGNORE INTO item_executors (item_id, user_id) VALUES (?, ?)', [it.id, uid]);
  const names = async (ids) => (await Promise.all(ids.map(userName))).join(', ');
  const parts = [];
  if (added.length) parts.push(`Добавлены: ${await names(added)}`);
  if (removed.length) parts.push(`Убраны: ${await names(removed)}`);
  await addHistory(it.id, req.user.id, 'executors_changed', parts.join('\n'));
  if (added.length) tg.notify(added, `📌 Вы назначены соисполнителем:\n<b>${tg.esc(it.title)}</b>`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/ext-request', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isExecutor(req.user, it)) return fail(res, 403, 'Только исполнитель может запросить продление');
  const nd = normDateTime(req.body.new_deadline);
  const reason = str(req.body.reason);
  if (!nd) return fail(res, 400, 'Укажите новый срок');
  if (!reason) return fail(res, 400, 'Укажите причину');
  await db.query(
    'UPDATE items SET ext_requested = 1, ext_new_deadline = ?, ext_reason = ?, ext_requested_at = NOW() WHERE id = ?',
    [nd, reason, it.id]
  );
  await addHistory(it.id, req.user.id, 'ext_requested', `Новый срок: ${nd.slice(0, 16)}\nПричина: ${reason}`);
  tg.notify(await tg.headIds(),
    `⏳ Запрос продления срока:\n<b>${tg.esc(it.title)}</b>\nДо: ${nd.slice(0, 16)}\nПричина: ${tg.esc(reason)}`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/ext-approve', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isHead(req.user)) return fail(res, 403, 'Недостаточно прав');
  if (!it.ext_requested) return fail(res, 400, 'Нет запроса на продление');
  await db.query(
    `UPDATE items SET deadline = ext_new_deadline, ext_requested = 0, ext_new_deadline = NULL,
     ext_reason = NULL, ext_requested_at = NULL WHERE id = ?`,
    [it.id]
  );
  await addHistory(it.id, req.user.id, 'ext_approved', `${it.deadline.slice(0, 16)} → ${it.ext_new_deadline.slice(0, 16)}`);
  tg.notify([it.main_executor_id, ...it.co_executors],
    `✅ Продление одобрено:\n<b>${tg.esc(it.title)}</b>\nНовый срок: ${it.ext_new_deadline.slice(0, 16)}`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/ext-reject', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isHead(req.user)) return fail(res, 403, 'Недостаточно прав');
  if (!it.ext_requested) return fail(res, 400, 'Нет запроса на продление');
  const comment = str(req.body.comment);
  await db.query(
    'UPDATE items SET ext_requested = 0, ext_new_deadline = NULL, ext_reason = NULL, ext_requested_at = NULL WHERE id = ?',
    [it.id]
  );
  await addHistory(it.id, req.user.id, 'ext_rejected',
    `Запрошено: ${it.ext_new_deadline.slice(0, 16)}${comment ? `\n${comment}` : ''}`);
  tg.notify([it.main_executor_id, ...it.co_executors],
    `❌ Продление отклонено:\n<b>${tg.esc(it.title)}</b>\nСрок прежний: ${it.deadline.slice(0, 16)}`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/send-to-control', withItem, notClosed, wrap(async (req, res) => {
  const it = req.item;
  if (!isPersonalOwner(req.user, it)) return fail(res, 403, 'Можно отправить только свою личную задачу');
  await db.query("UPDATE items SET self_type = 'control' WHERE id = ?", [it.id]);
  await addHistory(it.id, req.user.id, 'sent_to_control');
  tg.notify(await tg.headIds(), `📋 ${tg.esc(req.user.name)} поставил(а) задачу на контроль:\n<b>${tg.esc(it.title)}</b>`, it.id);
  res.json({ ok: true });
}));

router.post('/:id/message', withItem, wrap(async (req, res) => {
  const it = req.item;
  const body = str(req.body.body, 10000);
  if (!body) return fail(res, 400, 'Введите сообщение');
  const r = await db.query('INSERT INTO messages (item_id, user_id, body) VALUES (?, ?, ?)', [it.id, req.user.id, body]);
  await db.query(
    `INSERT INTO seen (item_id, user_id, seen_msg_id) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE seen_msg_id = GREATEST(seen_msg_id, VALUES(seen_msg_id))`,
    [it.id, req.user.id, r.insertId]
  );
  if (!isPersonal(it)) {
    let to = participants(it);
    if (isExecutor(req.user, it)) to = to.concat(await tg.headIds());
    tg.notify(to.filter((x) => x !== req.user.id),
      `💬 ${tg.esc(req.user.name)} — «${tg.esc(it.title)}»:\n${tg.esc(body.slice(0, 500))}`, it.id);
  }
  res.json({ ok: true });
}));

module.exports = router;

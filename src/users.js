const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { ROLES, validatePassword, validateLogin, str, publicUser, wrap } = require('./util');

const router = express.Router();

function superOnly(req, res, next) {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Недостаточно прав' });
  next();
}

async function otherActiveSupers(id) {
  const r = await db.one(
    "SELECT COUNT(*) AS c FROM users WHERE role = 'superadmin' AND active = 1 AND id <> ?",
    [id]
  );
  return r.c;
}

router.get('/', wrap(async (req, res) => {
  const rows = await db.query('SELECT * FROM users ORDER BY active DESC, name');
  res.json({ users: rows.map(publicUser) });
}));

// Привязка Telegram — любой пользователь для себя
router.post('/me/telegram', wrap(async (req, res) => {
  const chatId = str(String(req.body.chat_id ?? ''), 50);
  if (chatId && !/^-?\d+$/.test(chatId)) return res.status(400).json({ error: 'chat_id должен быть числом' });
  await db.query('UPDATE users SET tg_chat_id = ? WHERE id = ?', [chatId || null, req.user.id]);
  res.json({ ok: true });
}));

router.post('/', superOnly, wrap(async (req, res) => {
  const login = str(req.body.login, 50);
  const name = str(req.body.name, 200);
  const position = str(req.body.position, 200);
  const role = req.body.role;
  const err = validateLogin(login) || (!name && 'Укажите ФИО') ||
    (!ROLES.includes(role) && 'Выберите роль') || validatePassword(req.body.password);
  if (err) return res.status(400).json({ error: err });
  if (await db.one('SELECT id FROM users WHERE login = ?', [login])) {
    return res.status(400).json({ error: 'Такой логин уже существует' });
  }
  const hash = await bcrypt.hash(req.body.password, 10);
  const r = await db.query(
    'INSERT INTO users (login, password_hash, name, position, role) VALUES (?, ?, ?, ?, ?)',
    [login, hash, name, position, role]
  );
  res.json({ user: publicUser(await db.one('SELECT * FROM users WHERE id = ?', [r.insertId])) });
}));

router.patch('/:id', superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const u = await db.one('SELECT * FROM users WHERE id = ?', [id]);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });

  const login = req.body.login !== undefined ? str(req.body.login, 50) : u.login;
  const name = req.body.name !== undefined ? str(req.body.name, 200) : u.name;
  const position = req.body.position !== undefined ? str(req.body.position, 200) : u.position;
  const role = req.body.role !== undefined ? req.body.role : u.role;
  const err = validateLogin(login) || (!name && 'Укажите ФИО') || (!ROLES.includes(role) && 'Неверная роль');
  if (err) return res.status(400).json({ error: err });
  if (await db.one('SELECT id FROM users WHERE login = ? AND id <> ?', [login, id])) {
    return res.status(400).json({ error: 'Такой логин уже существует' });
  }
  if (u.role === 'superadmin' && role !== 'superadmin' && !(await otherActiveSupers(id))) {
    return res.status(400).json({ error: 'Нельзя снять роль с единственного суперадмина' });
  }
  await db.query('UPDATE users SET login = ?, name = ?, position = ?, role = ? WHERE id = ?',
    [login, name, position, role, id]);
  res.json({ user: publicUser(await db.one('SELECT * FROM users WHERE id = ?', [id])) });
}));

router.post('/:id/password', superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const err = validatePassword(req.body.password);
  if (err) return res.status(400).json({ error: err });
  const hash = await bcrypt.hash(req.body.password, 10);
  const r = await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ ok: true });
}));

router.post('/:id/active', superOnly, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const u = await db.one('SELECT * FROM users WHERE id = ?', [id]);
  if (!u) return res.status(404).json({ error: 'Пользователь не найден' });
  const active = req.body.active === undefined ? !u.active : !!req.body.active;
  if (!active && id === req.user.id) return res.status(400).json({ error: 'Нельзя деактивировать самого себя' });
  if (!active && u.role === 'superadmin' && !(await otherActiveSupers(id))) {
    return res.status(400).json({ error: 'Нельзя деактивировать единственного суперадмина' });
  }
  await db.query('UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  res.json({ user: publicUser(await db.one('SELECT * FROM users WHERE id = ?', [id])) });
}));

module.exports = router;

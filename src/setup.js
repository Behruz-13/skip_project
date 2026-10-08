const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { validatePassword, validateLogin, str, publicUser, wrap } = require('./util');
const { setCookie } = require('./auth');

const router = express.Router();

async function needed() {
  const r = await db.one('SELECT COUNT(*) AS c FROM users');
  return r.c === 0;
}

router.get('/status', wrap(async (req, res) => {
  res.json({ needed: await needed() });
}));

router.post('/', wrap(async (req, res) => {
  if (!(await needed())) return res.status(403).json({ error: 'Система уже настроена' });
  const login = str(req.body.login, 50);
  const name = str(req.body.name, 200);
  const position = str(req.body.position, 200);
  const { password } = req.body;
  const err = validateLogin(login) || (!name && 'Укажите ФИО') || validatePassword(password);
  if (err) return res.status(400).json({ error: err });

  const hash = await bcrypt.hash(password, 10);
  const r = await db.query(
    `INSERT INTO users (login, password_hash, name, position, role)
     SELECT ?, ?, ?, ?, 'superadmin' FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users)`,
    [login, hash, name, position]
  );
  if (!r.affectedRows) return res.status(403).json({ error: 'Система уже настроена' });
  const u = await db.one('SELECT * FROM users WHERE id = ?', [r.insertId]);
  setCookie(res, u);
  res.json({ user: publicUser(u) });
}));

module.exports = router;

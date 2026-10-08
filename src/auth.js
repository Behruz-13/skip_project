const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { publicUser, wrap, str } = require('./util');

const COOKIE = 'skip_token';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function secret() {
  return process.env.JWT_SECRET || 'change-me-in-env';
}

function setCookie(res, user) {
  const token = jwt.sign({ id: user.id }, secret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: MAX_AGE,
    path: '/',
  });
}

async function userFromReq(req) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return null;
  try {
    const { id } = jwt.verify(token, secret());
    const u = await db.one('SELECT * FROM users WHERE id = ?', [id]);
    return u && u.active ? u : null;
  } catch {
    return null;
  }
}

const auth = wrap(async (req, res, next) => {
  const u = await userFromReq(req);
  if (!u) return res.status(401).json({ error: 'Требуется вход в систему' });
  req.user = u;
  next();
});

// Простая защита от перебора паролей
const attempts = new Map();
function tooMany(key) {
  const now = Date.now();
  const a = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(key, a);
  return a.length >= 10;
}

const router = express.Router();

router.post('/login', wrap(async (req, res) => {
  const login = str(req.body.login, 50);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const key = `${req.ip}|${login.toLowerCase()}`;
  if (tooMany(key)) return res.status(429).json({ error: 'Слишком много попыток. Повторите через 15 минут' });

  const u = await db.one('SELECT * FROM users WHERE login = ?', [login]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    attempts.get(key).push(Date.now());
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  if (!u.active) return res.status(403).json({ error: 'Учётная запись деактивирована' });
  attempts.delete(key);
  setCookie(res, u);
  res.json({ user: publicUser(u) });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', wrap(async (req, res) => {
  const u = await userFromReq(req);
  if (!u) return res.status(401).json({ error: 'Не авторизован' });
  res.json({ user: publicUser(u) });
}));

module.exports = { router, auth, setCookie };

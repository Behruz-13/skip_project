const express = require('express');
const db = require('./db');
const { str, wrap } = require('./util');

const router = express.Router();

router.get('/', wrap(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Недостаточно прав' });
  const rows = await db.query(
    `SELECT s.id, s.body, s.created_at, s.user_id, u.name AS user_name
     FROM suggestions s JOIN users u ON u.id = s.user_id ORDER BY s.id DESC`
  );
  res.json({ suggestions: rows });
}));

router.post('/', wrap(async (req, res) => {
  const body = str(req.body.body, 10000);
  if (!body) return res.status(400).json({ error: 'Введите текст предложения' });
  await db.query('INSERT INTO suggestions (user_id, body) VALUES (?, ?)', [req.user.id, body]);
  res.json({ ok: true });
}));

router.delete('/:id', wrap(async (req, res) => {
  if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Недостаточно прав' });
  await db.query('DELETE FROM suggestions WHERE id = ?', [Number(req.params.id)]);
  res.json({ ok: true });
}));

module.exports = router;

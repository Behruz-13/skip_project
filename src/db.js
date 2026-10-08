const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
});

const tz = process.env.DB_TIMEZONE || '+05:00';
// Все даты в БД хранятся в местном времени учреждения
pool.pool.on('connection', (conn) => {
  conn.query('SET time_zone = ?', [tz], (err) => {
    if (err) console.error('Не удалось установить часовой пояс БД:', err.message);
  });
});

async function query(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function one(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// Создание таблиц при первом запуске (если schema.sql не выполнялся вручную)
async function init() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
    .filter(Boolean);
  for (const st of statements) await pool.query(st);

  const col = await one(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'tg_chat_id'`
  );
  if (!col.c) await pool.query('ALTER TABLE users ADD COLUMN tg_chat_id VARCHAR(50) DEFAULT NULL');
}

module.exports = { pool, query, one, init };

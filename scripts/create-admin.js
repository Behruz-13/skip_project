// Резервное создание суперадмина из консоли:
//   node scripts/create-admin.js <логин> <пароль> "<ФИО>" ["<должность>"]
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const db = require('../src/db');
const { validateLogin, validatePassword } = require('../src/util');

(async () => {
  const [login, password, name, position = ''] = process.argv.slice(2);
  const err = validateLogin(login) || validatePassword(password) || (!name && 'Укажите ФИО');
  if (err) {
    console.error(err);
    console.error('Использование: node scripts/create-admin.js <логин> <пароль> "<ФИО>" ["<должность>"]');
    process.exit(1);
  }
  await db.init();
  const hash = await bcrypt.hash(password, 10);
  await db.query(
    `INSERT INTO users (login, password_hash, name, position, role, active) VALUES (?, ?, ?, ?, 'superadmin', 1)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'superadmin', active = 1`,
    [login, hash, name, position]
  );
  console.log(`Суперадмин «${login}» создан/обновлён`);
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

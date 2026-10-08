const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cookieParser = require('cookie-parser');
const db = require('./src/db');
const { auth, router: authRouter } = require('./src/auth');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// API маршруты
app.use('/api/setup', require('./src/setup'));
app.use('/api/auth', authRouter);
app.use('/api/items', auth, require('./src/items'));
app.use('/api/users', auth, require('./src/users'));
app.use('/api/suggestions', auth, require('./src/suggestions'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

// Статика
const pub = path.join(__dirname, 'public');
app.use(express.static(pub, { index: 'index.html' }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(pub, 'index.html')));

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Некорректный запрос' });
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

const port = process.env.PORT || 3000;
db.init()
  .then(() => console.log('База данных готова'))
  .catch((e) => console.error('Ошибка инициализации БД (проверьте .env):', e.message))
  .finally(() => {
    app.listen(port, () => console.log(`СКИП запущен на порту ${port}`));
    require('./src/telegram').start();
  });

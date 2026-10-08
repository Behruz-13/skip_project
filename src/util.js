const ROLES = ['superadmin', 'head', 'assistant', 'staff'];
const MANAGERS = ['superadmin', 'head', 'assistant'];
const HEADS = ['superadmin', 'head'];

function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Пароль должен содержать минимум 8 символов';
  if (!/[A-Za-zА-Яа-яЁё]/.test(p) || !/\d/.test(p)) return 'Пароль должен содержать буквы и цифры';
  return null;
}

function validateLogin(l) {
  if (typeof l !== 'string' || !/^[A-Za-z0-9._-]{2,50}$/.test(l)) {
    return 'Логин: от 2 до 50 символов, латиница, цифры, точка, дефис, подчёркивание';
  }
  return null;
}

// Принимает "YYYY-MM-DD HH:MM", "YYYY-MM-DDTHH:MM[:SS]" → "YYYY-MM-DD HH:MM:SS" или null
function normDateTime(v) {
  if (typeof v !== 'string') return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 31 || +h > 23 || +mi > 59) return null;
  return `${y}-${mo}-${d} ${h}:${mi}:${s || '00'}`;
}

function str(v, max = 100000) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function publicUser(u) {
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    position: u.position,
    role: u.role,
    active: !!u.active,
    tg_linked: !!u.tg_chat_id,
  };
}

// Обёртка для async-обработчиков
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { ROLES, MANAGERS, HEADS, validatePassword, validateLogin, normDateTime, str, publicUser, wrap };

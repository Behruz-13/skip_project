export const ROLE_LABELS = {
  superadmin: 'Суперадмин',
  head: 'Руководитель',
  assistant: 'Помощник',
  staff: 'Сотрудник',
};

export const MANAGERS = ['superadmin', 'head', 'assistant'];
export const HEADS = ['superadmin', 'head'];
export const isManager = (u) => !!u && MANAGERS.includes(u.role);
export const isHead = (u) => !!u && HEADS.includes(u.role);

export const STATUS = {
  new: { label: 'Новое', badge: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-800 border-blue-200' },
  in_progress: { label: 'В работе', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  review: { label: 'На проверке', badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-800 border-purple-200' },
  closed: { label: 'Закрыто', badge: 'bg-green-100 text-green-800', dot: 'bg-green-500', chip: 'bg-green-50 text-green-800 border-green-200' },
  overdue: { label: 'Просрочено', badge: 'bg-red-100 text-red-800', dot: 'bg-red-500', chip: 'bg-red-50 text-red-800 border-red-200' },
};

export const HISTORY_LABELS = {
  created: 'Поручение создано',
  ack: 'Ознакомление',
  progress: 'Промежуточное обновление',
  report: 'Отчёт отправлен',
  closed: 'Закрыто',
  returned: 'Возвращено на доработку',
  deadline_changed: 'Срок изменён',
  main_changed: 'Смена основного исполнителя',
  executors_changed: 'Изменены соисполнители',
  edited: 'Поручение отредактировано',
  ext_requested: 'Запрос продления срока',
  ext_approved: 'Продление одобрено',
  ext_rejected: 'Продление отклонено',
  sent_to_control: 'Отправлено на контроль',
};

export const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD HH:MM:SS" → Date (местное время)
export function parseDT(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}

export function weekday(s) {
  const d = parseDT(s);
  return d ? WEEKDAYS[d.getDay()] : '';
}

export function fmtDate(s) {
  const d = parseDT(s);
  return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : '—';
}

export function fmtDT(s) {
  const d = parseDT(s);
  return d ? `${fmtDate(s)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}

// Срок с днём недели: "12.03.2025 (ср) 18:00"
export function fmtDeadline(s) {
  const d = parseDT(s);
  return d ? `${fmtDate(s)} (${weekday(s)}) ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
}

export function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function splitDT(s) {
  if (!s) return { date: '', time: '18:00' };
  return { date: s.slice(0, 10), time: s.slice(11, 16) || '18:00' };
}

export function isOverdue(it) {
  return it.status !== 'closed' && parseDT(it.deadline) < new Date();
}

export function isDueSoon(it) {
  if (it.status === 'closed') return false;
  const d = parseDT(it.deadline) - new Date();
  return d > 0 && d <= 3 * 24 * 3600 * 1000;
}

export function isExecutor(user, it) {
  return !!user && (it.main_executor_id === user.id || (it.co_executors || []).includes(user.id));
}

export const isPersonal = (it) => !!it.is_self && it.self_type === 'personal';

// Фильтры списка
export const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'review', label: 'На проверке' },
  { key: 'overdue', label: 'Просроченные' },
  { key: 'closed', label: 'Закрытые' },
];

export function matchFilter(it, key) {
  switch (key) {
    case 'new':
    case 'in_progress':
    case 'closed':
      return it.status === key;
    case 'review':
      return it.status === 'review' || (!!it.ext_requested && it.status !== 'closed');
    case 'overdue':
      return isOverdue(it);
    default:
      return true;
  }
}

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

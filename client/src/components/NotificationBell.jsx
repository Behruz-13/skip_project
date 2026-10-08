import React, { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../router.js';
import { fmtDeadline, isDueSoon, isExecutor, isHead, isManager, isOverdue } from '../utils.js';

const TYPES = {
  overdue: { label: 'Просрочено', cls: 'bg-red-500' },
  soon: { label: 'Скоро срок', cls: 'bg-orange-400' },
  review: { label: 'Ожидает проверки', cls: 'bg-purple-500' },
  ext: { label: 'Запрос продления', cls: 'bg-fuchsia-500' },
  msg: { label: 'Новые сообщения', cls: 'bg-blue-500' },
  returned: { label: 'Возвращено на доработку', cls: 'bg-amber-500' },
};

export function buildNotifications(user, items) {
  const out = [];
  for (const it of items) {
    const mine = isExecutor(user, it);
    if (it.status !== 'closed') {
      if (isOverdue(it) && (mine || isManager(user))) {
        out.push({ key: `overdue:${it.id}:${it.deadline}`, type: 'overdue', item: it, text: `Срок истёк ${fmtDeadline(it.deadline)}` });
      } else if (isDueSoon(it) && mine) {
        out.push({ key: `soon:${it.id}:${it.deadline}`, type: 'soon', item: it, text: `Срок ${fmtDeadline(it.deadline)}` });
      }
      if (it.status === 'review' && isHead(user)) {
        out.push({ key: `review:${it.id}:${it.last_action_at}`, type: 'review', item: it, text: 'Отчёт ожидает проверки' });
      }
      if (it.ext_requested && isHead(user)) {
        out.push({ key: `ext:${it.id}:${it.ext_requested_at}`, type: 'ext', item: it, text: `Просят продлить до ${fmtDeadline(it.ext_new_deadline)}` });
      }
      if (it.last_action === 'returned' && mine && it.status === 'in_progress') {
        out.push({ key: `returned:${it.id}:${it.last_action_at}`, type: 'returned', item: it, text: 'Требуется доработка' });
      }
    }
    if (it.unread > 0) {
      out.push({ key: `msg:${it.id}:${it.unread}`, type: 'msg', item: it, text: `Непрочитанных сообщений: ${it.unread}` });
    }
  }
  const order = Object.keys(TYPES);
  return out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

export default function NotificationBell({ user, items }) {
  const storeKey = `skip_seen_notif_${user.id}`;
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storeKey) || '[]'));
    } catch {
      return new Set();
    }
  });
  const ref = useRef(null);
  const list = useMemo(() => buildNotifications(user, items), [user, items]);
  const unseen = list.filter((n) => !seen.has(n.key)).length;

  useEffect(() => {
    const on = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener('mousedown', on);
    window.addEventListener('hashchange', close);
    return () => {
      document.removeEventListener('mousedown', on);
      window.removeEventListener('hashchange', close);
    };
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unseen) {
      const s = new Set(list.map((n) => n.key));
      setSeen(s);
      try {
        localStorage.setItem(storeKey, JSON.stringify([...s]));
      } catch {
        /* */
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-lg p-2 hover:bg-white/10" onClick={toggle} aria-label="Уведомления">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unseen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold">
            {unseen > 99 ? '99+' : unseen}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed left-2 right-2 top-14 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:w-96">
          <div className="sticky top-0 border-b border-slate-100 bg-white px-4 py-2.5 text-sm font-semibold">Уведомления</div>
          {list.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-500">Нет уведомлений</div>}
          {list.map((n) => (
            <button
              key={n.key}
              className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-2.5 text-left hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                navigate(`/item/${n.item.id}`);
              }}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TYPES[n.type].cls}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{TYPES[n.type].label}</span>
                <span className="block truncate text-sm font-medium">{n.item.title}</span>
                <span className="block text-xs text-slate-500">{n.text}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

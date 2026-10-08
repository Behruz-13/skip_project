import React, { useEffect, useRef, useState } from 'react';
import { post } from '../api.js';
import { ROLE_LABELS } from '../utils.js';
import { Logo } from './LoginForm.jsx';
import NotificationBell from './NotificationBell.jsx';
import Modal from './Modal.jsx';

function TelegramModal({ user, onClose, onSaved }) {
  const [chatId, setChatId] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const save = async (value) => {
    setErr('');
    try {
      await post('/users/me/telegram', { chat_id: value });
      setMsg(value ? 'Telegram привязан' : 'Telegram отвязан');
      onSaved(!!value);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal title="Уведомления в Telegram" onClose={onClose}>
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          Статус: {user.tg_linked ? <b className="text-green-700">привязан</b> : <b className="text-slate-500">не привязан</b>}
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-slate-600">
          <li>Откройте бота системы в Telegram и отправьте ему /start.</li>
          <li>Бот пришлёт ваш chat_id — введите его ниже.</li>
        </ol>
        <input className="input" placeholder="chat_id" value={chatId} onChange={(e) => setChatId(e.target.value)} />
        {err && <div className="text-red-600">{err}</div>}
        {msg && <div className="text-green-700">{msg}</div>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" onClick={() => save(chatId.trim())} disabled={!chatId.trim()}>Привязать</button>
          {user.tg_linked && <button className="btn-secondary" onClick={() => save('')}>Отвязать</button>}
        </div>
      </div>
    </Modal>
  );
}

export default function Header({ user, items, onLogout, setUser }) {
  const [menu, setMenu] = useState(false);
  const [tgOpen, setTgOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const on = (e) => ref.current && !ref.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', on);
    return () => document.removeEventListener('mousedown', on);
  }, []);

  return (
    <header className="sticky top-0 z-40 h-14 bg-blue-900 text-white shadow">
      <div className="mx-auto flex h-full max-w-6xl items-center gap-2 px-3 sm:px-4">
        <a href="#/list" className="mr-auto">
          <Logo />
        </a>
        <NotificationBell user={user} items={items} />
        <div className="relative" ref={ref}>
          <button className="flex max-w-[12rem] items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/10" onClick={() => setMenu(!menu)}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">
              {user.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="hidden truncate text-sm sm:block">{user.name}</span>
          </button>
          {menu && (
            <div className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-lg">
              <div className="border-b border-slate-100 px-2 pb-2">
                <div className="break-words font-medium">{user.name}</div>
                <div className="text-xs text-slate-500">{ROLE_LABELS[user.role]}{user.position ? ` · ${user.position}` : ''}</div>
                <div className="text-xs text-slate-400">логин: {user.login}</div>
              </div>
              <button className="mt-1 w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100" onClick={() => { setTgOpen(true); setMenu(false); }}>
                Telegram-уведомления
              </button>
              <button className="w-full rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={onLogout}>
                Выйти
              </button>
            </div>
          )}
        </div>
        <button className="hidden rounded-lg border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10 sm:block" onClick={onLogout}>
          Выход
        </button>
      </div>
      {tgOpen && (
        <TelegramModal user={user} onClose={() => setTgOpen(false)} onSaved={(linked) => setUser({ ...user, tg_linked: linked })} />
      )}
    </header>
  );
}

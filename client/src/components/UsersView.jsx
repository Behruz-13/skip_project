import React, { useState } from 'react';
import { api, post } from '../api.js';
import { ROLE_LABELS } from '../utils.js';
import Modal from './Modal.jsx';

export function passwordError(p) {
  if (!p || p.length < 8) return 'Пароль должен содержать минимум 8 символов';
  if (!/[A-Za-zА-Яа-яЁё]/.test(p) || !/\d/.test(p)) return 'Пароль должен содержать буквы и цифры';
  return null;
}

function UserForm({ initial, isNew, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (isNew) {
      const pe = passwordError(f.password);
      if (pe) return setError(pe);
    }
    setBusy(true);
    setError('');
    try {
      await onSave(f);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Новый пользователь' : 'Редактирование пользователя'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Логин (латиница)</label>
          <input className="input" value={f.login} onChange={set('login')} pattern="[A-Za-z0-9._\-]{2,50}" title="Латиница, цифры, точка, дефис, подчёркивание" required autoFocus />
        </div>
        <div>
          <label className="label">ФИО</label>
          <input className="input" value={f.name} onChange={set('name')} required />
        </div>
        <div>
          <label className="label">Должность</label>
          <input className="input" value={f.position} onChange={set('position')} />
        </div>
        <div>
          <label className="label">Роль</label>
          <select className="input" value={f.role} onChange={set('role')}>
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {isNew && (
          <div>
            <label className="label">Пароль</label>
            <input className="input" type="text" value={f.password} onChange={set('password')} autoComplete="new-password" required />
            <p className="mt-1 text-xs text-slate-500">Минимум 8 символов, буквы и цифры</p>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Сохранить'}</button>
          <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordForm({ user, onClose }) {
  const [p, setP] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const pe = passwordError(p);
    if (pe) return setError(pe);
    try {
      await post(`/users/${user.id}/password`, { password: p });
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal title={`Сброс пароля: ${user.name}`} onClose={onClose}>
      {done ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Пароль изменён. Сообщите его пользователю.</p>
          <button className="btn-primary" onClick={onClose}>Готово</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Новый пароль</label>
            <input className="input" type="text" value={p} onChange={(e) => setP(e.target.value)} autoComplete="new-password" autoFocus required />
            <p className="mt-1 text-xs text-slate-500">Минимум 8 символов, буквы и цифры</p>
          </div>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <div className="flex gap-2">
            <button className="btn-primary">Сохранить</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Отмена</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const ROLE_CLS = {
  superadmin: 'bg-rose-100 text-rose-800',
  head: 'bg-blue-100 text-blue-800',
  assistant: 'bg-teal-100 text-teal-800',
  staff: 'bg-slate-100 text-slate-700',
};

export default function UsersView({ user: me, users, reloadUsers }) {
  const [edit, setEdit] = useState(null);
  const [pwd, setPwd] = useState(null);
  const [error, setError] = useState('');

  const toggle = async (u) => {
    if (u.active && !confirm(`Деактивировать пользователя «${u.name}»? Он не сможет войти, его поручения сохранятся.`)) return;
    setError('');
    try {
      await post(`/users/${u.id}/active`, { active: !u.active });
      reloadUsers();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-slate-900">Пользователи</h1>
        <button className="btn-primary" onClick={() => setEdit({ isNew: true, data: { login: '', name: '', position: '', role: 'staff', password: '' } })}>
          + Добавить пользователя
        </button>
      </div>
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-2.5">
        {users.map((u) => (
          <div key={u.id} className={`card flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${u.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="break-words font-semibold text-slate-900">{u.name}</span>
                <span className={`badge ${ROLE_CLS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                {!u.active && <span className="badge bg-slate-300 text-slate-700">Деактивирован</span>}
                {u.id === me.id && <span className="badge bg-blue-50 text-blue-700">Вы</span>}
              </div>
              <div className="mt-0.5 truncate text-sm text-slate-500">
                {u.login}{u.position ? ` · ${u.position}` : ''}{u.tg_linked ? ' · Telegram ✓' : ''}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={() => setEdit({ isNew: false, id: u.id, data: { login: u.login, name: u.name, position: u.position || '', role: u.role } })}>
                Изменить
              </button>
              <button className="btn-secondary" onClick={() => setPwd(u)}>Сбросить пароль</button>
              {u.id !== me.id && (
                <button className={u.active ? 'btn-secondary text-red-600' : 'btn-success'} onClick={() => toggle(u)}>
                  {u.active ? 'Деактивировать' : 'Активировать'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <UserForm
          initial={edit.data}
          isNew={edit.isNew}
          onClose={() => setEdit(null)}
          onSave={async (f) => {
            if (edit.isNew) await post('/users', f);
            else await api(`/users/${edit.id}`, { method: 'PATCH', body: f });
            await reloadUsers();
          }}
        />
      )}
      {pwd && <PasswordForm user={pwd} onClose={() => setPwd(null)} />}
    </div>
  );
}

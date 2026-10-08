import React, { useState } from 'react';
import { post } from '../api.js';
import { AuthLayout } from './LoginForm.jsx';
import { passwordError } from './UsersView.jsx';

export default function SetupForm({ onDone }) {
  const [f, setF] = useState({ login: '', name: '', position: '', password: '', password2: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const pe = passwordError(f.password);
    if (pe) return setError(pe);
    if (f.password !== f.password2) return setError('Пароли не совпадают');
    setBusy(true);
    setError('');
    try {
      const { user } = await post('/setup', { login: f.login.trim(), name: f.name, position: f.position, password: f.password });
      onDone(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Первоначальная настройка" subtitle="Создайте учётную запись суперадминистратора. Эта форма доступна только один раз.">
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
          <label className="label">Пароль</label>
          <input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required />
          <p className="mt-1 text-xs text-slate-500">Минимум 8 символов, буквы и цифры</p>
        </div>
        <div>
          <label className="label">Повторите пароль</label>
          <input className="input" type="password" value={f.password2} onChange={set('password2')} autoComplete="new-password" required />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Создание…' : 'Создать суперадмина'}</button>
      </form>
    </AuthLayout>
  );
}

import React, { useState } from 'react';
import { post } from '../api.js';

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-800 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-lg font-bold tracking-wide">СКИП</div>
      </div>
    </div>
  );
}

export function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-900 to-slate-800 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <Logo className="mb-1 text-slate-900" />
        <p className="mb-6 text-sm text-slate-500">Система контроля исполнения поручений</p>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export default function LoginForm({ onLogin }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { user } = await post('/auth/login', { login: login.trim(), password });
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Вход в систему">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Логин</label>
          <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus required />
        </div>
        <div>
          <label className="label">Пароль</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? 'Вход…' : 'Войти'}</button>
      </form>
    </AuthLayout>
  );
}

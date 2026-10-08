import React, { useCallback, useEffect, useState } from 'react';
import { api, post } from '../api.js';
import { fmtDT } from '../utils.js';

export default function SuggestionsView({ user }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [list, setList] = useState([]);
  const admin = user.role === 'superadmin';

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      setList((await api('/suggestions')).suggestions);
    } catch (e) {
      setError(e.message);
    }
  }, [admin]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (e) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await post('/suggestions', { body: text });
      setText('');
      setMsg('Спасибо! Предложение отправлено администратору.');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!confirm('Удалить предложение?')) return;
    try {
      await api(`/suggestions/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Предложения</h1>
      <form onSubmit={send} className="card space-y-3 p-4">
        <p className="text-sm text-slate-600">Есть идея, как улучшить систему или работу? Напишите — предложение получит администратор.</p>
        <textarea className="input min-h-[110px]" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ваше предложение…" required />
        {msg && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{msg}</div>}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button className="btn-primary" disabled={!text.trim()}>Отправить</button>
      </form>

      {admin && (
        <div className="space-y-2">
          <h2 className="font-semibold text-slate-800">Поступившие предложения ({list.length})</h2>
          {list.length === 0 && <div className="card p-6 text-center text-sm text-slate-500">Предложений пока нет</div>}
          {list.map((s) => (
            <div key={s.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-xs text-slate-500"><b className="text-slate-700">{s.user_name}</b> · {fmtDT(s.created_at)}</div>
                <button className="text-sm text-red-600 hover:underline" onClick={() => remove(s.id)}>Удалить</button>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{s.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

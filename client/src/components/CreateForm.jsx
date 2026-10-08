import React, { useState } from 'react';
import { post } from '../api.js';
import { navigate } from '../router.js';
import DateTimeInput from './DateTimeInput.jsx';

export function ExecutorCheckboxes({ users, exclude, value, onChange }) {
  const list = users.filter((u) => u.active && u.id !== exclude);
  if (!list.length) return <p className="text-sm text-slate-500">Нет доступных сотрудников</p>;
  return (
    <div className="grid max-h-60 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
      {list.map((u) => (
        <label key={u.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
          <input
            type="checkbox"
            className="h-4 w-4 shrink-0 accent-blue-700"
            checked={value.includes(u.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, u.id] : value.filter((x) => x !== u.id))}
          />
          <span className="min-w-0 truncate">{u.name}{u.position ? <span className="text-slate-400"> · {u.position}</span> : null}</span>
        </label>
      ))}
    </div>
  );
}

export default function CreateForm({ mode, users, reloadItems }) {
  const self = mode === 'self';
  const [f, setF] = useState({
    title: '', detail: '', basis: '', main: '', co: [], date: '', time: '18:00', priority: 'normal', type: 'personal',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.date || !f.time) return setError('Укажите срок исполнения');
    setBusy(true);
    try {
      const deadline = `${f.date} ${f.time}`;
      const { item } = self
        ? await post('/items/self', { title: f.title, detail: f.detail, deadline, type: f.type, priority: f.priority })
        : await post('/items', {
            title: f.title, detail: f.detail, basis: f.basis, main_executor_id: Number(f.main),
            co_executors: f.co, deadline, priority: f.priority,
          });
      await reloadItems();
      navigate(`/item/${item.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const active = users.filter((u) => u.active);

  return (
    <div className="mx-auto max-w-3xl">
      <a href="#/list" className="mb-3 inline-block text-sm text-blue-700 hover:underline">← К списку</a>
      <form onSubmit={submit} className="card space-y-4 p-4 sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">{self ? 'Личная задача' : 'Новое поручение'}</h1>
        <div>
          <label className="label">Заголовок *</label>
          <input className="input" value={f.title} onChange={set('title')} maxLength={500} required autoFocus />
        </div>
        <div>
          <label className="label">Подробное описание{self ? '' : ' *'}</label>
          <textarea className="input min-h-[120px]" value={f.detail} onChange={set('detail')} required={!self} />
        </div>
        {!self && (
          <>
            <div>
              <label className="label">Основной исполнитель *</label>
              <select
                className="input"
                value={f.main}
                onChange={(e) => setF({ ...f, main: e.target.value, co: f.co.filter((x) => x !== Number(e.target.value)) })}
                required
              >
                <option value="">— выберите —</option>
                {active.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.position ? ` (${u.position})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Соисполнители</label>
              <ExecutorCheckboxes users={users} exclude={Number(f.main)} value={f.co} onChange={(co) => setF({ ...f, co })} />
            </div>
          </>
        )}
        <div>
          <label className="label">Срок исполнения *</label>
          <DateTimeInput date={f.date} time={f.time} onChange={({ date, time }) => setF({ ...f, date, time })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Приоритет</label>
            <select className="input" value={f.priority} onChange={set('priority')}>
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
            </select>
          </div>
          {!self && (
            <div>
              <label className="label">Основание / номер документа</label>
              <input className="input" value={f.basis} onChange={set('basis')} maxLength={500} />
            </div>
          )}
        </div>
        {self && (
          <div>
            <label className="label">Тип задачи</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ['personal', 'Личная', 'Видна только вам'],
                ['control', 'На контроль', 'Отправляется руководителю и видна в общем списке'],
              ].map(([v, l, d]) => (
                <label key={v} className={`flex cursor-pointer gap-2 rounded-lg border p-3 ${f.type === v ? 'border-blue-600 bg-blue-50' : 'border-slate-200'}`}>
                  <input type="radio" className="mt-1 accent-blue-700" checked={f.type === v} onChange={() => setF({ ...f, type: v })} />
                  <span>
                    <span className="block text-sm font-medium">{l}</span>
                    <span className="block text-xs text-slate-500">{d}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy}>{busy ? 'Сохранение…' : 'Создать'}</button>
          <a href="#/list" className="btn-secondary">Отмена</a>
        </div>
      </form>
    </div>
  );
}

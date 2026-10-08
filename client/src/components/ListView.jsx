import React, { useMemo } from 'react';
import { FILTERS, isManager, matchFilter, parseDT } from '../utils.js';
import ItemCard from './ItemCard.jsx';
import ExcelExport from './ExcelExport.jsx';

export default function ListView({ user, users, items, listState, setListState }) {
  const { filter, executor, search } = listState;
  const set = (patch) => setListState({ ...listState, ...patch });

  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (executor && it.main_executor_id !== executor) return false;
      if (!q) return true;
      return [it.title, it.detail, it.basis].some((s) => (s || '').toLowerCase().includes(q));
    });
  }, [items, executor, search]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, base.filter((it) => matchFilter(it, f.key)).length])),
    [base]
  );

  const shown = useMemo(() => {
    const list = base.filter((it) => matchFilter(it, filter));
    return list.sort((a, b) => {
      const ac = a.status === 'closed';
      const bc = b.status === 'closed';
      if (ac !== bc) return ac ? 1 : -1;
      if (ac) return (b.closed_at || '').localeCompare(a.closed_at || '');
      return parseDT(a.deadline) - parseDT(b.deadline);
    });
  }, [base, filter]);

  const execUser = executor && users.find((u) => u.id === executor);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-slate-900">Поручения</h1>
        {isManager(user) && <ExcelExport users={users} />}
        <a href="#/new-self" className="btn-secondary">+ Личная задача</a>
        {isManager(user) && <a href="#/new" className="btn-primary">+ Новое поручение</a>}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => set({ filter: f.key })}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              filter === f.key ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-xs ${filter === f.key ? 'bg-white/25' : f.key === 'overdue' && counts[f.key] ? 'bg-red-100 text-red-700' : 'bg-slate-100'}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          <input
            className="input pl-9"
            placeholder="Поиск по заголовку, описанию, основанию…"
            value={search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </div>
        {execUser && (
          <span className="flex items-center gap-2 self-start rounded-full bg-blue-100 py-1 pl-3 pr-1 text-sm text-blue-900 sm:self-auto">
            <span className="max-w-[14rem] truncate">Исполнитель: {execUser.name}</span>
            <button className="rounded-full px-1.5 hover:bg-blue-200" onClick={() => set({ executor: null })} aria-label="Сбросить">✕</button>
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">Поручений не найдено</div>
      ) : (
        <div className="grid gap-2.5">
          {shown.map((it) => <ItemCard key={it.id} item={it} />)}
        </div>
      )}
    </div>
  );
}

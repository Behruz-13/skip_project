import React, { useMemo } from 'react';
import { isOverdue } from '../utils.js';
import { navigate } from '../router.js';

const COLS = [
  { key: 'all', label: 'Всего', test: () => true, cls: 'text-slate-900' },
  { key: 'new', label: 'Новые', test: (it) => it.status === 'new', cls: 'text-blue-700' },
  { key: 'in_progress', label: 'В работе', test: (it) => it.status === 'in_progress', cls: 'text-amber-600' },
  { key: 'review', label: 'На проверке', test: (it) => it.status === 'review' || (!!it.ext_requested && it.status !== 'closed'), cls: 'text-purple-700' },
  { key: 'overdue', label: 'Просрочено', test: isOverdue, cls: 'text-red-600' },
  { key: 'closed', label: 'Закрыто', test: (it) => it.status === 'closed', cls: 'text-green-700' },
];

export default function DashboardView({ items, users, setListState }) {
  const go = (filter, executor = null) => {
    setListState({ filter, executor, search: '' });
    navigate('/list');
  };

  const totals = useMemo(() => Object.fromEntries(COLS.map((c) => [c.key, items.filter(c.test).length])), [items]);

  const rows = useMemo(() => {
    const map = {};
    for (const it of items) {
      const r = (map[it.main_executor_id] = map[it.main_executor_id] || { id: it.main_executor_id, name: it.main_executor_name, items: [] });
      r.items.push(it);
    }
    for (const u of users) if (u.active && !map[u.id]) map[u.id] = { id: u.id, name: u.name, items: [] };
    return Object.values(map)
      .map((r) => ({ ...r, c: Object.fromEntries(COLS.map((c) => [c.key, r.items.filter(c.test).length])) }))
      .sort((a, b) => b.c.all - a.c.all || a.name.localeCompare(b.name, 'ru'));
  }, [items, users]);

  const Num = ({ n, onClick, cls }) => (
    <button onClick={onClick} className={`min-w-[2rem] rounded px-1.5 py-0.5 font-semibold underline-offset-2 hover:bg-slate-100 hover:underline ${n ? cls : 'text-slate-300'}`}>
      {n}
    </button>
  );

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">Дашборд</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {COLS.map((c) => (
          <button key={c.key} onClick={() => go(c.key)} className="card p-4 text-left transition hover:border-blue-300 hover:shadow-md">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</div>
            <div className={`mt-1 text-3xl font-bold ${c.cls}`}>{totals[c.key]}</div>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">По исполнителям</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Исполнитель</th>
                {COLS.map((c) => <th key={c.key} className="px-2 py-2 text-center font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="max-w-[16rem] truncate px-4 py-2 font-medium text-slate-800">{r.name}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-2 py-1.5 text-center">
                      <Num n={r.c[c.key]} cls={c.cls} onClick={() => go(c.key, r.id)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

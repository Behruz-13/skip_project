import React, { useMemo, useState } from 'react';
import { MONTHS, STATUS, dateKey, fmtDeadline, isOverdue, parseDT } from '../utils.js';
import { navigate } from '../router.js';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const colorOf = (it) => STATUS[isOverdue(it) ? 'overdue' : it.status];

export default function CalendarView({ items }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(dateKey(now));

  const byDay = useMemo(() => {
    const map = {};
    for (const it of items) {
      const d = parseDT(it.deadline);
      if (!d) continue;
      (map[dateKey(d)] = map[dateKey(d)] || []).push(it);
    }
    Object.values(map).forEach((l) => l.sort((a, b) => a.deadline.localeCompare(b.deadline)));
    return map;
  }, [items]);

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(ym.y, ym.m, 1 - offset);
    const total = Math.ceil((offset + new Date(ym.y, ym.m + 1, 0).getDate()) / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [ym]);

  const shift = (d) => setYm(({ y, m }) => {
    const n = new Date(y, m + d, 1);
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const today = dateKey(now);
  const dayItems = byDay[selected] || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-bold text-slate-900">Календарь</h1>
        <button className="btn-secondary" onClick={() => shift(-1)} aria-label="Предыдущий месяц">‹</button>
        <div className="min-w-[9.5rem] text-center font-semibold">{MONTHS[ym.m]} {ym.y}</div>
        <button className="btn-secondary" onClick={() => shift(1)} aria-label="Следующий месяц">›</button>
        <button className="btn-secondary" onClick={() => { setYm({ y: now.getFullYear(), m: now.getMonth() }); setSelected(today); }}>Сегодня</button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {['new', 'in_progress', 'review', 'closed', 'overdue'].map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${STATUS[s].dot}`} />{STATUS[s].label}</span>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500">
          {DAYS.map((d, i) => <div key={d} className={`py-2 ${i > 4 ? 'text-red-500' : ''}`}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d) => {
            const k = dateKey(d);
            const list = byDay[k] || [];
            const inMonth = d.getMonth() === ym.m;
            return (
              <div
                key={k}
                onClick={() => setSelected(k)}
                className={`min-h-[64px] cursor-pointer overflow-hidden border-b border-r border-slate-100 p-1 sm:min-h-[110px] sm:p-1.5 ${
                  inMonth ? 'bg-white' : 'bg-slate-50 text-slate-400'
                } ${selected === k ? 'ring-2 ring-inset ring-blue-400' : ''}`}
              >
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${k === today ? 'bg-blue-700 text-white' : ''}`}>
                  {d.getDate()}
                </div>
                {/* Мобильные: точки */}
                <div className="flex flex-wrap gap-1 sm:hidden">
                  {list.slice(0, 6).map((it) => <span key={it.id} className={`h-2 w-2 rounded-full ${colorOf(it).dot}`} />)}
                  {list.length > 6 && <span className="text-[10px] leading-none">+{list.length - 6}</span>}
                </div>
                {/* ПК: метки */}
                <div className="hidden space-y-0.5 sm:block">
                  {list.slice(0, 3).map((it) => (
                    <button
                      key={it.id}
                      onClick={(e) => { e.stopPropagation(); navigate(`/item/${it.id}`); }}
                      className={`block w-full truncate rounded border px-1 py-0.5 text-left text-[11px] font-medium hover:brightness-95 ${colorOf(it).chip}`}
                      title={it.title}
                    >
                      {it.title}
                    </button>
                  ))}
                  {list.length > 3 && <div className="px-1 text-[11px] text-slate-500">ещё {list.length - 3}…</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-2 font-semibold text-slate-800">Срок {parseDT(selected) && `${selected.split('-').reverse().join('.')}`}</h2>
        {dayItems.length === 0 ? (
          <p className="text-sm text-slate-500">Нет поручений на этот день</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dayItems.map((it) => (
              <li key={it.id}>
                <a href={`#/item/${it.id}`} className="flex items-center gap-3 py-2 hover:bg-slate-50">
                  <span className={`h-3 w-3 shrink-0 rounded-full ${colorOf(it).dot}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{it.title}</span>
                  <span className="hidden shrink-0 text-xs text-slate-500 sm:inline">{it.main_executor_name}</span>
                  <span className="shrink-0 text-xs text-slate-500">{fmtDeadline(it.deadline).slice(-5)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

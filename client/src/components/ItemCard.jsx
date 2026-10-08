import React from 'react';
import { fmtDeadline, isOverdue } from '../utils.js';
import { ItemBadges } from './Badges.jsx';

export default function ItemCard({ item }) {
  const overdue = isOverdue(item);
  return (
    <a
      href={`#/item/${item.id}`}
      className={`card block overflow-hidden p-3 transition hover:border-blue-300 hover:shadow-md sm:p-4 ${overdue ? 'border-l-4 border-l-red-500' : ''}`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <h3 className="min-w-0 flex-1 truncate font-semibold text-slate-900" title={item.title}>{item.title}</h3>
        {item.unread > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white" title="Непрочитанные сообщения">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
            {item.unread}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-col gap-0.5 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
        <span className="min-w-0 truncate">
          <span className="text-slate-400">Исполнитель: </span>
          {item.main_executor_name}
          {item.co_executors.length > 0 && <span className="text-slate-400"> +{item.co_executors.length}</span>}
        </span>
        <span className={overdue ? 'font-medium text-red-600' : ''}>
          <span className="text-slate-400">Срок: </span>
          {fmtDeadline(item.deadline)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ItemBadges item={item} />
      </div>
    </a>
  );
}

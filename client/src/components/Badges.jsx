import React from 'react';
import { STATUS, isOverdue } from '../utils.js';

export function StatusBadge({ status }) {
  const s = STATUS[status];
  return <span className={`badge ${s.badge}`}>{s.label}</span>;
}

// Бейдж статуса + отдельный красный бейдж «Просрочено», если срок прошёл
export function ItemBadges({ item, showSelf = true }) {
  return (
    <>
      <StatusBadge status={item.status} />
      {isOverdue(item) && <StatusBadge status="overdue" />}
      {item.priority === 'high' && <span className="badge bg-rose-600 text-white">Высокий приоритет</span>}
      {!!item.ext_requested && item.status !== 'closed' && <span className="badge bg-fuchsia-100 text-fuchsia-800">Запрос продления</span>}
      {showSelf && !!item.is_self && (
        <span className="badge bg-slate-200 text-slate-700">{item.self_type === 'personal' ? 'Личная' : 'Личная · на контроле'}</span>
      )}
    </>
  );
}

import React from 'react';
import { isManager } from '../utils.js';

export default function TabNav({ user, active }) {
  const tabs = [
    { key: 'list', label: 'Поручения', href: '#/list' },
    { key: 'calendar', label: 'Календарь', href: '#/calendar' },
    isManager(user) && { key: 'dashboard', label: 'Дашборд', href: '#/dashboard' },
    user.role === 'superadmin' && { key: 'users', label: 'Пользователи', href: '#/users' },
    { key: 'suggestions', label: 'Предложения', href: '#/suggestions' },
  ].filter(Boolean);
  return (
    <nav className="sticky top-14 z-30 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 sm:px-4">
        {tabs.map((t) => (
          <a
            key={t.key}
            href={t.href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${
              active === t.key ? 'border-blue-700 text-blue-800' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

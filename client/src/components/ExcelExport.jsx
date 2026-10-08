import React, { useState } from 'react';
import { api } from '../api.js';
import { HISTORY_LABELS, STATUS, fmtDT, fmtDeadline, isOverdue } from '../utils.js';

export default function ExcelExport({ users }) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const [{ items, history }, XLSX] = await Promise.all([api('/items/export'), import('xlsx')]);
      const uName = Object.fromEntries(users.map((u) => [u.id, u.name]));
      const statusText = (it) => (isOverdue(it) ? `${STATUS[it.status].label} (просрочено)` : STATUS[it.status].label);

      const sheet1 = items.map((it) => ({
        '№': it.id,
        'Заголовок': it.title,
        'Описание': it.detail || '',
        'Основание': it.basis || '',
        'Основной исполнитель': it.main_executor_name,
        'Соисполнители': it.co_executors.map((id) => uName[id] || id).join(', '),
        'Срок': fmtDeadline(it.deadline),
        'Приоритет': it.priority === 'high' ? 'Высокий' : 'Обычный',
        'Статус': statusText(it),
        'Дата создания': fmtDT(it.created_at),
        'Дата закрытия': it.closed_at ? fmtDT(it.closed_at) : '',
        'Отчёт': it.report_text || '',
      }));

      const stats = {};
      for (const it of items) {
        const s = (stats[it.main_executor_id] = stats[it.main_executor_id] || {
          'Исполнитель': it.main_executor_name, 'Всего': 0, 'В работе': 0, 'На проверке': 0, 'Просрочено': 0, 'Закрыто': 0,
        });
        s['Всего']++;
        if (it.status === 'new' || it.status === 'in_progress') s['В работе']++;
        if (it.status === 'review') s['На проверке']++;
        if (isOverdue(it)) s['Просрочено']++;
        if (it.status === 'closed') s['Закрыто']++;
      }
      const sheet2 = Object.values(stats).sort((a, b) => a['Исполнитель'].localeCompare(b['Исполнитель'], 'ru'));

      const sheet3 = history.map((h) => ({
        'Дата и время': fmtDT(h.created_at),
        '№ поручения': h.item_id,
        'Поручение': h.item_title,
        'Пользователь': h.user_name || '',
        'Действие': HISTORY_LABELS[h.action] || h.action,
        'Подробности': h.detail || '',
      }));

      const wb = XLSX.utils.book_new();
      const add = (rows, name, widths) => {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
        ws['!cols'] = widths.map((w) => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, name);
      };
      add(sheet1, 'Поручения', [6, 40, 60, 20, 25, 30, 22, 10, 22, 17, 17, 60]);
      add(sheet2, 'Статистика по исполнителям', [30, 8, 10, 12, 12, 10]);
      add(sheet3, 'История', [17, 12, 40, 25, 30, 60]);
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `СКИП_поручения_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`Не удалось выполнить экспорт: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn-secondary" onClick={run} disabled={busy}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 text-green-700" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
      {busy ? 'Экспорт…' : 'Экспорт в Excel'}
    </button>
  );
}

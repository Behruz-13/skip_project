import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, post } from '../api.js';
import { navigate } from '../router.js';
import {
  HISTORY_LABELS, fmtDT, fmtDeadline, isExecutor, isHead, isManager, isOverdue, isPersonal, splitDT,
} from '../utils.js';
import { ItemBadges } from './Badges.jsx';
import DateTimeInput from './DateTimeInput.jsx';
import { ExecutorCheckboxes } from './CreateForm.jsx';

function Section({ title, children, right }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

// Панель действия с формой
function ActionPanel({ title, children, onSubmit, onCancel, submitLabel, submitClass = 'btn-primary', busy, error }) {
  return (
    <form
      className="mt-3 space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {children}
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <button className={submitClass} disabled={busy}>{busy ? 'Сохранение…' : submitLabel}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Отмена</button>
      </div>
    </form>
  );
}

function Chat({ item, messages, user, onSent }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await post(`/items/${item.id}/message`, { body: text });
      setText('');
      await onSent();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="py-4 text-center text-sm text-slate-400">Сообщений пока нет</p>}
        {messages.map((m) => {
          const mine = m.user_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${mine ? 'rounded-br-sm bg-blue-700 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800'}`}>
                <div className={`text-xs font-semibold ${mine ? 'text-blue-100' : 'text-slate-500'}`}>{m.user_name}</div>
                <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
                <div className={`mt-0.5 text-right text-[11px] ${mine ? 'text-blue-200' : 'text-slate-400'}`}>{fmtDT(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <textarea
          className="input min-h-[42px] flex-1 resize-y"
          rows={1}
          placeholder="Сообщение…"
          title="Enter — отправить, Shift+Enter — новая строка"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn-primary h-[42px]" onClick={send} disabled={busy || !text.trim()}>Отправить</button>
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function DetailView({ id, user, users, reloadItems }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [panel, setPanel] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/items/${id}`));
    } catch (e) {
      setLoadError(e.message);
    }
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await post(`/items/${id}/open`); // автоматическое ознакомление
      } catch {
        /* нет доступа — покажет load */
      }
      if (alive) {
        await load();
        reloadItems();
      }
    })();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, load, reloadItems]);

  if (loadError) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600">{loadError}</p>
        <a href="#/list" className="btn-secondary mt-4">К списку</a>
      </div>
    );
  }
  if (!data) return <div className="p-8 text-center text-slate-500">Загрузка…</div>;

  const { item, executors, history, messages } = data;
  const closed = item.status === 'closed';
  const executor = isExecutor(user, item);
  const personal = isPersonal(item);
  const personalOwner = personal && item.created_by === user.id;
  const manager = isManager(user);
  const head = isHead(user);
  const canEdit = !closed && (manager || personalOwner);
  const canClose = !closed && (head || personalOwner);

  const open = (name, initial = {}) => {
    setPanel(name);
    setForm(initial);
    setError('');
  };
  const close = () => setPanel(null);
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const run = async (path, body, validate) => {
    const v = validate && validate();
    if (v) return setError(v);
    setBusy(true);
    setError('');
    try {
      await post(`/items/${item.id}/${path}`, body);
      setPanel(null);
      await load();
      reloadItems();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const panelProps = { busy, error, onCancel: close };
  const activeUsers = users.filter((u) => u.active);
  const coNames = executors.filter((e) => !e.main);

  const executorButtons = !closed && executor && (
    <>
      <button className="btn-secondary" onClick={() => open('progress', { text: '' })}>Промежуточное обновление</button>
      {!personal && item.status !== 'review' && (
        <button className="btn-primary" onClick={() => open('report', { text: '' })}>Отправить отчёт</button>
      )}
      {!personal && !item.ext_requested && (
        <button className="btn-secondary" onClick={() => open('ext', { ...splitDT(item.deadline), reason: '' })}>Запросить продление</button>
      )}
    </>
  );

  const managerButtons = canEdit && (
    <>
      <button className="btn-secondary" onClick={() => open('edit', { title: item.title, detail: item.detail || '', basis: item.basis || '', priority: item.priority })}>Редактировать</button>
      <button className="btn-secondary" onClick={() => open('deadline', splitDT(item.deadline))}>Изменить срок</button>
      {manager && !personal && (
        <>
          <button className="btn-secondary" onClick={() => open('main', { user_id: String(item.main_executor_id) })}>Сменить исполнителя</button>
          <button className="btn-secondary" onClick={() => open('executors', { ids: item.co_executors })}>Соисполнители</button>
        </>
      )}
    </>
  );

  const headButtons = (
    <>
      {head && item.status === 'review' && (
        <button className="btn-warning" onClick={() => open('return', { comment: '' })}>Вернуть на доработку</button>
      )}
      {canClose && (
        <button className="btn-success" onClick={() => open('close', { comment: '' })}>
          {personalOwner && !head ? 'Выполнено — закрыть' : 'Закрыть поручение'}
        </button>
      )}
      {personalOwner && !closed && (
        <button className="btn-secondary" onClick={() => run('send-to-control', {})}>Отправить на контроль</button>
      )}
    </>
  );

  const lastReport = [...history].reverse().find((h) => h.action === 'report');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <button onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/list'))} className="text-sm text-blue-700 hover:underline">
        ← Назад
      </button>

      {/* Шапка */}
      <div className="card overflow-hidden p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5">
          <span className="badge bg-slate-100 text-slate-600">№ {item.id}</span>
          <ItemBadges item={item} />
        </div>
        <h1 className="mt-2 break-words text-xl font-bold text-slate-900 sm:text-2xl">{item.title}</h1>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Срок исполнения">
            <span className={isOverdue(item) ? 'font-semibold text-red-600' : 'font-semibold'}>{fmtDeadline(item.deadline)}</span>
          </Field>
          <Field label="Основной исполнитель">{item.main_executor_name}</Field>
          <Field label="Соисполнители">{coNames.length ? coNames.map((e) => e.name).join(', ') : '—'}</Field>
          <Field label="Основание / № документа">{item.basis || '—'}</Field>
          <Field label="Создано">{fmtDT(item.created_at)} · {item.created_by_name}</Field>
          {item.closed_at && <Field label="Закрыто">{fmtDT(item.closed_at)}</Field>}
        </dl>
        {item.detail && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Подробное описание</div>
            <p className="whitespace-pre-wrap break-words text-sm text-slate-800">{item.detail}</p>
          </div>
        )}
      </div>

      {/* Отчёт на проверке */}
      {item.status === 'review' && lastReport && (
        <div className="card border-purple-200 bg-purple-50 p-4">
          <div className="text-sm font-semibold text-purple-900">Отчёт на проверке · {lastReport.user_name} · {fmtDT(lastReport.created_at)}</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-purple-950">{lastReport.detail}</p>
        </div>
      )}

      {/* Запрос продления */}
      {!!item.ext_requested && !closed && (
        <div className="card border-fuchsia-200 bg-fuchsia-50 p-4">
          <div className="text-sm font-semibold text-fuchsia-900">Запрос продления срока · {fmtDT(item.ext_requested_at)}</div>
          <p className="mt-1 text-sm text-fuchsia-950">
            Новый срок: <b>{fmtDeadline(item.ext_new_deadline)}</b> (текущий: {fmtDeadline(item.deadline)})
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-fuchsia-950">Причина: {item.ext_reason}</p>
          {head ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn-success" disabled={busy} onClick={() => run('ext-approve', {})}>Одобрить</button>
              <button className="btn-danger" disabled={busy} onClick={() => run('ext-reject', {})}>Отклонить</button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-fuchsia-700">Ожидает решения руководителя</p>
          )}
          {error && !panel && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {/* Действия */}
      {!closed && (executorButtons || managerButtons || canClose || personalOwner) && (
        <Section title="Действия">
          <div className="flex flex-wrap gap-2">
            {executorButtons}
            {managerButtons}
            {headButtons}
          </div>
          {error && !panel && !item.ext_requested && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {panel === 'progress' && (
            <ActionPanel title="Промежуточное обновление" submitLabel="Сохранить" {...panelProps}
              onSubmit={() => run('progress', { text: form.text }, () => !form.text.trim() && 'Введите текст')}>
              <textarea className="input min-h-[100px]" value={form.text} onChange={setF('text')} placeholder="Что сделано на данный момент…" autoFocus />
            </ActionPanel>
          )}
          {panel === 'report' && (
            <ActionPanel title="Отчёт об исполнении" submitLabel="Отправить отчёт" {...panelProps}
              onSubmit={() => run('report', { text: form.text }, () => !form.text.trim() && 'Введите текст отчёта')}>
              <textarea className="input min-h-[140px]" value={form.text} onChange={setF('text')} placeholder="Текст отчёта…" autoFocus />
            </ActionPanel>
          )}
          {panel === 'ext' && (
            <ActionPanel title="Запрос продления срока" submitLabel="Отправить запрос" {...panelProps}
              onSubmit={() => run('ext-request', { new_deadline: `${form.date} ${form.time}`, reason: form.reason },
                () => (!form.date || !form.time ? 'Укажите новый срок' : !form.reason.trim() && 'Укажите причину'))}>
              <div>
                <label className="label">Новый срок</label>
                <DateTimeInput date={form.date} time={form.time} onChange={(v) => setForm({ ...form, ...v })} />
              </div>
              <div>
                <label className="label">Причина *</label>
                <textarea className="input min-h-[80px]" value={form.reason} onChange={setF('reason')} />
              </div>
            </ActionPanel>
          )}
          {panel === 'edit' && (
            <ActionPanel title="Редактирование поручения" submitLabel="Сохранить" {...panelProps}
              onSubmit={() => run('edit', form, () => !form.title.trim() && 'Укажите заголовок')}>
              <div>
                <label className="label">Заголовок</label>
                <input className="input" value={form.title} onChange={setF('title')} maxLength={500} />
              </div>
              <div>
                <label className="label">Подробное описание</label>
                <textarea className="input min-h-[120px]" value={form.detail} onChange={setF('detail')} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {!personal && (
                  <div>
                    <label className="label">Основание / № документа</label>
                    <input className="input" value={form.basis} onChange={setF('basis')} maxLength={500} />
                  </div>
                )}
                <div>
                  <label className="label">Приоритет</label>
                  <select className="input" value={form.priority} onChange={setF('priority')}>
                    <option value="normal">Обычный</option>
                    <option value="high">Высокий</option>
                  </select>
                </div>
              </div>
            </ActionPanel>
          )}
          {panel === 'deadline' && (
            <ActionPanel title="Изменение срока" submitLabel="Сохранить срок" {...panelProps}
              onSubmit={() => run('deadline', { deadline: `${form.date} ${form.time}` }, () => (!form.date || !form.time) && 'Укажите срок')}>
              <DateTimeInput date={form.date} time={form.time} onChange={(v) => setForm({ ...form, ...v })} />
            </ActionPanel>
          )}
          {panel === 'main' && (
            <ActionPanel title="Смена основного исполнителя" submitLabel="Сохранить" {...panelProps}
              onSubmit={() => run('main', { user_id: Number(form.user_id) })}>
              <select className="input" value={form.user_id} onChange={setF('user_id')}>
                {!activeUsers.some((u) => String(u.id) === form.user_id) && <option value={form.user_id}>{item.main_executor_name}</option>}
                {activeUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.position ? ` (${u.position})` : ''}</option>
                ))}
              </select>
            </ActionPanel>
          )}
          {panel === 'executors' && (
            <ActionPanel title="Соисполнители" submitLabel="Сохранить" {...panelProps}
              onSubmit={() => run('executors', { user_ids: form.ids })}>
              <ExecutorCheckboxes users={users} exclude={item.main_executor_id} value={form.ids} onChange={(ids) => setForm({ ids })} />
            </ActionPanel>
          )}
          {panel === 'close' && (
            <ActionPanel title="Закрытие поручения" submitLabel="Закрыть" submitClass="btn-success" {...panelProps}
              onSubmit={() => run('close', { comment: form.comment })}>
              <textarea className="input min-h-[80px]" value={form.comment} onChange={setF('comment')} placeholder="Комментарий (необязательно)" autoFocus />
            </ActionPanel>
          )}
          {panel === 'return' && (
            <ActionPanel title="Вернуть на доработку" submitLabel="Вернуть" submitClass="btn-warning" {...panelProps}
              onSubmit={() => run('return', { comment: form.comment }, () => !form.comment.trim() && 'Укажите, что необходимо исправить')}>
              <textarea className="input min-h-[100px]" value={form.comment} onChange={setF('comment')} placeholder="Что необходимо исправить… *" autoFocus />
            </ActionPanel>
          )}
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Ознакомление */}
        <Section title="Ознакомление">
          <ul className="divide-y divide-slate-100">
            {executors.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                <span className="min-w-0 break-words">
                  {e.name}
                  {e.main && <span className="ml-1.5 text-xs text-slate-400">основной</span>}
                </span>
                {e.ack_at ? (
                  <span className="text-green-700">✓ {fmtDT(e.ack_at)}</span>
                ) : (
                  <span className="text-slate-400">Не ознакомлен</span>
                )}
              </li>
            ))}
          </ul>
        </Section>

        {/* Сообщения */}
        <Section title="Сообщения">
          <Chat item={item} messages={messages} user={user} onSent={load} />
        </Section>
      </div>

      {/* История */}
      <Section title="История">
        <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-blue-600 ring-1 ring-slate-200" />
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-semibold text-slate-800">{HISTORY_LABELS[h.action] || h.action}</span>
                <span className="text-slate-500">{h.user_name || 'Система'}</span>
                <span className="text-xs text-slate-400">{fmtDT(h.created_at)}</span>
              </div>
              {h.detail && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">{h.detail}</p>}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { useRoute, navigate } from './router.js';
import { isManager } from './utils.js';
import LoginForm from './components/LoginForm.jsx';
import SetupForm from './components/SetupForm.jsx';
import Header from './components/Header.jsx';
import TabNav from './components/TabNav.jsx';
import ListView from './components/ListView.jsx';
import DetailView from './components/DetailView.jsx';
import CreateForm from './components/CreateForm.jsx';
import CalendarView from './components/CalendarView.jsx';
import DashboardView from './components/DashboardView.jsx';
import UsersView from './components/UsersView.jsx';
import SuggestionsView from './components/SuggestionsView.jsx';

export default function App() {
  const [boot, setBoot] = useState('loading'); // loading | setup | login | ready | error
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [listState, setListState] = useState({ filter: 'all', executor: null, search: '' });
  const route = useRoute();

  const start = useCallback(async () => {
    try {
      const s = await api('/setup/status');
      if (s.needed) return setBoot('setup');
      try {
        const { user } = await api('/auth/me');
        setUser(user);
        setBoot('ready');
      } catch {
        setBoot('login');
      }
    } catch {
      setBoot('error');
    }
  }, []);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    const on = () => {
      setUser(null);
      setBoot('login');
    };
    window.addEventListener('skip:unauthorized', on);
    return () => window.removeEventListener('skip:unauthorized', on);
  }, []);

  const reloadItems = useCallback(async () => {
    try {
      const { items } = await api('/items');
      setItems(items);
    } catch {
      /* ошибки сети игнорируем при фоновом обновлении */
    }
  }, []);

  const reloadUsers = useCallback(async () => {
    try {
      const { users } = await api('/users');
      setUsers(users);
    } catch {
      /* */
    }
  }, []);

  useEffect(() => {
    if (boot !== 'ready') return undefined;
    reloadItems();
    reloadUsers();
    const t = setInterval(reloadItems, 30000);
    return () => clearInterval(t);
  }, [boot, reloadItems, reloadUsers]);

  const onLogin = (u) => {
    setUser(u);
    setBoot('ready');
    navigate(window.location.hash.replace(/^#/, '') || '/list');
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* */
    }
    setUser(null);
    setItems([]);
    setBoot('login');
  };

  if (boot === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Загрузка…</div>;
  }
  if (boot === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-slate-700">Не удалось подключиться к серверу.</p>
        <button className="btn-primary" onClick={() => { setBoot('loading'); start(); }}>Повторить</button>
      </div>
    );
  }
  if (boot === 'setup') return <SetupForm onDone={onLogin} />;
  if (boot === 'login' || !user) return <LoginForm onLogin={onLogin} />;

  const ctx = { user, users, items, reloadItems, reloadUsers, listState, setListState };
  let view;
  let tab = 'list';
  const m = route.match(/^\/item\/(\d+)/);
  if (m) {
    view = <DetailView key={m[1]} id={Number(m[1])} {...ctx} />;
  } else if (route === '/new' && isManager(user)) {
    view = <CreateForm mode="item" {...ctx} />;
  } else if (route === '/new-self') {
    view = <CreateForm mode="self" {...ctx} />;
  } else if (route === '/calendar') {
    tab = 'calendar';
    view = <CalendarView {...ctx} />;
  } else if (route === '/dashboard' && isManager(user)) {
    tab = 'dashboard';
    view = <DashboardView {...ctx} />;
  } else if (route === '/users' && user.role === 'superadmin') {
    tab = 'users';
    view = <UsersView {...ctx} />;
  } else if (route === '/suggestions') {
    tab = 'suggestions';
    view = <SuggestionsView {...ctx} />;
  } else {
    view = <ListView {...ctx} />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Header user={user} items={items} onLogout={logout} reloadUsers={reloadUsers} setUser={setUser} />
      <TabNav user={user} active={tab} />
      <main className="mx-auto w-full max-w-6xl px-3 pb-12 pt-4 sm:px-4">{view}</main>
    </div>
  );
}

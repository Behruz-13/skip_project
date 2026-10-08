export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* пустой ответ */
  }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('skip:unauthorized'));
    const err = new Error(data.error || `Ошибка ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const post = (path, body = {}) => api(path, { method: 'POST', body });

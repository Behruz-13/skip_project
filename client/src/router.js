import { useEffect, useState } from 'react';

const read = () => (window.location.hash.replace(/^#/, '') || '/list');

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(path) {
  if (read() !== path) window.location.hash = path;
}

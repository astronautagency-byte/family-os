import { useEffect, useRef } from 'react';

let pendingPage = null;
const listeners = new Map();
export function requestPageAdd(page) {
  pendingPage = page;
  listeners.get(page)?.();
}
export default function usePageAdd(page, onAdd) {
  const callback = useRef(onAdd);
  callback.current = onAdd;
  useEffect(() => {
    const consume = () => {
      if (pendingPage !== page) return;
      pendingPage = null;
      callback.current();
    };
    listeners.set(page, consume);
    consume();
    return () => { if (listeners.get(page) === consume) listeners.delete(page); };
  }, [page]);
}

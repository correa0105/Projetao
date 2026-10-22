import { useEffect, useRef, useState } from 'react';

// Keep already decoded camp companions when navigating between portal tabs.
// Metadata is still revalidated; new art replaces the old image only after decoding.
const prepared = new Map<string, unknown>();
export function useCampCompanion<T>(key: string, revision: number, load: () => Promise<T>) {
  const latest = useRef(load);
  latest.current = load;
  const [state, setState] = useState(() => ({
    key,
    value: prepared.get(key) as T | undefined,
    ready: prepared.has(key),
  }));
  useEffect(() => {
    let active = true;
    void latest
      .current()
      .then((value) => {
        if (!active) return;
        prepared.set(key, value);
        if (prepared.size > 64) prepared.delete(prepared.keys().next().value!);
        setState({ key, value, ready: true });
      })
      .catch(() => {
        if (active) setState({ key, value: prepared.get(key) as T | undefined, ready: true });
      });
    return () => {
      active = false;
    };
  }, [key, revision]);
  return state.key === key
    ? state
    : { key, value: prepared.get(key) as T | undefined, ready: prepared.has(key) };
}

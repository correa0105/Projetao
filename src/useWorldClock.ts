import { useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import { worldDayMs, worldClockRate, type WorldClockSnapshot } from '../shared/world-clock';
export function useWorldClock() {
  const [clock, setClock] = useState<WorldClockSnapshot | null>(null),
    [now, setNow] = useState(performance.now()),
    [error, setError] = useState('');
  const received = useRef(performance.now()),
    generation = useRef(0),
    revision = useRef(0);
  function accept(next: WorldClockSnapshot) {
    if (next.revision < revision.current) return;
    revision.current = next.revision;
    received.current = performance.now();
    setNow(received.current);
    setClock(next);
    setError('');
  }
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const request = ++generation.current;
      try {
        const next = await api<WorldClockSnapshot>('/world-clock');
        if (active && request === generation.current) accept(next);
      } catch (e) {
        if (active)
          setError(e instanceof Error ? e.message : 'Não foi possível sincronizar o relógio.');
      }
    };
    const focus = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const sync = setInterval(focus, 30_000),
      tick = setInterval(() => {
        if (!document.hidden) setNow(performance.now());
      }, 1000);
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      active = false;
      generation.current++;
      clearInterval(sync);
      clearInterval(tick);
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, []);
  async function adjust(time: string) {
    if (!clock) throw new Error('Aguarde a sincronização do relógio.');
    generation.current++;
    const next = await post<WorldClockSnapshot>('/world-clock', { time, revision: clock.revision });
    accept(next);
  }
  return {
    clock,
    timeMs: clock
      ? (clock.timeMs + Math.max(0, now - received.current) * worldClockRate) % worldDayMs
      : 14 * 3_600_000,
    error,
    adjust,
  };
}

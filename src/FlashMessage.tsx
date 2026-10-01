import { isValidElement, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './flash-message.css';

type Message = { id: string; text: string; kind: 'error' | 'success' | 'info' };
let messages: Message[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function emit() { listeners.forEach((listener) => listener()); }
function dismiss(id: string) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  messages = messages.filter((message) => message.id !== id);
  emit();
}
function textOf(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(value)) return textOf(value.props.children);
  return '';
}

/** Declarative feedback shared by pages and dialogs; does not occupy their layout. */
export function FlashMessage({ children, kind = 'error' }: { children: ReactNode; kind?: Message['kind'] }) {
  const id = useId();
  const text = textOf(children).trim();
  useEffect(() => {
    if (!text || messages.some((message) => message.text === text && message.kind === kind)) return;
    clearTimeout(timers.get(id));
    messages = [...messages.filter((message) => message.id !== id), { id, text, kind }];
    emit();
    timers.set(id, setTimeout(() => dismiss(id), 5000));
  }, [id, text, kind]);
  return null;
}

export function FlashMessages() {
  const entries = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => messages,
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Manual popover remains above modal dialogs without stealing focus.
    if (ref.current?.matches(':popover-open')) ref.current.hidePopover();
    if (entries.length) ref.current?.showPopover();
  }, [entries]);
  return createPortal(
    <div ref={ref} popover="manual" className="flash-messages" aria-label="Avisos">
      {entries.map((message) => (
        <div key={message.id} className={`flash-message flash-message--${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
          <span>{message.text}</span>
          <button type="button" onClick={() => dismiss(message.id)} aria-label="Dispensar aviso"><X size={16} /></button>
        </div>
      ))}
    </div>, document.body,
  );
}

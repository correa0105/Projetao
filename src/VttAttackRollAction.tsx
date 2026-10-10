import { useSyncExternalStore } from 'react';
const actions = new Map<string, () => Promise<void>>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(listener => listener());
export function registerAttackDamage(id: string, action: () => Promise<void>) {
  actions.set(id, action); notify();
  return () => {if (actions.get(id) === action) {actions.delete(id); notify();}};
}
export function VttAttackRollAction({ messageId }: { messageId: string }) {
  const action = useSyncExternalStore(listener => {listeners.add(listener); return () => {listeners.delete(listener);};}, () => actions.get(messageId));
  return action ? <button className="vtt-chat-damage" onClick={() => void action()}>Rolar dano</button>
    : <small>Rolagem de acerto · não aplica dano</small>;
}

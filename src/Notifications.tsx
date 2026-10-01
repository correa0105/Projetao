import { FlashMessage } from './FlashMessage';
import { useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, Dices, Shield, TrendingUp, X, Check } from 'lucide-react';
import { api, post } from './api';
import type { PlayerNotification } from '../shared/notifications';
import type { Character } from './types';
import './notifications.css';

export function Notifications({
  characters,
  page,
  onNavigate,
}: {
  characters: Character[];
  page: string;
  onNavigate: (characterId: string, page: 'profile' | 'board') => void;
}) {
  const [items, setItems] = useState<PlayerNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const result = await api<PlayerNotification[]>('/notifications');
        if (alive) {
          setItems(result);
          setError('');
        }
      } catch {
        if (alive) setError('Não foi possível atualizar os avisos.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      window.removeEventListener('focus', refresh);
    };
  }, [characters, page, open, revision]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="player-notifications" ref={root}>
      <button
        className="notifications-trigger"
        ref={trigger}
        aria-label={`Pendências e notificações${items.length ? `: ${items.length}` : ''}`}
        aria-expanded={open}
        aria-controls="player-notifications-panel"
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} aria-hidden="true" />
        {items.length > 0 && <span className="notifications-count">{items.length}</span>}
      </button>
      {open && (
        <section
          className="notifications-panel"
          id="player-notifications-panel"
          aria-label="Pendências e notificações"
        >
          <header>
            <h2>Pendências e avisos</h2>
            <button
              ref={close}
              aria-label="Fechar notificações"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          <p className="notifications-caption">
            Seus personagens · {items.length} {items.length === 1 ? 'aviso' : 'avisos'}
          </p>
          {error && (
            <FlashMessage>
              {error} <button onClick={() => setRevision((v) => v + 1)}>Tentar novamente</button>
            </FlashMessage>
          )}
          {loading ? (
            <p role="status">Consultando pendências…</p>
          ) : (
            !error &&
            items.length === 0 && (
              <p className="notifications-empty">
                <Check size={20} /> Nenhuma pendência no momento.
              </p>
            )
          )}
          <ul>
            {items.map((item) => {
              const Icon =
                item.kind === 'roll'
                  ? Dices
                  : item.kind === 'rank'
                    ? Shield
                    : item.kind === 'level'
                      ? TrendingUp
                      : BookOpen;
              return (
                <li key={item.id}>
                  <Icon size={18} aria-hidden="true" />
                  <div>
                    <small>{item.characterName}</small>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <button
                      className="notification-action"
                      onClick={() => {
                        setOpen(false);
                        onNavigate(item.characterId, item.target);
                      }}
                    >
                      {item.action} →
                    </button>
                    {item.kind === 'level' && (
                      <button
                        className="notification-read"
                        disabled={saving}
                        onClick={async () => {
                          setSaving(true);
                          try {
                            await post(`/characters/${item.characterId}/notifications/level-read`, {
                              level: item.level,
                            });
                            setRevision((v) => v + 1);
                          } catch {
                            setError('Não foi possível marcar o aviso como lido.');
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        Marcar como lido
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

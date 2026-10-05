import { useEffect, useRef, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { api } from './api';
import { cards, type Card, type OwnedCard } from '../shared/cards';
import { CardFace } from './Cards';
import type { Character } from './types';
import './character-cards.css';

export type CollectionCard = { ownedId: string; card: Card; level: number; slot: number | null };

export function CardCollection({
  items,
  loading = false,
  busy = false,
  equip,
}: {
  items: CollectionCard[];
  loading?: boolean;
  busy?: boolean;
  equip?: (id: string | null, slot: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState('');
  const current = items.find((item) => item.ownedId === selected) || items[0];
  return (
    <div className="character-card-collection" aria-busy={loading}>
      <div className="character-card-slots" aria-label="Três cartas selecionadas">
        {[1, 2, 3].map((slot) => {
          const item = items.find((card) => card.slot === slot);
          return (
            <article key={slot} className="character-card-slot" data-slot={slot} data-empty={!item}>
              {item ? (
                <CardFace card={item.card} />
              ) : (
                <div className="character-card-empty">
                  <Layers size={24} strokeWidth={1} />
                  <span>Espaço {slot}</span>
                </div>
              )}
              <span className="character-card-slot-label">
                {item ? `${item.card.name} · nível ${item.level}` : 'Sem carta equipada'}
              </span>
              {item && equip && (
                <button
                  className="character-card-remove"
                  aria-label={`Retirar ${item.card.name} do espaço ${slot}`}
                  disabled={busy}
                  onClick={() => void equip(null, slot)}
                >
                  <X size={15} />
                </button>
              )}
            </article>
          );
        })}
      </div>
      <section className="character-card-inventory" aria-label="Inventário de cartas">
        <header>
          <h3>Inventário de cartas</h3>
          <span>
            {items.length} {items.length === 1 ? 'carta' : 'cartas'}
          </span>
        </header>
        {loading ? (
          <p role="status">Abrindo a coleção…</p>
        ) : items.length ? (
          <>
            <div className="character-card-inventory-grid">
              {items.map((item) => (
                <button
                  key={item.ownedId}
                  className="character-card-choice"
                  aria-label={`Ver ${item.card.name}`}
                  aria-pressed={current?.ownedId === item.ownedId}
                  onClick={() => setSelected(item.ownedId)}
                >
                  <CardFace card={item.card} small />
                  <span>
                    {item.slot ? `Equipada · espaço ${item.slot}` : 'Na coleção'} · nível{' '}
                    {item.level}
                  </span>
                </button>
              ))}
            </div>
            {current && (
              <div className="character-card-description">
                <h4>{current.card.name}</h4>
                <p>{current.card.description}</p>
                {equip && (
                  <div className="character-card-equip-actions">
                    {[1, 2, 3].map((slot) => (
                      <button
                        key={slot}
                        className="button outline"
                        disabled={busy || current.slot === slot}
                        onClick={() => void equip(current.ownedId, slot)}
                      >
                        {current.slot === slot
                          ? `Equipada no espaço ${slot}`
                          : `Equipar no espaço ${slot}`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="character-card-collection-empty">
            Este personagem ainda não possui cartas.
          </p>
        )}
      </section>
    </div>
  );
}

export function CharacterCards({ character }: { character?: Character }) {
  const [owned, setOwned] = useState<OwnedCard[]>([]),
    [loading, setLoading] = useState(Boolean(character)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const inFlight = useRef(false),
    live = useRef(true);
  useEffect(() => {
    live.current = true;
    if (character)
      void api<OwnedCard[]>('/cards/' + character.id)
        .then((items) => {
          if (live.current) setOwned(items);
        })
        .catch((e: Error) => {
          if (live.current) setError(e.message);
        })
        .finally(() => {
          if (live.current) setLoading(false);
        });
    return () => {
      live.current = false;
    };
  }, [character?.id]);
  async function equip(id: string | null, slot: number) {
    if (!character || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const slots = [1, 2, 3]
      .map((position) => owned.find((item) => item.slot === position)?.id || null)
      .map((existing) => (existing === id ? null : existing));
    slots[slot - 1] = id;
    try {
      await api('/cards/' + character.id + '/equipment', {
        method: 'PUT',
        body: JSON.stringify({ slots }),
      });
      const updated = await api<OwnedCard[]>('/cards/' + character.id);
      if (live.current) setOwned(updated);
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }
  const items = owned.flatMap((item) => {
    const card = cards.find((definition) => definition.id === item.card_id);
    return card ? [{ ownedId: item.id, card, level: item.level, slot: item.slot }] : [];
  });
  return (
    <section className="character-cards-page">
      <div className="page-header-spacer" aria-hidden="true" />
      <header className="character-cards-heading">
        <h1>Cartas de {character?.name || 'seu personagem'}</h1>
      </header>
      {error && <p role="alert">{error}</p>}
      {character ? (
        <CardCollection items={items} loading={loading} busy={busy} equip={equip} />
      ) : (
        <p>Selecione ou crie um personagem para abrir sua coleção.</p>
      )}
    </section>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Layers, X } from 'lucide-react';
import { api } from './api';
import { cards, type Card, type OwnedCard } from '../shared/cards';
import { CardFace } from './Cards';
import type { Character } from './types';
import './character-cards.css';
import { cardStories } from '../shared/card-stories';
import './card-folio.css';

export type CollectionCard = { ownedId: string; card: Card; level: number; slot: number | null };

export function CardCollection({
  items,
  loading = false,
  busy = false,
  equip,
  folio = false,
}: {
  items: CollectionCard[];
  loading?: boolean;
  busy?: boolean;
  equip?: (id: string | null, slot: number) => Promise<void>;
  folio?: boolean;
}) {
  const [selected, setSelected] = useState('');
  const current = items.find((item) => item.ownedId === selected) || items[0];
  const [query, setQuery] = useState('');
  const normalize = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  if (folio)
    return (
      <div className="character-card-collection card-folio" aria-busy={loading}>
        <aside className="card-folio-sidebar" aria-label="Minha coleção de cartas">
          <header>
            <span className="eyebrow">O SEU ACERVO</span>
            <h3>
              Minhas cartas <small>{items.length}</small>
            </h3>
          </header>
          <label className="card-folio-search">
            Buscar na coleção
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nome ou família"
            />
          </label>
          {loading ? (
            <p role="status">Abrindo a coleção…</p>
          ) : !items.length ? (
            <p>Suas cartas serão guardadas aqui.</p>
          ) : (
            <nav aria-label="Cartas do personagem">
              {items
                .filter((item) =>
                  normalize(item.card.name + ' ' + item.card.family).includes(normalize(query)),
                )
                .map((item) => (
                  <button
                    key={item.ownedId}
                    className="character-card-choice card-folio-choice"
                    aria-label={`Ver ${item.card.name}`}
                    aria-pressed={current?.ownedId === item.ownedId}
                    onClick={() => setSelected(item.ownedId)}
                  >
                    <CardFace card={item.card} small />
                    <span>
                      <strong>{item.card.name}</strong>
                      <small>
                        {item.card.family} · nível {item.level}
                      </small>
                      <em>{item.slot ? `Equipada · espaço ${item.slot}` : 'Na coleção'}</em>
                    </span>
                  </button>
                ))}
              {items.length > 0 &&
                !items.some((item) =>
                  normalize(item.card.name + ' ' + item.card.family).includes(normalize(query)),
                ) && <p>Nenhuma carta encontrada.</p>}
            </nav>
          )}
          <a className="card-folio-salon-link" href="#cards">
            Visitar o Salão das Cartas <span aria-hidden="true">↗</span>
          </a>
        </aside>
        <div className="card-folio-main">
          <section className="card-folio-playset" aria-label="Cartas para a jornada">
            <header>
              <div>
                <span className="eyebrow">A SUA JORNADA</span>
                <h3>Três lugares, três histórias</h3>
              </div>
              <span>{items.filter((item) => item.slot).length} / 3 equipadas</span>
            </header>
            <div className="character-card-slots" aria-label="Três cartas selecionadas">
              {[1, 2, 3].map((slot) => {
                const item = items.find((card) => card.slot === slot);
                return (
                  <article
                    key={slot}
                    className="character-card-slot"
                    data-slot={slot}
                    data-empty={!item}
                  >
                    {item ? (
                      <button
                        className="card-folio-slot-face"
                        onClick={() => setSelected(item.ownedId)}
                        aria-label={`Ver carta do espaço ${slot}: ${item.card.name}`}
                      >
                        <CardFace card={item.card} />
                      </button>
                    ) : (
                      <div className="character-card-empty">
                        <Layers size={24} strokeWidth={1} />
                        <span>Espaço {slot}</span>
                        <small>Selecione uma carta ao lado</small>
                      </div>
                    )}
                    <span className="character-card-slot-label">
                      {item ? item.card.name : 'Sem carta equipada'}
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
          </section>
          {current ? (
            <section className="card-folio-record" aria-label="Registro da carta selecionada">
              <div className="card-folio-art">
                <CardFace card={current.card} />
              </div>
              <div className="character-card-description">
                <span className="eyebrow">
                  {current.card.family} · NÍVEL {current.level}
                </span>
                <h4>{current.card.name}</h4>
                <p>{current.card.description}</p>
                <div className="card-folio-story">
                  <span className="eyebrow">
                    {cardStories[current.card.id]?.provenance || 'Do registro do Anfitrião'}
                  </span>
                  <p>{cardStories[current.card.id]?.story || current.card.comment}</p>
                </div>
                <blockquote>
                  {current.card.comment}
                  <cite>— O Anfitrião</cite>
                </blockquote>
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
            </section>
          ) : (
            <section className="card-folio-welcome">
              <span className="eyebrow">UM REGISTRO À SUA ESPERA</span>
              <h3>Toda coleção começa com uma história.</h3>
              <p>
                Visite o Anfitrião no Salão das Cartas. As cartas que adquirir aparecerão neste
                acervo, prontas para acompanhar seu personagem.
              </p>
              <a className="button outline" href="#cards">
                Conhecer as cartas
              </a>
            </section>
          )}
        </div>
      </div>
    );
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
        <h2>Coleção de {character?.name || 'seu personagem'}</h2>
      </header>
      {error && <p role="alert">{error}</p>}
      {character ? (
        <CardCollection items={items} loading={loading} busy={busy} equip={equip} folio />
      ) : (
        <p>Selecione ou crie um personagem para abrir sua coleção.</p>
      )}
    </section>
  );
}

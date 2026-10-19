import { useState } from 'react';
import { guildEstateFurnitureCatalog, type GuildEstateLayout } from '../shared/guild-estate';
import { money } from '../shared/rules';
import { Modal } from './components';
export function GuildEstateShop({
  estate,
  treasury,
  busy,
  error,
  close,
  buy,
  place,
}: {
  estate: GuildEstateLayout;
  treasury: number;
  busy: boolean;
  error: string;
  close: () => void;
  buy: (id: string) => void;
  place: (id: string) => void;
}) {
  const [search, setSearch] = useState(''),
    [tab, setTab] = useState<'shop' | 'inventory'>('shop');
  const normal = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const list = guildEstateFurnitureCatalog.filter((f) => normal(f.name).includes(normal(search)));
  return (
    <Modal title="Mobília da guilda" close={() => !busy && close()}>
      <div className="guild-estate-shop">
        <p>
          Tesouro disponível: <strong>{money(treasury)}</strong>. Os móveis pertencem à guilda.
        </p>
        <div className="guild-estate-shop-tabs">
          <button type="button" aria-pressed={tab === 'shop'} onClick={() => setTab('shop')}>
            Loja de móveis
          </button>
          <button
            type="button"
            aria-pressed={tab === 'inventory'}
            onClick={() => setTab('inventory')}
          >
            Acervo · {estate.furniture.length}
          </button>
        </div>
        <label>
          Buscar móvel
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Mesa, cadeira, cama, tapete…"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <ul>
          {tab === 'shop'
            ? list.map((f) => (
                <li key={f.id} data-estate-shop-item={f.id}>
                  <img src={f.image} loading="lazy" alt="" />
                  <b>{f.name}</b>
                  <span>{money(f.price * 100)}</span>
                  <button
                    type="button"
                    disabled={busy || treasury < f.price * 100 || estate.furniture.length >= 120}
                    onClick={() => buy(f.id)}
                  >
                    Comprar
                  </button>
                </li>
              ))
            : estate.furniture
                .filter((i) => list.some((f) => f.id === i.catalog))
                .map((i) => {
                  const f = guildEstateFurnitureCatalog.find((f) => f.id === i.catalog)!;
                  return (
                    <li key={i.id}>
                      <img src={f.image} loading="lazy" alt="" />
                      <b>{f.name}</b>
                      <span>{i.x === null ? 'Guardado no acervo' : 'Na sede'}</span>
                      <button type="button" disabled={busy} onClick={() => place(i.id)}>
                        {i.x === null ? 'Colocar na casa' : 'Reposicionar'}
                      </button>
                    </li>
                  );
                })}
        </ul>
        {tab === 'inventory' && !estate.furniture.length && <p>Nenhum móvel comprado ainda.</p>}
      </div>
    </Modal>
  );
}

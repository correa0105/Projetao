import { useState, type ReactNode } from 'react';
import { Pencil, Plus, ScrollText, Search, ShoppingBag } from 'lucide-react';
import {
  specialOfferCategoryLabels,
  type SpecialOffer,
  type SpecialShopState,
} from '../shared/special-economy';

const shelves = [
  ['all', 'Todos'],
  ['profile_border', 'Bordas de perfil'],
  ['weapon_skin', 'Skins de armas'],
  ['mount', 'Montarias'],
  ['pet', 'Mascotes'],
] as const;

function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

export function RelicCatalogue({
  state,
  status,
  busy,
  canBuy,
  onBuy,
  onEdit,
  onCreate,
  onCollection,
  onHistory,
}: {
  state: SpecialShopState | null;
  status: ReactNode;
  busy: boolean;
  canBuy: (offer: SpecialOffer) => boolean;
  onBuy: (offer: SpecialOffer) => void;
  onEdit: (offer: SpecialOffer) => void;
  onCreate: (category?: SpecialOffer['category']) => void;
  onCollection: () => void;
  onHistory?: () => void;
}) {
  const [shelf, setShelf] = useState<(typeof shelves)[number][0]>('all');
  const [search, setSearch] = useState('');
  const query = searchText(search.trim());
  const offers = state?.offers ?? [];
  const visible = offers.filter(
    (offer) =>
      (shelf === 'all' || offer.category === shelf) &&
      searchText(offer.name + ' ' + offer.description).includes(query),
  );
  const owned = new Set(state?.purchases.map((purchase) => purchase.offer_id));

  return (
    <section
      className="relic-shop-showcase"
      aria-label="Catálogo de Relíquias"
      data-empty={!visible.length || undefined}
    >
      <nav className="shop-shelves shop-stone" aria-label="Prateleiras de Relíquias">
        <h2>Prateleiras</h2>
        {shelves.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={shelf === key ? 'active' : ''}
            aria-pressed={shelf === key}
            onClick={() => setShelf(key)}
          >
            {label}
            <span aria-hidden="true">
              {key === 'all'
                ? offers.length
                : offers.filter((offer) => offer.category === key).length}
            </span>
          </button>
        ))}
      </nav>
      <div className="shop-catalog shop-stone">
        <div className="shop-search-row">
          <label>
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              aria-label="Procurar item"
              placeholder="Procure um item…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          {state && (
            <span title="Saldo de Prestígio">
              <img
                src="/navigation/illustrated-20261020/reliquias.webp"
                width={17}
                height={17}
                alt=""
              />
              {state.balance.toLocaleString('pt-BR')} Prestígio
            </span>
          )}
          <button
            type="button"
            className="shop-cart-toggle"
            aria-label="Minha coleção"
            title="Minha coleção"
            disabled={!state}
            onClick={onCollection}
          >
            <ShoppingBag size={17} aria-hidden="true" />
            <b aria-hidden="true">{state?.purchases.length ?? 0}</b>
          </button>
          {onHistory && (
            <button
              type="button"
              className="shop-cart-toggle"
              aria-label="Histórico e recompensas"
              title="Histórico e recompensas"
              onClick={onHistory}
            >
              <ScrollText size={17} aria-hidden="true" />
            </button>
          )}
        </div>
        {status}
        {state?.can_edit && (
          <button
            type="button"
            className="button outline relic-shop-add"
            disabled={busy}
            onClick={() => onCreate(shelf === 'all' ? undefined : shelf)}
          >
            <Plus size={14} aria-hidden="true" /> Cadastrar oferta
          </button>
        )}
        <div className="shop-product-list" tabIndex={0} aria-label="Ofertas de Relíquias">
          {state && !visible.length && (
            <p className="relic-shop-empty" role="status">
              {!offers.length
                ? 'Nenhuma oferta publicada.'
                : query
                  ? 'Nenhuma oferta encontrada para essa busca.'
                  : 'Nenhuma oferta nesta prateleira.'}
            </p>
          )}
          {visible.map((offer) => (
            <article key={offer.id} className="shop-product">
              <div className="shop-product-art">
                {offer.image_path && <img src={offer.image_path} alt="" loading="lazy" />}
              </div>
              <div>
                <small>{specialOfferCategoryLabels[offer.category]}</small>
                <h3>{offer.name}</h3>
                <p>{offer.description}</p>
                <footer>
                  <strong>
                    {offer.active ? offer.price.toLocaleString('pt-BR') + ' Prestígio' : 'Rascunho'}
                  </strong>
                  {offer.active && (
                    <button type="button" disabled={!canBuy(offer)} onClick={() => onBuy(offer)}>
                      {owned.has(offer.id) ? (
                        'Na coleção'
                      ) : (
                        <>
                          Comprar <Plus size={12} aria-hidden="true" />
                        </>
                      )}
                    </button>
                  )}
                  {state?.can_edit && (
                    <button
                      type="button"
                      aria-label={'Editar oferta ' + offer.name}
                      title="Editar oferta"
                      disabled={busy}
                      onClick={() => onEdit(offer)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  )}
                </footer>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

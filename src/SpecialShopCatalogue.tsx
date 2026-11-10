import { useState, type ReactNode } from 'react';
import { Pencil, Plus, Search, ShoppingBag, Table2 } from 'lucide-react';
import {
  specialOfferCategoryLabels,
  type SpecialCurrency,
  type SpecialOffer,
  type SpecialShopState,
} from '../shared/special-economy';

const relicShelves = [
  ['all', 'Todos'],
  ['profile_border', 'Bordas de perfil'],
  ['weapon_skin', 'Skins de armas'],
  ['mount', 'Montarias'],
  ['pet', 'Mascotes'],
] as const;
const crystalShelves = [
  ['all', 'Todos'],
  ['tower_item', 'Itens de expedição'],
] as const;
const currencyText = {
  prestige: {
    title: 'Relíquias',
    label: 'Prestígio',
    icon: 'reliquias',
    collection: 'Minha coleção',
  },
  crystals: {
    title: 'Cristais',
    label: 'cristais',
    icon: 'cristais',
    collection: 'Itens do personagem',
  },
} as const;

function searchText(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
}

export function SpecialShopCatalogue({
  currency,
  characterName,
  state,
  status,
  busy,
  canBuy,
  onBuy,
  onEdit,
  onCreate,
  onCollection,
  onPrestige,
}: {
  currency: SpecialCurrency;
  characterName?: string;
  state: SpecialShopState | null;
  status: ReactNode;
  busy: boolean;
  canBuy: (offer: SpecialOffer) => boolean;
  onBuy: (offer: SpecialOffer) => void;
  onEdit: (offer: SpecialOffer) => void;
  onCreate: (category?: SpecialOffer['category']) => void;
  onCollection: () => void;
  onPrestige?: () => void;
}) {
  const [shelf, setShelf] = useState<'all' | SpecialOffer['category']>('all');
  const [search, setSearch] = useState('');
  const crystals = currency === 'crystals';
  const shelves = crystals ? crystalShelves : relicShelves;
  const text = currencyText[currency];
  const icon = `/navigation/illustrated-20261020/${text.icon}.webp`;
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
      className={crystals ? 'crystal-shop-showcase' : 'relic-shop-showcase'}
      aria-label={'Catálogo de ' + text.title}
      data-empty={!visible.length || undefined}
    >
      <nav className="shop-shelves shop-stone" aria-label={'Prateleiras de ' + text.title}>
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
            <span title={'Saldo de ' + text.label}>
              <img src={icon} width={17} height={17} alt="" />
              {state.balance.toLocaleString('pt-BR')} {text.label}
            </span>
          )}
          <button
            type="button"
            className="shop-cart-toggle"
            aria-label={text.collection}
            title={text.collection}
            disabled={!state || (crystals && !characterName)}
            onClick={onCollection}
          >
            <ShoppingBag size={17} aria-hidden="true" />
            <b aria-hidden="true">{state?.purchases.length ?? 0}</b>
          </button>
          {onPrestige && (
            <button
              type="button"
              className="shop-cart-toggle relic-prestige-table-button"
              onClick={onPrestige}
            >
              <Table2 size={16} aria-hidden="true" />
              Tabela de Prestígio
            </button>
          )}
        </div>
        {crystals && (
          <p className="crystal-shop-note">
            {characterName ? (
              <>
                As compras ficam com <strong>{characterName}</strong> para uso em mesas oficiais de
                expedições ativas da Torre.
              </>
            ) : (
              'Selecione um personagem para usar a carteira de cristais da Torre.'
            )}
          </p>
        )}
        {status}
        {state?.can_edit && (
          <button
            type="button"
            className="button outline special-shop-add"
            disabled={busy}
            onClick={() => onCreate(shelf === 'all' ? undefined : shelf)}
          >
            <Plus size={14} aria-hidden="true" /> Cadastrar oferta
          </button>
        )}
        <div className="shop-product-list" tabIndex={0} aria-label={'Ofertas de ' + text.title}>
          {state && !visible.length && (
            <p className="special-shop-empty" role="status">
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
                {(offer.image_path || crystals) && (
                  <img src={offer.image_path || icon} alt="" loading="lazy" />
                )}
              </div>
              <div>
                <small>{specialOfferCategoryLabels[offer.category]}</small>
                <h3>{offer.name}</h3>
                <p>{offer.description}</p>
                <footer>
                  <strong>
                    {offer.active
                      ? offer.price.toLocaleString('pt-BR') + ' ' + text.label
                      : 'Rascunho'}
                  </strong>
                  {offer.active && (
                    <button type="button" disabled={!canBuy(offer)} onClick={() => onBuy(offer)}>
                      {!crystals && owned.has(offer.id) ? (
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

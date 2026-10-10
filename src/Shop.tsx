import { FlashMessage } from './FlashMessage';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { Coins, Search, ShoppingCart, X, Plus, Pencil } from 'lucide-react';
import type { Character, Item } from './types';
import { money } from '../shared/rules';
import { armorBundle, shopWeight } from '../shared/armor-bundles';
import { api, post } from './api';
import { Modal } from './components';
import content from './shop-content.json';
import './shop.css';
import './shop-reference.css';
import './shop-responsive.css';
import './shop-prices.css';
import './shop-variants.css';
import { merchantComment, merchantConversations } from './shop-presentation';
import { useShopCounterSound } from './shop-counter-audio';
import { shopItemScale } from './shop-item-scale';
import { houseCatalog } from '../shared/house';
import { HousePurchase } from './HousePurchase';
import { ShopPriceEditor } from './ShopPriceEditor';
import { ItemInfoButton } from './ItemInfoButton';
import { thematicModelLabel } from './shop-thematic-skins';
import { shopCategory, shopCategoryName, shopOfferCategories } from './shop-category';
import {
  groupShopItems,
  getVariantLabel,
  matchShopGroup,
  type ShopItemGroup,
} from './shop-variants';

type HouseSpec = (typeof houseCatalog)[number];
const asShopHouseItems = (specs: HouseSpec[]): Item[] =>
  specs.map((item) => ({
    id: `house-${item.id}`,
    name: item.name,
    original_name: item.name,
    category: 'Itens de House',
    description: item.description,
    price_cp: item.price_cp,
    image_path: item.image,
    audio_path: item.audio_path,
    merchant_comment: item.speech,
    weight_lb: '0',
    weight_estimated: true,
    source: 'Alvorada Cinzenta',
    source_url: '',
  }));

type Line = { id: string; quantity: number; x: number; y: number; z: number };
type Point = { x: number; y: number };
type OfferChoice = { model: string; variant: string; query: string };
function chosenOffer(group: ShopItemGroup, choice: OfferChoice | undefined, query: string) {
  if (!group.family) return { model: null, item: group.variants[0] };
  const matches = matchShopGroup(group, query);
  const model = group.models.find((candidate) => candidate.id === choice?.model);
  if (
    !model ||
    (choice?.query !== normalize(query) &&
      !matches.some((candidate) => candidate.base_item === model.id))
  )
    return { model: null, item: null };
  const candidates = matches.filter((candidate) => candidate.base_item === model.id);
  const preferred = model.variants.find((candidate) => candidate.id === choice?.variant);
  const item =
    preferred &&
    (choice?.query === normalize(query) ||
      candidates.some((candidate) => candidate.id === preferred.id))
      ? preferred
      : model.variants.length === 1
        ? model.variants[0]
        : query.trim() && candidates.length === 1
          ? candidates[0]
          : null;
  return { model, item };
}
function variantHeading(group: ShopItemGroup) {
  if (group.family === 'Armor of Resistance') return 'Resistência';
  if (group.variants.some((item) => item.damage_type)) return 'Tipo de dano';
  if (group.variants.some((item) => item.enhancement != null)) return 'Bônus mágico';
  if (group.family === 'Dragon Scale Mail') return 'Dragão';
  return 'Variação';
}
function SpeechBubbleShape() {
  const ref = useRef<SVGSVGElement>(null);
  const [shape, setShape] = useState({ width: 200, height: 100, x: 100, y: 140, bottom: true });
  useLayoutEffect(() => {
    const bubble = ref.current?.parentElement;
    const vendor = bubble?.closest('.merchant-vendor')?.querySelector('img');
    if (!bubble || !vendor) return;
    const update = () => {
      const face = vendor.getBoundingClientRect();
      const anchor = bubble.closest('.merchant-vendor')!.getBoundingClientRect();
      const scene = bubble.closest('.shop-scene')!;
      const room = scene.querySelector('.shop-layout')!.getBoundingClientRect();
      const catalog = scene.querySelector('.shop-showcase')!.getBoundingClientRect();
      const stacked = scene.clientWidth <= 1100;
      const leftLimit = stacked ? room.left + 14 : catalog.right + 16;
      // The empty area beside the head can hold the bubble without covering the face.
      const rightLimit = face.left + face.width * 0.54 - (stacked ? 32 : 56);
      const available = rightLimit - leftLimit;
      const side = available >= 160;
      const originalWidth = side
        ? Math.min(320, available)
        : Math.min(380, face.width, room.width - 28);
      const width = side ? Math.max(160, originalWidth * 0.8) : originalWidth;
      bubble.style.width = `${width}px`;
      bubble.style.maxWidth = 'none';
      bubble.style.right = 'auto';
      bubble.style.transform = 'none';
      const height = bubble.offsetHeight;
      const header = document.querySelector('.topbar.player-hud')?.getBoundingClientRect();
      const topLimit = stacked ? catalog.bottom + 12 : (header?.bottom ?? room.top) + 12;
      const left = side
        ? rightLimit - originalWidth
        : Math.min(room.right - width - 14, face.left + (face.width - width) / 2);
      const top = side
        ? Math.max(topLimit, face.top + face.height * 0.18)
        : Math.max(topLimit, face.top - height - 22);
      bubble.style.left = `${left - anchor.left}px`;
      bubble.style.top = `${top - anchor.top}px`;
      bubble.dataset.placement = side ? 'side' : 'above';
      const box = bubble.getBoundingClientRect();
      setShape({
        width: bubble.clientWidth,
        height: bubble.clientHeight,
        x: face.left + face.width * 0.54 - box.left,
        y: face.top + face.height * 0.28 - box.top,
        bottom: !side,
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(bubble);
    observer.observe(vendor);
    window.addEventListener('resize', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);
  const { width: w, height: h, x: targetX, y: targetY, bottom } = shape;
  const x = Math.max(22, Math.min(w - 22, targetX));
  const y = Math.max(22, Math.min(h - 22, targetY));
  const tipX = bottom ? x : w + 10;
  const tipY = bottom ? h + 10 : y;
  const rightEdge = bottom
    ? `V${h - 12}`
    : `V${y - 9} L${tipX} ${tipY} L${w - 0.5} ${y + 9} V${h - 12}`;
  const bottomEdge = bottom ? `H${x + 9} L${tipX} ${tipY} L${x - 9} ${h - 0.5} H12` : 'H12';
  return (
    <svg
      ref={ref}
      className="merchant-speech-shape"
      aria-hidden="true"
      data-tail-side={bottom ? 'bottom' : 'right'}
      width={w + 12}
      height={h + 12}
    >
      <path
        d={`M12 .5 H${w - 12} Q${w - 0.5} .5 ${w - 0.5} 12 ${rightEdge} Q${w - 0.5} ${h - 0.5} ${w - 12} ${h - 0.5} ${bottomEdge} Q.5 ${h - 0.5} .5 ${h - 12} V12 Q.5 .5 12 .5 Z`}
      />
    </svg>
  );
}
const itemScale = (item?: Item) => {
  if (!item) return 1;
  if (/sword|bow|staff|pole|spear|chest|ladder/i.test(item.id)) return 1.22;
  if (item.category === 'Armaduras') return 1.18;
  if (item.category === 'Armas') return 1.12;
  if (/potion|ring|amulet|vial/i.test(item.id)) return 1;
  return 1.06;
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function Shop({
  catalog: ordinaryCatalog,
  character,
  onPurchased,
  canAdmin = false,
}: {
  catalog: Item[];
  character?: Character;
  onPurchased: () => Promise<void>;
  canAdmin?: boolean;
}) {
  const [houseSpecs, setHouseSpecs] = useState<HouseSpec[]>([]);
  const [houseCatalogError, setHouseCatalogError] = useState('');
  const [priceEdit, setPriceEdit] = useState<Item | null>(null);
  const [priceNotice, setPriceNotice] = useState('');
  const houseItems = useMemo(() => asShopHouseItems(houseSpecs), [houseSpecs]);
  const catalog = useMemo(() => [...ordinaryCatalog, ...houseItems], [ordinaryCatalog, houseItems]);
  const offers = useMemo(() => groupShopItems(catalog).map(shopOfferCategories), [catalog]);
  useEffect(() => {
    let active = true;
    api<{ catalog: HouseSpec[] }>('/house')
      .then((result) => {
        if (active) setHouseSpecs(result.catalog);
      })
      .catch(() => {
        if (active) setHouseCatalogError('Não foi possível consultar os preços de House.');
      });
    return () => {
      active = false;
    };
  }, [ordinaryCatalog]);
  useEffect(() => {
    if (!canAdmin) setPriceEdit(null);
  }, [canAdmin]);
  async function reloadHousePrices() {
    setHouseCatalogError('');
    try {
      const result = await api<{ catalog: HouseSpec[] }>('/house');
      setHouseSpecs(result.catalog);
    } catch {
      setHouseCatalogError('Não foi possível consultar os preços de House.');
      throw Error('Não foi possível atualizar os preços exibidos.');
    }
  }
  async function priceSaved(result: { id: string; price_cp: number | null }) {
    if (result.id.startsWith('house-') && result.price_cp !== null) {
      setHouseSpecs((current) =>
        current.map((item) =>
          `house-${item.id}` === result.id ? { ...item, price_cp: result.price_cp! } : item,
        ),
      );
    }
    setExamined((current) =>
      current?.id === result.id ? { ...current, price_cp: result.price_cp } : current,
    );
    try {
      await Promise.all([onPurchased(), reloadHousePrices()]);
      setPriceNotice('Preço salvo.');
    } catch {
      setPriceNotice('Preço salvo. Atualize a página para consultar os preços atuais.');
    }
  }
  const categories = [
    ...new Set([
      'Itens mundanos',
      'Itens de House',
      'Equipamentos de montaria',
      'Acessórios para pet',
      ...content.categories.map(shopCategoryName),
      ...catalog.map(shopCategory),
    ]),
  ];
  const [houseBuy, setHouseBuy] = useState<(typeof houseCatalog)[number] | null>(null);
  const [houseNotice, setHouseNotice] = useState('');
  useEffect(() => {
    setHouseBuy((current) =>
      current ? houseSpecs.find((item) => item.id === current.id) || null : null,
    );
  }, [houseSpecs]);
  useEffect(() => {
    setHouseBuy(null);
    setHouseNotice('');
  }, [character?.id]);
  const [category, setCategory] = useState('Todos'),
    [query, setQuery] = useState('');
  const [offerChoices, setOfferChoices] = useState<Record<string, OfferChoice>>({});
  const [carts, setCarts] = useState<Record<string, Line[]>>({});
  const [selected, setSelected] = useState<string | null>(null),
    [examined, setExamined] = useState<Item | null>(null);
  const [speech, setSpeech] = useState(content.merchant.greeting),
    [speechKey, setSpeechKey] = useState(0);
  const [talk, setTalk] = useState(false),
    [checkout, setCheckout] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [speechVisible, setSpeechVisible] = useState(true);
  useEffect(() => {
    setSpeechVisible(true);
    const timer = window.setTimeout(
      () => setSpeechVisible(false),
      Math.max(8500, speech.length * 65),
    );
    return () => window.clearTimeout(timer);
  }, [speechKey, speech]);
  const vendorRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const placeSound = useShopCounterSound(sceneRef);
  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const alignBackground = () => {
      const counter = scene.querySelector<HTMLElement>('.shop-counter');
      if (!counter) return;
      // The painted counter begins at 63.2% of the source image.
      // Anchor it to the interactive tabletop, regardless of viewport aspect ratio.
      const edge = counter.offsetTop;
      const imageHeight = Math.max(
        (scene.clientWidth * 941) / 1672,
        edge / 0.632,
        (scene.clientHeight - edge) / 0.368,
      );
      scene.style.setProperty('--shop-scene-image-height', `${imageHeight}px`);
      scene.style.setProperty('--shop-scene-image-top', `${edge - imageHeight * 0.632}px`);
    };
    const observer = new ResizeObserver(alignBackground);
    observer.observe(scene);
    alignBackground();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!talk) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!vendorRef.current?.contains(event.target as Node)) setTalk(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [talk]);
  const keys = useRef<Record<string, string>>({});
  const surface = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const layer = useRef(0);
  const [tableSize, setTableSize] = useState({ width: 1, height: 1, base: 50 });
  useLayoutEffect(() => {
    const table = surface.current;
    const ruler = measure.current;
    if (!table || !ruler) return;
    const resize = () => {
      const { width, height } = table.getBoundingClientRect();
      const base = ruler.getBoundingClientRect().width;
      setTableSize((current) =>
        current.width === width && current.height === height && current.base === base
          ? current
          : { width, height, base },
      );
    };
    const observer = new ResizeObserver(resize);
    observer.observe(table);
    observer.observe(ruler);
    resize();
    return () => observer.disconnect();
  }, []);
  const dragging = useRef<{
    id: string;
    x: number;
    y: number;
    offset: Point;
    moved: boolean;
    original: Point;
    current: Point;
  } | null>(null);
  const owner = character?.id || 'guest';
  const lines = carts[owner] || [];
  const items = new Map(catalog.map((i) => [i.id, i]));
  const total = lines.reduce(
    (sum, line) => sum + (items.get(line.id)?.price_cp || 0) * line.quantity,
    0,
  );
  const unpriced = lines.some((line) => items.get(line.id)?.price_cp == null);
  const filtered = offers.filter(
    (offer) =>
      (category === 'Todos' || offer.categories.includes(category)) &&
      matchShopGroup(offer, query).length > 0,
  );
  function say(item: Item) {
    setTalk(false);
    setSpeech(item.category === 'Itens de House' ? item.merchant_comment! : merchantComment(item));
    setSpeechKey((v) => v + 1);
  }
  function chooseModel(offer: ShopItemGroup, model: string) {
    const choice = { model, variant: '', query: normalize(query) };
    setOfferChoices((current) => ({ ...current, [offer.id]: choice }));
    const item = chosenOffer(offer, choice, query).item;
    setExamined(item);
    if (item) say(item);
  }
  function chooseVariant(offer: ShopItemGroup, item: Item) {
    setOfferChoices((current) => ({
      ...current,
      [offer.id]: { model: item.base_item!, variant: item.id, query: normalize(query) },
    }));
    setExamined(item);
    say(item);
  }
  function update(next: Line[], changed = true) {
    setCarts((current) => ({ ...current, [owner]: next }));
    if (changed) keys.current[owner] = crypto.randomUUID();
    setError('');
  }
  function tokenSize(item: Item | undefined, width: number, height: number, base: number) {
    const art = Math.min(base * shopItemScale(item), width, height);
    return { art, size: Math.min(Math.max(48, art), width, height) };
  }
  function dimensions(id: string) {
    const r = surface.current!.getBoundingClientRect();
    const base = measure.current!.getBoundingClientRect().width;
    const { size } = tokenSize(items.get(id), r.width, r.height, base);
    return { r, size, w: Math.max(1, r.width - size), h: Math.max(1, r.height - size) };
  }
  function position(clientX: number, clientY: number, id: string, offset?: Point) {
    const { r, w, h, size } = dimensions(id);
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left - (offset?.x ?? size / 2)) / w)),
      y: Math.max(0, Math.min(1, (clientY - r.top - (offset?.y ?? size / 2)) / h)),
    };
  }
  function select(id: string) {
    const z = ++layer.current;
    setCarts((current) => ({
      ...current,
      [owner]: (current[owner] || []).map((line) => (line.id === id ? { ...line, z } : line)),
    }));
    setSelected(id);
    setError('');
  }
  function locate(id: string) {
    select(id);
    setCheckout(false);
    const item = items.get(id);
    if (item) {
      const offer = offers.find(
        (candidate) => candidate.family && candidate.variants.some((variant) => variant.id === id),
      );
      if (offer) chooseVariant(offer, item);
      setExamined(item);
      say(item);
    }
    requestAnimationFrame(() => {
      const token = [
        ...(surface.current?.querySelectorAll<HTMLElement>('.shop-table-token') || []),
      ].find((element) => element.dataset.itemId === id);
      token?.querySelector('button')?.focus({ preventScroll: true });
      token?.scrollIntoView({
        block: 'nearest',
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    });
  }
  function add(item: Item, preferred?: Point) {
    if (busy) return;
    say(item);
    setExamined(item);
    if (item.category === 'Itens de House') {
      if (!character) {
        setError('Escolha um personagem para comprar.');
        return;
      }
      setHouseBuy(houseSpecs.find((spec) => `house-${spec.id}` === item.id) || null);
      return;
    }
    const existing = lines.find((line) => line.id === item.id);
    if (existing) {
      if (existing.quantity >= 99) {
        setError('Limite de 99 unidades por item.');
        return;
      }
      update(
        lines.map((line) =>
          line.id === item.id
            ? { ...line, quantity: line.quantity + 1, ...preferred, z: ++layer.current }
            : line,
        ),
      );
      setSelected(item.id);
      placeSound(item, shopItemScale(item));
      return;
    }
    const p = preferred || { x: Math.random(), y: Math.random() };
    update([...lines, { id: item.id, quantity: 1, ...p, z: ++layer.current }]);
    setSelected(item.id);
    placeSound(item, shopItemScale(item));
  }
  function remove(id: string) {
    if (busy) return;
    update(lines.filter((line) => line.id !== id));
    setSelected(null);
  }
  function move(event: PointerEvent<HTMLButtonElement>, line: Line) {
    const drag = dragging.current;
    if (!drag || drag.id !== line.id) return;
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4) drag.moved = true;
    if (!drag.moved) return;
    const p = position(event.clientX, event.clientY, line.id, drag.offset);
    drag.current = p;
    update(
      lines.map((v) => (v.id === line.id ? { ...v, ...p } : v)),
      false,
    );
  }
  async function pay() {
    if (!character || busy || !lines.length || unpriced) return;
    setBusy(true);
    setError('');
    const id = character.id;
    const key = (keys.current[id] ||= crypto.randomUUID());
    try {
      await post('/shop/checkout', {
        character_id: id,
        idempotency_key: key,
        items: lines.map((line) => ({ item_id: line.id, quantity: line.quantity })),
      });
      setCarts((current) => ({ ...current, [id]: [] }));
      delete keys.current[id];
      setSelected(null);
      setCheckout(false);
      setSpeech(content.merchant.purchase_thanks);
      setSpeechKey((v) => v + 1);
      try {
        await onPurchased();
      } catch {
        setError('Compra concluída. Atualize a página para consultar seu inventário.');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="shop-scene merchant-shop" ref={sceneRef}>
      <div className="shop-layout">
        <aside
          className="merchant-vendor"
          aria-label="Vendedor da loja"
          ref={vendorRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setTalk(false);
              vendorRef.current?.querySelector('button')?.focus();
            }
          }}
        >
          <button
            className="merchant-vendor-toggle"
            aria-label="Conversar com o mercador"
            aria-expanded={talk}
            aria-controls={talk ? 'merchant-conversation' : undefined}
            onClick={() => {
              setTalk(!talk);
              setSpeechVisible(false);
            }}
          >
            <img
              src="/shop/reference/shop-merchant-v1.png"
              alt="Vendedor de cabelos grisalhos e colete de couro, com os braços apoiados no balcão"
              draggable={false}
            />
          </button>
          {talk ? (
            <div
              id="merchant-conversation"
              className="merchant-speech merchant-conversation npc-speech"
              role="group"
              aria-label="Perguntas ao vendedor"
            >
              <SpeechBubbleShape />
              <strong className="npc-speaker">Desconhecido</strong>
              <span>O que deseja saber?</span>
              {merchantConversations.map((c) => (
                <button
                  key={c.question}
                  onClick={() => {
                    setTalk(false);
                    setSpeech(c.answer);
                    setSpeechKey((v) => v + 1);
                    vendorRef.current?.querySelector('button')?.focus();
                  }}
                >
                  {c.question}
                </button>
              ))}
            </div>
          ) : (
            speechVisible && (
              <div
                key={speechKey}
                className="merchant-speech npc-speech"
                role="status"
                aria-label="Comentário do vendedor"
              >
                <SpeechBubbleShape />
                <strong className="npc-speaker">Desconhecido</strong>
                <span>{speech}</span>
              </div>
            )
          )}
        </aside>
        <section className="shop-showcase" aria-label="Catálogo da loja">
          <nav className="shop-shelves shop-stone" aria-label="Categorias da loja">
            <h2>Prateleiras</h2>
            {['Todos', ...categories].map((name) => (
              <button
                key={name}
                className={category === name ? 'active' : ''}
                aria-pressed={category === name}
                onClick={() => setCategory(name)}
              >
                {name}
                <span>
                  {name === 'Todos'
                    ? offers.length
                    : offers.filter((offer) => offer.categories.includes(name)).length}
                </span>
              </button>
            ))}
          </nav>
          <div className="shop-catalog shop-stone">
            <div className="shop-search-row">
              <label>
                <Search size={16} />
                <input
                  aria-label="Procurar item"
                  placeholder="Procure um item…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <span>
                <Coins size={15} />
                {character?.gold_unlimited ? '∞' : money(character?.gold_cp || 0)} PO
              </span>
              <button
                className="shop-cart-toggle"
                onClick={() => {
                  setError('');
                  setCheckout(true);
                }}
                aria-label={`Abrir carrinho: ${lines.length} itens`}
              >
                <ShoppingCart size={18} />
                <b>{lines.reduce((s, l) => s + l.quantity, 0)}</b>
              </button>
            </div>
            <div className="shop-product-list" tabIndex={0} aria-label="Itens da loja">
              {houseCatalogError && (
                <p className="shop-catalog-note" role="status">
                  {houseCatalogError}{' '}
                  <button type="button" onClick={() => void reloadHousePrices().catch(() => {})}>
                    Tentar novamente
                  </button>
                </p>
              )}
              {filtered.map((offer) => {
                const { model, item: chosen } = chosenOffer(offer, offerChoices[offer.id], query);
                const item = chosen || offer.variants[0];
                const grouped = !!offer.family;
                const familyTitle = offer.name.toLocaleUpperCase('pt-BR');
                const title = grouped
                  ? `${familyTitle}${!model ? ` (ESCOLHER TIPO DA ${offer.kind === 'armor' ? 'ARMADURA' : 'ARMA'})` : ''}`
                  : item.name;
                const modelHeading = offer.kind === 'armor' ? 'Tipo de armadura' : 'Tipo de arma';
                const variantTitle = variantHeading(offer);
                const armorSet = chosen && armorBundle(chosen.id);
                return (
                  <article
                    key={offer.id}
                    data-offer-id={offer.id}
                    data-item-id={chosen?.id || ''}
                    data-family={offer.family || undefined}
                    className={`shop-product${grouped ? ' shop-product-family' : ''}${chosen && examined?.id === chosen.id ? ' is-examined' : ''}`}
                    style={{ '--item-scale': itemScale(item) } as CSSProperties}
                  >
                    <button
                      className="shop-product-art"
                      aria-label={`Examinar ${chosen?.name || title}`}
                      disabled={grouped && !chosen}
                      draggable={!busy && !!chosen}
                      onDragStart={(event) => {
                        if (!chosen) return event.preventDefault();
                        event.dataTransfer.setData('application/x-alvorada-shop', chosen.id);
                        event.dataTransfer.effectAllowed = 'copy';
                        say(chosen);
                      }}
                      onClick={() => {
                        if (!chosen) return;
                        setExamined(chosen);
                        say(chosen);
                      }}
                    >
                      {grouped ? (
                        <span className="shop-family-display">
                          <img
                            className="shop-family-box"
                            src={`/shop/magic-${offer.kind}-box.webp`}
                            alt=""
                            draggable={false}
                            loading="lazy"
                          />
                          <img
                            className="shop-family-object"
                            src={
                              (chosen || model?.variants[0] || offer.variants[0]).image_path || ''
                            }
                            alt={`Prévia de ${(chosen || model?.variants[0] || offer.variants[0]).name}, apoiado na caixa`}
                            draggable={false}
                            loading="lazy"
                          />
                        </span>
                      ) : (
                        <img
                          src={item.image_path || ''}
                          alt={item.name}
                          draggable={false}
                          loading="lazy"
                        />
                      )}
                    </button>
                    <div>
                      <small>{chosen ? shopCategory(item) : offer.categories.join(' · ')}</small>
                      <h3>{title}</h3>
                      {grouped && (
                        <div className="shop-variant-selectors">
                          <label>
                            {modelHeading}
                            <select
                              aria-label={`${modelHeading} de ${familyTitle}`}
                              value={model?.id || ''}
                              disabled={busy}
                              onChange={(event) => chooseModel(offer, event.target.value)}
                            >
                              <option value="" disabled>
                                {offer.kind === 'armor'
                                  ? 'ESCOLHER TIPO DA ARMADURA'
                                  : 'ESCOLHER TIPO DA ARMA'}
                              </option>
                              {offer.models.map((choice) => (
                                <option key={choice.id} value={choice.id}>
                                  {offer.kind === 'weapon'
                                    ? thematicModelLabel(choice)
                                    : choice.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {offer.models.some((choice) => choice.variants.length > 1) && (
                            <label>
                              {variantTitle}
                              <select
                                aria-label={`${variantTitle} de ${familyTitle}`}
                                value={chosen?.id || ''}
                                disabled={busy || !model}
                                onChange={(event) => {
                                  const variant = offer.variants.find(
                                    (choice) => choice.id === event.target.value,
                                  );
                                  if (variant) chooseVariant(offer, variant);
                                }}
                              >
                                <option value="" disabled>
                                  Escolher {variantTitle.toLocaleLowerCase('pt-BR')}
                                </option>
                                {(model?.variants || []).map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {getVariantLabel(variant, model?.label)}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      )}
                      <p>
                        {chosen
                          ? item.description
                          : `Escolha o tipo ${offer.kind === 'armor' ? 'da armadura' : 'da arma'} para consultar seus detalhes e preço.`}
                      </p>
                      {armorSet && (
                        <span className="shop-weight">
                          Conjunto completo com {armorSet.pieces.length} peças
                        </span>
                      )}
                      {chosen && item.category !== 'Itens de House' && (
                        <span className="shop-weight">
                          {armorSet
                            ? 'Peso do conjunto'
                            : item.weight_estimated
                              ? 'Peso estimado'
                              : 'Peso'}
                          : {shopWeight(item).toLocaleString('pt-BR')} lb
                        </span>
                      )}
                      <footer>
                        <span className="shop-price">
                          <strong>
                            {!chosen
                              ? 'Escolha o tipo'
                              : item.price_cp === null
                                ? 'Preço a definir'
                                : `${money(item.price_cp)} PO`}
                          </strong>
                          {canAdmin && chosen && (
                            <button
                              type="button"
                              className="shop-price-edit"
                              aria-label={`Editar preço de ${item.name}`}
                              title="Editar preço"
                              disabled={busy}
                              onClick={() => {
                                setPriceNotice('');
                                setPriceEdit(chosen);
                              }}
                            >
                              <Pencil size={13} aria-hidden="true" />
                            </button>
                          )}
                        </span>
                        <div className="item-purchase-actions">
                          <button disabled={busy || !chosen} onClick={() => chosen && add(chosen)}>
                            {item.price_cp === null ? 'Examinar na mesa' : 'Comprar'}{' '}
                            <Plus size={13} />
                          </button>
                          <ItemInfoButton item={chosen} familyName={familyTitle} />
                        </div>
                      </footer>
                    </div>
                  </article>
                );
              })}
              {!filtered.length && <p className="shop-no-results">Nenhum item encontrado.</p>}
            </div>
          </div>
        </section>
      </div>
      {houseNotice && (
        <p className="shop-house-notice" role="status">
          {houseNotice}
        </p>
      )}
      {houseBuy && character && (
        <HousePurchase
          key={`${character.id}-${houseBuy.id}`}
          item={houseBuy}
          characterId={character.id}
          goldUnlimited={character.gold_unlimited}
          close={() => setHouseBuy(null)}
          purchased={async () => {
            placeSound(houseItems.find((i) => i.id === `house-${houseBuy.id}`)!);
            setHouseNotice('Compra guardada na coleção de House.');
            await onPurchased();
          }}
        />
      )}
      {canAdmin && priceEdit && (
        <ShopPriceEditor
          key={priceEdit.id}
          item={priceEdit}
          close={() => setPriceEdit(null)}
          saved={priceSaved}
        />
      )}
      {priceNotice && <FlashMessage kind="info">{priceNotice}</FlashMessage>}
      <section className="shop-counter merchant-countertop" aria-label="Balcão de compras">
        <div
          className="shop-table-surface"
          ref={surface}
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes('application/x-alvorada-shop')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            const item = items.get(e.dataTransfer.getData('application/x-alvorada-shop'));
            if (item) add(item, position(e.clientX, e.clientY, item.id));
          }}
        >
          <div className="shop-table-measure" ref={measure} aria-hidden="true" />
          {lines.map((line) => {
            const item = items.get(line.id);
            if (!item) return null;
            const { art, size } = tokenSize(
              item,
              tableSize.width,
              tableSize.height,
              tableSize.base,
            );
            return (
              <div
                className={`shop-table-token${selected === line.id ? ' selected' : ''}`}
                key={line.id}
                data-item-id={line.id}
                data-scale={shopItemScale(item)}
                data-x={line.x}
                data-y={line.y}
                style={
                  {
                    '--shop-token-size': `${size}px`,
                    '--shop-art-size': `${art}px`,
                    left: `calc(${line.x * 100}% - ${line.x} * var(--shop-token-size))`,
                    top: `calc(${line.y * 100}% - ${line.y} * var(--shop-token-size))`,
                    zIndex: line.z,
                  } as CSSProperties
                }
              >
                <button
                  aria-label={`${item.name} na mesa, ${line.quantity} unidades`}
                  disabled={busy}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    const box = e.currentTarget.parentElement!.getBoundingClientRect();
                    dragging.current = {
                      id: line.id,
                      x: e.clientX,
                      y: e.clientY,
                      offset: { x: e.clientX - box.left, y: e.clientY - box.top },
                      moved: false,
                      original: line,
                      current: line,
                    };
                    select(line.id);
                    say(item);
                  }}
                  onPointerMove={(e) => move(e, line)}
                  onPointerUp={() => {
                    const drag = dragging.current;
                    if (
                      drag?.id === line.id &&
                      drag.moved &&
                      Math.hypot(
                        drag.current.x - drag.original.x,
                        drag.current.y - drag.original.y,
                      ) > 0.001
                    )
                      placeSound(item, shopItemScale(item));
                    dragging.current = null;
                  }}
                  onPointerCancel={() => {
                    dragging.current = null;
                  }}
                  onClick={() => {
                    select(line.id);
                    setExamined(item);
                    say(item);
                  }}
                  onFocus={() => select(line.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Delete') {
                      remove(line.id);
                      return;
                    }
                    const delta: Record<string, Point> = {
                      ArrowLeft: { x: -0.025, y: 0 },
                      ArrowRight: { x: 0.025, y: 0 },
                      ArrowUp: { x: 0, y: -0.08 },
                      ArrowDown: { x: 0, y: 0.08 },
                    };
                    if (delta[e.key]) {
                      e.preventDefault();
                      const p = {
                        x: Math.max(0, Math.min(1, line.x + delta[e.key].x)),
                        y: Math.max(0, Math.min(1, line.y + delta[e.key].y)),
                      };
                      update(
                        lines.map((l) => (l.id === line.id ? { ...l, ...p } : l)),
                        false,
                      );
                    }
                  }}
                >
                  <img src={item.image_path || ''} alt="" draggable={false} />
                  <span>×{line.quantity}</span>
                </button>
                {selected === line.id && (
                  <button
                    className="shop-remove-token"
                    aria-label={`Remover ${item.name} da mesa`}
                    onClick={() => remove(line.id)}
                    disabled={busy}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
      {error && !checkout && <FlashMessage kind="info">{error}</FlashMessage>}
      {checkout && (
        <Modal
          title="Seu carrinho"
          close={() => {
            if (!busy) setCheckout(false);
          }}
        >
          <div className="shop-checkout">
            <p>
              Entrega na mochila de{' '}
              <strong>{character?.name || 'nenhum personagem selecionado'}</strong>.
            </p>
            {lines.length === 0 && <p>Seu balcão está vazio.</p>}
            {lines.map((line) => {
              const item = items.get(line.id)!;
              return (
                <div className="shop-checkout-line" key={line.id}>
                  <img src={item.image_path || ''} alt="" />
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {shopCategory(item)} ·{' '}
                      {item.price_cp === null
                        ? 'Preço a definir'
                        : `${money(item.price_cp)} PO / unidade`}
                    </small>
                    <ItemInfoButton item={item} />
                    <button
                      className="shop-checkout-locate"
                      disabled={busy}
                      aria-label={`Localizar ${item.name} no balcão`}
                      onClick={() => locate(line.id)}
                    >
                      Localizar no balcão
                    </button>
                    <label>
                      Quantidade
                      <input
                        type="number"
                        aria-label={`Quantidade de ${item.name}`}
                        min={1}
                        max={99}
                        value={line.quantity}
                        disabled={busy}
                        onChange={(e) => {
                          const q = Number(e.target.value);
                          if (Number.isInteger(q) && q >= 1 && q <= 99)
                            update(
                              lines.map((l) => (l.id === line.id ? { ...l, quantity: q } : l)),
                            );
                        }}
                      />
                    </label>
                  </div>
                  <button
                    className="shop-checkout-remove"
                    disabled={busy}
                    aria-label={`Remover ${item.name} do carrinho`}
                    onClick={() => remove(line.id)}
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
            <div className="shop-checkout-total">
              <span>
                Saldo: {character?.gold_unlimited ? '∞' : money(character?.gold_cp || 0)} PO
              </span>
              <strong>Total: {money(total)} PO</strong>
            </div>
            {unpriced && (
              <p role="status">
                Há itens sem preço definido no carrinho. Retire-os para finalizar a compra.
              </p>
            )}
            {character && !character.gold_unlimited && total > character.gold_cp && (
              <FlashMessage>Saldo insuficiente para este carrinho.</FlashMessage>
            )}
            {error && <FlashMessage>{error}</FlashMessage>}
            <button
              className="button primary full"
              disabled={
                busy ||
                !character ||
                !lines.length ||
                unpriced ||
                (!character.gold_unlimited && total > character.gold_cp)
              }
              onClick={() => void pay()}
            >
              {busy ? 'Finalizando…' : `Finalizar compra · ${money(total)} PO`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

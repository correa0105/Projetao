import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Coins, Search, ShoppingCart, X, Plus } from 'lucide-react';
import type { Character, Item } from './types';
import { money } from '../shared/rules';
import { post } from './api';
import { Modal } from './components';
import content from './shop-content.json';
import './shop.css';

type Line = { id: string; quantity: number; x: number; y: number };
type Point = { x: number; y: number };
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
  catalog,
  character,
  onPurchased,
}: {
  catalog: Item[];
  character?: Character;
  onPurchased: () => Promise<void>;
}) {
  const [category, setCategory] = useState('Todos'),
    [query, setQuery] = useState('');
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
    const timer = window.setTimeout(() => setSpeechVisible(false), 15000);
    return () => window.clearTimeout(timer);
  }, [speechKey]);
  const keys = useRef<Record<string, string>>({});
  const surface = useRef<HTMLDivElement>(null);
  const dragging = useRef<{
    id: string;
    x: number;
    y: number;
    moved: boolean;
    original: Point;
  } | null>(null);
  const owner = character?.id || 'guest';
  const lines = carts[owner] || [];
  const items = new Map(catalog.map((i) => [i.id, i]));
  const total = lines.reduce(
    (sum, line) => sum + (items.get(line.id)?.price_cp || 0) * line.quantity,
    0,
  );
  const unpriced = lines.some((line) => items.get(line.id)?.price_cp == null);
  const filtered = catalog.filter(
    (i) =>
      (category === 'Todos' || category === i.category) &&
      normalize(i.name + ' ' + i.original_name).includes(normalize(query)),
  );
  function say(item: Item) {
    setTalk(false);
    setSpeech(item.merchant_comment || item.description);
    setSpeechKey((v) => v + 1);
  }
  function update(next: Line[], changed = true) {
    setCarts((current) => ({ ...current, [owner]: next }));
    if (changed) keys.current[owner] = crypto.randomUUID();
    setError('');
  }
  function dimensions(id?: string) {
    const r = surface.current!.getBoundingClientRect();
    const size = (window.innerWidth <= 700 ? 82.8 : 110.4) * itemScale(items.get(id || ''));
    return { r, size, w: Math.max(1, r.width - size), h: Math.max(1, r.height - size) };
  }
  function isFree(p: Point, id: string) {
    const { w, h, size, r } = dimensions(id);
    return lines.every((line) => {
      if (line.id === id) return true;
      const other = dimensions(line.id).size;
      const x = p.x * w,
        y = p.y * h;
      const ox = line.x * (r.width - other),
        oy = line.y * (r.height - other);
      return x + size + 6 <= ox || ox + other + 6 <= x || y + size + 6 <= oy || oy + other + 6 <= y;
    });
  }
  function position(clientX: number, clientY: number, id: string) {
    const { r, w, h, size } = dimensions(id);
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left - size / 2) / w)),
      y: Math.max(0, Math.min(1, (clientY - r.top - size / 2) / h)),
    };
  }
  function freePosition(id: string, preferred?: Point): Point | null {
    if (preferred && isFree(preferred, id)) return preferred;
    for (let n = 0; n < 150; n++) {
      const p = { x: Math.random(), y: Math.random() };
      if (isFree(p, id)) return p;
    }
    const { w, h, size } = dimensions(id);
    for (let y = 0; y <= h; y += size + 7)
      for (let x = 0; x <= w; x += size + 7) {
        const p = { x: x / w, y: y / h };
        if (isFree(p, id)) return p;
      }
    return null;
  }
  function add(item: Item, preferred?: Point) {
    if (busy) return;
    say(item);
    setExamined(item);
    const existing = lines.find((line) => line.id === item.id);
    if (existing) {
      if (existing.quantity >= 99) {
        setError('Limite de 99 unidades por item.');
        return;
      }
      update(
        lines.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        ),
      );
      setSelected(item.id);
      return;
    }
    const p = freePosition(item.id, preferred);
    if (!p) {
      setError('A mesa está cheia. Retire um item ou finalize o carrinho.');
      return;
    }
    update([...lines, { id: item.id, quantity: 1, ...p }]);
    setSelected(item.id);
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
    const p = position(event.clientX, event.clientY, line.id);
    if (isFree(p, line.id))
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
    <div className="shop-scene">
      <div className="shop-room" aria-hidden="true" />
      <aside className="shop-merchant" aria-label="Vendedor da loja">
        <button
          className="shop-merchant-trigger"
          aria-label="Conversar com o mercador"
          aria-expanded={talk}
          aria-controls="shop-merchant-conversations"
          onClick={() => setTalk(!talk)}
        >
          <img
            className="shop-merchant-art"
            src="/shop/merchant-v2.png"
            alt="Mercador de expressão séria, com os antebraços apoiados no balcão"
          />
        </button>
        <div
          className={`shop-speech${talk ? ' conversation-open' : ' timed-speech'}`}
          key={speechKey}
          hidden={!speechVisible && !talk}
        >
          <svg
            className="shop-speech-shape"
            viewBox="0 0 200 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M28 1H187Q199 1 199 13V87Q199 99 187 99H28Q16 99 16 87V84L1 94L16 66V13Q16 1 28 1Z"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {speechVisible && !talk && <p aria-live="polite">{speech}</p>}
          {talk && (
            <div className="shop-conversations" id="shop-merchant-conversations">
              {content.merchant.conversations.map((c) => (
                <button
                  key={c.question}
                  onClick={() => {
                    setSpeech(c.answer);
                    setSpeechKey((v) => v + 1);
                    setTalk(false);
                  }}
                >
                  {c.question}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
      <section className="shop-showcase" aria-label="Catálogo da loja">
        <nav className="shop-shelves shop-stone" aria-label="Categorias da loja">
          <h2>Prateleiras</h2>
          {['Todos', ...content.categories].map((name) => (
            <button
              key={name}
              className={category === name ? 'active' : ''}
              aria-pressed={category === name}
              onClick={() => setCategory(name)}
            >
              {name}
              <span>
                {name === 'Todos'
                  ? catalog.length
                  : catalog.filter((i) => i.category === name).length}
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
              {money(character?.gold_cp || 0)} PO
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
            {filtered.map((item) => (
              <article
                key={item.id}
                className={`shop-product${examined?.id === item.id ? ' is-examined' : ''}`}
                style={{ '--item-scale': itemScale(item) } as CSSProperties}
              >
                <button
                  className="shop-product-art"
                  aria-label={`Examinar ${item.name}`}
                  draggable={!busy}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-alvorada-shop', item.id);
                    event.dataTransfer.effectAllowed = 'copy';
                    say(item);
                  }}
                  onClick={() => {
                    setExamined(item);
                    say(item);
                  }}
                >
                  <img
                    src={item.image_path || ''}
                    alt={item.name}
                    draggable={false}
                    loading="lazy"
                  />
                </button>
                <div>
                  <small>{item.category}</small>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                  <span className="shop-weight">
                    {item.weight_estimated ? 'Peso estimado' : 'Peso'}:{' '}
                    {Number(item.weight_lb).toLocaleString('pt-BR')} lb
                  </span>
                  <footer>
                    <strong>
                      {item.price_cp === null ? 'Preço a definir' : `${money(item.price_cp)} PO`}
                    </strong>
                    <button disabled={busy} onClick={() => add(item)}>
                      {item.price_cp === null ? 'Examinar na mesa' : 'Comprar'} <Plus size={13} />
                    </button>
                  </footer>
                </div>
              </article>
            ))}
            {!filtered.length && <p className="shop-no-results">Nenhum item encontrado.</p>}
          </div>
        </div>
      </section>
      <section className="shop-counter" aria-label="Balcão de compras">
        <img src="/shop/counter.png" className="shop-counter-art" alt="" draggable={false} />
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
          {lines.map((line) => {
            const item = items.get(line.id);
            if (!item) return null;
            return (
              <div
                className={`shop-table-token${selected === line.id ? ' selected' : ''}`}
                key={line.id}
                style={
                  {
                    '--shop-token-size': `calc(var(--shop-base-size) * ${itemScale(item)})`,
                    left: `calc(${line.x * 100}% - ${line.x} * var(--shop-token-size))`,
                    top: `calc(${line.y * 100}% - ${line.y} * var(--shop-token-size))`,
                  } as CSSProperties
                }
              >
                <button
                  aria-label={`${item.name} na mesa, ${line.quantity} unidades`}
                  disabled={busy}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragging.current = {
                      id: line.id,
                      x: e.clientX,
                      y: e.clientY,
                      moved: false,
                      original: line,
                    };
                    setSelected(line.id);
                    say(item);
                  }}
                  onPointerMove={(e) => move(e, line)}
                  onPointerUp={() => {
                    dragging.current = null;
                  }}
                  onPointerCancel={() => {
                    dragging.current = null;
                  }}
                  onClick={() => {
                    setSelected(line.id);
                    setExamined(item);
                    say(item);
                  }}
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
                      if (isFree(p, line.id))
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
          {!lines.length && (
            <p className="shop-table-hint">Escolha seus itens e coloque-os sobre o balcão.</p>
          )}
        </div>
      </section>
      {error && !checkout && (
        <p className="shop-feedback" role="status">
          {error}
        </p>
      )}
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
                      {item.price_cp === null
                        ? 'Preço a definir'
                        : `${money(item.price_cp)} PO / unidade`}
                    </small>
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
              <span>Saldo: {money(character?.gold_cp || 0)} PO</span>
              <strong>Total: {money(total)} PO</strong>
            </div>
            {unpriced && (
              <p role="status">
                O Orbe do Dragão está sem preço definido. Retire-o para finalizar a compra.
              </p>
            )}
            {character && total > character.gold_cp && (
              <p role="status">Saldo insuficiente para este carrinho.</p>
            )}
            {error && <p role="alert">{error}</p>}
            <button
              className="button primary full"
              disabled={
                busy || !character || !lines.length || unpriced || total > (character?.gold_cp || 0)
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

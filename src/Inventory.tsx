import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import { Sword, Shield, Package, ArrowUpRight, ArrowDownUp, Archive } from 'lucide-react';
import type { Character, Details, Item, StorageState } from './types';
import {
  compatibleSlots,
  EQUIPMENT_LABELS,
  equipmentBlockMessage,
  type EquipmentSlot,
} from '../shared/equipment';
import { INVENTORY_DRAG_TYPE as dragType } from './inventory-drag';
import { EquipmentPanel } from './EquipmentPanel';
import { money } from '../shared/rules';
import { SheetHelp } from './SheetHelp';
import { Modal } from './components';
import { api, post } from './api';
import './inventory.css';

const number = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
const itemIcon = (item: Item) =>
  item.category === 'Armas' ? Sword : item.category === 'Armaduras' ? Shield : Package;
type Place = 'backpack' | 'vault';
type Storage = StorageState;
type Transfer = { item: Item; from: Place; quantity: number; key: string };
function availableInventory(storage: Storage) {
  return storage.inventory
    .map((item) => ({
      ...item,
      quantity:
        (item.quantity || 0) -
        storage.equipped.filter((equipped) => equipped.id === item.id).length,
    }))
    .filter((item) => item.quantity > 0);
}

function InventorySlot({
  item,
  place,
  busy,
  onDrag,
  onTransfer,
}: {
  item: Item;
  place: Place;
  busy: boolean;
  onDrag: (value: { id: string; from: Place } | null) => void;
  onTransfer: (id: string, from: Place) => void;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const balloon = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const changingPopover = useRef(false);
  const Icon = itemIcon(item);
  function cancelHide() {
    clearTimeout(timer.current);
  }
  function hide() {
    cancelHide();
    if (changingPopover.current) return;
    changingPopover.current = true;
    try {
      balloon.current?.hidePopover();
    } finally {
      changingPopover.current = false;
    }
  }
  function show() {
    cancelHide();
    const node = balloon.current,
      button = trigger.current;
    if (!node || !button || busy || changingPopover.current) return;
    changingPopover.current = true;
    try {
      if (!node.matches(':popover-open')) node.showPopover();
    } finally {
      changingPopover.current = false;
    }
    const rect = button.getBoundingClientRect();
    node.style.left =
      Math.max(12, Math.min(rect.left, window.innerWidth - node.offsetWidth - 12)) + 'px';
    node.style.top =
      (rect.bottom + 8 + node.offsetHeight <= window.innerHeight - 12
        ? rect.bottom + 8
        : Math.max(12, rect.top - node.offsetHeight - 8)) + 'px';
  }
  function scheduleHide() {
    cancelHide();
    timer.current = setTimeout(() => {
      if (!balloon.current?.contains(document.activeElement)) hide();
    }, 180);
  }
  useEffect(() => {
    const scroll = (event: Event) => {
      // Keep the details open when scrolling their contents to reach the transfer button.
      if (event.target instanceof Node && balloon.current?.contains(event.target)) return;
      hide();
    };
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', hide);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', hide);
    };
  }, []);
  return (
    <div
      className="loot-slot-wrap"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) hide();
      }}
    >
      <button
        ref={trigger}
        className="loot-slot"
        aria-label={item.name + ', quantidade ' + (item.quantity ?? 0)}
        aria-controls={id}
        aria-haspopup="dialog"
        draggable={!busy}
        disabled={busy}
        onFocus={show}
        onClick={show}
        onDragStart={(event) => {
          hide();
          event.dataTransfer.setData(dragType, item.id);
          event.dataTransfer.effectAllowed = 'move';
          onDrag({ id: item.id, from: place });
        }}
        onDragEnd={() => onDrag(null)}
      >
        {item.image_path ? (
          <img className="loot-item-art" src={item.image_path} alt="" />
        ) : (
          <Icon size={23} aria-hidden="true" />
        )}
        <span className="loot-slot-name">{item.name}</span>
        <span className="loot-quantity">{item.quantity ?? 0}</span>
      </button>
      <div
        ref={balloon}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={'Detalhes de ' + item.name}
        className="loot-item-detail loot-item-balloon"
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
      >
        <span className="loot-category">{item.category}</span>
        <h3>{item.name}</h3>
        <p className="loot-original">{item.original_name}</p>
        <p>{item.description}</p>
        <dl>
          <div>
            <dt>Quantidade</dt>
            <dd>{item.quantity ?? 0}</dd>
          </div>
          <div>
            <dt>Peso total</dt>
            <dd>{number(Number(item.weight_lb) * (item.quantity ?? 0))} lb</dd>
          </div>
          <div>
            <dt>Valor unitário</dt>
            <dd>{item.price_cp === null ? 'Preço a definir' : money(item.price_cp) + ' PO'}</dd>
          </div>
        </dl>
        <button
          className="button outline loot-transfer-button"
          disabled={busy}
          onClick={() => {
            hide();
            onTransfer(item.id, place);
          }}
        >
          <ArrowDownUp size={15} />
          {place === 'vault' ? 'Levar para a mochila' : 'Guardar no cofre'}
        </button>
      </div>
    </div>
  );
}

function StoragePanel({
  place,
  items,
  busy,
  dragged,
  onDrag,
  onTransfer,
  onShop,
}: {
  place: Place;
  items: Item[];
  busy: boolean;
  dragged: { id: string; from: Place } | null;
  onDrag: (value: { id: string; from: Place } | null) => void;
  onTransfer: (id: string, from: Place) => void;
  onShop?: () => void;
}) {
  const [over, setOver] = useState(false);
  const isVault = place === 'vault';
  const name = isVault ? 'Cofre' : 'Mochila';
  const canDrop = !busy && dragged && dragged.from !== place;
  function drop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (canDrop && event.dataTransfer.types.includes(dragType))
      onTransfer(dragged.id, dragged.from);
    onDrag(null);
  }
  return (
    <section
      className={`loot-storage ${isVault ? 'loot-vault' : ''} ${over && canDrop ? 'is-drop-target' : ''}`}
      aria-label={isVault ? 'Itens do cofre' : 'Itens da mochila'}
      aria-busy={busy}
      onDragOver={(event) => {
        if (canDrop) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          setOver(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={drop}
    >
      <header className="loot-storage-heading">
        <div>
          <h2>
            {isVault && <Archive size={22} />} {name}
            <SheetHelp label={name}>
              {isVault
                ? 'Compartilhado somente entre os personagens da sua conta. Estes itens ficam guardados e não fazem parte da mochila levada à missão.'
                : 'Exclusiva deste personagem. Estes são os itens levados à missão. O peso considera todas as unidades em libras; equipamentos iniciais registrados na ficha permanecem em História e equipamento.'}{' '}
              Arraste um item para o outro inventário ou use o botão de transferência. Para pilhas,
              escolha a quantidade. Espaços vazios não limitam a capacidade.
            </SheetHelp>
          </h2>
          <p className="loot-storage-caption">
            {isVault
              ? 'Compartilhado entre seus personagens'
              : 'Pertences do personagem selecionado'}
          </p>
        </div>
        {onShop ? (
          <button className="text-button" onClick={onShop}>
            Visitar empório <ArrowUpRight size={15} />
          </button>
        ) : (
          <span className="loot-vault-count">
            {number(items.reduce((sum, item) => sum + (item.quantity ?? 0), 0))} itens guardados
          </span>
        )}
      </header>
      <div className="loot-slots" aria-label={isVault ? 'Espaços do cofre' : 'Espaços da mochila'}>
        {items.map((item) => (
          <InventorySlot
            key={item.id}
            item={item}
            place={place}
            busy={busy}
            onDrag={onDrag}
            onTransfer={onTransfer}
          />
        ))}
        {Array.from(
          {
            length:
              (isVault
                ? Math.max(36, Math.ceil(items.length / 12) * 12)
                : Math.max(34, Math.ceil(items.length / 7) * 7)) - items.length,
          },
          (_, i) => (
            <div key={i} className="loot-slot loot-slot-empty" aria-hidden="true">
              <span>＋</span>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

export function Inventory({
  character,
  details,
  onShop,
  onInventoryChange,
}: {
  character: Character;
  details: Details;
  onShop: () => void;
  onInventoryChange: (items: Item[]) => void;
}) {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [dragged, setDragged] = useState<{ id: string; from: Place } | null>(null);
  const mounted = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    void api<Storage>(`/characters/${character.id}/storage`)
      .then((value) => {
        if (mounted.current) setStorage(value);
      })
      .catch((e) => {
        if (mounted.current) setError(e.message);
      });
    return () => {
      mounted.current = false;
    };
  }, [character.id]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function reload() {
    setError('');
    try {
      const value = await api<Storage>(`/characters/${character.id}/storage`);
      if (mounted.current) {
        setStorage(value);
        onInventoryChange(value.inventory);
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    }
  }
  function requestTransfer(id: string, from: Place) {
    if (!storage || inFlight.current) return;
    const item = (from === 'backpack' ? availableInventory(storage) : storage.vault).find(
      (item) => item.id === id,
    );
    if (item) {
      setError('');
      setTransfer({ item, from, quantity: item.quantity ?? 1, key: crypto.randomUUID() });
    }
  }
  function dropEquipment(slot: EquipmentSlot, id: string, from: Place) {
    setDragged(null);
    if (!storage || inFlight.current) return;
    if (from !== 'backpack') {
      setNotice('Leve o item do cofre para a mochila antes de equipá-lo.');
      return;
    }
    const item = availableInventory(storage).find((item) => item.id === id);
    if (!item) {
      setNotice('Este item não está disponível na mochila.');
      return;
    }
    if (!compatibleSlots(item).includes(slot)) {
      setNotice(`O item ${item.name} não pertence à categoria ${EQUIPMENT_LABELS[slot]}.`);
      return;
    }
    const blocked = equipmentBlockMessage(slot, storage.equipped);
    if (blocked) {
      setNotice(blocked);
      return;
    }
    void equip(slot, id);
  }
  async function equip(slot: EquipmentSlot, itemId: string | null) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await post<Storage>('/inventory/equipment', {
        character_id: character.id,
        slot,
        item_id: itemId,
      });
      if (mounted.current) {
        setStorage(value);
        onInventoryChange(value.inventory);
        setNotice(itemId ? 'Item equipado.' : 'Item desequipado.');
      }
    } catch (error) {
      if (mounted.current) setError((error as Error).message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function submitTransfer() {
    if (!transfer || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const value = await post<Storage>('/inventory/transfers', {
        character_id: character.id,
        item_id: transfer.item.id,
        direction: transfer.from === 'backpack' ? 'to_vault' : 'to_backpack',
        quantity: transfer.quantity,
        idempotency_key: transfer.key,
      });
      if (mounted.current) {
        setStorage(value);
        onInventoryChange(value.inventory);
        setTransfer(null);
        setNotice('Transferência concluída.');
      }
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  if (!storage)
    return (
      <section className="loot-storage">
        <p role={error ? 'alert' : 'status'}>{error || 'Abrindo mochila e cofre…'}</p>
        {error && (
          <button className="button outline" onClick={reload}>
            Tentar novamente
          </button>
        )}
      </section>
    );
  const count = storage.inventory.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const weight = storage.inventory.reduce(
    (sum, item) => sum + Number(item.weight_lb) * (item.quantity ?? 0),
    0,
  );
  return (
    <div className="loot-inventory">
      {notice && (
        <p className="loot-notice" role="status">
          {notice}
        </p>
      )}
      {error && !transfer && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <EquipmentPanel
        character={character}
        storage={storage}
        busy={busy}
        onEquip={equip}
        dragged={dragged}
        onDropItem={dropEquipment}
      />
      <div className="loot-layout">
        <div className="loot-pack-column">
          <section className="loot-summary" aria-label="Resumo da mochila">
            <div>
              <span className="loot-stat-art loot-stat-coins" aria-hidden="true" />
              <span>
                Ouro
                <strong>
                  {money(character.gold_cp)} <small>PO</small>
                </strong>
              </span>
            </div>
            <div>
              <span className="loot-stat-art loot-stat-weight" aria-hidden="true" />
              <span>
                Peso
                <strong>
                  {number(weight)} <small>lb</small>
                </strong>
              </span>
            </div>
            <div>
              <span className="loot-stat-art loot-stat-items" aria-hidden="true" />
              <span>
                Itens
                <strong>
                  {number(count)} <small>{count === 1 ? 'item' : 'itens'}</small>
                </strong>
              </span>
            </div>
          </section>
          <figure className="loot-backpack">
            <img
              src="/inventory-backpack-v1.png"
              alt="Mochila de couro de aventureiro com corda, cantil e cobertor"
            />
            <figcaption>Seus pertences</figcaption>
          </figure>
        </div>
        <StoragePanel
          place="backpack"
          items={availableInventory(storage)}
          busy={busy}
          dragged={dragged}
          onDrag={setDragged}
          onTransfer={requestTransfer}
          onShop={onShop}
        />
      </div>
      <StoragePanel
        place="vault"
        items={storage.vault}
        busy={busy}
        dragged={dragged}
        onDrag={setDragged}
        onTransfer={requestTransfer}
      />
      {details.history.length > 0 && (
        <details className="loot-history">
          <summary>
            Últimas compras <span>{details.history.length}</span>
          </summary>
          <ul>
            {details.history.map((order) => (
              <li key={order.id}>
                <div>
                  <strong>
                    {order.quantity} × {order.name}
                  </strong>
                  <small>{new Date(order.created_at).toLocaleString('pt-BR')}</small>
                </div>
                <span>−{money(order.total_cp)} PO</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {transfer && (
        <Modal
          title={transfer.from === 'backpack' ? 'Guardar no cofre' : 'Levar para a mochila'}
          close={() => {
            if (!busy) {
              setTransfer(null);
              setError('');
            }
          }}
        >
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              void submitTransfer();
            }}
          >
            <p>
              <strong>{transfer.item.name}</strong> · {transfer.item.quantity} disponíveis
            </p>
            <label>
              Quantidade
              <input
                type="number"
                min={1}
                max={transfer.item.quantity}
                step={1}
                required
                disabled={busy}
                value={transfer.quantity}
                onChange={(event) =>
                  setTransfer({
                    ...transfer,
                    quantity: Number(event.target.value),
                    key: crypto.randomUUID(),
                  })
                }
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="sheet-actions">
              <button className="button primary" disabled={busy} type="submit">
                {busy ? 'Transferindo…' : 'Transferir'}
              </button>
              <button
                className="button outline"
                type="button"
                disabled={busy}
                onClick={() => {
                  setTransfer(null);
                  void reload();
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

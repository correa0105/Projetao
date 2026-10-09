import { useState, useRef } from 'react';
import { Modal } from './components';
import { FlashMessage } from './FlashMessage';
import { post } from './api';
import type { Item, StorageState } from './types';

export function InventoryBagTransfer({
  characterId,
  storage,
  humanItems,
  busy,
  onChange,
}: {
  characterId: string;
  storage: StorageState;
  humanItems: Item[];
  busy: boolean;
  onChange: (s: StorageState) => void;
}) {
  const operation = useRef({ signature: '', key: crypto.randomUUID() });
  const [open, setOpen] = useState(false),
    [source, setSource] = useState('character'),
    [destination, setDestination] = useState('vault'),
    [itemId, setItemId] = useState(''),
    [quantity, setQuantity] = useState(1),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const bags = [
    { id: 'character', name: 'Personagem', inventory: humanItems },
    { id: 'vault', name: 'Cofre', inventory: storage.vault },
    ...(storage.companions || []).map((c) => ({
      ...c,
      name: (c.kind === 'mount' ? 'Montaria · ' : 'Mascote · ') + c.name,
      inventory: c.inventory
        .map((i) => ({ ...i, quantity: (i.quantity || 0) - i.equipped_quantity }))
        .filter((i) => i.quantity > 0),
    })),
  ];
  const items = bags.find((b) => b.id === source)?.inventory || [],
    item = items.find((i) => i.id === itemId) || items[0];
  async function submit() {
    if (!item || saving) return;
    setSaving(true);
    setError('');
    const signature = JSON.stringify([characterId, item.id, source, destination, quantity]);
    if (operation.current.signature !== signature)
      operation.current = { signature, key: crypto.randomUUID() };
    try {
      const value = await post<StorageState>('/inventory/bags/transfers', {
        character_id: characterId,
        item_id: item.id,
        source,
        destination,
        quantity,
        idempotency_key: operation.current.key,
      });
      onChange(value);
      operation.current.signature = '';
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        className="button outline"
        disabled={busy}
        onClick={() => {
          setOpen(true);
          setError('');
        }}
      >
        Transferir entre inventários
      </button>
      {open && (
        <Modal
          title="Transferir entre inventários"
          close={() => {
            if (!saving) setOpen(false);
          }}
        >
          <div className="form-grid">
            {error && <FlashMessage>{error}</FlashMessage>}
            <label>
              Inventário de origem
              <select
                disabled={saving}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setItemId('');
                  setQuantity(1);
                  if (e.target.value === destination) setDestination(source);
                }}
              >
                {bags.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Inventário de destino
              <select
                disabled={saving}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {bags
                  .filter((b) => b.id !== source)
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Item
              <select
                disabled={saving || !items.length}
                value={item?.id || ''}
                onChange={(e) => {
                  setItemId(e.target.value);
                  setQuantity(1);
                }}
              >
                {items.length ? (
                  items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} · {i.quantity} livres
                    </option>
                  ))
                ) : (
                  <option value="">Nenhuma unidade livre</option>
                )}
              </select>
            </label>
            <label>
              Quantidade
              <input
                type="number"
                min={1}
                max={item?.quantity || 1}
                value={quantity}
                disabled={saving}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <p>
              Os itens equipados ficam com seu dono. Desequipe uma unidade antes de transferi-la.
            </p>
            <button
              className="button"
              disabled={
                saving ||
                !item ||
                quantity < 1 ||
                quantity > (item.quantity || 0) ||
                source === destination
              }
              onClick={() => void submit()}
            >
              {saving ? 'Transferindo…' : 'Transferir itens'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

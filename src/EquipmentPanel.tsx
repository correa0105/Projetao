import { Shield, Package, Sword } from 'lucide-react';
import { useState } from 'react';
import { INVENTORY_DRAG_TYPE, type InventoryDrag } from './inventory-drag';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_LABELS,
  compatibleSlots,
  twoHanded,
  type EquipmentSlot,
} from '../shared/equipment';
import type { StorageState } from './types';
import './equipment.css';

export function EquipmentPanel({
  storage,
  busy,
  onEquip,
  dragged,
  onDropItem,
}: {
  storage: StorageState;
  busy: boolean;
  onEquip: (slot: EquipmentSlot, id: string | null) => void;
  dragged: InventoryDrag | null;
  onDropItem: (slot: EquipmentSlot, id: string, from: InventoryDrag['from']) => void;
}) {
  const [over, setOver] = useState<EquipmentSlot | null>(null);
  const main = storage.equipped.find((item) => item.slot === 'main_hand');
  return (
    <section className="equipment-panel loot-storage" aria-label="Itens equipados" aria-busy={busy}>
      <header>
        <h2>Itens equipados</h2>
        <p>
          Arraste um item da mochila para sua categoria ou use a lista. Os itens continuam contando
          no peso total.
        </p>
      </header>
      <div className="equipment-grid">
        {EQUIPMENT_SLOTS.map((slot) => {
          const current = storage.equipped.find((item) => item.slot === slot);
          const candidates = storage.inventory.filter(
            (item) =>
              compatibleSlots(item).includes(slot) &&
              (item.quantity || 0) >
                storage.equipped.filter(
                  (equipped) => equipped.slot !== slot && equipped.id === item.id,
                ).length,
          );
          const blocked = slot === 'off_hand' && main && twoHanded(main);
          const draggedItem = dragged && storage.inventory.find((item) => item.id === dragged.id);
          const compatible =
            dragged?.from === 'backpack' &&
            draggedItem &&
            compatibleSlots(draggedItem).includes(slot) &&
            !blocked;
          const Icon = slot.includes('hand')
            ? Sword
            : slot === 'armor' || slot === 'head'
              ? Shield
              : Package;
          return (
            <div
              className={`equipment-slot ${current ? 'is-equipped' : ''} ${dragged && over === slot ? (compatible ? 'is-drag-over' : 'is-drag-incompatible') : ''}`}
              key={slot}
              role="group"
              aria-label={`Equipar em ${EQUIPMENT_LABELS[slot]}`}
              data-equipment-slot={slot}
              onDragOver={(event) => {
                if (busy || !dragged || !event.dataTransfer.types.includes(INVENTORY_DRAG_TYPE))
                  return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOver(slot);
              }}
              onDragLeave={(event) => {
                if (
                  event.relatedTarget instanceof Node &&
                  event.currentTarget.contains(event.relatedTarget)
                )
                  return;
                setOver(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOver(null);
                if (busy || !dragged || !event.dataTransfer.types.includes(INVENTORY_DRAG_TYPE))
                  return;
                const id = event.dataTransfer.getData(INVENTORY_DRAG_TYPE);
                if (id === dragged.id) onDropItem(slot, id, dragged.from);
              }}
            >
              <span className="equipment-position">{EQUIPMENT_LABELS[slot]}</span>
              <div className="equipment-art">
                {current?.image_path ? (
                  <img src={current.image_path} alt={current.name} draggable={false} />
                ) : (
                  <Icon aria-hidden="true" size={32} />
                )}
              </div>
              <label className="sr-only" htmlFor={`equipment-${slot}`}>
                {EQUIPMENT_LABELS[slot]}
              </label>
              <select
                id={`equipment-${slot}`}
                value={current?.id || ''}
                disabled={busy || Boolean(blocked) || (!candidates.length && !current)}
                onChange={(event) => onEquip(slot, event.target.value || null)}
              >
                <option value="">
                  {blocked
                    ? 'Duas mãos ocupadas'
                    : candidates.length
                      ? 'Não equipado'
                      : 'Nenhum item compatível'}
                </option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {current && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => onEquip(slot, null)}
                  aria-label={`Desequipar ${current.name} de ${EQUIPMENT_LABELS[slot]}`}
                >
                  Desequipar
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p className="equipment-note">
        Itens equipados podem aparecer na próxima imagem do personagem. Bônus e efeitos mágicos não
        são aplicados automaticamente.
      </p>
    </section>
  );
}

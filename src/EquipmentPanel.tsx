import { EquipmentIcon } from './EquipmentIcon';
import { useEffect, useState } from 'react';
import { INVENTORY_DRAG_TYPE, type InventoryDrag } from './inventory-drag';
import {
  EQUIPMENT_SLOTS,
  EQUIPMENT_LABELS,
  compatibleSlots,
  equipmentBlockMessage,
  type EquipmentSlot,
} from '../shared/equipment';
import type { Character, StorageState } from './types';
import './equipment.css';
import { CharacterArtButton } from './CharacterArtButton';

export function EquipmentPanel({
  storage,
  busy,
  onEquip,
  dragged,
  onDropItem,
  character,
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
  character: Character;
  storage: StorageState;
  busy: boolean;
  onEquip: (slot: EquipmentSlot, id: string | null) => void;
  dragged: InventoryDrag | null;
  onDropItem: (slot: EquipmentSlot, id: string, from: InventoryDrag['from']) => void;
}) {
  const [over, setOver] = useState<EquipmentSlot | null>(null);
  const [portraitFailed, setPortraitFailed] = useState(false);
  useEffect(() => setPortraitFailed(false), [character.id, character.portrait_revision]);
  const left: EquipmentSlot[] = [
    'head',
    'neck',
    'shoulders',
    'armor',
    'bracers',
    'hands',
    'back',
    'main_hand',
  ];
  const right: EquipmentSlot[] = [
    'cloak',
    'belt',
    'legs',
    'feet',
    'ring_left',
    'ring_right',
    'off_hand',
  ];
  return (
    <section className="equipment-panel loot-storage" aria-label="Itens equipados" aria-busy={busy}>
      <header>
        <h2>Itens equipados</h2>
        <p>Arraste da mochila ou clique em um espaço para equipar.</p>
      </header>
      <div className="equipment-grid">
        <figure className="equipment-character">
          <img
            src={
              character.portrait_revision > 0 && !portraitFailed
                ? `/api/characters/${character.id}/portrait?v=${character.portrait_revision}`
                : '/character-silhouette-v2.png'
            }
            alt={character.name}
            onError={() => setPortraitFailed(true)}
          />
          <figcaption>{character.name}</figcaption>
        </figure>
        {EQUIPMENT_SLOTS.map((slot) => {
          const current = storage.equipped.find((item) => item.slot === slot);
          const candidates = storage.inventory.filter(
            (item) =>
              compatibleSlots(item).includes(slot) &&
              (item.quantity || 0) >
                storage.equipped.filter(
                  (equipped) => equipped.slot !== slot && equipped.id === item.id,
                ).length +
                  (storage.companion_allocated?.[item.id] || 0),
          );
          const blocked = equipmentBlockMessage(slot, storage.equipped);
          const draggedItem = dragged && storage.inventory.find((item) => item.id === dragged.id);
          const compatible =
            dragged?.from === 'backpack' &&
            draggedItem &&
            compatibleSlots(draggedItem).includes(slot) &&
            !blocked;
          return (
            <div
              className={`equipment-slot ${current ? 'is-equipped' : ''} ${dragged && over === slot ? (compatible ? 'is-drag-over' : 'is-drag-incompatible') : ''}`}
              key={slot}
              role="group"
              aria-label={`Equipar em ${EQUIPMENT_LABELS[slot]}`}
              data-equipment-slot={slot}
              style={{
                gridColumn: left.includes(slot) ? 1 : 3,
                gridRow: (left.includes(slot) ? left : right).indexOf(slot) + 1,
              }}
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
              <button
                type="button"
                className="equipment-slot-trigger"
                disabled={busy}
                popoverTarget={`equipment-picker-${slot}`}
                aria-label={EQUIPMENT_LABELS[slot]}
                title={`${EQUIPMENT_LABELS[slot]}${current ? ` · ${current.name}` : ''}`}
              >
                <div className="equipment-art">
                  {current?.image_path ? (
                    <img src={current.image_path} alt={current.name} draggable={false} />
                  ) : (
                    <EquipmentIcon slot={slot} />
                  )}
                </div>
              </button>
              <div
                id={`equipment-picker-${slot}`}
                className="equipment-picker"
                popover="auto"
                role="dialog"
                aria-label={EQUIPMENT_LABELS[slot]}
                onToggle={(event) => {
                  const picker = event.currentTarget;
                  if (!picker.matches(':popover-open')) return;
                  const anchor = picker
                    .parentElement!.querySelector('.equipment-slot-trigger')!
                    .getBoundingClientRect();
                  const box = picker.getBoundingClientRect();
                  picker.style.left = `${Math.max(12, Math.min(anchor.right + 10, innerWidth - box.width - 12))}px`;
                  picker.style.top = `${Math.max(12, Math.min(anchor.top, innerHeight - box.height - 12))}px`;
                }}
              >
                <h3>{EQUIPMENT_LABELS[slot]}</h3>
                <p>
                  {blocked ||
                    current?.name ||
                    (candidates.length
                      ? 'Escolha um item da mochila.'
                      : 'Nenhum item compatível na mochila.')}
                </p>
                <label className="sr-only" htmlFor={`equipment-${slot}`}>
                  {EQUIPMENT_LABELS[slot]}
                </label>
                <select
                  id={`equipment-${slot}`}
                  value={current?.id || ''}
                  disabled={busy || Boolean(blocked) || (!candidates.length && !current)}
                  onChange={(event) => {
                    onEquip(slot, event.target.value || null);
                    document.getElementById(`equipment-picker-${slot}`)?.hidePopover();
                  }}
                >
                  <option value="">
                    {blocked
                      ? slot === 'hands'
                        ? 'Luvas das braçadeiras'
                        : 'Duas mãos ocupadas'
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
                    onClick={() => {
                      onEquip(slot, null);
                      document.getElementById(`equipment-picker-${slot}`)?.hidePopover();
                    }}
                    aria-label={`Desequipar ${current.name} de ${EQUIPMENT_LABELS[slot]}`}
                  >
                    Desequipar
                  </button>
                )}
                {current?.id === 'plate-bracers' && <small>Inclui as luvas de placas</small>}
              </div>
            </div>
          );
        })}
      </div>
      <CharacterArtButton character={character} onRefresh={onRefresh} />
    </section>
  );
}

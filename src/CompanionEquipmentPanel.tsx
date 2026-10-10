import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { CompanionEquipmentIcon } from './CompanionEquipmentIcon';
import {
  BARDING_PARTS,
  armorPartLabel,
  isBarding,
  supportsArmorParts,
  type BardingPart,
  COMPANION_SLOT_LABELS,
  compatibleCompanionSlots,
  type CompanionArtJob,
  type CompanionEquipmentState,
  type CompanionKind,
  type CompanionSlot,
} from '../shared/companion-equipment';
import { api, post } from './api';
import { FlashMessage } from './FlashMessage';
import { INVENTORY_DRAG_TYPE, type InventoryDrag } from './inventory-drag';
import './companion-equipment.css';
import { ArmorSetPicker } from './ArmorSetPicker';
import { armorSetOptions, inventoryPieceName } from './armor-set-options';

export function CompanionEquipmentPanel({
  characterId,
  kind,
  busy,
  dragged,
  onInventoryRefresh,
  onRefresh,
  selectedCompanionId,
  onSelectCompanion,
}: {
  characterId: string;
  kind: CompanionKind;
  busy: boolean;
  dragged: InventoryDrag | null;
  onInventoryRefresh: () => Promise<void>;
  onRefresh: () => Promise<void>;
  selectedCompanionId?: string;
  onSelectCompanion?: (id: string) => void;
}) {
  const [state, setState] = useState<CompanionEquipmentState | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [jobs, setJobs] = useState<CompanionArtJob[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [over, setOver] = useState<CompanionSlot | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [bardingChoices, setBardingChoices] = useState<Record<string, BardingPart[]>>({});
  const alive = useRef(true),
    inFlight = useRef(false),
    refresh = useRef(onRefresh);
  const artKey = useRef(crypto.randomUUID());
  const requestVersion = useRef(0);
  refresh.current = onRefresh;
  useEffect(() => {
    alive.current = true;
    let updating = false,
      previous = '';
    async function update() {
      if (updating || inFlight.current) return;
      updating = true;
      const version = requestVersion.current;
      try {
        const [data, history] = await Promise.all([
          api<CompanionEquipmentState>(`/companions/${characterId}/equipment`),
          api<{ jobs: CompanionArtJob[]; available: boolean }>(
            `/companions/${characterId}/art/jobs`,
          ),
        ]);
        if (!alive.current || version !== requestVersion.current) return;
        const signature = JSON.stringify(data.companions.map((c) => [c.id, c.image_revision]));
        const changed = previous && signature !== previous;
        previous = signature;
        setState(data);
        setJobs(history.jobs);
        if (changed) {
          window.dispatchEvent(
            new CustomEvent('companion-art-updated', { detail: { characterId } }),
          );
          await refresh.current();
        }
      } catch (e) {
        if (alive.current) setError((e as Error).message);
      } finally {
        updating = false;
      }
    }
    void update();
    const timer = setInterval(() => void update(), 4000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [characterId]);
  const companions = state?.companions.filter((c) => c.kind === kind) || [];
  const selected =
    companions.find((c) => c.id === (selectedCompanionId ?? selectedId)) || companions[0];
  const hasBarding =
    selected &&
    supportsArmorParts(kind, selected.species_id) &&
    selected.equipped.some((item) =>
      kind === 'mount'
        ? item.slot === 'armor' && isBarding(item.id)
        : item.slot === 'armor' && item.id.startsWith('pet-armor-'),
    );
  const bardingParts = selected
    ? (bardingChoices[selected.id] ?? selected.barding_parts ?? [...BARDING_PARTS])
    : [...BARDING_PARTS];
  useEffect(() => {
    setImageFailed(false);
    artKey.current = crypto.randomUUID();
  }, [selected?.id, selected?.equipment_revision, selected?.image_revision]);
  const disabled = busy || saving;
  async function equip(slot: CompanionSlot, itemId: string | null) {
    if (!selected || disabled || inFlight.current) return;
    inFlight.current = true;
    requestVersion.current++;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api<CompanionEquipmentState>(`/companions/${characterId}/equipment`, {
        method: 'PUT',
        body: JSON.stringify({ kind, companion_id: selected.id, slot, item_id: itemId }),
      });
      if (alive.current) {
        setState(result);
        setNotice(
          itemId
            ? 'Equipamento salvo. Use Vestir para atualizar a aparência.'
            : 'Equipamento retirado. Use Vestir para atualizar a aparência.',
        );
      }
      await onInventoryRefresh();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }
  async function equipSet(itemId: string) {
    if (!selected || disabled || inFlight.current) return;
    inFlight.current = true;
    requestVersion.current++;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api<CompanionEquipmentState>(
        `/companions/${characterId}/equipment-set`,
        {
          method: 'PUT',
          body: JSON.stringify({ kind, companion_id: selected.id, item_id: itemId }),
        },
      );
      if (alive.current) {
        setState(result);
        setNotice('Armadura completa equipada. Use Vestir para atualizar a aparência.');
      }
      await onInventoryRefresh();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }
  function drop(event: DragEvent, slot: CompanionSlot) {
    event.preventDefault();
    event.stopPropagation();
    setOver(null);
    if (
      !selected ||
      disabled ||
      !dragged ||
      !event.dataTransfer.types.includes(INVENTORY_DRAG_TYPE)
    )
      return;
    const item = selected?.inventory.find((i) => i.id === dragged.id);
    if (dragged.from !== 'backpack') {
      setError('Leve o item do cofre para a mochila antes de equipar.');
      return;
    }
    if (
      !item ||
      item.available < 1 ||
      !compatibleCompanionSlots(item, kind, selected.species_id).includes(slot)
    ) {
      setError('Este item não está disponível ou não é compatível com este espaço.');
      return;
    }
    if (event.dataTransfer.getData(INVENTORY_DRAG_TYPE) === item.id) void equip(slot, item.id);
  }
  async function dress() {
    if (!selected || disabled || selected.art_pending || inFlight.current) return;
    inFlight.current = true;
    requestVersion.current++;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const job = await post<CompanionArtJob>(`/companions/${characterId}/art`, {
        kind,
        companion_id: selected.id,
        idempotency_key: artKey.current,
        ...(supportsArmorParts(kind, selected.species_id) ? { barding_parts: bardingParts } : {}),
      });
      if (!alive.current) return;
      setJobs((current) => [job, ...current.filter((j) => j.id !== job.id)]);
      setState(
        (current) =>
          current && {
            ...current,
            companions: current.companions.map((c) =>
              c.id === selected.id ? { ...c, art_pending: true } : c,
            ),
          },
      );
      setNotice('Atualizando a aparência com a imagem base e os equipamentos escolhidos.');
      await refresh.current();
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (alive.current) setSaving(false);
    }
  }
  const title = kind === 'mount' ? 'Equipamentos da montaria' : 'Equipamentos do mascote';
  const latest = selected && jobs.find((j) => j.companion_id === selected.id && j.kind === kind);
  useEffect(() => {
    if (latest?.status === 'failed' || latest?.status === 'stale')
      artKey.current = crypto.randomUUID();
  }, [latest?.id, latest?.status]);
  const pending =
    selected?.art_pending || latest?.status === 'queued' || latest?.status === 'running';
  const quotaFull =
    selected && selected.art_limit !== null && selected.art_used >= selected.art_limit;
  const coverageChanged =
    hasBarding &&
    JSON.stringify(bardingParts) !== JSON.stringify(selected?.barding_parts ?? BARDING_PARTS);
  const armorSets =
    selected && state
      ? armorSetOptions(
          selected.inventory,
          kind,
          selected.slots,
          (item, slot) =>
            item.available +
            (selected.equipped.some(
              (equipped) =>
                equipped.source === 'inventory' &&
                equipped.id === item.id &&
                equipped.slot === slot,
            )
              ? 1
              : 0),
        )
      : [];
  return (
    <section
      className="equipment-panel loot-storage companion-equipment-panel"
      aria-label={title}
      aria-busy={disabled}
    >
      <header>
        <h2>{title}</h2>
        <p>Equipe os itens da mochila deste animal.</p>
        {kind === 'mount' && (
          <p>
            A barda ocupa um único espaço de armadura. Vestir combina a armadura completa e os
            acessórios equipados.
          </p>
        )}
      </header>
      {error && <FlashMessage>{error}</FlashMessage>}
      {notice && <FlashMessage kind="info">{notice}</FlashMessage>}
      {!state ? (
        <p role="status">Carregando companheiros…</p>
      ) : !selected ? (
        <p>Este personagem ainda não possui {kind === 'mount' ? 'uma montaria' : 'um mascote'}.</p>
      ) : (
        <>
          <label className="companion-equipment-choice">
            {kind === 'mount' ? 'Montaria' : 'Mascote'}
            <select
              value={selected.id}
              disabled={disabled}
              onChange={(event) => {
                setSelectedId(event.target.value);
                onSelectCompanion?.(event.target.value);
                setNotice('');
                setError('');
              }}
            >
              {companions.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {kind === 'pet' && (
            <ArmorSetPicker
              key={selected.id}
              options={armorSets}
              busy={disabled}
              onEquip={(id) => void equipSet(id)}
            />
          )}
          <div className="companion-outfit-grid">
            <figure className="companion-outfit-image">
              <img
                src={(!imageFailed && selected.image_url) || selected.base_image}
                alt={selected.name}
                draggable={false}
                onError={() => setImageFailed(true)}
              />
              <figcaption>{selected.name}</figcaption>
            </figure>
            {selected.slots.map((slot, index) => {
              const current = selected.equipped.find((i) => i.slot === slot);
              const candidates = selected.inventory.filter(
                (i) =>
                  compatibleCompanionSlots(i, kind, selected.species_id).includes(slot) &&
                  (i.available > 0 || (current?.source === 'inventory' && current.id === i.id)),
              );
              const legacy = selected.legacy_options.filter((i) => i.slot === slot);
              const draggedItem = dragged && selected.inventory.find((i) => i.id === dragged.id);
              const compatible =
                dragged?.from === 'backpack' &&
                draggedItem &&
                draggedItem.available > 0 &&
                compatibleCompanionSlots(draggedItem, kind, selected.species_id).includes(slot);
              const pickerId = `companion-${selected.id}-${slot}`;
              return (
                <div
                  className={`equipment-slot ${current ? 'is-equipped' : ''} ${dragged && over === slot ? (compatible ? 'is-drag-over' : 'is-drag-incompatible') : ''}`}
                  key={slot}
                  data-companion-slot={slot}
                  style={{ gridColumn: index % 2 ? 3 : 1, gridRow: Math.floor(index / 2) + 1 }}
                  onDragOver={(event) => {
                    if (
                      !disabled &&
                      dragged &&
                      event.dataTransfer.types.includes(INVENTORY_DRAG_TYPE)
                    ) {
                      event.preventDefault();
                      setOver(slot);
                    }
                  }}
                  onDragLeave={() => setOver(null)}
                  onDrop={(event) => drop(event, slot)}
                >
                  <button
                    type="button"
                    className="equipment-slot-trigger"
                    disabled={disabled}
                    popoverTarget={pickerId}
                    aria-label={COMPANION_SLOT_LABELS[slot]}
                    title={`${COMPANION_SLOT_LABELS[slot]}${current ? ' · ' + current.name : ''}`}
                  >
                    <span className="equipment-art">
                      {current?.image_path ? (
                        <img src={current.image_path} alt={current.name} draggable={false} />
                      ) : (
                        <CompanionEquipmentIcon
                          slot={slot}
                          kind={kind}
                          speciesId={selected.species_id}
                        />
                      )}
                    </span>
                  </button>
                  <div
                    id={pickerId}
                    popover="auto"
                    className="equipment-picker"
                    role="dialog"
                    aria-label={COMPANION_SLOT_LABELS[slot]}
                    onToggle={(event) => {
                      const node = event.currentTarget;
                      if (!node.matches(':popover-open')) return;
                      const rect = node
                        .parentElement!.querySelector('button')!
                        .getBoundingClientRect();
                      node.style.left = `${Math.max(12, Math.min(rect.right + 10, innerWidth - node.offsetWidth - 12))}px`;
                      node.style.top = `${Math.max(12, Math.min(rect.top, innerHeight - node.offsetHeight - 12))}px`;
                    }}
                  >
                    <h3>{COMPANION_SLOT_LABELS[slot]}</h3>
                    <p>
                      {current
                        ? inventoryPieceName(current)
                        : 'Escolha um equipamento compatível da mochila.'}
                    </p>
                    <label className="sr-only" htmlFor={pickerId + '-select'}>
                      {COMPANION_SLOT_LABELS[slot]}
                    </label>
                    <select
                      id={pickerId + '-select'}
                      value={current?.id || ''}
                      disabled={disabled}
                      onChange={(event) => {
                        void equip(slot, event.target.value || null);
                        document.getElementById(pickerId)?.hidePopover();
                      }}
                    >
                      <option value="">Não equipado</option>
                      {legacy.length > 0 && (
                        <optgroup label="Comprado com esta montaria">
                          {legacy.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {candidates.map((i) => (
                        <option value={i.id} key={i.id}>
                          {inventoryPieceName(i)}
                        </option>
                      ))}
                    </select>
                    {current && (
                      <button
                        className="text-button"
                        disabled={disabled}
                        onClick={() => {
                          void equip(slot, null);
                          document.getElementById(pickerId)?.hidePopover();
                        }}
                      >
                        Desequipar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {hasBarding && (
            <fieldset className="companion-barding-parts" disabled={disabled || pending}>
              <legend>
                {kind === 'mount' ? 'Partes da barda na imagem' : 'Partes da armadura na imagem'}
              </legend>
              <p>Marque as proteções que deseja na próxima imagem.</p>
              <div>
                {BARDING_PARTS.map((part) => (
                  <label key={part}>
                    <input
                      type="checkbox"
                      checked={bardingParts.includes(part)}
                      onChange={(event) => {
                        const next = BARDING_PARTS.filter((p) =>
                          p === part ? event.target.checked : bardingParts.includes(p),
                        );
                        setBardingChoices((current) => ({ ...current, [selected.id]: next }));
                        artKey.current = crypto.randomUUID();
                      }}
                    />
                    {armorPartLabel(part, kind)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="equipment-generate">
            <button
              className="button outline small-button"
              disabled={disabled || pending || quotaFull || !state.worker_available}
              onClick={() => void dress()}
            >
              <Sparkles size={15} />
              {pending ? 'Vestindo…' : 'Vestir'}
            </button>
            <p className="equipment-note">
              {!state.worker_available
                ? 'O ilustrador está offline.'
                : pending
                  ? 'A aparência atual fica visível até a nova arte ficar pronta.'
                  : coverageChanged ||
                      selected.art_equipment_revision !== selected.equipment_revision
                    ? 'A aparência será refeita a partir da imagem base, substituindo os equipamentos anteriores.'
                    : 'A aparência está atualizada.'}
            </p>
            <p className="equipment-note">
              {selected.art_limit === null
                ? 'Geração de imagens sem limite.'
                : `${selected.art_used} de ${selected.art_limit} imagens do personagem usadas neste mês.`}
            </p>
            {latest?.status === 'failed' && (
              <FlashMessage>
                {latest.error || 'A arte não foi concluída. Tente novamente.'}
              </FlashMessage>
            )}
            {latest?.status === 'stale' && (
              <p className="equipment-note">
                Os equipamentos mudaram durante a geração. Use Vestir para atualizar a nova
                configuração.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

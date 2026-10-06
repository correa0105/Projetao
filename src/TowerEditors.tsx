import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import monsterManifest from '../data/vtt/monster-token-art.json';
import type { TowerFloorContent, TowerRewardTable, TowerItemInfo } from '../shared/tower';
import type { Item } from './types';

export function TowerDialog({
  label,
  close,
  children,
}: {
  label: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    ref.current?.querySelector<HTMLElement>('input,textarea,select')?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className="tower-confirm"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {children}
    </dialog>
  );
}
export function TowerFloorEditor({
  initial,
  busy,
  error,
  close,
  save,
}: {
  initial: TowerFloorContent;
  busy: boolean;
  error: string;
  close: () => void;
  save: (draft: TowerFloorContent) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <TowerDialog label="Editar andar da torre" close={close}>
      <form
        className="tower-editor"
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <button
          type="button"
          className="tower-confirm-close"
          aria-label="Fechar edição do andar"
          disabled={busy}
          onClick={close}
        >
          <X size={17} />
        </button>
        <span className="tower-kicker">ADMINISTRAÇÃO · ANDAR {draft.number}</span>
        <h2>Preparar este andar</h2>
        <p>
          Nome e descrição ficam visíveis. Criaturas, guardião, desafios, ambiente e armadilhas
          ficam ocultos até a conclusão do andar.
        </p>
        <label>
          Nome do andar
          <input
            autoFocus
            value={draft.name}
            maxLength={100}
            required
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        {(
          [
            ['description', 'Descrição pública'],
            ['challenge', 'Desafio'],
            ['hazard', 'Ambiente'],
            ['traps', 'Armadilhas'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              rows={3}
              maxLength={3000}
              value={draft[key] || ''}
              onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
            />
          </label>
        ))}
        <label className="tower-check">
          <input
            type="checkbox"
            checked={draft.boss}
            onChange={(e) => setDraft({ ...draft, boss: e.target.checked })}
          />
          Este andar tem um guardião
        </label>
        {draft.boss && (
          <label>
            Nome do guardião
            <input
              value={draft.boss_name || ''}
              maxLength={100}
              onChange={(e) => setDraft({ ...draft, boss_name: e.target.value })}
            />
          </label>
        )}
        <fieldset>
          <legend>Criaturas</legend>
          {(draft.creatures || []).map((creature, i) => (
            <div className="tower-creature-editor" key={i}>
              <label>
                Nome da criatura {i + 1}
                <input
                  required
                  maxLength={100}
                  value={creature.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      creatures: draft.creatures!.map((c, j) =>
                        j === i ? { ...c, name: e.target.value } : c,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Arte da criatura {i + 1}
                <input
                  list="tower-monster-art"
                  placeholder="Opcional · nome no catálogo"
                  value={creature.art}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      creatures: draft.creatures!.map((c, j) =>
                        j === i ? { ...c, art: e.target.value } : c,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                aria-label={'Remover criatura ' + (i + 1)}
                onClick={() =>
                  setDraft({ ...draft, creatures: draft.creatures!.filter((_, j) => j !== i) })
                }
              >
                <X size={15} />
              </button>
            </div>
          ))}
          <datalist id="tower-monster-art">
            {monsterManifest.images.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <button
            type="button"
            disabled={(draft.creatures?.length || 0) >= 30}
            onClick={() =>
              setDraft({ ...draft, creatures: [...(draft.creatures || []), { name: '', art: '' }] })
            }
          >
            <Plus size={15} />
            Adicionar criatura
          </button>
        </fieldset>
        <fieldset>
          <legend>Recompensa do retorno até este andar</legend>
          <p>Deixe vazio para usar a progressão por andar e guardiões vencidos.</p>
          <div className="tower-editor-pair">
            <label>
              Ouro base (PO)
              <input
                type="number"
                min={0}
                max={1000000}
                step="0.01"
                value={draft.base_gold_cp === null ? '' : draft.base_gold_cp / 100}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    base_gold_cp:
                      e.target.value === '' ? null : Math.round(Number(e.target.value) * 100),
                  })
                }
              />
            </label>
            <label>
              Cristais base
              <input
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={draft.base_crystals ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    base_crystals: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </label>
          </div>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="tower-editor-actions">
          <button className="tower-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar andar'}
          </button>
          <button type="button" disabled={busy} onClick={close}>
            Cancelar
          </button>
        </div>
      </form>
    </TowerDialog>
  );
}
export function TowerRewardEditor({
  initial,
  catalog,
  busy,
  error,
  close,
  save,
}: {
  initial: TowerRewardTable;
  catalog: Item[];
  busy: boolean;
  error: string;
  close: () => void;
  save: (draft: TowerRewardTable) => void;
}) {
  const [draft, setDraft] = useState({ ...initial, rows: initial.rows.map((r) => ({ ...r })) });
  const update = (index: number, key: string, value: unknown) =>
    setDraft({
      ...draft,
      rows: draft.rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)),
    });
  return (
    <TowerDialog label="Editar prêmios da torre" close={close}>
      <form
        className="tower-editor"
        onSubmit={(e) => {
          e.preventDefault();
          save(draft);
        }}
      >
        <button
          type="button"
          className="tower-confirm-close"
          aria-label="Fechar edição dos prêmios"
          disabled={busy}
          onClick={close}
        >
          <X size={17} />
        </button>
        <span className="tower-kicker">ADMINISTRAÇÃO · GRAU {draft.tier}</span>
        <h2>Prêmios do d100</h2>
        <p>
          As faixas devem cobrir de 1 a 100, em ordem. Itens vinculados são entregues ao inventário
          junto do prêmio. Expedições já concluídas mantêm os prêmios que estavam em vigor no
          retorno.
        </p>
        {draft.rows.map((r, i) => (
          <fieldset key={i}>
            <legend>Faixa {i + 1}</legend>
            <div className="tower-editor-pair">
              <label>
                De
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={r.min}
                  onChange={(e) => update(i, 'min', Number(e.target.value))}
                />
              </label>
              <label>
                Até
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={r.max}
                  onChange={(e) => update(i, 'max', Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Raridade
              <input
                required
                maxLength={40}
                value={r.rarity}
                onChange={(e) => update(i, 'rarity', e.target.value)}
              />
            </label>
            <label>
              Nome do prêmio
              <input
                required
                maxLength={150}
                value={r.relic}
                onChange={(e) => update(i, 'relic', e.target.value)}
              />
            </label>
            <div className="tower-editor-pair">
              <label>
                Ouro extra (PO)
                <input
                  type="number"
                  required
                  min={0}
                  max={1000000}
                  step="0.01"
                  value={r.gold_cp / 100}
                  onChange={(e) => update(i, 'gold_cp', Math.round(Number(e.target.value) * 100))}
                />
              </label>
              <label>
                Cristais extras
                <input
                  type="number"
                  required
                  min={0}
                  max={1000000}
                  value={r.crystals}
                  onChange={(e) => update(i, 'crystals', Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              Item do catálogo
              <select
                value={r.item_id || ''}
                onChange={(e) => update(i, 'item_id', e.target.value || null)}
              >
                <option value="">Sem item</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {r.item_id && (
              <label>
                Quantidade do item
                <input
                  type="number"
                  required
                  min={1}
                  max={99}
                  value={r.quantity}
                  onChange={(e) => update(i, 'quantity', Number(e.target.value))}
                />
              </label>
            )}
            <button
              type="button"
              disabled={draft.rows.length === 1}
              onClick={() => setDraft({ ...draft, rows: draft.rows.filter((_, j) => i !== j) })}
            >
              Remover faixa
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          disabled={draft.rows.length >= 20}
          onClick={() =>
            setDraft({
              ...draft,
              rows: [
                ...draft.rows,
                {
                  min: 100,
                  max: 100,
                  rarity: 'Comum',
                  relic: 'Novo prêmio',
                  gold_cp: 0,
                  crystals: 0,
                  item_id: null,
                  quantity: 1,
                },
              ],
            })
          }
        >
          <Plus size={15} />
          Adicionar faixa
        </button>
        {error && <p role="alert">{error}</p>}
        <div className="tower-editor-actions">
          <button className="tower-primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar prêmios'}
          </button>
          <button type="button" disabled={busy} onClick={close}>
            Cancelar
          </button>
        </div>
      </form>
    </TowerDialog>
  );
}
export function TowerItemPreview({ item, close }: { item: TowerItemInfo; close: () => void }) {
  return (
    <TowerDialog label={'Informações de ' + item.name} close={close}>
      <button
        className="tower-confirm-close"
        aria-label="Fechar informações do item"
        onClick={close}
      >
        <X size={17} />
      </button>
      <span className="tower-kicker">{item.category || 'ITEM DO CATÁLOGO'}</span>
      <h2>{item.name}</h2>
      {item.image_path && <img className="tower-item-art" src={item.image_path} alt={item.name} />}
      <p className="tower-item-description">{item.description}</p>
    </TowerDialog>
  );
}

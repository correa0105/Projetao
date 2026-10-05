import { useEffect, useRef, useState } from 'react';
import { Lock, Unlock, Plus, Trash2, Swords, Sparkles, FlaskConical, X } from 'lucide-react';
import { api } from './api';
import {
  actionMime,
  hotbarActionSchema,
  type HotbarAction,
  type HotbarState,
  type HotbarDocument,
} from '../shared/vtt-hotbar';
import { sheetAttacks, spells } from '../shared/character-sheet';
import type { VttSheetData } from '../shared/vtt-sheet';
import type { VttMessage, VttToken } from '../shared/vtt';
import type { MonsterAction } from '../shared/vtt-monster-actions';
import type { AttackRequest } from '../shared/vtt-attack';
import { VttAttack } from './VttAttack';
import './vtt-hotbar.css';
const signed = (n: number) => (n >= 0 ? '+' : '') + n;
export function ActionShortcut({ action }: { action: HotbarAction }) {
  return (
    <button
      className="vtt-pin-action"
      draggable
      title="Arraste para a barra de ações ou clique para fixar"
      aria-label={'Fixar ' + action.label}
      onDragStart={(e) => {
        e.dataTransfer.setData(actionMime, JSON.stringify(action));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={() => window.dispatchEvent(new CustomEvent('vtt-pin-action', { detail: action }))}
    >
      <Plus size={12} /> Fixar
    </button>
  );
}
export function VttHotbar({
  roomId,
  tokens,
  sheetOpen,
  roll,
  shareSpell,
  refresh,
  gm,
  applyEffect,
  onAttack,
  attack,
  target,
  selectedTokenId,
  closeAttack,
  attackBusy,
  onAttackBusy,
}: {
  roomId: string;
  tokens: VttToken[];
  sheetOpen: boolean;
  roll: (formula: string, label: string) => Promise<VttMessage['roll']>;
  onAttack: (request: AttackRequest) => void;
  attack: AttackRequest | null;
  target?: VttToken;
  selectedTokenId?: string;
  closeAttack: () => void;
  attackBusy: boolean;
  onAttackBusy: (busy: boolean) => void;
  shareSpell: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  gm: boolean;
  applyEffect: (id: string) => Promise<void>;
}) {
  const [state, setState] = useState<HotbarState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<{
      action: HotbarAction;
      data?: VttSheetData;
      monster?: { tokenName: string; action: MonsterAction };
      index: number;
    } | null>(null);
  const inFlight = useRef(false),
    live = useRef(true);
  const url = `/vtt/rooms/${roomId}/hotbar`;
  useEffect(() => {
    live.current = true;
    void api<HotbarState>(url)
      .then(setState)
      .catch((e) => setError(e.message));
    return () => {
      live.current = false;
    };
  }, [url]);
  const page = state?.document.pages.find((p) => p.id === state.document.active);
  useEffect(() => {
    setSelected(null);
    closeAttack();
  }, [page?.id]);
  async function mutate(fn: (d: HotbarDocument) => void) {
    if (!state || inFlight.current || attackBusy) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const document = structuredClone(state.document);
    fn(document);
    try {
      if (gm) await refresh();
      const next = await api<HotbarState>(url, {
        method: 'PUT',
        body: JSON.stringify({ revision: state.revision, document }),
      });
      if (live.current) setState(next);
    } catch (e) {
      if (live.current) {
        setError((e as Error).message);
        const next = await api<HotbarState>(url).catch(() => null);
        if (next) setState(next);
      }
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }
  function pin(action: HotbarAction, index = page?.slots.findIndex((s) => s === null) ?? -1) {
    if (!page || page.locked) {
      setError('Destranque esta aba para adicionar ou mover atalhos.');
      return;
    }
    if (index < 0) {
      setError('Esta aba está cheia. Crie outra aba ou remova um atalho.');
      return;
    }
    void mutate((d) => {
      d.pages.find((p) => p.id === d.active)!.slots[index] = action;
    });
  }
  useEffect(() => {
    const handler = (e: Event) => {
      const parsed = hotbarActionSchema.safeParse((e as CustomEvent).detail);
      if (parsed.success) pin(parsed.data);
    };
    window.addEventListener('vtt-pin-action', handler);
    return () => window.removeEventListener('vtt-pin-action', handler);
  });
  async function choose(action: HotbarAction, index: number) {
    if (inFlight.current || attackBusy) return;
    closeAttack();
    setSelected(null);
    if (action.kind === 'effect' || action.kind === 'monster') {
      if (!gm) {
        setError('Esse atalho é exclusivo do mestre.');
        return;
      }
      if (action.kind === 'effect') {
        setSelected({ action, index });
      } else {
        setBusy(true);
        inFlight.current = true;
        setError('');
        try {
          await refresh();
          const monster = await api<{ tokenName: string; action: MonsterAction }>(
            url + '/monster/' + action.tokenId + '/' + encodeURIComponent(action.sourceId),
          );
          setSelected({ action, monster, index });
          if (monster.action.attack)
            onAttack({
              actorId: action.tokenId,
              name: monster.tokenName + ' · ' + monster.action.name,
              attack: monster.action.attack,
              damage: monster.action.damage,
            });
        } catch (e) {
          setError((e as Error).message);
          setSelected({ action, index });
        } finally {
          setBusy(false);
          inFlight.current = false;
        }
      }
      return;
    }
    const token = tokens.find(
      (t) => t.characterId === action.characterId && t.layer === 'tokens' && !t.hidden,
    );
    if (!token) {
      setError('O personagem precisa estar importado e disponível neste mapa.');
      setSelected({ action, index });
      return;
    }
    setBusy(true);
    inFlight.current = true;
    setError('');
    try {
      await refresh();
      const data = await api<VttSheetData>(`/vtt/rooms/${roomId}/sheets/${token.id}`);
      setSelected({ action, data, index });
      if (action.kind === 'attack') {
        const c = data.character,
          choices = data.sheet?.choices;
        const weapon =
          choices &&
          sheetAttacks(c.race, c.class, c.stats, choices).find((w) => w.name === action.sourceId);
        if (!weapon) throw Error('Este ataque não está mais na ficha.');
        onAttack({
          actorId: data.token.id,
          name: data.token.name + ' · ' + weapon.name,
          attack: '1d20' + signed(weapon.attack),
          damage: weapon.dice === '—' ? [] : [weapon.dice + signed(weapon.ability)],
        });
      }
    } catch (e) {
      setError((e as Error).message);
      setSelected({ action, index });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function execute(mode: 'attack' | 'damage' | 'description' | 'cast' | 'use' | 'apply') {
    if (!selected || inFlight.current || attackBusy) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    const { action, data } = selected;
    try {
      if (action.kind === 'effect') {
        if (!gm) throw Error('Esse atalho é exclusivo do mestre.');
        await applyEffect(action.sourceId);
      } else if (action.kind === 'monster') {
        if (!gm) throw Error('Esse atalho é exclusivo do mestre.');
        await refresh();
        const monster = await api<{ tokenName: string; action: MonsterAction }>(
          url + '/monster/' + action.tokenId + '/' + encodeURIComponent(action.sourceId),
        );
        const label = monster.tokenName + ' · ' + monster.action.name;
        if (mode === 'attack' && monster.action.attack)
          onAttack({
            actorId: action.tokenId,
            name: label,
            attack: monster.action.attack,
            damage: monster.action.damage,
          });
        else if (mode === 'damage') {
          for (const formula of monster.action.damage) await roll(formula, label + ' · dano');
        } else if (mode === 'description')
          await roll('', (label + '\n' + monster.action.description).slice(0, 2000));
      } else if (action.kind === 'attack' && data) {
        const c = data.character,
          choices = data.sheet?.choices;
        const attack =
          choices &&
          sheetAttacks(c.race, c.class, c.stats, choices).find((w) => w.name === action.sourceId);
        if (!attack) throw Error('Este ataque não está mais na ficha.');
        if (mode === 'attack')
          onAttack({
            actorId: data.token.id,
            name: data.token.name + ' · ' + attack.name,
            attack: '1d20' + signed(attack.attack),
            damage: attack.dice === '—' ? [] : [attack.dice + signed(attack.ability)],
          });
        else
          await roll(
            attack.dice + signed(attack.ability),
            data.token.name + ' · ' + attack.name + ' · dano separado',
          );
      } else if (action.kind === 'spell' && data) {
        const spell = spells.find((s) => s.id === action.sourceId);
        if (!spell) throw Error('Magia indisponível.');
        if (mode === 'cast' && spell.level > 0) {
          await api(`/vtt/rooms/${roomId}/sheets/${data.token.id}/use`, {
            method: 'POST',
            body: JSON.stringify({
              kind: 'slot',
              slot: spell.level,
              idempotency_key: crypto.randomUUID(),
            }),
          });
          await refresh();
        }
        await shareSpell(spell.name);
      } else if (action.kind === 'consumable' && data) {
        const item = data.inventory.find(
          (i) => i.id === action.sourceId && i.consumable && i.quantity > 0,
        );
        if (!item) throw Error('Este consumível acabou no inventário.');
        await api(`/vtt/rooms/${roomId}/sheets/${data.token.id}/use`, {
          method: 'POST',
          body: JSON.stringify({
            kind: 'consumable',
            item_id: item.id,
            idempotency_key: crypto.randomUUID(),
          }),
        });
        await refresh();
      }
      setSelected(null);
      closeAttack();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        sheetOpen ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.querySelector('.vtt-modal-backdrop') ||
        (e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')
      )
        return;
      const index = e.key === '0' ? 9 : Number(e.key) - 1;
      if (/^[0-9]$/.test(e.key) && index >= 0 && page?.slots[index]) {
        e.preventDefault();
        void choose(page.slots[index]!, index);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  if (!state || !page)
    return error ? (
      <div className="vtt-hotbar-error" role="alert">
        {error}
      </div>
    ) : null;
  const spell =
    selected?.action.kind === 'spell'
      ? spells.find((s) => s.id === selected.action.sourceId)
      : null;
  return (
    <div className={'vtt-hotbar ' + (sheetOpen ? 'over-sheet' : '')} aria-label="Barra de ações">
      {error && (
        <div role="alert" className="vtt-hotbar-error">
          {error}
          <button aria-label="Fechar aviso da barra" onClick={() => setError('')}>
            <X size={12} />
          </button>
        </div>
      )}
      {(selected || attack) && (
        <div
          className="vtt-hotbar-action"
          role="dialog"
          aria-label={'Atalho · ' + (attack?.name || selected?.action.label)}
        >
          <strong>{attack?.name || selected?.action.label}</strong>
          <button
            aria-label="Fechar atalho"
            disabled={busy || attackBusy}
            onClick={() => {
              setSelected(null);
              closeAttack();
            }}
          >
            <X size={14} />
          </button>
          {attack ? (
            <VttAttack
              key={attack.actorId + ':' + attack.name}
              request={attack}
              target={target}
              active={selectedTokenId === attack.actorId}
              roll={roll}
              onBusy={onAttackBusy}
            />
          ) : selected?.action.kind === 'effect' ? (
            <button disabled={busy} onClick={() => void execute('apply')}>
              Aplicar no token selecionado
            </button>
          ) : selected?.action.kind === 'monster' ? (
            <>
              {selected.monster?.action.attack && (
                <button disabled={busy} onClick={() => void execute('attack')}>
                  Rolar ataque
                </button>
              )}
              {!!selected.monster?.action.damage.length && (
                <button disabled={busy} onClick={() => void execute('damage')}>
                  Rolar dano separado
                </button>
              )}
              <button
                disabled={busy || !selected.monster}
                onClick={() => void execute('description')}
              >
                Descrição no chat
              </button>
            </>
          ) : selected?.action.kind === 'attack' ? (
            <>
              <button disabled={busy || !selected.data} onClick={() => void execute('attack')}>
                Rolar ataque
              </button>
              <button disabled={busy || !selected.data} onClick={() => void execute('damage')}>
                Rolar dano separado
              </button>
            </>
          ) : selected?.action.kind === 'spell' ? (
            <>
              <button disabled={busy || !selected.data} onClick={() => void execute('description')}>
                Descrição no chat
              </button>
              <button
                disabled={
                  busy ||
                  !selected.data ||
                  (!!spell?.level &&
                    (selected.data?.resources.slots_used[spell.level - 1] ?? 0) >=
                      (selected.data?.resources.slots_total[spell.level - 1] ?? 0))
                }
                onClick={() => void execute('cast')}
              >
                {spell?.level ? `Conjurar · gastar espaço ${spell.level}` : 'Conjurar truque'}
              </button>
            </>
          ) : selected ? (
            <button
              disabled={
                busy ||
                !selected.data?.inventory.some(
                  (i) => i.id === selected.action.sourceId && i.quantity > 0,
                )
              }
              onClick={() => void execute('use')}
            >
              Usar uma unidade
            </button>
          ) : null}
          {attack && selected?.action.kind === 'monster' && (
            <button disabled={busy || attackBusy} onClick={() => void execute('description')}>
              Descrição no chat
            </button>
          )}
          {selected && !page.locked && (
            <button
              disabled={busy || attackBusy}
              onClick={() => {
                void mutate((d) => {
                  d.pages.find((p) => p.id === d.active)!.slots[selected.index] = null;
                });
                setSelected(null);
                closeAttack();
              }}
            >
              <Trash2 size={12} /> Remover atalho
            </button>
          )}
        </div>
      )}
      <div className="vtt-hotbar-pages">
        <select
          aria-label="Aba da barra de ações"
          disabled={busy || attackBusy}
          value={page.id}
          onChange={(e) => {
            setSelected(null);
            closeAttack();
            void mutate((d) => {
              d.active = e.target.value;
            });
          }}
        >
          {state.document.pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.locked ? ' · trancada' : ''}
            </option>
          ))}
        </select>
        <button
          aria-label={page.locked ? 'Destrancar aba' : 'Trancar aba'}
          disabled={busy || attackBusy}
          onClick={() =>
            void mutate((d) => {
              d.pages.find((p) => p.id === d.active)!.locked = !page.locked;
            })
          }
        >
          {page.locked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button
          aria-label="Nova aba de ações"
          disabled={busy || attackBusy || state.document.pages.length >= 20}
          onClick={() =>
            void mutate((d) => {
              const id = crypto.randomUUID();
              d.pages.push({
                id,
                name: 'Ações ' + (d.pages.length + 1),
                locked: false,
                slots: Array(10).fill(null),
              });
              d.active = id;
            })
          }
        >
          <Plus size={14} />
        </button>
        <button
          aria-label="Renomear aba de ações"
          disabled={busy || attackBusy || page.locked}
          onClick={() => {
            const name = prompt('Nome da aba', page.name)?.trim();
            if (name)
              void mutate((d) => {
                d.pages.find((p) => p.id === d.active)!.name = name.slice(0, 32);
              });
          }}
        >
          ✎
        </button>
        <button
          aria-label="Remover aba de ações"
          disabled={busy || attackBusy || page.locked || state.document.pages.length === 1}
          onClick={() => {
            if (confirm('Remover esta aba e seus atalhos?'))
              void mutate((d) => {
                d.pages = d.pages.filter((p) => p.id !== d.active);
                d.active = d.pages[0].id;
              });
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
      <div className="vtt-hotbar-slots">
        {page.slots.map((action, i) => {
          const Icon =
            action?.kind === 'attack' || action?.kind === 'monster'
              ? Swords
              : action?.kind === 'spell' || action?.kind === 'effect'
                ? Sparkles
                : FlaskConical;
          return (
            <button
              key={i}
              className="vtt-hotbar-slot"
              aria-label={`Atalho ${i === 9 ? 0 : i + 1}${action ? ' · ' + action.label : ' · vazio'}`}
              disabled={busy}
              title={action?.label || 'Arraste uma ação da ficha'}
              draggable={!!action && !page.locked}
              onDragStart={(e) => {
                if (action) {
                  e.dataTransfer.setData(actionMime, JSON.stringify(action));
                  e.dataTransfer.setData(
                    'application/x-alvorada-slot',
                    JSON.stringify({ pageId: page.id, index: i }),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                }
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(actionMime) && !page.locked) e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (page.locked) return;
                try {
                  const action = hotbarActionSchema.parse(
                    JSON.parse(e.dataTransfer.getData(actionMime)),
                  );
                  const from = e.dataTransfer.getData('application/x-alvorada-slot');
                  if (from !== '') {
                    const { pageId, index } = JSON.parse(from);
                    if (Number.isInteger(index) && index >= 0 && index < 10)
                      void mutate((d) => {
                        const p = d.pages.find((p) => p.id === d.active)!;
                        const source = d.pages.find((p) => p.id === pageId);
                        if (!source || source.locked) return;
                        [p.slots[i], source.slots[index]] = [source.slots[index], p.slots[i]];
                      });
                  } else pin(action, i);
                } catch {
                  setError('Não foi possível adicionar esse atalho.');
                }
              }}
              onClick={() => action && void choose(action, i)}
            >
              <small>{i === 9 ? 0 : i + 1}</small>
              {action && (
                <>
                  <Icon size={20} />
                  <span>{action.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

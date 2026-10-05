import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Dices, Swords, X } from 'lucide-react';
import { api } from './api';
import type { CombatView } from '../shared/vtt-combat';
import type { VttToken } from '../shared/vtt';
import './vtt-combat.css';
export function useVttCombat(
  roomId: string | undefined,
  sceneId: string | undefined,
  before: () => Promise<void>,
  refresh: () => Promise<void>,
) {
  const [state, setState] = useState<CombatView | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const liveId = useRef(roomId);
  liveId.current = roomId;
  const inFlight = useRef(false);
  useEffect(() => {
    setState(null);
    setError('');
    if (!roomId) return;
    let live = true,
      pending = false;
    const load = async () => {
      if (pending || document.hidden || inFlight.current) return;
      pending = true;
      try {
        const s = await api<CombatView>(`/vtt/rooms/${roomId}/combat`);
        if (live)
          setState((old) =>
            old?.sceneId === s.sceneId &&
            (old.revision > s.revision || JSON.stringify(old) === JSON.stringify(s))
              ? old
              : s,
          );
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(load, 1000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [roomId, sceneId]);
  async function send(body: object) {
    if (!roomId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await before();
      const s = await api<CombatView>(`/vtt/rooms/${roomId}/combat`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (liveId.current === roomId) {
        setState(s);
        await refresh();
      }
    } catch (e) {
      if (liveId.current === roomId) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { state, busy, error, send };
}
export type CombatControls = ReturnType<typeof useVttCombat>;
function Portrait({ entry }: { entry: NonNullable<CombatView>['entries'][number] }) {
  return entry.image ? (
    <img src={entry.image} alt="" />
  ) : (
    <span className="vtt-turn-initial">{entry.name.slice(0, 2)}</span>
  );
}
export function VttTurnCarousel({
  controls,
  gm,
  open,
}: {
  controls: CombatControls;
  gm: boolean;
  open: () => void;
}) {
  const { state: c, busy, send } = controls;
  if (!c?.entries.length) return null;
  const at = Math.max(
    0,
    c.entries.findIndex((e) => e.tokenId === c.currentId),
  );
  const cards = c.entries.map((_, i) => c.entries[(at + i) % c.entries.length]).slice(0, 5);
  return (
    <section className="vtt-turn-carousel" aria-label="Carrossel de turnos">
      <header>
        <button onClick={open}>{c.active ? 'Rodada ' + c.round : 'Aguardando iniciativa'}</button>
        {gm && (
          <div>
            <button
              disabled={busy}
              aria-label="Turno anterior"
              onClick={() => void send({ kind: 'step', direction: -1 })}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={busy}
              aria-label="Avançar turno"
              onClick={() => void send({ kind: 'step', direction: 1 })}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </header>
      <div className="vtt-turn-cards">
        {cards.map((e) => (
          <article
            key={e.tokenId}
            className={
              c.active && e.tokenId === c.currentId
                ? 'current'
                : c.active && e.tokenId === c.nextId
                  ? 'next'
                  : ''
            }
          >
            <button
              className="vtt-turn-portrait"
              title={gm ? 'Escolher turno de ' + e.name : e.name}
              disabled={!gm || busy}
              onClick={() => void send({ kind: 'goto', tokenId: e.tokenId })}
            >
              <Portrait entry={e} />
            </button>
            <strong title={e.name}>{e.name}</strong>
            <span>{e.value ?? '—'}</span>
            {e.canRoll && (
              <button
                aria-label={'Rolar iniciativa de ' + e.name}
                disabled={busy}
                onClick={() => void send({ kind: 'roll', tokenId: e.tokenId })}
              >
                <Dices size={13} />
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
function InitiativeValue({
  entry,
  busy,
  send,
}: {
  entry: CombatView['entries'][number];
  busy: boolean;
  send: CombatControls['send'];
}) {
  const [value, setValue] = useState(String(entry.value ?? ''));
  useEffect(() => setValue(String(entry.value ?? '')), [entry.value]);
  return (
    <input
      aria-label={'Iniciativa de ' + entry.name}
      type="number"
      min={-100}
      max={1000}
      value={value}
      disabled={busy}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        const n = Number(value);
        if (value.trim() && Number.isInteger(n) && n !== entry.value)
          void send({ kind: 'set', tokenId: entry.tokenId, value: n });
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
export function VttCombatPanel({
  controls,
  gm,
  tokens,
  selected,
  selectAll,
}: {
  controls: CombatControls;
  gm: boolean;
  tokens: VttToken[];
  selected: string[];
  selectAll: () => void;
}) {
  const { state: c, busy, error, send } = controls;
  const publicTokens = tokens.filter((t) => t.layer === 'tokens' && !t.hidden),
    ids = selected.filter((id) => publicTokens.some((t) => t.id === id));
  return (
    <section className="vtt-combat-panel" aria-label="Ordem dos turnos">
      <div className="vtt-round">
        <Swords size={17} />
        <span>{c?.active ? 'Em combate · rodada ' + c.round : 'Combate não iniciado'}</span>
      </div>
      {error && <p role="alert">{error}</p>}
      {gm && (
        <div className="vtt-row">
          <button disabled={!publicTokens.length || busy} onClick={selectAll}>
            Selecionar todos os tokens
          </button>
          <button
            disabled={!ids.length || busy || c?.active}
            onClick={() => void send({ kind: 'add', tokenIds: ids })}
          >
            Adicionar selecionados à ordem
          </button>
          <button
            disabled={!publicTokens.length || busy || c?.active}
            onClick={() => void send({ kind: 'add', tokenIds: publicTokens.map((t) => t.id) })}
          >
            Adicionar todos à ordem
          </button>
        </div>
      )}
      <p className="vtt-muted">
        {gm
          ? 'Shift + clique seleciona vários tokens. Defina as iniciativas antes de iniciar.'
          : 'Role a iniciativa do seu personagem aqui ou no carrossel.'}
      </p>
      {c?.entries.map((e) => (
        <div
          className={'vtt-combat-entry ' + (c.active && e.tokenId === c.currentId ? 'current' : '')}
          key={e.tokenId}
        >
          <Portrait entry={e} />
          <strong>{e.name}</strong>
          {gm ? <InitiativeValue entry={e} busy={busy} send={send} /> : <b>{e.value ?? '—'}</b>}
          {e.canRoll && (
            <button
              aria-label={'Rolar iniciativa de ' + e.name}
              disabled={busy}
              onClick={() => void send({ kind: 'roll', tokenId: e.tokenId })}
            >
              <Dices size={19} />
            </button>
          )}
          {gm && (
            <>
              <button
                aria-label={'Escolher turno de ' + e.name}
                disabled={busy}
                onClick={() => void send({ kind: 'goto', tokenId: e.tokenId })}
              >
                <ChevronRight size={15} />
              </button>
              <button
                aria-label={'Remover ' + e.name + ' da ordem'}
                disabled={busy}
                onClick={() => void send({ kind: 'remove', tokenId: e.tokenId })}
              >
                <X size={13} />
              </button>
            </>
          )}
        </div>
      ))}
      {gm && (
        <div className="vtt-row">
          {c?.active ? (
            <>
              <button disabled={busy} onClick={() => void send({ kind: 'step', direction: -1 })}>
                Turno anterior
              </button>
              <button disabled={busy} onClick={() => void send({ kind: 'step', direction: 1 })}>
                Próximo turno
              </button>
            </>
          ) : (
            <button
              className="vtt-gold"
              disabled={busy || !c?.entries.length || c.entries.some((e) => e.value === null)}
              onClick={() => void send({ kind: 'start' })}
            >
              Iniciar combate
            </button>
          )}
          <button disabled={busy || !c?.entries.length} onClick={() => void send({ kind: 'end' })}>
            Encerrar combate
          </button>
        </div>
      )}
    </section>
  );
}

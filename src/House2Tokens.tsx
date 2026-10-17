import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Crosshair, PawPrint, Plus, RefreshCw, Trash2, UserRound } from 'lucide-react';
import { api, post } from './api';
import {
  house2TokenClamp,
  house2TokenCanMove,
  house2Contains,
  type House2Token,
  type House2TokenSource,
} from '../shared/house2-tokens';
import type { House2Plot } from '../shared/house-v2';
import './house2-tokens.css';

type Snapshot = { tokens: House2Token[]; doors: Record<string, boolean> };
const empty = (): Snapshot => ({ tokens: [], doors: {} });
export function useHouse2Tokens(neighborhood: string | null, notice: (message: string) => void) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty),
    [sources, setSources] = useState<House2TokenSource[]>([]);
  const [selected, select] = useState<string | null>(null),
    [preview, setPreview] = useState<House2Token | null>(null);
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const active = useRef(false),
    moving = useRef(false),
    epoch = useRef(0);
  const base = '/house-v2/neighborhoods/' + neighborhood;
  const refresh = useCallback(async () => {
    if (!neighborhood || active.current || moving.current) return;
    const version = ++epoch.current;
    try {
      const next = await api<Snapshot>('/house-v2/neighborhoods/' + neighborhood + '/tokens');
      if (epoch.current === version && !active.current && !moving.current) setSnapshot(next);
    } catch (error) {
      if (epoch.current === version) notice((error as Error).message);
    }
  }, [neighborhood, notice]);
  useEffect(() => {
    let cancelled = false;
    epoch.current++;
    active.current = moving.current = false;
    setSnapshot(empty());
    setPreview(null);
    select(null);
    setSources([]);
    setBusy(false);
    setLoading(false);
    if (!neighborhood) return;
    setLoading(true);
    void Promise.all([refresh(), api<{ sources: House2TokenSource[] }>('/house-v2/token-library')])
      .then(([, library]) => {
        if (!cancelled) setSources(library.sources);
      })
      .catch((e) => {
        if (!cancelled) notice(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const poll = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 5000);
    return () => {
      cancelled = true;
      epoch.current++;
      clearInterval(poll);
    };
  }, [neighborhood, refresh, notice]);
  async function operation<T>(fn: (current: () => boolean) => Promise<T>): Promise<T | undefined> {
    if (!neighborhood || active.current) return;
    const version = ++epoch.current;
    active.current = true;
    setBusy(true);
    try {
      return await fn(() => version === epoch.current);
    } catch (e) {
      if (version === epoch.current) notice((e as Error).message);
    } finally {
      if (version === epoch.current) {
        active.current = false;
        moving.current = false;
        setBusy(false);
        setPreview(null);
        void refresh();
      }
    }
  }
  async function bring(source: House2TokenSource, position: { x: number; y: number }) {
    const existing = snapshot.tokens.find(
      (t) => t.source_id === source.id && t.kind === source.kind && t.can_control,
    );
    if (existing) {
      select(existing.id);
      return existing;
    }
    return operation(async (current) => {
      const nearby = snapshot.tokens.filter(
        (t) => Math.hypot(t.x - position.x, t.y - position.y) < 3,
      ).length;
      const t = await post<House2Token>(base + '/tokens', {
        kind: source.kind,
        source_id: source.id,
        position: {
          x: position.x + (nearby % 4) * 1.3,
          y: position.y + Math.floor(nearby / 4) * 1.3,
        },
      });
      if (!current()) return;
      setSnapshot((s) => ({ ...s, tokens: [...s.tokens.filter((v) => v.id !== t.id), t] }));
      select(t.id);
      notice(t.name + ' está no mapa.');
      return t;
    });
  }
  async function update(
    t: House2Token,
    change: Partial<Pick<House2Token, 'x' | 'y' | 'rotation' | 'size'>>,
    path?: { x: number; y: number }[],
  ) {
    return operation(async (current) => {
      const next = { x: t.x, y: t.y, rotation: t.rotation, size: t.size, ...change };
      Object.assign(next, house2TokenClamp(next));
      const saved = await api<House2Token>(base + '/tokens/' + t.id, {
        method: 'PATCH',
        body: JSON.stringify({ ...next, revision: t.revision, ...(path ? { path } : {}) }),
      });
      if (!current()) return;
      setSnapshot((s) => ({ ...s, tokens: s.tokens.map((v) => (v.id === saved.id ? saved : v)) }));
      return saved;
    });
  }
  async function remove(t: House2Token) {
    return operation(async (current) => {
      await api(base + '/tokens/' + t.id, {
        method: 'DELETE',
        body: JSON.stringify({ revision: t.revision }),
      });
      if (!current()) return;
      setSnapshot((s) => ({ ...s, tokens: s.tokens.filter((v) => v.id !== t.id) }));
      select(null);
      notice(t.name + ' foi retirado do mapa.');
    });
  }
  async function door(id: string, open: boolean) {
    return operation(async (current) => {
      await api(base + '/doors/' + id, { method: 'PATCH', body: JSON.stringify({ open }) });
      if (!current()) return;
      setSnapshot((s) => ({ ...s, doors: { ...s.doors, [id]: open } }));
    });
  }
  const tokens = preview
    ? snapshot.tokens.map((t) => (t.id === preview.id ? preview : t))
    : snapshot.tokens;
  const viewer =
    tokens.find((t) => t.id === selected && t.can_control) ??
    tokens.find((t) => t.can_control && t.kind === 'character') ??
    tokens.find((t) => t.can_control);
  return {
    tokens,
    sources,
    selected,
    select,
    viewer,
    doors: snapshot.doors,
    busy,
    loading,
    bring,
    update,
    remove,
    door,
    refresh,
    preview: (t: House2Token | null) => {
      moving.current = !!t;
      setPreview(t);
    },
  };
}
export type House2TokenControls = ReturnType<typeof useHouse2Tokens>;

export function House2TokensLayer({
  controls,
  plots,
  world,
  disabled,
  choose,
  interior,
}: {
  controls: House2TokenControls;
  plots: House2Plot[];
  world: (x: number, y: number) => { x: number; y: number };
  disabled: boolean;
  choose: () => void;
  interior: string | null;
}) {
  const drag = useRef<{
    pointer: number;
    node: SVGGElement;
    token: House2Token;
    at: House2Token;
    offset: { x: number; y: number };
    path: { x: number; y: number }[];
    moved: boolean;
  } | null>(null);
  const latest = useRef(controls);
  latest.current = controls;
  function finish(cancel = false) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.node.hasPointerCapture(d.pointer)) d.node.releasePointerCapture(d.pointer);
    if (!cancel && d.moved) void latest.current.update(d.token, { x: d.at.x, y: d.at.y }, d.path);
    else latest.current.preview(null);
  }
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current) {
        e.preventDefault();
        finish(true);
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      latest.current.preview(null);
    };
  }, []);
  function down(e: PointerEvent<SVGGElement>, t: House2Token) {
    if (!t.can_control || disabled || controls.busy || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    controls.select(t.id);
    choose();
    const at = world(e.clientX, e.clientY);
    drag.current = {
      pointer: e.pointerId,
      node: e.currentTarget,
      token: t,
      at: t,
      offset: { x: at.x - t.x, y: at.y - t.y },
      path: [],
      moved: false,
    };
    controls.preview(t);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<SVGGElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    e.stopPropagation();
    const p = world(e.clientX, e.clientY);
    const at = house2TokenClamp({ x: p.x - d.offset.x, y: p.y - d.offset.y, size: d.token.size });
    if (Math.hypot(at.x - d.at.x, at.y - d.at.y) < 0.025) return;
    if (!house2TokenCanMove(plots, d.at, at, d.token.size) || d.path.length >= 198) return;
    d.at = { ...d.token, ...at };
    d.path.push(at);
    d.moved = true;
    controls.preview(d.at);
  }
  return (
    <g data-house2-tokens="true">
      {controls.tokens
        .filter((t) => !plots.some((p) => p.house_id && p.id !== interior && house2Contains(p, t)))
        .map((t) => (
          <g
            key={t.id}
            data-house2-token={t.id}
            data-token-kind={t.kind}
            data-token-control={t.can_control ? 'mine' : 'visitor'}
            transform={`translate(${t.x} ${t.y})`}
            role="group"
            aria-label={`Token de ${t.name}`}
            tabIndex={t.can_control && !disabled ? 0 : undefined}
            className={'h2-actor ' + (t.can_control && !disabled ? 'controlled' : '')}
            onPointerDown={(e) => down(e, t)}
            onPointerMove={move}
            onPointerUp={(e) => {
              if (drag.current?.pointer === e.pointerId) {
                e.stopPropagation();
                finish();
              }
            }}
            onPointerCancel={() => finish(true)}
            onLostPointerCapture={() => finish(true)}
            onKeyDown={(e) => {
              if (!t.can_control || disabled || controls.busy) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                controls.select(t.id);
                choose();
              }
              const directions: Record<string, [number, number]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              const direction = directions[e.key];
              if (direction) {
                e.preventDefault();
                controls.select(t.id);
                const step = e.shiftKey ? 1 : 0.25;
                void controls.update(t, {
                  x: t.x + direction[0] * step,
                  y: t.y + direction[1] * step,
                });
              }
            }}
          >
            <title>{t.kind === 'pet' ? `${t.name} · pet de ${t.character_name}` : t.name}</title>
            {!t.top_down && (
              <defs>
                <clipPath id={'h2-actor-face-' + t.id}>
                  <circle r={t.size / 2} />
                </clipPath>
              </defs>
            )}
            <g transform={`rotate(${t.rotation})`}>
              {!t.top_down && (
                <circle r={t.size / 2} fill="#17212c" stroke="#b89960" strokeWidth=".035" />
              )}
              <image
                href={t.image_url}
                x={-t.size / 2}
                y={-t.size / 2}
                width={t.size}
                height={t.size}
                preserveAspectRatio={t.top_down ? 'xMidYMid meet' : 'xMidYMid slice'}
                clipPath={t.top_down ? undefined : `url(#h2-actor-face-${t.id})`}
              />
            </g>
            {controls.viewer?.id === t.id && (
              <circle
                data-house2-token-controls="true"
                r={t.size / 2 + 0.07}
                fill="none"
                stroke="#e4c682"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            <text
              className="h2-actor-name"
              y={t.size / 2 + 0.32}
              textAnchor="middle"
              pointerEvents="none"
            >
              {t.name}
            </text>
          </g>
        ))}
    </g>
  );
}

export function House2TokensPanel({
  controls,
  center,
  focus,
}: {
  controls: House2TokenControls;
  center: { x: number; y: number };
  focus: (t: House2Token) => void;
}) {
  const [query, setQuery] = useState('');
  const selected = controls.tokens.find((t) => t.id === controls.selected && t.can_control);
  return (
    <div className="h2-token-panel">
      <p>
        Traga seus personagens e os pets deles. Arraste seus tokens pelo mapa; a posição é salva ao
        soltar.
      </p>
      <label>
        Buscar personagem ou pet
        <input
          type="search"
          aria-label="Buscar meus tokens"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome do personagem ou pet…"
        />
      </label>
      <button disabled={controls.busy || controls.loading} onClick={() => void controls.refresh()}>
        <RefreshCw size={15} /> Atualizar tokens no mapa
      </button>
      {controls.loading && <p role="status">Carregando seus tokens…</p>}
      {!controls.loading && !controls.sources.length && (
        <p>Você ainda não tem personagens ou pets cadastrados.</p>
      )}
      {controls.sources
        .filter((s) =>
          `${s.name} ${s.character_name}`
            .toLocaleLowerCase('pt-BR')
            .includes(query.toLocaleLowerCase('pt-BR')),
        )
        .map((s) => {
          const placed = controls.tokens.find(
            (t) => t.kind === s.kind && t.source_id === s.id && t.can_control,
          );
          return (
            <article className="h2-token-source" key={s.kind + s.id}>
              <img src={s.image_url} alt="" loading="lazy" />
              <div>
                <strong>{s.name}</strong>
                <span>{s.kind === 'pet' ? `Pet de ${s.character_name}` : 'Seu personagem'}</span>
                <button
                  disabled={controls.busy}
                  aria-label={
                    (placed ? 'Localizar ' : 'Trazer ') +
                    s.name +
                    (placed ? ' no mapa' : ' para o mapa')
                  }
                  onClick={async () => {
                    const t = await controls.bring(s, center);
                    if (t) focus(t);
                  }}
                >
                  {placed ? (
                    <Crosshair size={14} />
                  ) : s.kind === 'pet' ? (
                    <PawPrint size={14} />
                  ) : (
                    <Plus size={14} />
                  )}
                  {placed ? 'Localizar no mapa' : 'Trazer para o mapa'}
                </button>
              </div>
            </article>
          );
        })}
      {selected && (
        <section className="h2-token-adjust" key={selected.id + ':' + selected.revision}>
          <h3>
            <UserRound size={16} /> {selected.name}
          </h3>
          <p>
            Setas movem o token; Shift aumenta o passo. Paredes e portas fechadas bloqueiam a
            passagem.
          </p>
          <label>
            Tamanho do token
            <input
              type="number"
              min=".35"
              max="3"
              step=".05"
              aria-label="Tamanho do token"
              defaultValue={selected.size}
              disabled={controls.busy}
              onBlur={(e) => {
                const size = e.target.valueAsNumber;
                if (Number.isFinite(size) && size >= 0.35 && size <= 3 && size !== selected.size)
                  void controls.update(selected, { size });
              }}
            />
          </label>
          <label>
            Giro do token
            <input
              type="number"
              min="0"
              max="359.99"
              step="1"
              aria-label="Giro do token"
              defaultValue={selected.rotation}
              disabled={controls.busy}
              onBlur={(e) => {
                const rotation = e.target.valueAsNumber;
                if (
                  Number.isFinite(rotation) &&
                  rotation >= 0 &&
                  rotation < 360 &&
                  rotation !== selected.rotation
                )
                  void controls.update(selected, { rotation });
              }}
            />
          </label>
          <button disabled={controls.busy} onClick={() => void controls.remove(selected)}>
            <Trash2 size={15} /> Retirar {selected.name} do mapa
          </button>
        </section>
      )}
    </div>
  );
}

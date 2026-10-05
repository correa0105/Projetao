import { FlashMessage } from './FlashMessage';
import { useEffect, useState, useRef } from 'react';
import { Lock, Plus, Check, Search, Pencil, Crown } from 'lucide-react';
import { api, post } from './api';
import {
  achievementCatalog,
  materials,
  emptyShelf,
  defaultPositions,
  defaultShelfRows,
  type ShelfConfig,
  type AchievementState,
  type AchievementDefinition,
  type AchievementCatalogResponse,
} from '../shared/achievements';
import type { TitlesResponse, CharacterTitle } from '../shared/titles';
import './achievements.css';
import { TitleHall, TitleManager } from './Titles';
import { AchievementEditor } from './AchievementEditor';
function Medal({ code }: { code: string }) {
  return (
    <img
      className={'fantasy-medal achievement-art art-' + code}
      src={'/trophies/' + code + '.png'}
      alt=""
      draggable={false}
    />
  );
}
export function AchievementShelf({
  config,
  selected,
  onSelect,
  onMove,
  onShelfSelect,
  definitions = achievementCatalog,
}: {
  config: ShelfConfig;
  selected?: number | null;
  onSelect?: (index: number) => void;
  onMove?: (index: number, x: number, row?: number) => void;
  onShelfSelect?: (row: number) => void;
  definitions?: readonly Pick<AchievementDefinition, 'code' | 'title'>[];
}) {
  const drag = useRef<{
    index: number;
    start: number;
    startY: number;
    x: number;
    width: number;
    height: number;
    row: number;
    moved: boolean;
  } | null>(null);
  const positions = config.positions ?? defaultPositions(config.slots.length),
    rows = config.rows ?? defaultShelfRows(config.slots.length);
  return (
    <div className="fantasy-cabinet" aria-label="Estante de conquistas">
      <img
        className={'cabinet-art material-' + config.material}
        src="/achievement-cabinet-v3.png"
        alt="Estante medieval entalhada com três prateleiras"
      />
      <div className="cabinet-spaces">
        {onShelfSelect &&
          [0, 1, 2].map((row) => (
            <button
              key={'row' + row}
              className="cabinet-row-target"
              style={{ bottom: [65.8, 44.4, 23.8][row] + '%' }}
              aria-label={`Escolher prateleira ${row + 1}`}
              onClick={() => onShelfSelect(row)}
            />
          ))}
        {config.slots.map((code, i) => {
          const title = definitions.find((a) => a.code === code)?.title;
          if (!code) return null;
          return (
            <button
              key={i}
              type="button"
              style={{
                left: positions[i] + '%',
                bottom: [65.8, 44.4, 23.8][rows[i]] + '%',
                zIndex: selected === i ? 100 : 30 + i,
              }}
              className={'cabinet-slot occupied ' + (selected === i ? 'selected' : '')}
              aria-label={`Posição ${i + 1}: ${title ?? 'vazia'}`}
              aria-pressed={selected === i}
              onPointerDown={(e) => {
                if (!code || !onMove || e.button !== 0) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                const bounds = e.currentTarget.parentElement!.getBoundingClientRect();
                drag.current = {
                  index: i,
                  start: e.clientX,
                  startY: e.clientY,
                  x: positions[i],
                  width: bounds.width,
                  height: bounds.height,
                  row: rows[i],
                  moved: false,
                };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d || d.index !== i) return;
                if (Math.abs(e.clientX - d.start) > 3 || Math.abs(e.clientY - d.startY) > 3)
                  d.moved = true;
                if (d.moved)
                  onMove?.(
                    i,
                    Math.max(0, Math.min(90, d.x + ((e.clientX - d.start) / d.width) * 100)),
                    Math.max(
                      0,
                      Math.min(2, d.row + Math.round((e.clientY - d.startY) / (d.height * 0.21))),
                    ),
                  );
              }}
              onPointerUp={(e) => {
                if (drag.current?.moved) {
                  e.preventDefault();
                  onSelect?.(i);
                }
              }}
              onPointerCancel={() => {
                drag.current = null;
              }}
              onClick={() => {
                const moved = drag.current?.moved;
                drag.current = null;
                if (!moved) onSelect?.(i);
              }}
              onKeyDown={(e) => {
                if (
                  code &&
                  onMove &&
                  ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
                ) {
                  e.preventDefault();
                  if (e.key === 'ArrowUp' || e.key === 'ArrowDown')
                    onMove(
                      i,
                      positions[i],
                      Math.max(0, Math.min(2, rows[i] + (e.key === 'ArrowUp' ? -1 : 1))),
                    );
                  else
                    onMove(
                      i,
                      Math.max(
                        0,
                        Math.min(
                          90,
                          positions[i] + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1),
                        ),
                      ),
                    );
                }
              }}
              disabled={!onSelect}
            >
              {code ? <Medal code={code} /> : <Plus className="empty-position" size={18} />}
              {title && (
                <span className="cabinet-title" role="tooltip">
                  {title}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
export function Achievements({ characterId }: { characterId: string }) {
  const [data, setData] = useState<AchievementState | null>(null),
    [config, setConfig] = useState<ShelfConfig>(emptyShelf);
  const [selected, setSelected] = useState<number | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState('Todas');
  const [query, setQuery] = useState('');
  const [selectedShelf, setSelectedShelf] = useState(0);
  const [page, setPage] = useState(1);
  const [definitions, setDefinitions] = useState<AchievementDefinition[]>(
    achievementCatalog.map((a) => ({ ...a, revision: 0 })),
  );
  const [titles, setTitles] = useState<CharacterTitle[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [editing, setEditing] = useState<AchievementDefinition | null>(null);
  const [creatingTitle, setCreatingTitle] = useState<AchievementDefinition | null>(null);
  const [honorRevision, setHonorRevision] = useState(0);
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  const visible = definitions.filter(
    (a) =>
      normalize(a.title).includes(normalize(query)) &&
      (filter === 'Todas' ||
        (filter === 'Desbloqueadas') === Boolean(data?.unlocked.some((v) => v.code === a.code))),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 5));
  const currentPage = Math.min(page, pages);
  const paginated = visible.slice((currentPage - 1) * 5, currentPage * 5);
  useEffect(() => {
    setPage(1);
  }, [query, filter, characterId]);
  useEffect(() => {
    let active = true;
    setError('');
    Promise.all([
      api<AchievementState>(`/characters/${characterId}/achievements`),
      api<AchievementCatalogResponse>('/achievements/catalog'),
      api<TitlesResponse>('/titles/' + characterId),
    ])
      .then(([r, catalog, titleState]) => {
        if (active) {
          setData(r);
          setConfig(r.shelf);
          setSelected(null);
          setDefinitions(catalog.items);
          setTitles(titleState.items);
          setCanEdit(catalog.can_edit && titleState.can_edit);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [characterId, retry]);
  async function refreshHonors() {
    const [catalog, titleState] = await Promise.all([
      api<AchievementCatalogResponse>('/achievements/catalog'),
      api<TitlesResponse>('/titles/' + characterId),
    ]);
    setDefinitions(catalog.items);
    setTitles(titleState.items);
    setCanEdit(catalog.can_edit && titleState.can_edit);
    setHonorRevision((v) => v + 1);
  }
  useEffect(() => {
    if (saved) {
      const t = setTimeout(() => setSaved(false), 4000);
      return () => clearTimeout(t);
    }
  }, [saved]);
  function change(next: ShelfConfig) {
    setConfig(next);
    setSaved(false);
  }
  function place(code: string | null) {
    const slots = [...config.slots],
      positions = [...(config.positions ?? defaultPositions(slots.length))],
      rows = [...(config.rows ?? defaultShelfRows(slots.length))];
    if (!code) {
      if (selected === null) return;
      slots.splice(selected, 1);
      positions.splice(selected, 1);
      rows.splice(selected, 1);
      setSelected(null);
    } else {
      const existing = slots.indexOf(code);
      if (existing >= 0) {
        rows[existing] = selectedShelf;
        setSelected(existing);
      } else {
        const count = rows.filter((row, i) => row === selectedShelf && slots[i]).length;
        slots.push(code);
        positions.push((count * 15) % 91);
        rows.push(selectedShelf);
        setSelected(slots.length - 1);
      }
    }
    change({ ...config, slots, positions, rows });
  }
  async function save() {
    setBusy(true);
    setError('');
    try {
      const r = await post<AchievementState>(`/characters/${characterId}/achievements`, config);
      setData(r);
      setConfig(r.shelf);
      setSelected(null);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="achievement-content">
        {error ? (
          <>
            <FlashMessage>{error}</FlashMessage>
            <button onClick={() => setRetry((v) => v + 1)}>Tentar novamente</button>
          </>
        ) : (
          <p role="status">Abrindo as conquistas…</p>
        )}
      </div>
    );
  return (
    <div className="achievement-content">
      <div className="cabinet-room-stage">
        <AchievementShelf
          config={config}
          definitions={definitions}
          selected={selected}
          onShelfSelect={
            busy
              ? undefined
              : (row) => {
                  setSelectedShelf(row);
                  setSelected(null);
                }
          }
          onMove={
            busy
              ? undefined
              : (index, x, row) => {
                  const positions = [
                      ...(config.positions ?? defaultPositions(config.slots.length)),
                    ],
                    rows = [...(config.rows ?? defaultShelfRows(config.slots.length))];
                  positions[index] = x;
                  if (row !== undefined) rows[index] = row;
                  change({ ...config, positions, rows });
                }
          }
          onSelect={
            busy
              ? undefined
              : (index) => {
                  setSelectedShelf((config.rows ?? defaultShelfRows(config.slots.length))[index]);
                  setSelected((current) => (current === index ? null : index));
                }
          }
        />
      </div>
      <div className="cabinet-row-choices" aria-label="Prateleira escolhida">
        {[0, 1, 2].map((row) => (
          <button
            key={row}
            className="button outline"
            disabled={busy}
            aria-pressed={selectedShelf === row}
            onClick={() => {
              setSelectedShelf(row);
              if (selected !== null) {
                const rows = [...(config.rows ?? defaultShelfRows(config.slots.length))];
                rows[selected] = row;
                change({ ...config, rows });
              }
            }}
          >
            Prateleira {row + 1}
          </button>
        ))}
        <button
          className="button primary"
          disabled={busy || JSON.stringify(config) === JSON.stringify(data.shelf)}
          onClick={() => void save()}
        >
          Salvar estante
        </button>
        {saved && <span role="status">Estante salva.</span>}
      </div>
      {error && <FlashMessage>{error}</FlashMessage>}
      <details className="cabinet-personalization">
        <summary>
          <span>Personalizar estante</span>
        </summary>
        <div className="cabinet-customization">
          <fieldset disabled={busy}>
            <legend>Acabamento da estante</legend>
            <div className="material-options">
              {Object.entries(materials).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="radio"
                    name="material"
                    checked={config.material === key}
                    onChange={() => change({ ...config, material: key as ShelfConfig['material'] })}
                  />
                  <span className={'wood-swatch material-' + key} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="cabinet-type">
            Tipo de estante
            <select
              aria-label="Tipo de estante"
              value="classic"
              disabled={busy}
              onChange={() => {}}
            >
              <option value="classic">Estante entalhada</option>
              <option value="arcane" disabled>
                Estante arcana — Em breve
              </option>
              <option value="stone" disabled>
                Estante de pedra — Em breve
              </option>
            </select>
          </label>
          <div className="cabinet-actions">
            <span>
              {selected === null
                ? 'Selecione uma posição na estante'
                : `Posição ${selected + 1} selecionada`}
            </span>
            <button
              className="text-button"
              disabled={busy || selected === null || !config.slots[selected]}
              onClick={() => place(null)}
            >
              Esvaziar posição
            </button>
            <button
              className="button primary"
              disabled={busy || JSON.stringify(config) === JSON.stringify(data.shelf)}
              onClick={() => void save()}
            >
              {busy ? 'Salvando…' : 'Salvar estante'}
            </button>
            {saved && <FlashMessage kind="success">Estante salva.</FlashMessage>}
          </div>
        </div>
      </details>
      <section className="fantasy-catalog" aria-labelledby="catalog-title">
        <header>
          <h2 id="catalog-title">Catálogo de conquistas</h2>
          <p>
            Escolha a prateleira e adicione suas conquistas. Arraste entre as prateleiras ou use as
            quatro setas para ajustar. Você pode sobrepor peças, sem limite por prateleira.
          </p>
        </header>
        <label className="achievement-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar conquista por nome"
            placeholder="Buscar conquista por nome…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="catalog-filters" aria-label="Filtrar conquistas">
          {['Todas', 'Desbloqueadas', 'A conquistar'].map((v) => (
            <button
              key={v}
              className="button outline"
              aria-pressed={filter === v}
              onClick={() => setFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>
        {paginated.map((a) => {
          const progress = data.progress[a.code];
          const earned = data.unlocked.find((v) => v.code === a.code),
            position = config.slots.indexOf(a.code);
          return (
            <article
              data-code={a.code}
              data-earned={Boolean(earned)}
              className={'catalog-achievement ' + (!earned ? 'locked' : '')}
              key={a.code}
            >
              <Medal code={a.code} />
              <div>
                <span className="catalog-status">
                  {earned ? <Check size={12} /> : <Lock size={12} />}{' '}
                  {earned ? 'Desbloqueada' : 'Bloqueada'}
                </span>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                {titles
                  .filter((t) => t.goal.kind === 'achievement' && t.goal.achievement === a.code)
                  .map((t) => (
                    <small className="achievement-linked-title" key={t.id}>
                      <Crown size={12} />
                      Título: {t.name}
                    </small>
                  ))}
                {progress &&
                  !earned &&
                  (progress.available ? (
                    <div className="achievement-progress">
                      <span>
                        {progress.current.toLocaleString('pt-BR')} /{' '}
                        {progress.target.toLocaleString('pt-BR')} {progress.unit}
                      </span>
                      <progress
                        aria-label={'Progresso de ' + a.title}
                        value={progress.current}
                        max={progress.target}
                      />
                    </div>
                  ) : (
                    <small className="achievement-pending">
                      Em breve — sistema de reputação ainda não disponível.
                    </small>
                  ))}
                {earned && (
                  <time dateTime={earned.unlocked_at}>
                    {new Date(earned.unlocked_at).toLocaleDateString('pt-BR')}
                  </time>
                )}
              </div>
              {earned && (
                <button
                  className="button outline"
                  disabled={
                    busy ||
                    (position >= 0 &&
                      (config.rows ?? defaultShelfRows(config.slots.length))[position] ===
                        selectedShelf)
                  }
                  onClick={() => place(a.code)}
                >
                  {position >= 0 ? 'Mover para esta prateleira' : 'Exibir na estante'}
                </button>
              )}
              {canEdit && (
                <div className="achievement-admin-actions">
                  <button className="text-button" onClick={() => setEditing(a)}>
                    <Pencil size={13} />
                    Editar conquista
                  </button>
                  <button className="text-button" onClick={() => setCreatingTitle(a)}>
                    <Crown size={13} />
                    Criar título
                  </button>
                </div>
              )}
            </article>
          );
        })}
        {pages > 1 && (
          <nav className="achievement-pagination" aria-label="Paginação das conquistas">
            <button
              className="button outline"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </button>
            <span aria-live="polite">
              Página {currentPage} de {pages}
            </span>
            <button
              className="button outline"
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
        {visible.length === 0 && (
          <p role="status">Nenhuma conquista encontrada com essa busca e filtro.</p>
        )}
      </section>
      <TitleHall
        characterId={characterId}
        definitions={definitions}
        refreshVersion={honorRevision}
        onChanged={refreshHonors}
      />
      {editing && canEdit && (
        <AchievementEditor
          achievement={editing}
          titles={titles}
          close={() => setEditing(null)}
          saved={async () => {
            await refreshHonors();
            setEditing(null);
          }}
        />
      )}
      {creatingTitle && canEdit && (
        <TitleManager
          initialAchievement={creatingTitle}
          definitions={definitions}
          close={() => setCreatingTitle(null)}
          changed={refreshHonors}
        />
      )}
    </div>
  );
}

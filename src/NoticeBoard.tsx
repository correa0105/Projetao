import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Plus, Search, X } from 'lucide-react';
import type { Post } from './types';
import { api } from './api';
import { PaperPicker } from './NoticePaper';
import { PAPER_HEIGHT, PAPER_WIDTH, type PaperStyle } from '../shared/notice-board';
import './notice-board.css';

const categories = [
  { kind: 'mission', title: 'Missões' },
  { kind: 'hook', title: 'Ganchos' },
  { kind: 'event', title: 'Eventos' },
] as const;
const kindLabel = {
  mission: 'Chamado da guilda',
  hook: 'Uma história espera',
  event: 'Encontro da guilda',
};
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const clamp = (value: number) => Math.max(0, Math.min(1, value));
type Position = { paper_x: number; paper_y: number };
const PAGE_SIZE = 6;

export function NoticeBoard({
  posts,
  userId,
  renderPost,
  canCreateEvent,
  onPublish,
  onPaperChange,
  feedback,
}: {
  posts: Post[];
  userId: string;
  renderPost: (post: Post) => ReactNode;
  canCreateEvent: boolean;
  onPublish: (kind: 'mission' | 'event') => void;
  onPaperChange: () => Promise<void>;
  feedback?: string;
}) {
  const [category, setCategory] = useState<Post['kind'] | null>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [filter, setFilter] = useState('Atuais');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: string; position: Position } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{
    id: string;
    pointer: number;
    x: number;
    y: number;
    start: Position;
    position: Position;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);
  const selected = posts.find((p) => p.id === postId);
  const isOpen = !!category || !!selected;
  useEffect(() => {
    if (isOpen && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      heading.current?.focus();
    }
  }, [isOpen]);
  const visible = posts.filter((p) => ['open', 'active'].includes(p.status));
  const items = posts.filter(
    (p) =>
      p.kind === category &&
      normalize(p.title).includes(normalize(query.trim())) &&
      (filter === 'Todos' ||
        (filter === 'Histórico' ? ['completed', 'closed'] : ['open', 'active']).includes(p.status)),
  );
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);

  function openCategory(kind: Post['kind'], target: HTMLElement) {
    returnFocus.current = target;
    setPostId(null);
    setCategory(kind);
    setFilter('Atuais');
    setQuery('');
    setPage(1);
  }
  function close() {
    dialog.current?.close();
    setPostId(null);
    setCategory(null);
    returnFocus.current?.focus();
  }
  async function save(p: Post, position: Position, style: PaperStyle = p.paper_style) {
    if (saving) return;
    setSaving(p.id);
    setError('');
    try {
      await api(`/board/${p.id}/paper`, {
        method: 'PATCH',
        body: JSON.stringify({ ...position, paper_style: style }),
      });
      await onPaperChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
      setDraft(null);
    }
  }
  function begin(e: PointerEvent<HTMLButtonElement>, p: Post) {
    suppressClick.current = false;
    if (p.author_id !== userId || saving || e.button !== 0 || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    const position = { paper_x: p.paper_x, paper_y: p.paper_y };
    drag.current = {
      id: p.id,
      pointer: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      start: position,
      position,
      width: r.width * (1 - PAPER_WIDTH),
      height: r.height * (1 - PAPER_HEIGHT),
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x,
      dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 5) return;
    d.moved = true;
    d.position = {
      paper_x: clamp(d.start.paper_x + dx / d.width),
      paper_y: clamp(d.start.paper_y + dy / d.height),
    };
    setDraft({ id: d.id, position: d.position });
  }
  function end(e: PointerEvent<HTMLButtonElement>, p: Post, cancel = false) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    suppressClick.current = d.moved;
    if (d.moved && !cancel) void save(p, d.position);
    else setDraft(null);
  }
  return (
    <div className="notice-board-page">
      <div className="notice-board" aria-label="Mural de avisos da guilda">
        <div className="notice-board-surface" ref={stage} aria-label="Avisos publicados">
          {visible.map((p, index) => {
            const pos = draft?.id === p.id ? draft.position : p;
            const mine = p.author_id === userId;
            return (
              <button
                type="button"
                key={p.id}
                className={
                  'board-post-paper' +
                  (mine ? ' movable' : '') +
                  (draft?.id === p.id ? ' dragging' : '')
                }
                style={{
                  left: `${pos.paper_x * (1 - PAPER_WIDTH) * 100}%`,
                  top: `${pos.paper_y * (1 - PAPER_HEIGHT) * 100}%`,
                  width: `${PAPER_WIDTH * 100}%`,
                  height: `${PAPER_HEIGHT * 100}%`,
                  zIndex: visible.length - index,
                }}
                data-post-id={p.id}
                aria-label={`Abrir aviso: ${p.title}`}
                title={
                  p.title + (mine ? ' — arraste para mover; use as setas com o foco no papel' : '')
                }
                aria-describedby={mine ? 'notice-drag-help' : undefined}
                onPointerDown={(e) => begin(e, p)}
                onPointerMove={move}
                onPointerUp={(e) => end(e, p)}
                onPointerCancel={(e) => end(e, p, true)}
                onKeyDown={(e) => {
                  if (
                    !mine ||
                    saving ||
                    !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
                  )
                    return;
                  e.preventDefault();
                  const step = e.shiftKey ? 0.1 : 0.025;
                  void save(p, {
                    paper_x: clamp(
                      p.paper_x +
                        (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
                    ),
                    paper_y: clamp(
                      p.paper_y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
                    ),
                  });
                }}
                onClick={(e) => {
                  if (suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  returnFocus.current = e.currentTarget;
                  setCategory(null);
                  setPostId(p.id);
                }}
              >
                <img src={`/notices/paper-${p.paper_style}.png`} alt="" draggable={false} />
                <span className="board-paper-copy">
                  <small>
                    {p.kind === 'mission' ? `Patente ${p.mission_rank}` : kindLabel[p.kind]}
                  </small>
                  <strong>{p.title}</strong>
                  <span>{p.paper_summary || p.description}</span>
                  <em>
                    {p.kind === 'mission'
                      ? `${p.participants} inscrito${p.participants === 1 ? '' : 's'}`
                      : p.kind === 'event'
                        ? 'Evento'
                        : 'Gancho'}
                  </em>
                </span>
              </button>
            );
          })}
        </div>
        <nav className="notice-wood-menu" aria-label="Listas do mural">
          <span>Registros da guilda</span>
          {categories.map((c) => (
            <button
              key={c.kind}
              className={'notice-hanging-sign notice-sign-' + c.kind}
              onClick={(e) => openCategory(c.kind, e.currentTarget)}
              aria-label={'Abrir ' + c.title}
            >
              <img src={`/notices/hanging-${c.kind}-v2.png`} alt="" draggable={false} />
              <span>{c.title}</span>
            </button>
          ))}
          <small id="notice-drag-help">
            Clique para ler. Arraste seus avisos ou mova com as setas do teclado.
          </small>
        </nav>
      </div>
      {(error || saving) && !isOpen && (
        <p className="board-save-status" role={error ? 'alert' : 'status'}>
          {error || 'Salvando posição…'}
        </p>
      )}
      {isOpen && (
        <dialog
          ref={dialog}
          className="notice-category-panel notice-dialog"
          id="notice-category-panel"
          aria-labelledby="notice-panel-title"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const r = e.currentTarget.getBoundingClientRect();
              if (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
              )
                close();
            }
          }}
        >
          <header>
            <h2 id="notice-panel-title" ref={heading} tabIndex={-1}>
              {selected ? 'Aviso do mural' : categories.find((c) => c.kind === category)?.title}
            </h2>
            <button className="icon-button" aria-label="Fechar lista de avisos" onClick={close}>
              <X size={20} />
            </button>
          </header>
          {category && (
            <>
              <div className="notice-panel-toolbar">
                <div className="tabs">
                  {['Atuais', 'Todos', 'Histórico'].map((t) => (
                    <button
                      key={t}
                      aria-pressed={filter === t}
                      className={filter === t ? 'active' : ''}
                      onClick={() => {
                        setFilter(t);
                        setPage(1);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="notice-register-actions">
                  <button className="button primary" onClick={() => onPublish('mission')}>
                    <Plus size={16} />
                    Registrar missão
                  </button>
                  {category === 'event' && canCreateEvent && (
                    <button className="button" onClick={() => onPublish('event')}>
                      Registrar evento
                    </button>
                  )}
                </div>
              </div>
              <label className="notice-search">
                <Search size={16} />
                <input
                  type="search"
                  aria-label="Buscar aviso por nome"
                  placeholder="Buscar por nome…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
            </>
          )}
          {error && (
            <p className="notice-feedback" role="alert">
              {error}
            </p>
          )}
          {feedback && (
            <p className="notice-feedback" role="status">
              {feedback}
            </p>
          )}
          <div className={'quest-grid' + (selected ? ' notice-single' : '')}>
            {selected
              ? renderPost(selected)
              : items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((p) => (
                  <div key={p.id} className="notice-list-entry">
                    {renderPost(p)}
                    {['open', 'active'].includes(p.status) && (
                      <button
                        className="notice-locate"
                        onClick={() => {
                          close();
                          requestAnimationFrame(() =>
                            stage.current
                              ?.querySelector<HTMLButtonElement>(`[data-post-id="${p.id}"]`)
                              ?.focus(),
                          );
                        }}
                      >
                        Localizar no mural
                      </button>
                    )}
                  </div>
                ))}
          </div>
          {selected?.author_id === userId && (
            <details className="notice-paper-settings">
              <summary>Aparência do papel</summary>
              <PaperPicker
                value={selected.paper_style}
                disabled={!!saving}
                onChange={(style) =>
                  void save(
                    selected,
                    { paper_x: selected.paper_x, paper_y: selected.paper_y },
                    style,
                  )
                }
              />
            </details>
          )}
          {category && items.length === 0 && (
            <p className="notice-empty">Nenhum aviso nesta categoria e filtro.</p>
          )}
          {category && pages > 1 && (
            <nav className="notice-pagination" aria-label="Páginas dos avisos">
              <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Anterior
              </button>
              <span>
                {currentPage} de {pages} · {items.length} avisos
              </span>
              <button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>
                Próxima
              </button>
            </nav>
          )}
          {category === 'hook' && (
            <p className="source-note">Ganchos nascem da conclusão de uma missão.</p>
          )}
        </dialog>
      )}
    </div>
  );
}

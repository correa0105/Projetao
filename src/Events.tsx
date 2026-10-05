import { useEffect, useState, type CSSProperties } from 'react';
import { CalendarDays, Clock, ImagePlus, Plus, Save, Sparkles, Trash2, MapPin } from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { FormattedText } from './HomeJournal';
import {
  eventBackgrounds,
  artAnimations,
  artAnimationNames,
  defaultEventScene,
  blankEvent,
  type EventScene,
  type EventInput,
  type GuildEvent,
} from '../shared/events';
import './events.css';
type SceneResponse = { document: EventScene; revision: number; can_edit: boolean };
const date = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(value),
  );
const statusNames = {
  open: 'Em breve',
  active: 'Acontecendo',
  completed: 'Memória da guilda',
  closed: 'Encerrado',
};
function ArtLayers({ scene }: { scene: EventScene }) {
  return (
    <>
      {scene.layers
        .filter((layer) => layer.path)
        .map((layer) => (
          <div
            key={layer.id}
            className="event-art-layer"
            data-animation={layer.animation}
            data-behind={layer.behind}
            style={
              {
                left: layer.x + '%',
                top: layer.y + '%',
                width: layer.width + '%',
                opacity: layer.opacity,
              } as CSSProperties
            }
          >
            <img src={layer.path} alt="" />
          </div>
        ))}
    </>
  );
}
function Countdown({ starts }: { starts: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!starts || new Date(starts).getTime() <= now) return null;
  const minutes = Math.ceil((new Date(starts).getTime() - now) / 60000),
    days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60);
  return (
    <span className="event-countdown">
      <Clock size={13} />
      {days
        ? `${days} dias · ${hours} horas`
        : hours
          ? `${hours} horas · ${minutes % 60} min`
          : `${minutes} min`}{' '}
      para o encontro
    </span>
  );
}
async function upload(file: File) {
  const response = await fetch('/api/event-images', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error);
  return value.path as string;
}
export function Events() {
  const [scene, setScene] = useState<SceneResponse | null>(null),
    [events, setEvents] = useState<GuildEvent[]>([]),
    [canEdit, setCanEdit] = useState(false),
    [error, setError] = useState(''),
    [filter, setFilter] = useState('Todos'),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<GuildEvent | 'new' | null>(null),
    [editScene, setEditScene] = useState(false),
    [hidden, setHidden] = useState(document.hidden);
  async function refresh() {
    const [s, e] = await Promise.all([
      api<SceneResponse>('/events-scene'),
      api<{ can_edit: boolean; items: GuildEvent[] }>('/events'),
    ]);
    setScene(s);
    setEvents(e.items);
    setCanEdit(e.can_edit && s.can_edit);
  }
  useEffect(() => {
    let live = true;
    Promise.all([
      api<SceneResponse>('/events-scene'),
      api<{ can_edit: boolean; items: GuildEvent[] }>('/events'),
    ])
      .then(([s, e]) => {
        if (live) {
          setScene(s);
          setEvents(e.items);
          setCanEdit(e.can_edit && s.can_edit);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      live = false;
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const sceneDoc = scene?.document || defaultEventScene;
  const visible = events.filter(
    (e) =>
      filter === 'Todos' ||
      (filter === 'Próximos'
        ? ['open', 'active'].includes(e.status)
        : ['completed', 'closed'].includes(e.status)),
  );
  const featured =
    visible.find((e) => e.id === selected) ||
    visible.find((e) => e.presentation.featured) ||
    visible[0];
  return (
    <section className="events-page" data-paused={hidden}>
      <div
        className="events-backdrop"
        style={{
          backgroundImage: `url('${sceneDoc.background}')`,
          backgroundPosition: `${sceneDoc.x}% ${sceneDoc.y}%`,
        }}
        aria-hidden="true"
      />
      <div
        className="events-shade"
        style={{ '--events-darkness': sceneDoc.darkness } as CSSProperties}
        aria-hidden="true"
      />
      <div className={'events-atmosphere ' + sceneDoc.ambient} aria-hidden="true">
        {sceneDoc.ambient === 'embers' &&
          Array.from({ length: 20 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  left: ((i * 43) % 100) + '%',
                  animationDelay: -i * 0.8 + 's',
                  animationDuration: 12 + (i % 6) + 's',
                } as CSSProperties
              }
            />
          ))}
      </div>
      <ArtLayers scene={sceneDoc} />
      <div className="events-content">
        <header className="events-heading">
          <div className="event-seal">
            <CalendarDays size={27} />
          </div>
          <span className="eyebrow">OS ENCONTROS DA ALVORADA</span>
          <h1>{sceneDoc.title}</h1>
          <p>{sceneDoc.subtitle}</p>
          {canEdit && (
            <div className="events-admin-actions">
              <button className="button outline" onClick={() => setEditScene(true)}>
                <ImagePlus size={15} />
                Editar cenário
              </button>
              <button className="button primary" onClick={() => setEditing('new')}>
                <Plus size={15} />
                Criar evento
              </button>
            </div>
          )}
        </header>
        {error && <p role="alert">{error}</p>}
        <nav className="events-filters" aria-label="Filtrar eventos">
          {['Todos', 'Próximos', 'Memórias'].map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
          <small>
            {visible.length} {visible.length === 1 ? 'encontro' : 'encontros'}
          </small>
        </nav>
        {featured ? (
          <article className="event-feature" key={featured.id}>
            <div className="event-feature-copy">
              <span className="event-feature-kicker">
                <Sparkles size={13} />
                {featured.presentation.eyebrow || statusNames[featured.status]}
              </span>
              <h2>{featured.title}</h2>
              <div className="event-feature-meta">
                <span className="event-status">{statusNames[featured.status]}</span>
                {featured.starts_at && (
                  <time dateTime={featured.starts_at}>
                    <CalendarDays size={14} />
                    {date(featured.starts_at)}
                  </time>
                )}
                {featured.location && (
                  <span>
                    <MapPin size={14} />
                    {featured.location}
                  </span>
                )}
              </div>
              <Countdown starts={featured.starts_at} />
              <FormattedText text={featured.description} />
              <div className="event-feature-actions">
                {featured.presentation.link && (
                  <a
                    className="button primary"
                    href={featured.presentation.link}
                    {...(featured.presentation.link.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    Participar do encontro →
                  </a>
                )}
                {canEdit && (
                  <button className="text-button" onClick={() => setEditing(featured)}>
                    Editar evento
                  </button>
                )}
              </div>
            </div>
            {featured.presentation.image && (
              <div className="event-feature-art" data-animation={featured.presentation.animation}>
                <img src={featured.presentation.image} alt={featured.title} />
              </div>
            )}
          </article>
        ) : (
          <div className="events-empty">
            <span>Uma página ainda por escrever.</span>
            <p>
              {filter === 'Todos'
                ? 'Os encontros publicados aparecerão neste salão.'
                : 'Nenhum encontro nesta seleção.'}
            </p>
            {canEdit && (
              <button className="text-button" onClick={() => setEditing('new')}>
                Escrever o primeiro evento →
              </button>
            )}
          </div>
        )}
        {visible.length > 1 && (
          <div className="events-agenda" aria-label="Agenda de encontros">
            {visible.map((e) => (
              <button
                key={e.id}
                aria-pressed={featured?.id === e.id}
                onClick={() => setSelected(e.id)}
              >
                <span className="event-agenda-date">
                  {e.starts_at
                    ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(
                        new Date(e.starts_at),
                      )
                    : 'Sem data'}
                </span>
                <strong>{e.title}</strong>
                <small>{statusNames[e.status]}</small>
              </button>
            ))}
          </div>
        )}
        <footer className="events-footer">Cada encontro deixa uma história.</footer>
      </div>
      {editScene && scene && canEdit && (
        <SceneEditor
          value={scene}
          close={() => setEditScene(false)}
          saved={async () => {
            await refresh();
            setEditScene(false);
          }}
        />
      )}
      {editing && canEdit && (
        <EventEditor
          item={editing === 'new' ? undefined : editing}
          close={() => setEditing(null)}
          saved={async () => {
            await refresh();
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
export function EventImageField({
  value,
  onChange,
  label,
  disabled,
  onBusy,
  onError,
  gallery = eventBackgrounds,
  emptyLabel = 'Sem imagem',
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onError: (error: string) => void;
  gallery?: { path: string; label: string }[];
  emptyLabel?: string;
}) {
  return (
    <div className="event-image-field">
      <label>
        {label}
        <select
          aria-label={label}
          value={gallery.some((b) => b.path === value) ? value : value ? 'custom' : ''}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value !== 'custom') onChange(e.target.value);
          }}
        >
          <option value="">{emptyLabel}</option>
          {gallery.map((b) => (
            <option key={b.path} value={b.path}>
              {b.label}
            </option>
          ))}
          {value && !gallery.some((b) => b.path === value) && (
            <option value="custom">Imagem enviada</option>
          )}
        </select>
      </label>
      <label className="button outline">
        Enviar imagem
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          disabled={disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onBusy(true);
            onError('');
            try {
              onChange(await upload(file));
            } catch (error) {
              onError((error as Error).message);
            } finally {
              onBusy(false);
              e.target.value = '';
            }
          }}
        />
      </label>
    </div>
  );
}
export function EventEditor({
  item,
  close,
  saved,
  initialDate,
}: {
  item?: GuildEvent;
  close: () => void;
  saved: () => Promise<void>;
  initialDate?: string;
}) {
  const [draft, setDraft] = useState<EventInput>(
      item
        ? {
            title: item.title,
            description: item.description,
            starts_at: item.starts_at,
            location: item.location,
            status: item.status,
            presentation: { ...item.presentation },
          }
        : { ...structuredClone(blankEvent), starts_at: initialDate || null },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(false);
  const change = (value: Partial<EventInput>) => setDraft((d) => ({ ...d, ...value }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      if (item)
        await api('/events/' + item.id, {
          method: 'PUT',
          body: JSON.stringify({ ...draft, revision: item.event_revision }),
        });
      else await post('/events', draft);
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await api('/events/' + item!.id, {
        method: 'DELETE',
        body: JSON.stringify({ revision: item!.event_revision }),
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const local = draft.starts_at
    ? new Date(
        new Date(draft.starts_at).getTime() - new Date(draft.starts_at).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : '';
  return (
    <Modal
      title={item ? 'Editar evento' : 'Criar evento'}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="event-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Título
            <input
              required
              minLength={2}
              maxLength={100}
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label>
            Descrição
            <textarea
              aria-label="Descrição"
              required
              rows={7}
              maxLength={3000}
              value={draft.description}
              onChange={(e) => change({ description: e.target.value })}
            />
            <small>Use **destaque**, *ênfase*, ## subtítulo, &gt; citação ou - lista.</small>
          </label>
          <div className="event-editor-grid">
            <label>
              Data e horário
              <input
                type="datetime-local"
                value={local}
                onChange={(e) =>
                  change({
                    starts_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </label>
            <label>
              Local
              <input
                maxLength={100}
                value={draft.location}
                onChange={(e) => change({ location: e.target.value })}
              />
            </label>
            <label>
              Estado
              <select
                value={draft.status}
                onChange={(e) => change({ status: e.target.value as EventInput['status'] })}
              >
                {Object.entries(statusNames).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chamada curta
              <input
                maxLength={80}
                value={draft.presentation.eyebrow}
                onChange={(e) =>
                  change({ presentation: { ...draft.presentation, eyebrow: e.target.value } })
                }
              />
            </label>
          </div>
          <EventImageField
            label="Arte do evento"
            value={draft.presentation.image}
            onChange={(image) => change({ presentation: { ...draft.presentation, image } })}
            disabled={busy}
            onBusy={setBusy}
            onError={setError}
          />
          <label>
            Animação da arte
            <select
              aria-label="Animação da arte"
              value={draft.presentation.animation}
              onChange={(e) =>
                change({
                  presentation: {
                    ...draft.presentation,
                    animation: e.target.value as EventInput['presentation']['animation'],
                  },
                })
              }
            >
              {artAnimations.map((a) => (
                <option key={a} value={a}>
                  {artAnimationNames[a]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Link para participar
            <input
              maxLength={2000}
              value={draft.presentation.link}
              placeholder="#board ou https://…"
              onChange={(e) =>
                change({ presentation: { ...draft.presentation, link: e.target.value } })
              }
            />
          </label>
          <label className="event-check">
            <input
              type="checkbox"
              checked={draft.presentation.featured}
              onChange={(e) =>
                change({ presentation: { ...draft.presentation, featured: e.target.checked } })
              }
            />
            Destacar este encontro
          </label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="event-editor-actions">
          {item &&
            (confirm ? (
              <button type="button" disabled={busy} onClick={() => void remove()}>
                Confirmar exclusão de “{item.title}”
              </button>
            ) : (
              <button className="text-button" type="button" onClick={() => setConfirm(true)}>
                <Trash2 size={14} />
                Excluir evento
              </button>
            ))}
          <button className="button primary" disabled={busy}>
            <Save size={14} />
            {busy ? 'Salvando…' : 'Salvar evento'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SceneEditor({
  value,
  close,
  saved,
}: {
  value: SceneResponse;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(value.document)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const change = (patch: Partial<EventScene>) => setDraft((d) => ({ ...d, ...patch }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/events-scene', {
        method: 'PUT',
        body: JSON.stringify({ document: draft, revision: value.revision }),
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Editar cenário dos eventos"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="event-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div
          className="event-scene-preview"
          style={{
            backgroundImage: `linear-gradient(#050809${Math.round(draft.darkness * 255)
              .toString(16)
              .padStart(2, '0')},#05080955),url('${draft.background}')`,
            backgroundPosition: `${draft.x}% ${draft.y}%`,
          }}
        >
          <ArtLayers scene={draft} />
          <span>{draft.title}</span>
        </div>
        <fieldset disabled={busy}>
          <label>
            Título da página
            <input
              maxLength={140}
              required
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label>
            Apresentação
            <textarea
              maxLength={500}
              rows={3}
              value={draft.subtitle}
              onChange={(e) => change({ subtitle: e.target.value })}
            />
          </label>
          <EventImageField
            label="Fundo de tela inteira"
            value={draft.background}
            onChange={(background) => change({ background })}
            disabled={busy}
            onBusy={setBusy}
            onError={setError}
          />
          <div className="event-editor-grid">
            {(['x', 'y', 'darkness'] as const).map((field) => (
              <label key={field}>
                {field === 'x'
                  ? 'Enquadramento horizontal'
                  : field === 'y'
                    ? 'Enquadramento vertical'
                    : 'Escurecer fundo'}
                <input
                  type="range"
                  min={0}
                  max={field === 'darkness' ? 0.95 : 100}
                  step={field === 'darkness' ? 0.01 : 1}
                  value={draft[field]}
                  onChange={(e) => change({ [field]: Number(e.target.value) })}
                />
              </label>
            ))}
            <label>
              Ambientação
              <select
                aria-label="Ambientação"
                value={draft.ambient}
                onChange={(e) => change({ ambient: e.target.value as EventScene['ambient'] })}
              >
                <option value="embers">Brasas douradas</option>
                <option value="mist">Névoa suave</option>
                <option value="none">Sem partículas</option>
              </select>
            </label>
          </div>
          <h3>Artes na cena</h3>
          <p>
            Envie imagens com transparência para compor a tela. Ajuste a posição e dê movimento a
            cada arte.
          </p>
          {draft.layers.map((layer, index) => (
            <section className="event-layer-editor" key={layer.id}>
              <header>
                <strong>Arte {index + 1}</strong>
                <button
                  type="button"
                  aria-label={`Excluir arte ${index + 1}`}
                  onClick={() => change({ layers: draft.layers.filter((l) => l.id !== layer.id) })}
                >
                  <Trash2 size={14} />
                </button>
              </header>
              <EventImageField
                label="Imagem da arte"
                value={layer.path}
                disabled={busy}
                onBusy={setBusy}
                onError={setError}
                onChange={(path) =>
                  change({
                    layers: draft.layers.map((l) => (l.id === layer.id ? { ...l, path } : l)),
                  })
                }
              />
              <div className="event-editor-grid">
                {(['x', 'y', 'width', 'opacity'] as const).map((field) => (
                  <label key={field}>
                    {
                      { x: 'Horizontal', y: 'Vertical', width: 'Tamanho', opacity: 'Opacidade' }[
                        field
                      ]
                    }
                    <input
                      type="range"
                      min={field === 'width' ? 2 : field === 'opacity' ? 0.05 : 0}
                      max={field === 'opacity' ? 1 : 100}
                      step={field === 'opacity' ? 0.05 : 1}
                      value={layer[field]}
                      onChange={(e) =>
                        change({
                          layers: draft.layers.map((l) =>
                            l.id === layer.id ? { ...l, [field]: Number(e.target.value) } : l,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
                <label>
                  Movimento
                  <select
                    value={layer.animation}
                    onChange={(e) =>
                      change({
                        layers: draft.layers.map((l) =>
                          l.id === layer.id
                            ? { ...l, animation: e.target.value as typeof layer.animation }
                            : l,
                        ),
                      })
                    }
                  >
                    {artAnimations.map((a) => (
                      <option value={a} key={a}>
                        {artAnimationNames[a]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="event-check">
                  <input
                    type="checkbox"
                    checked={layer.behind}
                    onChange={(e) =>
                      change({
                        layers: draft.layers.map((l) =>
                          l.id === layer.id ? { ...l, behind: e.target.checked } : l,
                        ),
                      })
                    }
                  />
                  Atrás do texto
                </label>
              </div>
            </section>
          ))}
          <button
            type="button"
            className="button outline"
            disabled={draft.layers.length >= 60}
            onClick={() =>
              change({
                layers: [
                  ...draft.layers,
                  {
                    id: crypto.randomUUID(),
                    path: '',
                    x: 75,
                    y: 58,
                    width: 25,
                    opacity: 1,
                    animation: 'float',
                    behind: true,
                  },
                ],
              })
            }
          >
            <Plus size={14} />
            Adicionar arte
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <div className="event-editor-actions">
          <button className="button primary" disabled={busy}>
            <Save size={14} />
            {busy ? 'Salvando…' : 'Salvar cenário'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

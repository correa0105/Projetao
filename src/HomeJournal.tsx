import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarDays,
  ImagePlus,
  Plus,
  Save,
  X,
} from 'lucide-react';
import { api, post } from './api';
import {
  homeImages,
  safeHomeLink,
  type HomeUpdate,
  type HomeUpdateInput,
} from '../shared/home-updates';
import type { Post } from './types';
import './home-journal.css';
const schedule = (date: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(date),
  );
const blank: HomeUpdateInput = {
  title: '',
  body: '',
  kind: 'article',
  layout: 'feature',
  image_path: homeImages[0].path,
  image_side: 'right',
  image_fit: 'cover',
  link: '',
  starts_at: null,
  location: '',
  text_align: 'left',
  text_size: 'normal',
  position: 0,
};
const introductions: HomeUpdate[] = [
  {
    ...blank,
    id: 'intro-world',
    author_id: '',
    author_name: 'Alvorada Cinzenta',
    can_edit: false,
    created_at: '',
    revision: 1,
    title: 'O mundo espera por uma nova história.',
    body: 'Entre montanhas, reinos e caminhos esquecidos, há sempre uma próxima aventura. Explore as terras da Alvorada e descubra onde a sua jornada continua.',
    link: '#world',
  },
  {
    ...blank,
    id: 'intro-camp',
    author_id: '',
    author_name: 'Alvorada Cinzenta',
    can_edit: false,
    created_at: '',
    revision: 1,
    title: 'Quem seguirá a próxima trilha?',
    body: 'Reúna seus personagens. Toda grande história começa com bons companheiros.',
    layout: 'landscape',
    image_path: homeImages[1].path,
    link: '#characters',
  },
  {
    ...blank,
    id: 'intro-board',
    author_id: '',
    author_name: 'Alvorada Cinzenta',
    can_edit: false,
    created_at: '',
    revision: 1,
    title: 'Um chamado na taverna.',
    body: 'Veja as missões publicadas pela guilda e encontre a sua próxima mesa.',
    layout: 'portrait',
    image_path: homeImages[2].path,
    link: '#board',
  },
];
// Plain text with a small, safe formatting vocabulary. Never render submitted HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && safeHomeLink(link[2]))
      return (
        <a
          key={i}
          href={link[2]}
          {...(link[2].startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {link[1]}
        </a>
      );
    return part;
  });
}
function FormattedText({ text }: { text: string }) {
  return (
    <div className="journal-rich-text">
      {text.split('\n').map((line, i) =>
        line.startsWith('## ') ? (
          <h3 key={i}>{inline(line.slice(3))}</h3>
        ) : line.startsWith('> ') ? (
          <blockquote key={i}>{inline(line.slice(2))}</blockquote>
        ) : line.startsWith('- ') ? (
          <p className="journal-list-line" key={i}>
            • {inline(line.slice(2))}
          </p>
        ) : line ? (
          <p key={i}>{inline(line)}</p>
        ) : (
          <div className="journal-paragraph-gap" key={i} />
        ),
      )}
    </div>
  );
}
function MeetingCalendar({ item }: { item: HomeUpdateInput }) {
  if (!item.starts_at) return null;
  const download = () => {
    const escape = (v: string) =>
      v
        .replaceAll('\\', '\\\\')
        .replaceAll('\n', '\\n')
        .replaceAll(',', '\\,')
        .replaceAll(';', '\\;');
    const date = (v: Date) =>
      v
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/\.\d{3}/, '');
    const start = new Date(item.starts_at!);
    const end = new Date(start.getTime() + 3600000);
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Alvorada Cinzenta//Reuniões//PT-BR',
      'BEGIN:VEVENT',
      'UID:' + crypto.randomUUID() + '@alvorada',
      'DTSTAMP:' + date(new Date()),
      'DTSTART:' + date(start),
      'DTEND:' + date(end),
      'SUMMARY:' + escape(item.title),
      'DESCRIPTION:' + escape(item.body),
      'LOCATION:' + escape(item.location),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reuniao-alvorada.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button className="text-button" onClick={download}>
      <CalendarDays size={14} />
      Adicionar ao calendário
    </button>
  );
}
function JournalCard({ item, onEdit }: { item: HomeUpdate; onEdit?: (item: HomeUpdate) => void }) {
  const image = item.image_path ? (
    <img
      src={item.image_path}
      alt={item.title}
      loading="lazy"
      style={{ objectFit: item.image_fit }}
    />
  ) : null;
  return (
    <article
      className={'journal-card journal-' + item.layout}
      data-side={item.image_side}
      data-align={item.text_align}
      data-size={item.text_size}
    >
      {image &&
        (item.link ? (
          <a
            className="journal-image"
            href={item.link}
            aria-label={item.title}
            {...(item.link.startsWith('http')
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {image}
            <span className="journal-image-link">
              <ArrowUpRight size={18} />
            </span>
          </a>
        ) : (
          <div className="journal-image">{image}</div>
        ))}
      <div className="journal-copy">
        <div className="journal-card-meta">
          <span>
            {item.kind === 'meeting'
              ? 'Encontro da guilda'
              : item.kind === 'image'
                ? 'Pelas terras da Alvorada'
                : 'Crônicas da guilda'}
          </span>
          {item.can_edit && onEdit && (
            <button className="text-button" onClick={() => onEdit(item)}>
              Editar
            </button>
          )}
        </div>
        <h2>{item.title}</h2>
        {item.kind === 'meeting' && item.starts_at && (
          <div className="journal-meeting">
            <CalendarDays size={16} />
            <time dateTime={item.starts_at}>{schedule(item.starts_at)}</time>
            {item.location && <span>{item.location}</span>}
          </div>
        )}
        <FormattedText text={item.body} />
        <div className="journal-card-bottom">
          {item.link && (
            <a
              className="journal-read-link"
              href={item.link}
              {...(item.link.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              Explorar <ArrowUpRight size={15} />
            </a>
          )}
          {item.kind === 'meeting' && <MeetingCalendar item={item} />}
        </div>
        {item.author_id && (
          <small className="journal-byline">
            {item.author_name} · {new Date(item.created_at).toLocaleDateString('pt-BR')}
          </small>
        )}
      </div>
    </article>
  );
}
export function HomeJournal({ upcoming }: { upcoming: Post[] }) {
  const [items, setItems] = useState<HomeUpdate[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [editing, setEditing] = useState<HomeUpdate | null | undefined>(),
    [draft, setDraft] = useState<HomeUpdateInput>(blank),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false),
    [preview, setPreview] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const text = useRef<HTMLTextAreaElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const refresh = async () => {
    try {
      setItems(await api<HomeUpdate[]>('/home-updates'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (editing !== undefined) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
    }
  }, [editing]);
  const open = (item: HomeUpdate | null) => {
    setEditing(item);
    setDraft(
      item
        ? { ...item }
        : { ...blank, position: items.length ? Math.min(...items.map((i) => i.position)) - 1 : 0 },
    );
    setError('');
    setPreview(false);
    setConfirmDelete(false);
  };
  const change = <K extends keyof HomeUpdateInput>(key: K, value: HomeUpdateInput[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const format = (before: string, after = '') => {
    const field = text.current;
    if (!field) return;
    const start = field.selectionStart,
      end = field.selectionEnd,
      selection = draft.body.slice(start, end) || 'texto';
    change('body', draft.body.slice(0, start) + before + selection + after + draft.body.slice(end));
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selection.length);
    });
  };
  const upload = async (file: File) => {
    setUploading(true);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 8 MB.');
      const result = await api<{ path: string }>('/home-images', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      change('image_path', result.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      if (editing)
        await api('/home-updates/' + editing.id, { method: 'PUT', body: JSON.stringify(draft) });
      else await post('/home-updates', draft);
      await refresh();
      setEditing(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await api('/home-updates/' + editing.id, { method: 'DELETE' });
      await refresh();
      setEditing(undefined);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const shown = items.length ? items : introductions;
  return (
    <section className="home-journal">
      <div className="page-header-spacer" aria-hidden="true" />
      <header className="journal-masthead">
        <div>
          <span className="journal-eyebrow">Notícias · encontros · histórias</span>
          <h1>O Diário da Alvorada</h1>
          <p>O que acontece entre uma aventura e a próxima.</p>
        </div>
        <button className="button outline" onClick={() => open(null)}>
          <Plus size={16} />
          Nova publicação
        </button>
      </header>
      {error && editing === undefined && (
        <div role="alert" className="journal-error">
          {error}
          <button className="text-button" onClick={() => void refresh()}>
            Tentar novamente
          </button>
        </div>
      )}
      <div className="journal-grid">
        {shown.map((item) => (
          <JournalCard key={item.id} item={item} onEdit={open} />
        ))}
      </div>
      {loading && <p role="status">Lendo as últimas crônicas…</p>}
      <section className="journal-agenda">
        <header>
          <div>
            <span className="journal-eyebrow">A próxima jornada</span>
            <h2>Na agenda da guilda</h2>
          </div>
          <a href="#board" className="journal-read-link">
            Ver mural <ArrowUpRight size={16} />
          </a>
        </header>
        {upcoming.length ? (
          upcoming.map((item) => (
            <a className="journal-agenda-entry" href="#missions" key={item.id}>
              <CalendarDays size={20} />
              <div>
                <strong>{item.title}</strong>
                <time dateTime={item.starts_at!}>{schedule(item.starts_at!)}</time>
              </div>
              <ArrowUpRight size={17} />
            </a>
          ))
        ) : (
          <p>
            As mesas das próximas 24 horas aparecerão aqui. Encontros também podem ser marcados em
            uma nova publicação.
          </p>
        )}
      </section>
      <dialog
        ref={dialog}
        className="journal-editor"
        onCancel={(e) => {
          if (busy || uploading) e.preventDefault();
          else setEditing(undefined);
        }}
      >
        <header>
          <div>
            <span className="journal-eyebrow">Sua voz na Alvorada</span>
            <h2>{editing ? 'Editar publicação' : 'Nova publicação'}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Fechar editor"
            disabled={busy || uploading}
            onClick={() => setEditing(undefined)}
          >
            <X size={20} />
          </button>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy || uploading}>
            <div className="journal-editor-fields">
              <label>
                Título
                <input
                  required
                  minLength={2}
                  maxLength={140}
                  value={draft.title}
                  onChange={(e) => change('title', e.target.value)}
                />
              </label>
              <div className="journal-form-row">
                <label>
                  Tipo
                  <select
                    aria-label="Tipo"
                    value={draft.kind}
                    onChange={(e) => change('kind', e.target.value as HomeUpdateInput['kind'])}
                  >
                    <option value="article">Artigo / atualização</option>
                    <option value="meeting">Reunião</option>
                    <option value="image">Imagem com link</option>
                  </select>
                </label>
                <label>
                  Formato
                  <select
                    aria-label="Formato"
                    value={draft.layout}
                    onChange={(e) => change('layout', e.target.value as HomeUpdateInput['layout'])}
                  >
                    <option value="feature">Destaque com imagem lateral</option>
                    <option value="landscape">Cartão em paisagem</option>
                    <option value="portrait">Cartão em retrato</option>
                    <option value="compact">Nota compacta</option>
                  </select>
                </label>
              </div>
              {draft.kind === 'meeting' && (
                <div className="journal-form-row">
                  <label>
                    Data e horário
                    <input
                      required
                      type="datetime-local"
                      value={draft.starts_at ? localDate(draft.starts_at) : ''}
                      onChange={(e) =>
                        change(
                          'starts_at',
                          e.target.value ? new Date(e.target.value).toISOString() : null,
                        )
                      }
                    />
                  </label>
                  <label>
                    Local / plataforma
                    <input
                      maxLength={160}
                      value={draft.location}
                      onChange={(e) => change('location', e.target.value)}
                      placeholder="Taverna, Discord, mesa presencial…"
                    />
                  </label>
                </div>
              )}
              <label>
                Texto
                <div className="journal-format-tools">
                  <button type="button" title="Negrito" onClick={() => format('**', '**')}>
                    <b>B</b>
                  </button>
                  <button type="button" title="Itálico" onClick={() => format('*', '*')}>
                    <i>I</i>
                  </button>
                  <button type="button" onClick={() => format('\n## ')}>
                    Título
                  </button>
                  <button type="button" onClick={() => format('\n- ')}>
                    Lista
                  </button>
                  <button type="button" onClick={() => format('\n> ')}>
                    Citação
                  </button>
                  <button type="button" onClick={() => format('[', '](#world)')}>
                    Link
                  </button>
                </div>
                <textarea
                  ref={text}
                  rows={7}
                  maxLength={8000}
                  value={draft.body}
                  onChange={(e) => change('body', e.target.value)}
                  placeholder="Escreva a atualização da guilda…"
                />
              </label>
              <div className="journal-form-row">
                <label>
                  Alinhamento
                  <select
                    aria-label="Alinhamento"
                    value={draft.text_align}
                    onChange={(e) => change('text_align', e.target.value as 'left' | 'center')}
                  >
                    <option value="left">À esquerda</option>
                    <option value="center">Centralizado</option>
                  </select>
                </label>
                <label>
                  Tamanho do texto
                  <select
                    aria-label="Tamanho do texto"
                    value={draft.text_size}
                    onChange={(e) => change('text_size', e.target.value as 'normal' | 'large')}
                  >
                    <option value="normal">Normal</option>
                    <option value="large">Maior</option>
                  </select>
                </label>
              </div>
              <label>
                Imagem
                <select
                  aria-label="Imagem"
                  value={
                    homeImages.some((i) => i.path === draft.image_path)
                      ? draft.image_path
                      : draft.image_path
                        ? 'uploaded'
                        : ''
                  }
                  onChange={(e) => {
                    if (e.target.value !== 'uploaded') change('image_path', e.target.value);
                  }}
                >
                  <option value="">Sem imagem</option>
                  {homeImages.map((i) => (
                    <option key={i.path} value={i.path}>
                      {i.label}
                    </option>
                  ))}
                  {draft.image_path.startsWith('/api/') && (
                    <option value="uploaded">Imagem enviada</option>
                  )}
                </select>
              </label>
              <label className="journal-upload">
                <ImagePlus size={18} />
                {uploading ? 'Enviando imagem…' : 'Enviar uma imagem sua'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={(e) => {
                    if (e.target.files?.[0]) void upload(e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              <div className="journal-form-row">
                <label>
                  Lado da imagem
                  <select
                    aria-label="Lado da imagem"
                    value={draft.image_side}
                    onChange={(e) => change('image_side', e.target.value as 'left' | 'right')}
                  >
                    <option value="right">Direita</option>
                    <option value="left">Esquerda</option>
                  </select>
                </label>
                <label>
                  Enquadramento
                  <select
                    aria-label="Enquadramento"
                    value={draft.image_fit}
                    onChange={(e) => change('image_fit', e.target.value as 'contain' | 'cover')}
                  >
                    <option value="contain">Imagem inteira</option>
                    <option value="cover">Preencher o quadro</option>
                  </select>
                </label>
              </div>
              <label>
                Ao clicar na imagem, abrir
                <input
                  maxLength={2000}
                  value={draft.link}
                  onChange={(e) => change('link', e.target.value)}
                  placeholder="#world, #shop ou https://…"
                />
              </label>
              <div className="journal-order">
                <span>Ordem na página</span>
                <button
                  type="button"
                  aria-label="Mover publicação para cima"
                  onClick={() => change('position', Math.max(-10000, draft.position - 1))}
                >
                  <ArrowUp size={16} />
                </button>
                <output>{draft.position}</output>
                <button
                  type="button"
                  aria-label="Mover publicação para baixo"
                  onClick={() => change('position', Math.min(10000, draft.position + 1))}
                >
                  <ArrowDown size={16} />
                </button>
              </div>
            </div>
          </fieldset>
          {error && (
            <p className="journal-error" role="alert">
              {error}
            </p>
          )}
          <div className="journal-editor-actions">
            <button type="button" className="button outline" onClick={() => setPreview(!preview)}>
              {preview ? 'Ocultar prévia' : 'Visualizar'}
            </button>
            <button className="button primary" disabled={busy || uploading}>
              {busy ? (
                'Salvando…'
              ) : (
                <>
                  <Save size={16} />
                  Publicar
                </>
              )}
            </button>
            {editing && (
              <button
                type="button"
                className="text-button journal-delete"
                disabled={busy}
                onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
              >
                {confirmDelete ? 'Confirmar remoção' : 'Remover publicação'}
              </button>
            )}
          </div>
          {preview && (
            <div className="journal-preview">
              <JournalCard
                item={{
                  ...draft,
                  id: 'preview',
                  author_id: '',
                  author_name: '',
                  can_edit: false,
                  created_at: '',
                  revision: 1,
                }}
              />
            </div>
          )}
        </form>
      </dialog>
    </section>
  );
}
function localDate(value: string) {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

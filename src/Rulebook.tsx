import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  History,
  ImagePlus,
  List,
  LoaderCircle,
  PenLine,
  Plus,
  Quote,
  Save,
  Search,
  Table2,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import {
  RULEBOOK_MAX_DOCUMENT_BYTES,
  RULEBOOK_MAX_IMAGE_BYTES,
  rulebookDocumentSchema,
  type RuleArticle,
  type RuleBlock,
  type RuleChapter,
  type RulebookDocument,
  type RulebookImage,
  type RulebookResponse,
} from '../shared/rulebook';
import { FlashMessage } from './FlashMessage';
import './rulebook.css';

type Notice = { id: number; text: string; kind: 'success' | 'error' | 'info' };
type Confirmation = { title: string; detail: string; action: string; run: () => void };
type Revision = { revision: number; title: string; updated_at: string };
type ArticleLocation = {
  chapter: RuleChapter;
  article: RuleArticle;
  chapterIndex: number;
  articleIndex: number;
};
const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
const number = (value: number) => String(value).padStart(2, '0');
const shorten = (value: string, length = 80) =>
  value.length > length ? value.slice(0, length).trim() + '…' : value;
const blockNames: Record<RuleBlock['type'], string> = {
  text: 'Texto',
  callout: 'Citação / nota',
  list: 'Lista',
  table: 'Tabela',
  image: 'Imagem',
};
const blockIcons = { text: Type, callout: Quote, list: List, table: Table2, image: ImagePlus };
const newId = () => crypto.randomUUID();
function reorder<T>(items: T[], index: number, offset: number) {
  const copy = [...items];
  const next = index + offset;
  if (next < 0 || next >= copy.length) return copy;
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}
function blockText(block: RuleBlock) {
  if (block.type === 'text') return block.text;
  if (block.type === 'callout') return block.title + ' ' + block.text;
  if (block.type === 'list') return block.items.join(' ');
  if (block.type === 'table') return block.columns.join(' ') + ' ' + block.rows.flat().join(' ');
  return block.caption;
}
function createBlock(type: RuleBlock['type']): RuleBlock {
  const id = newId();
  if (type === 'text') return { id, type, text: '' };
  if (type === 'callout') return { id, type, title: '', text: '', tone: 'note' };
  if (type === 'list') return { id, type, items: [''], ordered: false };
  if (type === 'table') return { id, type, columns: ['Título', 'Descrição'], rows: [['', '']] };
  return { id, type, src: '', caption: '' };
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api/rulebook' + path, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Não foi possível concluir a solicitação.') as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }
  return data as T;
}
function fileData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler essa imagem.'));
    reader.readAsDataURL(file);
  });
}
function download(document: RulebookDocument) {
  const blob = new Blob([JSON.stringify(document)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = window.document.createElement('a');
  anchor.href = href;
  anchor.download =
    (normalize(document.title)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'livro-de-regras') + '.json';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={'rb-field ' + className}>
      <span>{label}</span>
      {children}
    </label>
  );
}
function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  danger = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={'rb-icon-button' + (danger ? ' rb-danger' : '')}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
function OrderButtons({
  name,
  index,
  total,
  move,
  remove,
  removeLabel,
}: {
  name: string;
  index: number;
  total: number;
  move: (offset: number) => void;
  remove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="rb-order-buttons">
      <IconButton
        label={'Mover ' + name + ' para cima'}
        disabled={index === 0}
        onClick={() => move(-1)}
      >
        <ArrowUp size={14} />
      </IconButton>
      <IconButton
        label={'Mover ' + name + ' para baixo'}
        disabled={index === total - 1}
        onClick={() => move(1)}
      >
        <ArrowDown size={14} />
      </IconButton>
      {remove &&
        (removeLabel ? (
          <button
            type="button"
            className="rb-item-action rb-danger"
            aria-label={'Excluir ' + name}
            onClick={remove}
          >
            <Trash2 size={14} />
            {removeLabel}
          </button>
        ) : (
          <IconButton label={'Excluir ' + name} danger onClick={remove}>
            <Trash2 size={14} />
          </IconButton>
        ))}
    </div>
  );
}
function ItemActions({
  name,
  edit,
  remove,
  disabled,
  children,
}: {
  name: string;
  edit: () => void;
  remove: () => void;
  disabled: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rb-item-actions">
      <button
        type="button"
        className="rb-item-action"
        aria-label={'Editar ' + name}
        onClick={edit}
        disabled={disabled}
      >
        <PenLine size={13} />
        Editar
      </button>
      <button
        type="button"
        className="rb-item-action rb-danger"
        aria-label={'Excluir ' + name}
        onClick={remove}
        disabled={disabled}
      >
        <Trash2 size={13} />
        Excluir
      </button>
      {children}
    </div>
  );
}
function Confirm({ value, close }: { value: Confirmation; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="rb-confirm"
      aria-labelledby="rb-confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="rb-confirm-inner">
        <span className="rb-kicker">Revisar alteração</span>
        <h2 id="rb-confirm-title">{value.title}</h2>
        <p>{value.detail}</p>
        <div className="rb-confirm-actions">
          <button type="button" className="rb-button rb-button-quiet" autoFocus onClick={close}>
            Manter como está
          </button>
          <button
            type="button"
            className="rb-button rb-button-primary"
            onClick={() => {
              value.run();
              close();
            }}
          >
            {value.action}
          </button>
        </div>
      </div>
    </dialog>
  );
}
function HistoryDialog({
  revisions,
  loading,
  selected,
  close,
  load,
}: {
  revisions: Revision[];
  loading: boolean;
  selected: number | null;
  close: () => void;
  load: (revision: Revision) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="rb-confirm rb-history"
      aria-labelledby="rb-history-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="rb-confirm-inner">
        <div className="rb-history-heading">
          <span className="rb-kicker">Memória do códice</span>
          <button
            type="button"
            className="rb-history-close"
            aria-label="Fechar histórico"
            onClick={close}
          >
            <X size={18} />
          </button>
        </div>
        <h2 id="rb-history-title">Versões do códice</h2>
        <p>
          Recupere uma publicação anterior como rascunho. A restauração só será publicada quando
          você salvar.
        </p>
        <div className="rb-history-list">
          {loading ? (
            <span role="status">Abrindo o histórico…</span>
          ) : revisions.length ? (
            revisions.map((revision) => (
              <button
                type="button"
                key={revision.revision}
                disabled={selected !== null}
                onClick={() => load(revision)}
              >
                <span>
                  <small>
                    Versão {revision.revision} ·{' '}
                    {new Date(revision.updated_at).toLocaleString('pt-BR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </small>
                  <strong>{revision.title}</strong>
                </span>
                {selected === revision.revision ? (
                  <LoaderCircle size={18} className="rb-spinner" />
                ) : (
                  <ArrowRight size={18} />
                )}
              </button>
            ))
          ) : (
            <span>Ainda não há versões para recuperar.</span>
          )}
        </div>
      </div>
    </dialog>
  );
}
function ReadBlock({ block }: { block: RuleBlock }) {
  if (block.type === 'text')
    return (
      <div className="rb-prose">
        {block.text
          .split(/\n\s*\n/)
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
      </div>
    );
  if (block.type === 'callout')
    return (
      <aside className={'rb-callout rb-callout-' + block.tone}>
        <Quote size={23} aria-hidden="true" />
        <div>
          {block.title && <h4>{block.title}</h4>}
          <p>{block.text}</p>
        </div>
      </aside>
    );
  if (block.type === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return (
      <Tag className="rb-list">
        {block.items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </Tag>
    );
  }
  if (block.type === 'table')
    return (
      <div className="rb-table-scroll" tabIndex={0} aria-label="Tabela de regras">
        <table className="rb-table">
          <thead>
            <tr>
              {block.columns.map((column, index) => (
                <th scope="col" key={index}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return block.src ? (
    <figure className="rb-figure">
      <img src={block.src} alt={block.caption || 'Ilustração do livro de regras'} loading="lazy" />
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  ) : null;
}

function ImageInput({
  src,
  setSrc,
  upload,
  uploading,
  label = 'Imagem',
}: {
  src: string;
  setSrc: (value: string) => void;
  upload: (file: File) => void;
  uploading: boolean;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="rb-image-input">
      <div className={'rb-image-preview' + (!src ? ' rb-image-empty' : '')}>
        {src ? (
          <img src={src} alt={label} />
        ) : (
          <>
            <ImagePlus size={29} />
            <span>Escolha uma imagem para este espaço.</span>
          </>
        )}
      </div>
      <div className="rb-image-fields">
        <Field label={label + ' — endereço'}>
          <input
            type="text"
            inputMode="url"
            value={src}
            maxLength={2048}
            disabled={uploading}
            placeholder="https://…"
            onChange={(event) => setSrc(event.target.value)}
          />
        </Field>
        <input
          ref={input}
          type="file"
          hidden
          accept="image/png,image/jpeg,image/webp"
          aria-label={'Arquivo de ' + label.toLowerCase()}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) upload(file);
          }}
        />
        <button
          type="button"
          className="rb-button rb-button-quiet"
          disabled={uploading}
          onClick={() => input.current?.click()}
        >
          {uploading ? <LoaderCircle size={15} className="rb-spinner" /> : <Upload size={15} />}
          {uploading ? 'Enviando imagem…' : 'Enviar imagem'}
        </button>
        <small>PNG, JPG ou WebP · até 8 MB</small>
      </div>
    </div>
  );
}
function EditBlock({
  block,
  update,
  upload,
  uploading,
  confirm,
}: {
  block: RuleBlock;
  update: (block: RuleBlock) => void;
  upload: (file: File) => void;
  uploading: boolean;
  confirm: (value: Confirmation) => void;
}) {
  if (block.type === 'text')
    return (
      <Field label="Texto">
        <textarea
          value={block.text}
          maxLength={20000}
          rows={6}
          placeholder="Escreva a regra. Separe os parágrafos com uma linha em branco."
          onChange={(event) => update({ ...block, text: event.target.value })}
        />
      </Field>
    );
  if (block.type === 'callout')
    return (
      <>
        <div className="rb-fields-two">
          <Field label="Título da citação ou nota">
            <input
              value={block.title}
              maxLength={160}
              onChange={(event) => update({ ...block, title: event.target.value })}
            />
          </Field>
          <Field label="Tom">
            <select
              value={block.tone}
              onChange={(event) =>
                update({ ...block, tone: event.target.value as 'note' | 'warning' })
              }
            >
              <option value="note">Citação / nota</option>
              <option value="warning">Atenção</option>
            </select>
          </Field>
        </div>
        <Field label="Texto da citação ou nota">
          <textarea
            value={block.text}
            maxLength={20000}
            rows={4}
            onChange={(event) => update({ ...block, text: event.target.value })}
          />
        </Field>
      </>
    );
  if (block.type === 'list')
    return (
      <>
        <label className="rb-checkbox">
          <input
            type="checkbox"
            checked={block.ordered}
            onChange={(event) => update({ ...block, ordered: event.target.checked })}
          />
          Numerar esta lista
        </label>
        <div className="rb-list-editor">
          {block.items.map((item, index) => (
            <div className="rb-list-editor-row" key={index}>
              <span className="rb-row-number">{number(index + 1)}</span>
              <textarea
                aria-label={'Item ' + (index + 1)}
                value={item}
                maxLength={3000}
                rows={2}
                onChange={(event) =>
                  update({
                    ...block,
                    items: block.items.map((value, i) =>
                      i === index ? event.target.value : value,
                    ),
                  })
                }
              />
              <OrderButtons
                name={'item ' + (index + 1)}
                index={index}
                total={block.items.length}
                move={(offset) => update({ ...block, items: reorder(block.items, index, offset) })}
                remove={() =>
                  confirm({
                    title: 'Excluir este item?',
                    detail:
                      '“' + shorten(item || 'Item ' + (index + 1)) + '” será removido da lista.',
                    action: 'Excluir item',
                    run: () =>
                      update({ ...block, items: block.items.filter((_, i) => i !== index) }),
                  })
                }
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="rb-text-button"
          disabled={block.items.length >= 100}
          onClick={() => update({ ...block, items: [...block.items, ''] })}
        >
          <Plus size={15} />
          Adicionar item
        </button>
      </>
    );
  if (block.type === 'table')
    return (
      <>
        <div className="rb-table-scroll rb-table-editor" tabIndex={0} aria-label="Editar tabela">
          <table>
            <thead>
              <tr>
                {block.columns.map((column, index) => (
                  <th key={index}>
                    <input
                      aria-label={'Título da coluna ' + (index + 1)}
                      value={column}
                      maxLength={160}
                      onChange={(event) =>
                        update({
                          ...block,
                          columns: block.columns.map((value, i) =>
                            i === index ? event.target.value : value,
                          ),
                        })
                      }
                    />
                    <div className="rb-column-actions">
                      <IconButton
                        label={'Mover coluna ' + (index + 1) + ' para a esquerda'}
                        disabled={index === 0}
                        onClick={() =>
                          update({
                            ...block,
                            columns: reorder(block.columns, index, -1),
                            rows: block.rows.map((row) => reorder(row, index, -1)),
                          })
                        }
                      >
                        <ArrowLeft size={12} />
                      </IconButton>
                      <IconButton
                        label={'Mover coluna ' + (index + 1) + ' para a direita'}
                        disabled={index === block.columns.length - 1}
                        onClick={() =>
                          update({
                            ...block,
                            columns: reorder(block.columns, index, 1),
                            rows: block.rows.map((row) => reorder(row, index, 1)),
                          })
                        }
                      >
                        <ArrowRight size={12} />
                      </IconButton>
                      <IconButton
                        label={'Excluir coluna ' + (index + 1)}
                        disabled={block.columns.length === 1}
                        danger
                        onClick={() =>
                          confirm({
                            title: 'Excluir a coluna “' + (column || number(index + 1)) + '”?',
                            detail:
                              'As ' +
                              block.rows.length +
                              ' células desta coluna também serão removidas.',
                            action: 'Excluir coluna',
                            run: () =>
                              update({
                                ...block,
                                columns: block.columns.filter((_, i) => i !== index),
                                rows: block.rows.map((row) => row.filter((_, i) => i !== index)),
                              }),
                          })
                        }
                      >
                        <Trash2 size={12} />
                      </IconButton>
                    </div>
                  </th>
                ))}
                <th className="rb-table-actions-cell">
                  <span>Linhas</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>
                      <textarea
                        aria-label={'Linha ' + (index + 1) + ', coluna ' + (cellIndex + 1)}
                        value={cell}
                        rows={2}
                        maxLength={2000}
                        onChange={(event) =>
                          update({
                            ...block,
                            rows: block.rows.map((value, i) =>
                              i === index
                                ? value.map((text, j) =>
                                    j === cellIndex ? event.target.value : text,
                                  )
                                : value,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td className="rb-table-actions-cell">
                    <OrderButtons
                      name={'linha ' + (index + 1)}
                      index={index}
                      total={block.rows.length}
                      move={(offset) =>
                        update({ ...block, rows: reorder(block.rows, index, offset) })
                      }
                      remove={() =>
                        confirm({
                          title: 'Excluir a linha ' + (index + 1) + '?',
                          detail:
                            '“' +
                            shorten(row.join(' · ') || 'Linha vazia') +
                            '” será removida da tabela.',
                          action: 'Excluir linha',
                          run: () =>
                            update({ ...block, rows: block.rows.filter((_, i) => i !== index) }),
                        })
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rb-inline-actions">
          <button
            type="button"
            className="rb-text-button"
            disabled={block.rows.length >= 120}
            onClick={() => update({ ...block, rows: [...block.rows, block.columns.map(() => '')] })}
          >
            <Plus size={15} />
            Adicionar linha
          </button>
          <button
            type="button"
            className="rb-text-button"
            disabled={block.columns.length >= 20}
            onClick={() =>
              update({
                ...block,
                columns: [...block.columns, 'Nova coluna'],
                rows: block.rows.map((row) => [...row, '']),
              })
            }
          >
            <Plus size={15} />
            Adicionar coluna
          </button>
        </div>
      </>
    );
  return (
    <>
      <ImageInput
        src={block.src}
        setSrc={(src) => update({ ...block, src })}
        upload={upload}
        uploading={uploading}
      />
      <Field label="Legenda e descrição da imagem">
        <textarea
          value={block.caption}
          rows={2}
          maxLength={1200}
          onChange={(event) => update({ ...block, caption: event.target.value })}
        />
      </Field>
    </>
  );
}

export function Rulebook({ active = true }: { active?: boolean }) {
  const [record, setRecord] = useState<RulebookResponse | null>(null);
  const recordRef = useRef<RulebookResponse | null>(null);
  recordRef.current = record;
  const [draft, setDraft] = useState<RulebookDocument | null>(null);
  const draftRef = useRef<RulebookDocument | null>(null);
  draftRef.current = draft;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySelected, setHistorySelected] = useState<number | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const historyGeneration = useRef(0);
  const wasActive = useRef(active);
  const [query, setQuery] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [articleId, setArticleId] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [indexOpen, setIndexOpen] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const current = draft || record?.document;
  const edit = editing && !preview;
  const dirty = Boolean(
    draft && record && JSON.stringify(draft) !== JSON.stringify(record.document),
  );
  const notify = (text: string, kind: Notice['kind'] = 'success') =>
    setNotice({ id: Date.now(), text, kind });
  const load = useCallback(async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setLoadError('');
    try {
      const response = await request<RulebookResponse>('', { signal: abort.signal });
      if (abort.signal.aborted) return;
      setRecord(response);
      setDraft(null);
      setEditing(false);
      setPreview(false);
      setConflict(false);
      const first = response.document.chapters[0];
      setChapterId(first?.id || '');
      setArticleId(first?.articles[0]?.id || '');
      setExpanded(first ? [first.id] : []);
    } catch (error) {
      if (!abort.signal.aborted) setLoadError((error as Error).message);
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      controller.current?.abort();
      historyGeneration.current++;
    };
  }, [load]);
  useEffect(() => {
    const previous = wasActive.current;
    wasActive.current = active;
    if (active && !previous && !editing) void load();
  }, [active, editing, load]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const articles = useMemo(
    () =>
      current?.chapters.flatMap((chapter, chapterIndex) =>
        chapter.articles.map((article, articleIndex) => ({
          chapter,
          article,
          chapterIndex,
          articleIndex,
        })),
      ) || [],
    [current],
  );
  const activeChapter =
    current?.chapters.find((chapter) => chapter.id === chapterId) || current?.chapters[0];
  const activeArticle =
    activeChapter?.articles.find((article) => article.id === articleId) ||
    activeChapter?.articles[0];
  const activeLocation = articles.find((value) => value.article.id === activeArticle?.id);
  const pageIndex = articles.findIndex((value) => value.article.id === activeArticle?.id);
  const search = normalize(query.trim());
  const results = useMemo(
    () =>
      search
        ? articles.filter(({ chapter, article }) =>
            normalize(
              chapter.title +
                ' ' +
                chapter.description +
                ' ' +
                article.title +
                ' ' +
                article.summary +
                ' ' +
                article.tag +
                ' ' +
                article.blocks.map(blockText).join(' '),
            ).includes(search),
          )
        : [],
    [articles, search],
  );

  const scrollToArticle = () =>
    window.requestAnimationFrame(() =>
      articleRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      }),
    );
  const selectArticle = (location: ArticleLocation, scroll = true) => {
    setChapterId(location.chapter.id);
    setArticleId(location.article.id);
    setExpanded((value) =>
      value.includes(location.chapter.id) ? value : [...value, location.chapter.id],
    );
    setQuery('');
    setIndexOpen(false);
    if (scroll) scrollToArticle();
  };
  const changeDocument = (change: Partial<RulebookDocument>) =>
    setDraft((value) => (value ? { ...value, ...change } : value));
  const changeChapter = (id: string, change: (chapter: RuleChapter) => RuleChapter) =>
    setDraft((value) =>
      value
        ? {
            ...value,
            chapters: value.chapters.map((chapter) =>
              chapter.id === id ? change(chapter) : chapter,
            ),
          }
        : value,
    );
  const changeArticle = (change: (article: RuleArticle) => RuleArticle) => {
    if (activeChapter && activeArticle)
      changeChapter(activeChapter.id, (chapter) => ({
        ...chapter,
        articles: chapter.articles.map((article) =>
          article.id === activeArticle.id ? change(article) : article,
        ),
      }));
  };
  const changeBlock = (id: string, block: RuleBlock) =>
    changeArticle((article) => ({
      ...article,
      blocks: article.blocks.map((value) => (value.id === id ? block : value)),
    }));
  const beginEditing = () => {
    if (!record?.can_edit || loading) return false;
    if (!editing) setDraft(structuredClone(record.document));
    setEditing(true);
    setPreview(false);
    setQuery('');
    setIndexOpen(true);
    return true;
  };
  const editLocation = (chapter: RuleChapter, article?: RuleArticle) => {
    if (!beginEditing()) return;
    setChapterId(chapter.id);
    setArticleId(article?.id || chapter.articles[0]?.id || '');
    setExpanded((value) => (value.includes(chapter.id) ? value : [...value, chapter.id]));
    scrollToArticle();
    window.requestAnimationFrame(() => {
      const input = articleRef.current?.querySelector<HTMLInputElement>(
        article ? '.rb-article-title-input' : '.rb-chapter-fields input',
      );
      input?.focus({ preventScroll: true });
    });
  };
  const removeChapter = (chapter: RuleChapter) =>
    setConfirmation({
      title: 'Excluir “' + chapter.title + '”?',
      detail:
        'O capítulo e seus ' +
        chapter.articles.length +
        ' artigos serão removidos do rascunho. A publicação só será alterada ao salvar.',
      action: 'Excluir capítulo',
      run: () => {
        if (!beginEditing()) return;
        const source = draftRef.current || recordRef.current?.document;
        if (!source) return;
        const chapters = source.chapters.filter((value) => value.id !== chapter.id);
        setDraft({ ...source, chapters });
        if (activeChapter?.id === chapter.id) {
          setChapterId(chapters[0]?.id || '');
          setArticleId(chapters[0]?.articles[0]?.id || '');
        }
      },
    });
  const removeArticle = (chapter: RuleChapter, article: RuleArticle) =>
    setConfirmation({
      title: 'Excluir “' + article.title + '”?',
      detail:
        'Este artigo e seus ' +
        article.blocks.length +
        ' blocos serão removidos do rascunho. A publicação só será alterada ao salvar.',
      action: 'Excluir artigo',
      run: () => {
        if (!beginEditing()) return;
        const source = draftRef.current || recordRef.current?.document;
        if (!source) return;
        const chapters = source.chapters.map((value) =>
          value.id === chapter.id
            ? { ...value, articles: value.articles.filter((item) => item.id !== article.id) }
            : value,
        );
        setDraft({ ...source, chapters });
        setChapterId(chapter.id);
        if (activeArticle?.id === article.id || !editing)
          setArticleId(chapters.find((value) => value.id === chapter.id)?.articles[0]?.id || '');
        setExpanded((value) => (value.includes(chapter.id) ? value : [...value, chapter.id]));
      },
    });
  const cancel = () => {
    const run = () => {
      setDraft(null);
      setEditing(false);
      setPreview(false);
      setConflict(false);
    };
    if (!dirty) {
      run();
      return;
    }
    setConfirmation({
      title: 'Descartar as alterações?',
      detail:
        'As alterações ainda não salvas em “' +
        current?.title +
        '” serão descartadas. A publicação atual será preservada.',
      action: 'Descartar alterações',
      run,
    });
  };
  const save = async () => {
    if (!draft || !record || saving) return;
    const sentDraft = draft;
    const validation = rulebookDocumentSchema.safeParse(draft);
    if (!validation.success) {
      notify('Revise o códice antes de salvar: ' + validation.error.issues[0].message, 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await request<RulebookResponse>('', {
        method: 'PUT',
        body: JSON.stringify({ revision: record.revision, document: validation.data }),
      });
      setRecord(response);
      const newerChanges = draftRef.current !== sentDraft;
      setDraft((value) => (value === sentDraft ? structuredClone(response.document) : value));
      setConflict(false);
      notify(
        newerChanges
          ? 'Códice salvo. As alterações feitas durante o envio continuam no rascunho.'
          : 'Códice salvo. As novas regras já estão disponíveis.',
      );
    } catch (error) {
      if ((error as Error & { status?: number }).status === 409) {
        setConflict(true);
        notify(
          'O códice foi alterado enquanto você editava. Suas alterações continuam no rascunho.',
          'error',
        );
      } else notify((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const upload = async (file: File, target: string) => {
    if (uploading) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      notify('Escolha uma imagem PNG, JPG ou WebP.', 'error');
      return;
    }
    if (file.size > RULEBOOK_MAX_IMAGE_BYTES) {
      notify('A imagem deve ter até 8 MB.', 'error');
      return;
    }
    setUploading(target);
    try {
      const image = await request<RulebookImage>('/images', {
        method: 'POST',
        body: JSON.stringify({ name: file.name, data: await fileData(file) }),
      });
      if (target === 'cover') changeDocument({ cover_image: image.src });
      else
        setDraft((value) =>
          value
            ? {
                ...value,
                chapters: value.chapters.map((chapter) => ({
                  ...chapter,
                  articles: chapter.articles.map((article) => ({
                    ...article,
                    blocks: article.blocks.map((block) =>
                      block.id === target && block.type === 'image'
                        ? { ...block, src: image.src }
                        : block,
                    ),
                  })),
                })),
              }
            : value,
        );
      notify('Imagem adicionada ao rascunho. Salve para publicar.');
    } catch (error) {
      notify((error as Error).message, 'error');
    } finally {
      setUploading(null);
    }
  };
  const importDocument = async (file: File) => {
    if (uploading) return;
    if (file.size > RULEBOOK_MAX_DOCUMENT_BYTES) {
      notify('O arquivo do códice deve ter até 2 MB.', 'error');
      return;
    }
    try {
      const parsed = rulebookDocumentSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        notify('Este arquivo não é um códice válido: ' + parsed.error.issues[0].message, 'error');
        return;
      }
      const imported = parsed.data;
      setConfirmation({
        title: 'Importar “' + imported.title + '”?',
        detail:
          'O rascunho atual será substituído por ' +
          imported.chapters.length +
          ' capítulos e ' +
          imported.chapters.reduce((count, chapter) => count + chapter.articles.length, 0) +
          ' artigos. A importação só será publicada quando você salvar.',
        action: 'Importar códice',
        run: () => {
          setDraft(imported);
          setQuery('');
          setChapterId(imported.chapters[0]?.id || '');
          setArticleId(imported.chapters[0]?.articles[0]?.id || '');
          setExpanded(imported.chapters[0] ? [imported.chapters[0].id] : []);
          notify('Códice importado para o rascunho.');
        },
      });
    } catch {
      notify('Não foi possível ler este arquivo. Escolha uma cópia JSON do códice.', 'error');
    }
  };
  const openHistory = async () => {
    if (uploading) return;
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setRevisions((await request<{ revisions: Revision[] }>('/history')).revisions);
    } catch (error) {
      notify((error as Error).message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  };
  const closeHistory = () => {
    historyGeneration.current++;
    setHistorySelected(null);
    setHistoryOpen(false);
  };
  const restore = async (revision: Revision) => {
    if (historySelected !== null || uploading) return;
    const generation = ++historyGeneration.current;
    setHistorySelected(revision.revision);
    try {
      const snapshot = await request<{ document: RulebookDocument; revision: number }>(
        '/history/' + revision.revision,
      );
      if (generation !== historyGeneration.current) return;
      const run = () => {
        // Keep the current publication token: loading history is only a local draft change.
        setDraft(structuredClone(snapshot.document));
        setChapterId(snapshot.document.chapters[0]?.id || '');
        setArticleId(snapshot.document.chapters[0]?.articles[0]?.id || '');
        setExpanded(snapshot.document.chapters[0] ? [snapshot.document.chapters[0].id] : []);
        setQuery('');
        notify('Versão ' + revision.revision + ' carregada como rascunho. Salve para publicar.');
      };
      setHistoryOpen(false);
      const currentDraft = draftRef.current;
      const currentRecord = recordRef.current;
      const currentDirty = Boolean(
        currentDraft &&
        currentRecord &&
        JSON.stringify(currentDraft) !== JSON.stringify(currentRecord.document),
      );
      if (currentDirty)
        setConfirmation({
          title: 'Carregar a versão ' + revision.revision + '?',
          detail:
            'As alterações ainda não salvas serão substituídas pelo conteúdo de “' +
            revision.title +
            '”. A publicação atual será preservada até você salvar.',
          action: 'Carregar versão',
          run,
        });
      else run();
    } catch (error) {
      notify((error as Error).message, 'error');
    } finally {
      if (generation === historyGeneration.current) setHistorySelected(null);
    }
  };
  const addChapter = () => {
    if (!draft || draft.chapters.length >= 80) return;
    const chapter: RuleChapter = {
      id: newId(),
      title: 'Novo capítulo',
      description: '',
      articles: [],
    };
    changeDocument({ chapters: [...draft.chapters, chapter] });
    setChapterId(chapter.id);
    setArticleId('');
    setQuery('');
    setExpanded((value) => [...value, chapter.id]);
    setIndexOpen(false);
    scrollToArticle();
  };
  const addArticle = (chapter: RuleChapter) => {
    if (chapter.articles.length >= 80) return;
    const article: RuleArticle = {
      id: newId(),
      title: 'Novo artigo',
      summary: '',
      tag: '',
      blocks: [],
    };
    changeChapter(chapter.id, (value) => ({ ...value, articles: [...value.articles, article] }));
    setChapterId(chapter.id);
    setArticleId(article.id);
    setQuery('');
    setExpanded((value) => (value.includes(chapter.id) ? value : [...value, chapter.id]));
    setIndexOpen(false);
    scrollToArticle();
  };

  if (!current)
    return (
      <section className="rulebook rb-loading" aria-busy={loading}>
        <span className="rb-kicker">Biblioteca da Alvorada</span>
        <BookOpen size={38} />
        <h2>{loading ? 'Abrindo o códice…' : 'O códice não pôde ser aberto'}</h2>
        {loadError && (
          <>
            <p>{loadError}</p>
            <button
              type="button"
              className="rb-button rb-button-primary"
              onClick={() => void load()}
            >
              Tentar novamente
            </button>
          </>
        )}
      </section>
    );

  return (
    <section
      className="rulebook"
      data-editing={editing || undefined}
      data-preview={preview || undefined}
      aria-label="Livro de regras"
    >
      {notice && (
        <FlashMessage key={notice.id} kind={notice.kind}>
          {notice.text}
        </FlashMessage>
      )}
      {confirmation && <Confirm value={confirmation} close={() => setConfirmation(null)} />}
      {historyOpen && (
        <HistoryDialog
          revisions={revisions}
          loading={historyLoading}
          selected={historySelected}
          close={closeHistory}
          load={(revision) => void restore(revision)}
        />
      )}
      {editing && (
        <div className="rb-editor-bar" role="toolbar" aria-label="Edição do códice">
          <div className="rb-edit-state">
            <PenLine size={15} />
            <span>
              {preview ? 'Prévia do rascunho' : 'Editando o códice'}
              <small>{saving ? 'Salvando…' : dirty ? 'Alterações por salvar' : 'Tudo salvo'}</small>
            </span>
          </div>
          <div className="rb-editor-actions">
            <button
              type="button"
              className="rb-button rb-button-quiet"
              disabled={saving || Boolean(uploading)}
              onClick={() => setPreview((value) => !value)}
            >
              {preview ? <PenLine size={15} /> : <Eye size={15} />}
              {preview ? 'Editar' : 'Prévia'}
            </button>
            <button
              type="button"
              className="rb-button rb-button-quiet"
              disabled={saving || Boolean(uploading)}
              onClick={cancel}
            >
              <X size={15} />
              Cancelar
            </button>
            <button
              type="button"
              className="rb-button rb-button-primary"
              disabled={!dirty || saving || Boolean(uploading)}
              onClick={() => void save()}
            >
              {saving ? (
                <LoaderCircle size={15} className="rb-spinner" />
              ) : dirty ? (
                <Save size={15} />
              ) : (
                <Check size={15} />
              )}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
      {conflict && (
        <div className="rb-conflict" role="alert">
          <div>
            <strong>A publicação mudou enquanto você editava.</strong>
            <p>
              Seu rascunho está preservado. Baixe uma cópia antes de carregar a publicação mais
              recente.
            </p>
          </div>
          <button
            type="button"
            className="rb-button rb-button-quiet"
            onClick={() => draft && download(draft)}
          >
            <Download size={15} />
            Baixar meu rascunho
          </button>
          <button
            type="button"
            className="rb-button rb-button-quiet"
            onClick={() =>
              setConfirmation({
                title: 'Carregar a publicação atual?',
                detail:
                  'As alterações sem salvar de “' +
                  current.title +
                  '” serão descartadas. Baixe seu rascunho primeiro se quiser preservá-las.',
                action: 'Carregar publicação',
                run: () => void load(),
              })
            }
          >
            Carregar publicação
          </button>
        </div>
      )}
      <header
        className="rb-hero"
        data-has-cover={Boolean(current.cover_image)}
        style={
          {
            '--rb-cover': current.cover_image
              ? 'url(' + JSON.stringify(current.cover_image) + ')'
              : 'none',
          } as CSSProperties
        }
      >
        <div className="rb-hero-top">
          <span className="rb-kicker">
            <span />
            Biblioteca da Alvorada
          </span>
          {record?.can_edit && !editing && (
            <button
              type="button"
              className="rb-button rb-button-glass"
              disabled={loading}
              onClick={beginEditing}
            >
              <PenLine size={14} />
              Editar conteúdo
            </button>
          )}
        </div>
        <div className="rb-hero-copy">
          {edit ? (
            <>
              <Field label="Título do códice">
                <input
                  className="rb-title-input"
                  value={current.title}
                  maxLength={160}
                  onChange={(event) => changeDocument({ title: event.target.value })}
                />
              </Field>
              <Field label="Subtítulo">
                <textarea
                  rows={2}
                  value={current.subtitle}
                  maxLength={1200}
                  onChange={(event) => changeDocument({ subtitle: event.target.value })}
                />
              </Field>
              <Field label="Introdução">
                <textarea
                  rows={4}
                  value={current.introduction}
                  maxLength={20000}
                  onChange={(event) => changeDocument({ introduction: event.target.value })}
                />
              </Field>
            </>
          ) : (
            <>
              <h2>{current.title}</h2>
              {current.subtitle && <p className="rb-subtitle">{current.subtitle}</p>}
              {current.introduction && <p className="rb-introduction">{current.introduction}</p>}
            </>
          )}
        </div>
        <div className="rb-hero-bottom">
          <span>
            {number(current.chapters.length)} capítulos <i />
            {number(articles.length)} artigos
          </span>
          <span className="rb-edition">O códice da nossa mesa</span>
        </div>
      </header>
      {edit && (
        <details className="rb-cover-editor">
          <summary>
            <ImagePlus size={17} />
            Capa e cópias do códice
            <ChevronDown size={15} />
          </summary>
          <div className="rb-cover-body">
            <ImageInput
              label="Capa"
              src={current.cover_image || ''}
              setSrc={(src) => changeDocument({ cover_image: src || null })}
              uploading={uploading === 'cover'}
              upload={(file) => void upload(file, 'cover')}
            />
            <div className="rb-cover-actions">
              <button
                type="button"
                className="rb-text-button"
                disabled={!current.cover_image || Boolean(uploading)}
                onClick={() =>
                  setConfirmation({
                    title: 'Remover a capa?',
                    detail:
                      'A arte de fundo será removida do rascunho. O título e o conteúdo serão preservados.',
                    action: 'Remover capa',
                    run: () => changeDocument({ cover_image: null }),
                  })
                }
              >
                <Trash2 size={14} />
                Remover capa
              </button>
              <button
                type="button"
                className="rb-text-button"
                disabled={Boolean(uploading)}
                onClick={() => importInput.current?.click()}
              >
                <Upload size={14} />
                Importar códice
              </button>
              <button type="button" className="rb-text-button" onClick={() => download(current)}>
                <Download size={14} />
                Exportar códice
              </button>
              <button
                type="button"
                className="rb-text-button"
                disabled={Boolean(uploading)}
                onClick={() => void openHistory()}
              >
                <History size={14} />
                Histórico
              </button>
              <input
                ref={importInput}
                type="file"
                hidden
                disabled={Boolean(uploading)}
                accept=".json,application/json"
                aria-label="Arquivo JSON do códice"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void importDocument(file);
                }}
              />
            </div>
          </div>
        </details>
      )}
      <div className="rb-reading-tools">
        <span>
          <BookOpen size={16} />
          Consulta ao códice
        </span>
        <label className="rb-search">
          <Search size={17} />
          <input
            value={query}
            maxLength={200}
            placeholder="Buscar no livro…"
            aria-label="Buscar no livro"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}>
              <X size={15} />
            </button>
          )}
        </label>
      </div>
      <div className="rb-layout">
        <aside
          className="rb-index"
          data-open={indexOpen || undefined}
          aria-label="Índice do códice"
        >
          <div className="rb-index-heading">
            <span className="rb-kicker">Sumário</span>
            <span>{number(current.chapters.length)}</span>
            <button
              type="button"
              className="rb-index-toggle"
              aria-expanded={indexOpen}
              aria-controls="rb-chapter-index"
              onClick={() => setIndexOpen((value) => !value)}
            >
              {indexOpen ? 'Fechar índice' : 'Abrir índice'}
              <ChevronDown size={16} />
            </button>
          </div>
          <nav id="rb-chapter-index" className="rb-index-body">
            {current.chapters.map((chapter, chapterIndex) => {
              const open = expanded.includes(chapter.id);
              return (
                <div
                  className={
                    'rb-index-chapter' +
                    (activeChapter?.id === chapter.id ? ' rb-current-chapter' : '')
                  }
                  key={chapter.id}
                >
                  <button
                    type="button"
                    className="rb-chapter-button"
                    aria-expanded={open}
                    onClick={() => {
                      setExpanded((value) =>
                        open ? value.filter((id) => id !== chapter.id) : [...value, chapter.id],
                      );
                      if (!open || !chapter.articles.length) {
                        setChapterId(chapter.id);
                        setArticleId(chapter.articles[0]?.id || '');
                      }
                    }}
                  >
                    <span className="rb-chapter-number">{number(chapterIndex + 1)}</span>
                    <span>{chapter.title}</span>
                    <ChevronRight size={14} />
                  </button>
                  {record?.can_edit && (
                    <ItemActions
                      name={'capítulo ' + chapter.title}
                      edit={() => editLocation(chapter)}
                      remove={() => removeChapter(chapter)}
                      disabled={loading}
                    >
                      {edit && (
                        <OrderButtons
                          name={'capítulo ' + chapter.title}
                          index={chapterIndex}
                          total={current.chapters.length}
                          move={(offset) =>
                            changeDocument({
                              chapters: reorder(current.chapters, chapterIndex, offset),
                            })
                          }
                        />
                      )}
                    </ItemActions>
                  )}
                  {open && (
                    <div className="rb-index-articles">
                      {chapter.articles.map((article, articleIndex) => (
                        <div className="rb-index-article-row" key={article.id}>
                          <button
                            type="button"
                            className={
                              'rb-article-button' +
                              (activeArticle?.id === article.id ? ' rb-active' : '')
                            }
                            aria-current={activeArticle?.id === article.id ? 'page' : undefined}
                            onClick={() =>
                              selectArticle({ chapter, article, chapterIndex, articleIndex })
                            }
                          >
                            <span>{number(chapterIndex + 1) + '.' + number(articleIndex + 1)}</span>
                            {article.title}
                          </button>
                          {record?.can_edit && (
                            <ItemActions
                              name={'artigo ' + article.title}
                              edit={() => editLocation(chapter, article)}
                              remove={() => removeArticle(chapter, article)}
                              disabled={loading}
                            >
                              {edit && (
                                <OrderButtons
                                  name={'artigo ' + article.title}
                                  index={articleIndex}
                                  total={chapter.articles.length}
                                  move={(offset) =>
                                    changeChapter(chapter.id, (value) => ({
                                      ...value,
                                      articles: reorder(value.articles, articleIndex, offset),
                                    }))
                                  }
                                />
                              )}
                            </ItemActions>
                          )}
                        </div>
                      ))}
                      {edit && (
                        <button
                          type="button"
                          className="rb-text-button rb-add-article"
                          disabled={chapter.articles.length >= 80}
                          onClick={() => addArticle(chapter)}
                        >
                          <Plus size={14} />
                          Adicionar artigo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {edit && (
              <button
                type="button"
                className="rb-button rb-add-chapter"
                disabled={current.chapters.length >= 80}
                onClick={addChapter}
              >
                <Plus size={16} />
                Adicionar capítulo
              </button>
            )}
          </nav>
          <div className="rb-index-foot">
            <span />
            Alvorada Cinzenta
          </div>
        </aside>
        <div ref={articleRef} className="rb-content" tabIndex={-1}>
          {search ? (
            <div className="rb-search-results">
              <span className="rb-kicker">Busca no códice</span>
              <h3>
                {results.length
                  ? results.length + (results.length === 1 ? ' resultado' : ' resultados')
                  : 'Nenhum resultado'}
              </h3>
              <p className="rb-results-caption">Para “{query}”</p>
              {results.length ? (
                results.map((location) => (
                  <button
                    type="button"
                    className="rb-search-result"
                    key={location.article.id}
                    onClick={() => selectArticle(location)}
                  >
                    <span className="rb-kicker">
                      {number(location.chapterIndex + 1)} · {location.chapter.title}
                    </span>
                    <strong>{location.article.title}</strong>
                    <span>
                      {shorten(
                        location.article.summary ||
                          location.article.blocks.map(blockText).join(' '),
                        180,
                      )}
                    </span>
                    <ArrowRight size={19} />
                  </button>
                ))
              ) : (
                <p className="rb-empty-description">
                  Tente outro termo ou consulte os capítulos do sumário.
                </p>
              )}
            </div>
          ) : (
            <>
              {activeChapter && (
                <div className="rb-chapter-intro">
                  <span className="rb-kicker">
                    Capítulo {number(current.chapters.indexOf(activeChapter) + 1)}
                  </span>
                  {edit ? (
                    <div className="rb-chapter-fields">
                      <Field label="Título do capítulo">
                        <input
                          value={activeChapter.title}
                          maxLength={160}
                          onChange={(event) =>
                            changeChapter(activeChapter.id, (value) => ({
                              ...value,
                              title: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field label="Descrição do capítulo">
                        <textarea
                          rows={2}
                          value={activeChapter.description}
                          maxLength={1200}
                          onChange={(event) =>
                            changeChapter(activeChapter.id, (value) => ({
                              ...value,
                              description: event.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>
                  ) : (
                    <>
                      <span className="rb-chapter-name">{activeChapter.title}</span>
                      {activeChapter.description && <p>{activeChapter.description}</p>}
                    </>
                  )}
                </div>
              )}
              {activeArticle ? (
                <article
                  className="rb-article"
                  aria-label={activeArticle.title}
                  data-article-id={activeArticle.id}
                >
                  <header className="rb-article-head">
                    {edit ? (
                      <>
                        <div className="rb-fields-two">
                          <Field label="Título do artigo">
                            <input
                              className="rb-article-title-input"
                              value={activeArticle.title}
                              maxLength={160}
                              onChange={(event) =>
                                changeArticle((value) => ({ ...value, title: event.target.value }))
                              }
                            />
                          </Field>
                          <Field label="Etiqueta">
                            <input
                              value={activeArticle.tag}
                              maxLength={80}
                              placeholder="Ex.: Regra da guilda"
                              onChange={(event) =>
                                changeArticle((value) => ({ ...value, tag: event.target.value }))
                              }
                            />
                          </Field>
                        </div>
                        <Field label="Resumo do artigo">
                          <textarea
                            rows={3}
                            value={activeArticle.summary}
                            maxLength={1600}
                            onChange={(event) =>
                              changeArticle((value) => ({ ...value, summary: event.target.value }))
                            }
                          />
                        </Field>
                      </>
                    ) : (
                      <>
                        <div className="rb-article-meta">
                          <span>
                            {number(
                              activeLocation?.chapterIndex === undefined
                                ? 1
                                : activeLocation.chapterIndex + 1,
                            ) +
                              '.' +
                              number((activeLocation?.articleIndex || 0) + 1)}
                          </span>
                          {activeArticle.tag && <span className="rb-tag">{activeArticle.tag}</span>}
                        </div>
                        <h3>{activeArticle.title}</h3>
                        {activeArticle.summary && (
                          <p className="rb-article-summary">{activeArticle.summary}</p>
                        )}
                      </>
                    )}
                  </header>
                  <div className="rb-blocks">
                    {activeArticle.blocks.map((block, index) =>
                      edit ? (
                        <section
                          className="rb-edit-block"
                          key={block.id}
                          data-block-id={block.id}
                          aria-label={'Bloco ' + (index + 1) + ': ' + blockNames[block.type]}
                        >
                          <header>
                            <span>
                              {number(index + 1)}
                              <b>{blockNames[block.type]}</b>
                            </span>
                            <OrderButtons
                              name={'bloco ' + (index + 1)}
                              removeLabel="Excluir bloco"
                              index={index}
                              total={activeArticle.blocks.length}
                              move={(offset) =>
                                changeArticle((value) => ({
                                  ...value,
                                  blocks: reorder(value.blocks, index, offset),
                                }))
                              }
                              remove={() =>
                                setConfirmation({
                                  title:
                                    'Excluir este bloco de ' +
                                    blockNames[block.type].toLowerCase() +
                                    '?',
                                  detail:
                                    '“' +
                                    shorten(blockText(block) || blockNames[block.type]) +
                                    '” será removido de “' +
                                    activeArticle.title +
                                    '”.',
                                  action: 'Excluir bloco',
                                  run: () =>
                                    changeArticle((value) => ({
                                      ...value,
                                      blocks: value.blocks.filter((item) => item.id !== block.id),
                                    })),
                                })
                              }
                            />
                          </header>
                          <div className="rb-edit-block-body">
                            <EditBlock
                              block={block}
                              update={(value) => changeBlock(block.id, value)}
                              confirm={setConfirmation}
                              uploading={uploading === block.id}
                              upload={(file) => void upload(file, block.id)}
                            />
                          </div>
                        </section>
                      ) : (
                        <ReadBlock block={block} key={block.id} />
                      ),
                    )}
                  </div>
                  {edit && (
                    <div className="rb-block-picker">
                      <span className="rb-kicker">Adicionar ao artigo</span>
                      <div>
                        {(Object.keys(blockNames) as RuleBlock['type'][]).map((type) => {
                          const Icon = blockIcons[type];
                          return (
                            <button
                              type="button"
                              key={type}
                              disabled={activeArticle.blocks.length >= 80}
                              onClick={() =>
                                changeArticle((value) => ({
                                  ...value,
                                  blocks: [...value.blocks, createBlock(type)],
                                }))
                              }
                            >
                              <Icon size={18} />
                              {blockNames[type]}
                              <Plus size={12} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              ) : (
                <div className="rb-empty">
                  <BookOpen size={32} />
                  <h3>
                    {activeChapter
                      ? 'Um novo capítulo começa aqui.'
                      : 'O primeiro capítulo está por escrever.'}
                  </h3>
                  <p>
                    {edit
                      ? 'Dê lugar às regras e aos acordos que guiam sua mesa.'
                      : 'Os próximos artigos aparecerão neste espaço.'}
                  </p>
                  {edit && (
                    <button
                      type="button"
                      className="rb-button rb-button-primary"
                      onClick={() => (activeChapter ? addArticle(activeChapter) : addChapter())}
                    >
                      <Plus size={15} />
                      {activeChapter ? 'Adicionar primeiro artigo' : 'Adicionar primeiro capítulo'}
                    </button>
                  )}
                </div>
              )}
              {activeArticle && articles.length > 1 && (
                <nav className="rb-page-navigation" aria-label="Navegação entre artigos">
                  <button
                    type="button"
                    disabled={pageIndex <= 0}
                    onClick={() =>
                      articles[pageIndex - 1] && selectArticle(articles[pageIndex - 1])
                    }
                  >
                    <ArrowLeft size={19} />
                    <span>
                      <small>Anterior</small>
                      {articles[pageIndex - 1]?.article.title || 'Início do códice'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pageIndex < 0 || pageIndex >= articles.length - 1}
                    onClick={() =>
                      articles[pageIndex + 1] && selectArticle(articles[pageIndex + 1])
                    }
                  >
                    <span>
                      <small>Próximo</small>
                      {articles[pageIndex + 1]?.article.title || 'Fim do códice'}
                    </span>
                    <ArrowRight size={19} />
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
      <footer className="rb-attribution">
        <span>Referências & atribuição</span>
        <p>
          This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by
          Wizards of the Coast LLC, available at{' '}
          <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">
            https://www.dndbeyond.com/srd
          </a>
          . The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International
          License, available at{' '}
          <a
            href="https://creativecommons.org/licenses/by/4.0/legalcode"
            target="_blank"
            rel="noreferrer"
          >
            https://creativecommons.org/licenses/by/4.0/legalcode
          </a>
          . Nomes traduzidos e regras resumidas.
        </p>
      </footer>
    </section>
  );
}

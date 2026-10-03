import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Castle,
  Check,
  ChevronRight,
  Eye,
  Feather,
  ImagePlus,
  Plus,
  Pencil,
  Save,
  Search,
  ScrollText,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { FlashMessage } from './FlashMessage';
import { LoreScrollHolderIcon, LoreScrollIcon } from './LoreSymbols';
import { useLoreScrollSound } from './SiteMusic';
import {
  loreDescendants,
  loreFolderPath,
  loreImageUrl,
  LORE_MAX_IMAGE_BYTES,
  type LoreBlock,
  type LoreFolder,
  type LoreIndex,
  type LorePage,
  type LorePageSummary,
  type LoreDeletedFolder,
} from '../shared/lore';
import './lore.css';

const alignLabels = { left: 'Esquerda', center: 'Centro', right: 'Direita' };
const formatLabels = {
  portrait: 'Retrato',
  landscape: 'Paisagem inteira',
  'half-landscape': 'Meia paisagem',
};
const styleLabels = {
  prose: 'Texto livre',
  parchment: 'Caixa de pergaminho',
  inscription: 'Caixa de inscrição',
  quote: 'Citação / lenda',
};
const textBlock = (): LoreBlock => ({
  id: crypto.randomUUID(),
  type: 'text',
  title: '',
  text: '',
  style: 'prose',
  alignment: 'left',
});

export function LoreImage({ block }: { block: Extract<LoreBlock, { type: 'image' }> }) {
  const frame = useRef<HTMLDivElement>(null);
  return (
    <figure className={`lore-image lore-image--${block.format} lore-align--${block.alignment}`}>
      <div
        ref={frame}
        data-fit={block.fit}
        className={`lore-image-frame lore-image-frame--${block.effect}`}
        onPointerMove={(event) => {
          if (
            block.effect !== 'cinematic' ||
            block.fit === 'contain' ||
            event.pointerType === 'touch' ||
            matchMedia('(prefers-reduced-motion: reduce)').matches
          )
            return;
          const rect = event.currentTarget.getBoundingClientRect();
          frame.current?.style.setProperty(
            '--image-x',
            `${((event.clientX - rect.left) / rect.width - 0.5) * 12}px`,
          );
          frame.current?.style.setProperty(
            '--image-y',
            `${((event.clientY - rect.top) / rect.height - 0.5) * 12}px`,
          );
        }}
        onPointerLeave={() => {
          frame.current?.style.setProperty('--image-x', '0px');
          frame.current?.style.setProperty('--image-y', '0px');
        }}
      >
        <img
          src={loreImageUrl(block.asset_id)}
          alt={block.alt || block.caption || 'Ilustração da crônica'}
          loading="lazy"
          style={{ objectFit: block.fit }}
        />
        {block.effect === 'cinematic' && <span className="lore-image-mist" aria-hidden="true" />}
      </div>
      {block.caption && <figcaption>{block.caption}</figcaption>}
    </figure>
  );
}

export function LoreBlocks({ blocks }: { blocks: LoreBlock[] }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!root.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    root.current.querySelectorAll('.lore-block').forEach((element) => {
      element.setAttribute('data-reveal', 'true');
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, [blocks]);
  return (
    <div className="lore-blocks" ref={root}>
      {blocks.map((block) =>
        block.type === 'image' ? (
          <div
            className={`lore-block lore-block--image lore-block--${block.format} lore-align--${block.alignment}`}
            key={block.id}
          >
            <LoreImage block={block} />
          </div>
        ) : (
          <section
            className={`lore-block lore-text lore-text--${block.style} lore-align--${block.alignment}`}
            key={block.id}
          >
            {block.title && <h3>{block.title}</h3>}
            {block.text
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
          </section>
        ),
      )}
    </div>
  );
}

function LoreFolderButton({
  folder,
  active,
  depth,
  count,
  onSelect,
}: {
  folder: LoreFolder;
  active: boolean;
  depth: number;
  count: number;
  onSelect: (id: string) => void;
}) {
  const [rummaging, setRummaging] = useState(false);
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      style={{ '--folder-depth': depth } as CSSProperties}
      aria-pressed={active}
      data-folder-choice={folder.id}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setRummaging(true);
      }}
      onPointerLeave={() => setRummaging(false)}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) setRummaging(true);
      }}
      onBlur={() => setRummaging(false)}
      onClick={() => {
        setRummaging(false);
        onSelect(folder.id);
      }}
    >
      <LoreScrollHolderIcon rummaging={rummaging} />
      <span>{folder.name}</span>
      <small>{count.toString().padStart(2, '0')}</small>
    </button>
  );
}

function FolderTree({
  folders,
  parent = null,
  active,
  onSelect,
  pages,
  depth = 0,
  onDelete,
  onEdit,
}: {
  folders: LoreFolder[];
  parent?: string | null;
  active: string | null;
  onSelect: (id: string) => void;
  pages: LorePageSummary[];
  depth?: number;
  onDelete?: (folder: LoreFolder) => void;
  onEdit?: (folder: LoreFolder) => void;
}) {
  return (
    <ul className="lore-folder-tree">
      {folders
        .filter((folder) => folder.parent_id === parent)
        .map((folder) => {
          const descendants = loreDescendants(folder.id, folders);
          const count = pages.filter((page) => descendants.has(page.folder_id)).length;
          return (
            <li key={folder.id}>
              <div className="lore-folder-row">
                <LoreFolderButton
                  folder={folder}
                  active={active === folder.id}
                  depth={depth}
                  count={count}
                  onSelect={onSelect}
                />
                {onEdit && (
                  <button
                    className="lore-folder-edit"
                    type="button"
                    aria-label={`Editar pasta ${folder.name}`}
                    title={`Editar pasta ${folder.name}`}
                    onClick={() => onEdit(folder)}
                  >
                    <Pencil size={13} />
                  </button>
                )}
                {onDelete && (
                  <button
                    className="lore-folder-delete"
                    type="button"
                    aria-label={`Excluir pasta ${folder.name}`}
                    onClick={() => onDelete(folder)}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <FolderTree
                folders={folders}
                parent={folder.id}
                active={active}
                onSelect={onSelect}
                pages={pages}
                depth={depth + 1}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </li>
          );
        })}
    </ul>
  );
}

export function LoreLibrary() {
  const playScroll = useLoreScrollSound();
  const [index, setIndex] = useState<LoreIndex | null>(null);
  const [regionId, setRegionId] = useState('reino-do-norte');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [page, setPage] = useState<LorePage | null>(null);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<'page' | 'folder' | null>(null);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<LoreFolder | null>(null);
  const [editingFolder, setEditingFolder] = useState<LoreFolder | null>(null);
  const [trash, setTrash] = useState<LoreDeletedFolder[] | null>(null);
  const [trashError, setTrashError] = useState('');
  const request = useRef(0);
  async function refresh() {
    const data = await api<LoreIndex>('/lore');
    setIndex(data);
    return data;
  }
  useEffect(() => {
    void refresh().catch((error) => setMessage(error.message));
  }, []);
  async function openPage(id: string) {
    playScroll();
    const token = ++request.current;
    setBusy(true);
    try {
      const loaded = await api<LorePage>(`/lore/pages/${id}`);
      if (token === request.current) {
        setPage(loaded);
        setEditing(false);
      }
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  function navigate(region: string, folder: string | null) {
    request.current++;
    setBusy(false);
    setRegionId(region);
    setFolderId(folder);
    setPage(null);
    setEditing(false);
  }
  if (!index)
    return (
      <section className="lore-loading" aria-live="polite">
        <BookOpen size={28} />
        <p>{message || 'Abrindo os arquivos do mundo…'}</p>
        {message && (
          <button
            className="button"
            onClick={() => void refresh().catch((e) => setMessage(e.message))}
          >
            Tentar novamente
          </button>
        )}
      </section>
    );
  const region = index.regions.find((item) => item.id === regionId) || index.regions[0];
  const folders = index.folders.filter((folder) => folder.region_id === region.id);
  const regionPages = index.pages.filter((item) => item.region_id === region.id);
  const allowedFolders = folderId ? loreDescendants(folderId, folders) : null;
  const pages = regionPages.filter(
    (item) =>
      (!allowedFolders || allowedFolders.has(item.folder_id)) &&
      `${item.title} ${item.subtitle}`
        .toLocaleLowerCase('pt-BR')
        .includes(query.toLocaleLowerCase('pt-BR')),
  );
  return (
    <section
      className={`lore-library ${editing ? 'is-editing' : ''}`}
      aria-label="Biblioteca de lore"
    >
      {message && <FlashMessage kind="info">{message}</FlashMessage>}
      <header className="lore-hero">
        <div className="lore-hero-art" aria-hidden="true" />
        <div className="lore-hero-fog" aria-hidden="true" />
        <div className="lore-hero-copy">
          <span className="lore-kicker">O ARQUIVO DOS REINOS</span>
          <h1>
            Crônicas &amp; lore<span>.</span>
          </h1>
        </div>
      </header>
      {editing && page ? (
        <LoreEditor
          key={page.id}
          page={page}
          index={index}
          onCancel={() => setEditing(false)}
          onSaved={async (saved) => {
            setPage(saved);
            setRegionId(saved.region_id);
            setFolderId(saved.folder_id);
            setEditing(false);
            await refresh();
            setMessage(saved.published ? 'Crônica publicada na biblioteca.' : 'Rascunho salvo.');
          }}
        />
      ) : (
        <div className="lore-archive" id="lore-archive">
          <aside className="lore-sidebar" aria-label="Regiões e pastas da lore">
            <span className="lore-kicker">TERRITÓRIOS DO ATLAS</span>
            <label className="lore-region-picker">
              Região
              <select value={region.id} onChange={(event) => navigate(event.target.value, null)}>
                {index.regions.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className={`lore-all ${!folderId ? 'is-active' : ''}`}
              onClick={() => navigate(region.id, null)}
            >
              <BookOpen size={16} /> Todas as crônicas <small>{regionPages.length}</small>
            </button>
            <FolderTree
              folders={folders}
              active={folderId}
              onSelect={(id) => navigate(region.id, id)}
              pages={regionPages}
              onDelete={index.can_manage_folders ? setDeletingFolder : undefined}
              onEdit={index.can_manage_folders ? setEditingFolder : undefined}
            />
            <button className="lore-folder-add" onClick={() => setDialog('folder')}>
              <LoreScrollHolderIcon /> Nova pasta / subpasta
            </button>
            {index.can_manage_folders && (
              <button
                className="lore-folder-trash"
                onClick={() =>
                  void api<LoreDeletedFolder[]>('/lore/folder-trash')
                    .then((entries) => {
                      setTrashError('');
                      setTrash(entries);
                    })
                    .catch((error) => setMessage(error.message))
                }
              >
                <Trash2 size={14} /> Pastas excluídas
              </button>
            )}
            <div className="lore-sidebar-seal">
              <Castle size={24} />
              <p>
                Os arquivos de
                <br />
                <b>{region.name}</b>
              </p>
            </div>
          </aside>
          <div className="lore-stage">
            <div className="lore-stage-toolbar">
              <div>
                <span className="lore-kicker">
                  {folderId ? loreFolderPath(folderId, folders) : 'ARQUIVO REGIONAL'}
                </span>
                <h2>{region.name}</h2>
              </div>
              <button className="button lore-new" onClick={() => setDialog('page')}>
                <Feather size={16} /> Nova crônica
              </button>
            </div>
            {busy && <p role="status">Lendo a crônica…</p>}
            {page ? (
              <article className="lore-reader">
                <div className="lore-reader-actions">
                  <button onClick={() => setPage(null)}>
                    <ArrowLeft size={15} /> Voltar ao arquivo
                  </button>
                  {page.can_edit && (
                    <button onClick={() => setEditing(true)}>
                      <Feather size={15} /> Editar crônica
                    </button>
                  )}
                </div>
                <header>
                  <span className="lore-kicker">
                    {loreFolderPath(page.folder_id, folders)}
                    {!page.published && ' · RASCUNHO'}
                  </span>
                  <div className="lore-reader-title">
                    <LoreScrollIcon open />
                    <h2>{page.title}</h2>
                  </div>
                  {page.subtitle && <p>{page.subtitle}</p>}
                  <div className="lore-rule" aria-hidden="true">
                    ✦
                  </div>
                </header>
                <LoreBlocks blocks={page.blocks} />
                {!page.blocks.length && (
                  <p className="lore-empty">Esta página ainda espera suas primeiras palavras.</p>
                )}
              </article>
            ) : (
              <>
                <p className="lore-region-description">{region.description}</p>
                <label className="lore-search">
                  <Search size={16} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar crônica nesta região…"
                    aria-label="Buscar crônica"
                  />
                </label>
                <div className="lore-page-list">
                  {pages.map((item) => (
                    <button
                      key={item.id}
                      className="lore-page-link"
                      onClick={() => void openPage(item.id)}
                    >
                      <LoreScrollIcon />
                      <span className="lore-page-copy">
                        <small>
                          {loreFolderPath(item.folder_id, folders)}
                          {!item.published && ' · Rascunho'}
                        </small>
                        <strong>{item.title}</strong>
                        <span>{item.subtitle}</span>
                      </span>
                      <span
                        className="lore-page-art"
                        aria-hidden="true"
                        style={{
                          backgroundImage: `url("${item.thumbnail || '/alvorada-dawn-banner.png'}")`,
                        }}
                      />
                      <ChevronRight size={20} />
                    </button>
                  ))}
                </div>
                {!pages.length && (
                  <div className="lore-empty">
                    <ScrollText size={28} />
                    <h3>{query ? 'Nenhuma crônica encontrada' : 'Um capítulo por escrever'}</h3>
                    <p>
                      {query
                        ? 'Tente outro título ou pasta.'
                        : 'Registre cidades, lendas e habitantes deste território.'}
                    </p>
                    <button className="button" onClick={() => setDialog('page')}>
                      <Plus size={15} /> Escrever a primeira crônica
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {dialog && (
        <LoreCreateDialog
          kind={dialog}
          index={index}
          regionId={region.id}
          folderId={folderId}
          onClose={() => setDialog(null)}
          onCreated={async (created) => {
            await refresh();
            setDialog(null);
            setMessage(
              'id' in created && 'blocks' in created
                ? 'Rascunho criado. Adicione texto e imagens.'
                : 'Pasta criada.',
            );
            if ('blocks' in created) {
              setPage(created);
              setEditing(true);
            } else setFolderId(created.id);
          }}
        />
      )}
      {deletingFolder && (
        <LoreDeleteFolderDialog
          folder={deletingFolder}
          folders={folders}
          onClose={() => setDeletingFolder(null)}
          onDeleted={async () => {
            await refresh();
            setDeletingFolder(null);
            navigate(region.id, null);
            setMessage('Pasta excluída. As crônicas foram preservadas.');
          }}
        />
      )}
      {editingFolder && (
        <LoreEditFolderDialog
          folder={editingFolder}
          folders={folders}
          onClose={() => setEditingFolder(null)}
          onSaved={async () => {
            await refresh();
            setEditingFolder(null);
            setMessage('Pasta atualizada.');
          }}
        />
      )}
      {trash && (
        <Modal title="Pastas excluídas" close={() => setTrash(null)}>
          <div className="lore-trash-list">
            {trashError && <p role="alert">{trashError}</p>}
            {!trash.length && <p>Nenhuma pasta excluída.</p>}
            {trash.map((item) => (
              <div key={item.id}>
                <LoreScrollHolderIcon />
                <span>
                  <b>{item.name}</b>
                  <small>
                    {index.regions.find((region) => region.id === item.region_id)?.name}
                  </small>
                </span>
                <button
                  className="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setTrashError('');
                    try {
                      await post(`/lore/folder-trash/${item.id}/restore`, {});
                      await refresh();
                      setTrash((current) => current?.filter((entry) => entry.id !== item.id) || []);
                      setMessage('Pasta restaurada.');
                    } catch (error) {
                      setTrashError((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <Undo2 size={14} />
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
}

function LoreDeleteFolderDialog({
  folder,
  folders,
  onClose,
  onDeleted,
}: {
  folder: LoreFolder;
  folders: LoreFolder[];
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const removed = loreDescendants(folder.id, folders);
  const destinations = folders.filter((item) => !removed.has(item.id));
  const [destination, setDestination] = useState(destinations[0]?.id || '');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={`Excluir pasta ${folder.name}`} close={onClose}>
      <form
        className="lore-delete-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(`/lore/folders/${folder.id}`, {
              method: 'DELETE',
              body: JSON.stringify({ destination_id: destination || null }),
            });
            await onDeleted();
          } catch (issue) {
            setError((issue as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>
          A pasta e suas subpastas sairão do arquivo. As crônicas serão preservadas na pasta de
          destino escolhida.
        </p>
        <label>
          Guardar crônicas em
          <select value={destination} onChange={(event) => setDestination(event.target.value)}>
            <option value="">Excluir somente se estiver vazia</option>
            {destinations.map((item) => (
              <option key={item.id} value={item.id}>
                {loreFolderPath(item.id, folders)}
              </option>
            ))}
          </select>
        </label>
        <p className="lore-delete-note">Você pode restaurar a pasta em Pastas excluídas.</p>
        {error && <p role="alert">{error}</p>}
        <div>
          <button className="button" type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="button danger" disabled={busy}>
            <Trash2 size={15} />
            {busy ? 'Excluindo…' : 'Excluir pasta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LoreEditFolderDialog({
  folder,
  folders,
  onClose,
  onSaved,
}: {
  folder: LoreFolder;
  folders: LoreFolder[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const excluded = loreDescendants(folder.id, folders);
  const [name, setName] = useState(folder.name),
    [parent, setParent] = useState(folder.parent_id || '');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal title="Editar pasta" close={onClose}>
      <form
        className="lore-create-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await api(`/lore/folders/${folder.id}`, {
              method: 'PUT',
              body: JSON.stringify({ name, parent_id: parent || null, revision: folder.revision }),
            });
            await onSaved();
          } catch (issue) {
            setError((issue as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Nome da pasta
          <input
            autoFocus
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Dentro da pasta
          <select value={parent} onChange={(event) => setParent(event.target.value)}>
            <option value="">Raiz da região</option>
            {folders
              .filter((item) => !excluded.has(item.id))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {loreFolderPath(item.id, folders)}
                </option>
              ))}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar pasta'}
        </button>
      </form>
    </Modal>
  );
}

function LoreCreateDialog({
  kind,
  index,
  regionId,
  folderId,
  onClose,
  onCreated,
}: {
  kind: 'page' | 'folder';
  index: LoreIndex;
  regionId: string;
  folderId: string | null;
  onClose: () => void;
  onCreated: (item: LorePage | LoreFolder) => Promise<void>;
}) {
  const [region, setRegion] = useState(regionId),
    [folder, setFolder] = useState(
      folderId ||
        (kind === 'page'
          ? index.folders.find((item) => item.region_id === regionId && item.name === 'História')
              ?.id
          : '') ||
        '',
    );
  const [name, setName] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const folders = index.folders.filter((item) => item.region_id === region);
  return (
    <Modal
      title={kind === 'page' ? 'Escrever uma crônica' : 'Nova pasta do arquivo'}
      close={onClose}
    >
      <form
        className="lore-create-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          try {
            await onCreated(
              kind === 'page'
                ? await post<LorePage>('/lore/pages', {
                    title: name,
                    subtitle: '',
                    region_id: region,
                    folder_id: folder,
                    published: false,
                    blocks: [textBlock()],
                  })
                : await post<LoreFolder>('/lore/folders', {
                    name,
                    region_id: region,
                    parent_id: folder || null,
                  }),
            );
          } catch (issue) {
            setError((issue as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {kind === 'page' ? 'Título da crônica' : 'Nome da pasta'}
          <input
            autoFocus
            required
            minLength={2}
            maxLength={kind === 'page' ? 140 : 80}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          Região
          <select
            value={region}
            onChange={(event) => {
              setRegion(event.target.value);
              setFolder(
                kind === 'page'
                  ? index.folders.find(
                      (item) => item.region_id === event.target.value && item.name === 'História',
                    )?.id || ''
                  : '',
              );
            }}
          >
            {index.regions.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {kind === 'page' ? 'Pasta' : 'Dentro da pasta'}
          <select value={folder} onChange={(event) => setFolder(event.target.value)}>
            {kind === 'folder' && <option value="">Raiz da região</option>}
            {folders.map((item) => (
              <option key={item.id} value={item.id}>
                {loreFolderPath(item.id, folders)}
              </option>
            ))}
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy || (kind === 'page' && !folder)}>
          {busy ? 'Criando…' : kind === 'page' ? 'Criar rascunho' : 'Criar pasta'}
        </button>
      </form>
    </Modal>
  );
}

function LoreEditor({
  page,
  index,
  onSaved,
  onCancel,
}: {
  page: LorePage;
  index: LoreIndex;
  onSaved: (page: LorePage) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(page),
    [history, setHistory] = useState<LorePage[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [preview, setPreview] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(page);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    addEventListener('beforeunload', guard);
    return () => removeEventListener('beforeunload', guard);
  }, [dirty]);
  function change(next: LorePage) {
    setHistory((past) => [...past.slice(-39), draft]);
    setDraft(next);
  }
  function updateBlock(id: string, update: (block: LoreBlock) => LoreBlock) {
    change({
      ...draft,
      blocks: draft.blocks.map((block) => (block.id === id ? update(block) : block)),
    });
  }
  function move(id: string, offset: number) {
    const blocks = [...draft.blocks],
      from = blocks.findIndex((block) => block.id === id),
      to = from + offset;
    if (to < 0 || to >= blocks.length) return;
    [blocks[from], blocks[to]] = [blocks[to], blocks[from]];
    change({ ...draft, blocks });
  }
  async function save(published: boolean) {
    setBusy(true);
    setError('');
    try {
      await onSaved(
        await api<LorePage>(`/lore/pages/${page.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: draft.title,
            subtitle: draft.subtitle,
            region_id: draft.region_id,
            folder_id: draft.folder_id,
            blocks: draft.blocks,
            revision: page.revision,
            published,
          }),
        }),
      );
    } catch (issue) {
      setError((issue as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const folders = index.folders.filter((item) => item.region_id === draft.region_id);
  return (
    <section className="lore-editor" aria-label="Editor de crônica">
      <div className="lore-editor-toolbar">
        <span>
          <Feather size={18} /> A mesa do escriba
        </span>
        <div>
          <button
            type="button"
            disabled={busy || !history.length}
            onClick={() => {
              setDraft(history.at(-1)!);
              setHistory((past) => past.slice(0, -1));
            }}
          >
            <Undo2 size={15} /> Desfazer
          </button>
          <button type="button" onClick={() => setPreview(!preview)}>
            <Eye size={15} />
            {preview ? 'Voltar à edição' : 'Prévia'}
          </button>
          <button type="button" disabled={busy} onClick={() => void save(false)}>
            <Save size={15} /> Salvar rascunho
          </button>
          <button
            className="button primary"
            disabled={busy || draft.title.trim().length < 2}
            onClick={() => void save(true)}
          >
            <Check size={15} /> {busy ? 'Salvando…' : 'Publicar'}
          </button>
        </div>
      </div>
      {error && (
        <p className="lore-editor-error" role="alert">
          {error}
        </p>
      )}
      {preview ? (
        <article className="lore-reader lore-editor-preview">
          <header>
            <span className="lore-kicker">{loreFolderPath(draft.folder_id, folders)}</span>
            <h2>{draft.title}</h2>
            <p>{draft.subtitle}</p>
            <div className="lore-rule" aria-hidden="true">
              ✦
            </div>
          </header>
          <LoreBlocks blocks={draft.blocks} />
        </article>
      ) : (
        <>
          <div className="lore-editor-meta">
            <label>
              Título
              <input
                value={draft.title}
                maxLength={140}
                onChange={(event) => change({ ...draft, title: event.target.value })}
              />
            </label>
            <label>
              Subtítulo
              <input
                value={draft.subtitle}
                maxLength={300}
                onChange={(event) => change({ ...draft, subtitle: event.target.value })}
              />
            </label>
            <label>
              Região
              <select
                value={draft.region_id}
                onChange={(event) =>
                  change({
                    ...draft,
                    region_id: event.target.value,
                    folder_id: index.folders.find(
                      (item) => item.region_id === event.target.value && item.name === 'História',
                    )!.id,
                  })
                }
              >
                {index.regions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pasta
              <select
                value={draft.folder_id}
                onChange={(event) => change({ ...draft, folder_id: event.target.value })}
              >
                {folders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {loreFolderPath(item.id, folders)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="lore-edit-blocks">
            {draft.blocks.map((block, position) => (
              <section
                className="lore-edit-block"
                key={block.id}
                aria-label={`Bloco ${position + 1}`}
              >
                <header>
                  <span>
                    {block.type === 'image' ? <ImagePlus size={16} /> : <ScrollText size={16} />}{' '}
                    {block.type === 'image' ? 'Imagem' : 'Texto'} ·{' '}
                    {(position + 1).toString().padStart(2, '0')}
                  </span>
                  <div>
                    <button
                      aria-label={`Subir bloco ${position + 1}`}
                      disabled={!position}
                      onClick={() => move(block.id, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      aria-label={`Descer bloco ${position + 1}`}
                      disabled={position === draft.blocks.length - 1}
                      onClick={() => move(block.id, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      aria-label={`Remover bloco ${position + 1}`}
                      onClick={() =>
                        change({
                          ...draft,
                          blocks: draft.blocks.filter((item) => item.id !== block.id),
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </header>
                {block.type === 'text' ? (
                  <>
                    <div className="lore-block-options">
                      <label>
                        Tipo de caixa
                        <select
                          value={block.style}
                          onChange={(event) =>
                            updateBlock(block.id, (item) =>
                              item.type === 'text'
                                ? { ...item, style: event.target.value as typeof block.style }
                                : item,
                            )
                          }
                        >
                          {Object.entries(styleLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Alinhamento
                        <select
                          value={block.alignment}
                          onChange={(event) =>
                            updateBlock(block.id, (item) => ({
                              ...item,
                              alignment: event.target.value as typeof block.alignment,
                            }))
                          }
                        >
                          {Object.entries(alignLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      Título do bloco
                      <input
                        value={block.title}
                        maxLength={140}
                        onChange={(event) =>
                          updateBlock(block.id, (item) =>
                            item.type === 'text' ? { ...item, title: event.target.value } : item,
                          )
                        }
                      />
                    </label>
                    <label>
                      Texto
                      <textarea
                        value={block.text}
                        maxLength={12000}
                        rows={7}
                        placeholder="Escreva a história. Separe parágrafos com uma linha em branco."
                        onChange={(event) =>
                          updateBlock(block.id, (item) =>
                            item.type === 'text' ? { ...item, text: event.target.value } : item,
                          )
                        }
                      />
                    </label>
                  </>
                ) : (
                  <div className="lore-image-settings">
                    <img
                      className="lore-upload-preview"
                      src={loreImageUrl(block.asset_id)}
                      alt={block.alt || 'Imagem enviada'}
                    />
                    <div>
                      <div className="lore-block-options">
                        <label>
                          Formato
                          <select
                            value={block.format}
                            onChange={(event) =>
                              updateBlock(block.id, (item) =>
                                item.type === 'image'
                                  ? {
                                      ...item,
                                      format: event.target.value as typeof block.format,
                                      alignment:
                                        event.target.value === 'half-landscape' &&
                                        item.alignment === 'center'
                                          ? 'left'
                                          : item.alignment,
                                    }
                                  : item,
                              )
                            }
                          >
                            {Object.entries(formatLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Posição
                          <select
                            value={block.alignment}
                            onChange={(event) =>
                              updateBlock(block.id, (item) => ({
                                ...item,
                                alignment: event.target.value as typeof block.alignment,
                              }))
                            }
                          >
                            {Object.entries(alignLabels)
                              .filter(
                                ([value]) =>
                                  block.format !== 'half-landscape' || value !== 'center',
                              )
                              .map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                      <div className="lore-block-options">
                        <label>
                          Enquadramento
                          <select
                            value={block.fit}
                            onChange={(event) =>
                              updateBlock(block.id, (item) =>
                                item.type === 'image'
                                  ? { ...item, fit: event.target.value as typeof block.fit }
                                  : item,
                              )
                            }
                          >
                            <option value="cover">Preencher moldura</option>
                            <option value="contain">Mostrar imagem inteira</option>
                          </select>
                        </label>
                        <label>
                          Efeito
                          <select
                            value={block.effect}
                            onChange={(event) =>
                              updateBlock(block.id, (item) =>
                                item.type === 'image'
                                  ? { ...item, effect: event.target.value as typeof block.effect }
                                  : item,
                              )
                            }
                          >
                            <option value="cinematic">Névoa, grão e movimento suave</option>
                            <option value="still">Imagem sem efeito</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Descrição da imagem
                        <input
                          value={block.alt}
                          maxLength={300}
                          onChange={(event) =>
                            updateBlock(block.id, (item) =>
                              item.type === 'image' ? { ...item, alt: event.target.value } : item,
                            )
                          }
                        />
                      </label>
                      <label>
                        Legenda
                        <input
                          value={block.caption}
                          maxLength={500}
                          onChange={(event) =>
                            updateBlock(block.id, (item) =>
                              item.type === 'image'
                                ? { ...item, caption: event.target.value }
                                : item,
                            )
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>
          <div className="lore-add-block">
            <button
              className="button"
              disabled={busy || draft.blocks.length >= 50}
              onClick={() => change({ ...draft, blocks: [...draft.blocks, textBlock()] })}
            >
              <Plus size={16} /> Adicionar caixa de texto
            </button>
            <button
              className="button"
              disabled={busy || draft.blocks.length >= 50}
              onClick={() => file.current?.click()}
            >
              <ImagePlus size={16} /> Adicionar imagem
            </button>
            <span>PNG, JPEG ou WebP · até 12 MB</span>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="lore-file-input"
            aria-label="Enviar imagem para a crônica"
            onChange={async (event) => {
              const uploaded = event.target.files?.[0];
              event.target.value = '';
              if (!uploaded) return;
              if (uploaded.size > LORE_MAX_IMAGE_BYTES) {
                setError('A imagem deve ter no máximo 12 MB.');
                return;
              }
              setBusy(true);
              setError('');
              try {
                const asset = await api<{ id: string }>(`/lore/pages/${page.id}/images`, {
                  method: 'POST',
                  body: uploaded,
                  headers: { 'Content-Type': uploaded.type },
                });
                change({
                  ...draft,
                  blocks: [
                    ...draft.blocks,
                    {
                      id: crypto.randomUUID(),
                      type: 'image',
                      asset_id: asset.id,
                      alt: '',
                      caption: '',
                      format: 'landscape',
                      alignment: 'center',
                      fit: 'cover',
                      effect: 'cinematic',
                    },
                  ],
                });
              } catch (issue) {
                setError((issue as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </>
      )}
      <div className="lore-editor-bottom">
        <span>{dirty ? 'Há alterações ainda não salvas.' : 'Rascunho sem alterações.'}</span>
        <button
          onClick={() => {
            if (!dirty || confirm('Descartar as alterações não salvas desta crônica?')) onCancel();
          }}
        >
          <X size={15} /> Fechar edição
        </button>
      </div>
    </section>
  );
}

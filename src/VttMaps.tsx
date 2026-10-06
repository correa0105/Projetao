import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ChevronRight,
  Folder,
  FolderPlus,
  Image,
  Map,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import {
  folderTrail,
  sceneSchema,
  type VttDocument,
  type VttScene,
  type VttAsset,
} from '../shared/vtt';
import './vtt-maps.css';

export function VttModal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
      if (e.key !== 'Tab') return;
      const items = [
        ...ref.current!.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,[tabindex="0"]',
        ),
      ];
      const first = items[0],
        last = items.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    ref.current?.addEventListener('keydown', key);
    const element = ref.current;
    return () => {
      element?.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="vtt-modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`vtt-map-dialog ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <header>
          <div>
            <span className="vtt-eyebrow">MESA VIRTUAL</span>
            <h2>{title}</h2>
          </div>
          <button aria-label={`Fechar ${title}`} onClick={close}>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function FolderOptions({ doc, omit }: { doc: VttDocument; omit?: string }) {
  return (
    <>
      <option value="">Sem pasta</option>
      {doc.folders
        .filter((f) => !folderTrail(doc, f.id).some((p) => p.id === omit))
        .map((f) => (
          <option key={f.id} value={f.id}>
            {folderTrail(doc, f.id)
              .map((p) => p.name)
              .join(' / ')}
          </option>
        ))}
    </>
  );
}

export function MapLibrary({
  doc,
  edit,
  activate,
  create,
  configure,
  close,
}: {
  doc: VttDocument;
  edit: (fn: (d: VttDocument) => void) => void;
  activate: (id: string) => void;
  create: (folderId: string | null) => void;
  configure: (id: string) => void;
  close: () => void;
}) {
  const [location, setLocation] = useState('all'),
    [query, setQuery] = useState(''),
    [folderEditor, setFolderEditor] = useState<{
      id: string;
      name: string;
      parentId: string | null;
    } | null>(null);
  const folderId = doc.folders.some((f) => f.id === location) ? location : null;
  const trail = folderTrail(doc, folderId);
  const scenes = doc.scenes.filter(
    (s) =>
      (location === 'archived' ? s.archived : !s.archived) &&
      (location === 'all' || location === 'archived' || s.folderId === folderId) &&
      s.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const children =
    location === 'archived'
      ? []
      : doc.folders.filter(
          (f) =>
            (location === 'all' ? !f.parentId : f.parentId === folderId) &&
            (!query || f.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())),
        );
  const tree = (parentId: string | null, depth = 0): React.ReactNode =>
    doc.folders
      .filter((f) => f.parentId === parentId)
      .map((f) => (
        <div key={f.id}>
          <button
            className={location === f.id ? 'selected' : ''}
            style={{ paddingLeft: 14 + depth * 14 }}
            onClick={() => setLocation(f.id)}
          >
            <Folder size={15} />
            <span>{f.name}</span>
            <small>
              {
                doc.scenes.filter(
                  (s) => !s.archived && folderTrail(doc, s.folderId).some((p) => p.id === f.id),
                ).length
              }
            </small>
          </button>
          {tree(f.id, depth + 1)}
        </div>
      ));
  return (
    <VttModal title="Biblioteca de mapas" wide close={close}>
      <div className="vtt-map-search">
        <label>
          <Search size={17} />
          <input
            aria-label="Buscar mapas"
            placeholder="Localizar mapa pelo nome…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          onClick={() => setFolderEditor({ id: crypto.randomUUID(), name: '', parentId: folderId })}
        >
          <FolderPlus size={16} />
          Nova pasta
        </button>
        <button
          className="vtt-gold"
          onClick={() => create(folderId)}
          disabled={doc.scenes.length >= 50}
        >
          <Plus size={16} />
          Novo mapa
        </button>
      </div>
      <div className="vtt-map-browser">
        <nav aria-label="Pastas dos mapas">
          <button
            className={location === 'all' ? 'selected' : ''}
            onClick={() => setLocation('all')}
          >
            <Map size={16} />
            <span>Todos os mapas</span>
            <small>{doc.scenes.filter((s) => !s.archived).length}</small>
          </button>
          <button
            className={location === 'root' ? 'selected' : ''}
            onClick={() => setLocation('root')}
          >
            <Folder size={16} />
            <span>Sem pasta</span>
          </button>
          {tree(null)}
          <button
            className={location === 'archived' ? 'selected' : ''}
            onClick={() => setLocation('archived')}
          >
            <Archive size={16} />
            <span>Arquivados</span>
            <small>{doc.scenes.filter((s) => s.archived).length}</small>
          </button>
        </nav>
        <section className="vtt-map-browser-main">
          <div className="vtt-map-breadcrumb">
            <button onClick={() => setLocation('all')}>Mapas</button>
            {trail.map((f) => (
              <span key={f.id}>
                <ChevronRight size={13} />
                <button onClick={() => setLocation(f.id)}>{f.name}</button>
              </span>
            ))}
            {location === 'archived' && <span> / Arquivados</span>}
            {folderId && (
              <button
                className="vtt-folder-edit"
                aria-label="Editar pasta"
                onClick={() =>
                  setFolderEditor(structuredClone(doc.folders.find((f) => f.id === folderId)!))
                }
              >
                <Settings2 size={15} />
                Editar pasta
              </button>
            )}
          </div>
          {folderEditor && (
            <form
              className="vtt-folder-editor"
              onSubmit={(e) => {
                e.preventDefault();
                if (!folderEditor.name.trim()) return;
                edit((d) => {
                  const f = d.folders.find((f) => f.id === folderEditor.id);
                  if (f) Object.assign(f, folderEditor);
                  else d.folders.push(folderEditor);
                });
                setLocation(folderEditor.id);
                setFolderEditor(null);
              }}
            >
              <label>
                Nome da pasta
                <input
                  aria-label="Nome da pasta"
                  value={folderEditor.name}
                  onChange={(e) => setFolderEditor({ ...folderEditor, name: e.target.value })}
                  required
                  maxLength={100}
                  autoFocus
                />
              </label>
              <label>
                Pasta superior
                <select
                  aria-label="Pasta superior"
                  value={folderEditor.parentId || ''}
                  onChange={(e) =>
                    setFolderEditor({ ...folderEditor, parentId: e.target.value || null })
                  }
                >
                  <FolderOptions doc={doc} omit={folderEditor.id} />
                </select>
              </label>
              <div className="vtt-row">
                <button className="vtt-gold" type="submit">
                  Salvar pasta
                </button>
                <button type="button" onClick={() => setFolderEditor(null)}>
                  Cancelar
                </button>
                {doc.folders.some((f) => f.id === folderEditor.id) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !confirm(
                          'Excluir a pasta? Seus mapas e subpastas serão movidos para a pasta superior.',
                        )
                      )
                        return;
                      edit((d) => {
                        const id = folderEditor.id,
                          parent = d.folders.find((f) => f.id === id)!.parentId;
                        d.folders = d.folders.filter((f) => f.id !== id);
                        d.folders.forEach((f) => {
                          if (f.parentId === id) f.parentId = parent;
                        });
                        d.scenes.forEach((s) => {
                          if (s.folderId === id) s.folderId = parent;
                        });
                      });
                      setLocation(folderEditor.parentId || 'root');
                      setFolderEditor(null);
                    }}
                  >
                    <Trash2 size={14} />
                    Excluir pasta
                  </button>
                )}
              </div>
            </form>
          )}
          <div className="vtt-map-cards">
            {children.map((f) => (
              <button key={f.id} className="vtt-folder-card" onClick={() => setLocation(f.id)}>
                <Folder size={62} strokeWidth={1} />
                <strong>{f.name}</strong>
                <span>
                  {
                    doc.scenes.filter(
                      (s) => !s.archived && folderTrail(doc, s.folderId).some((p) => p.id === f.id),
                    ).length
                  }{' '}
                  mapas
                </span>
              </button>
            ))}
            {scenes.map((s) => (
              <article
                className={`vtt-map-card ${s.id === doc.activeScene ? 'active' : ''}`}
                key={s.id}
              >
                <button
                  className="vtt-map-card-open"
                  aria-label={`Abrir mapa ${s.name}`}
                  onClick={() => {
                    if (s.archived) configure(s.id);
                    else activate(s.id);
                  }}
                >
                  <div className="vtt-map-thumbnail" style={{ backgroundColor: s.backgroundColor }}>
                    {s.background ? (
                      <img src={s.background} alt="" />
                    ) : (
                      <span className="vtt-empty-map-grid">
                        <Map size={24} />
                      </span>
                    )}
                  </div>
                  <strong>{s.name}</strong>
                  <span>
                    {s.id === doc.activeScene ? 'Em jogo · ' : ''}
                    {Math.round((s.width / s.grid.size) * 10) / 10} ×{' '}
                    {Math.round((s.height / s.grid.size) * 10) / 10} células
                  </span>
                </button>
                <button
                  className="vtt-map-card-settings"
                  aria-label={`Configurar mapa ${s.name}`}
                  onClick={() => configure(s.id)}
                >
                  <Settings2 size={15} />
                </button>
              </article>
            ))}
          </div>
          {!scenes.length && !children.length && (
            <p className="vtt-map-empty">
              <Map size={36} />
              {query ? 'Nenhum mapa com esse nome.' : 'Esta pasta está pronta para seus mapas.'}
            </p>
          )}
        </section>
      </div>
      <footer>
        <span>
          {doc.scenes.filter((s) => !s.archived).length} mapas · {doc.folders.length} pastas
        </span>
        <button onClick={close}>Voltar à mesa</button>
      </footer>
    </VttModal>
  );
}

function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 16000,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={Number(value.toFixed(3))}
        min={min}
        max={max}
        step="any"
        onChange={(e) => {
          const n = e.currentTarget.valueAsNumber;
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}
export function MapSettings({
  scene,
  doc,
  assets,
  close,
  save,
  remove,
  upload,
}: {
  scene: VttScene;
  doc: VttDocument;
  assets: VttAsset[];
  close: () => void;
  save: (s: VttScene) => void;
  remove: () => void;
  upload: (file: File) => Promise<VttAsset>;
}) {
  const [draft, setDraft] = useState(() => structuredClone(scene)),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [extraAssets, setExtraAssets] = useState<VttAsset[]>([]);
  const change = (fn: (s: VttScene) => void) =>
    setDraft((s) => {
      const next = structuredClone(s);
      fn(next);
      return next;
    });
  const grid = (patch: Partial<VttScene['grid']>) => change((s) => Object.assign(s.grid, patch));
  const percent = (name: string, value: number, update: (n: number) => void, min = 0) => (
    <label>
      {name}
      <span className="vtt-range-row">
        <input
          aria-label={name}
          type="range"
          min={min}
          max="1"
          step=".01"
          value={value}
          onChange={(e) => update(Number(e.target.value))}
        />
        <output>{Math.round(value * 100)}%</output>
      </span>
    </label>
  );
  const toggle = (name: string, value: boolean, update: (n: boolean) => void) => (
    <label className="vtt-check vtt-setting-toggle">
      <span>{name}</span>
      <input
        aria-label={name}
        type="checkbox"
        role="switch"
        checked={value}
        onChange={(e) => update(e.target.checked)}
      />
    </label>
  );
  const allAssets = [
    ...assets,
    ...extraAssets.filter((a) => !assets.some((old) => old.id === a.id)),
  ];
  const persist = (s = draft) => {
    try {
      save(sceneSchema.parse(s));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const others = doc.scenes.some((s) => s.id !== scene.id && !s.archived);
  return (
    <VttModal title="Configurações do mapa" close={close}>
      <form
        className="vtt-settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          persist();
        }}
      >
        <div className="vtt-settings-scroll">
          {error && (
            <p role="alert" className="vtt-map-error">
              {error}
            </p>
          )}
          <section>
            <h3>Detalhes do mapa</h3>
            <label>
              Nome do mapa
              <input
                value={draft.name}
                aria-label="Nome do mapa"
                required
                maxLength={100}
                onChange={(e) =>
                  change((s) => {
                    s.name = e.target.value;
                  })
                }
              />
            </label>
            <label>
              Pasta
              <select
                aria-label="Pasta do mapa"
                value={draft.folderId || ''}
                onChange={(e) =>
                  change((s) => {
                    s.folderId = e.target.value || null;
                  })
                }
              >
                <FolderOptions doc={doc} />
              </select>
            </label>
            <h4>Tamanho</h4>
            {(['width', 'height'] as const).map((axis) => (
              <div className="vtt-size-row" key={axis}>
                <Num
                  label={axis === 'width' ? 'Largura em células' : 'Altura em células'}
                  value={draft[axis] / draft.grid.size}
                  min={280 / draft.grid.size}
                  max={16000 / draft.grid.size}
                  step={0.1}
                  onChange={(n) =>
                    change((s) => {
                      s[axis] = Math.round(n * s.grid.size);
                    })
                  }
                />
                <span>× {draft.grid.size} px =</span>
                <Num
                  label={axis === 'width' ? 'Largura do mapa' : 'Altura do mapa'}
                  value={draft[axis]}
                  min={280}
                  onChange={(n) =>
                    change((s) => {
                      s[axis] = Math.round(n);
                    })
                  }
                />
                <span>px</span>
              </div>
            ))}
            <p className="vtt-muted">
              Estas dimensões correspondem ao tamanho real em zoom de 100%.
            </p>
          </section>
          <section>
            <h3>Fundo e entorno</h3>
            <div className="vtt-two">
              <label>
                Cor do tabuleiro
                <input
                  type="color"
                  aria-label="Cor do tabuleiro"
                  value={draft.backgroundColor}
                  onChange={(e) =>
                    change((s) => {
                      s.backgroundColor = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Cor do entorno
                <input
                  type="color"
                  aria-label="Cor do entorno"
                  value={draft.backdropColor}
                  onChange={(e) =>
                    change((s) => {
                      s.backdropColor = e.target.value;
                    })
                  }
                />
              </label>
            </div>
            {toggle('Usar cor predominante do mapa no entorno', draft.dominantBackdrop, (n) =>
              change((s) => {
                s.dominantBackdrop = n;
              }),
            )}
            <label>
              Imagem de fundo
              <select
                aria-label="Imagem de fundo"
                value={draft.background}
                onChange={(e) =>
                  change((s) => {
                    s.background = e.target.value;
                  })
                }
              >
                <option value="">Sem imagem · tabuleiro vazio</option>
                {draft.background.startsWith('/vtt/') && (
                  <option value={draft.background}>Mapa original</option>
                )}
                {allAssets
                  .filter((a) => a.kind === 'image')
                  .map((a) => (
                    <option key={a.id} value={a.path}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="vtt-file-button">
              <Image size={15} />
              {busy ? 'Enviando imagem…' : 'Enviar imagem de mapa'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setBusy(true);
                  void upload(file)
                    .then((a) => {
                      setExtraAssets((old) => [...old, a]);
                      change((s) => {
                        s.background = a.path;
                      });
                    })
                    .catch((err) => setError(err.message))
                    .finally(() => setBusy(false));
                }}
              />
            </label>
          </section>
          <section>
            <h3>Escala</h3>
            <div className="vtt-two">
              <Num
                label="Distância por célula"
                value={draft.grid.scale}
                min={0.1}
                max={1000}
                step={0.1}
                onChange={(n) => grid({ scale: n })}
              />
              <label>
                Unidade
                <select
                  aria-label="Unidade"
                  value={draft.grid.unit}
                  onChange={(e) => grid({ unit: e.target.value as 'ft' | 'm' })}
                >
                  <option value="ft">Pés (ft)</option>
                  <option value="m">Metros (m)</option>
                </select>
              </label>
            </div>
          </section>
          <section>
            <h3>Grade</h3>
            {toggle('Exibir grade', draft.grid.type !== 'none', (n) =>
              grid({ type: n ? 'square' : 'none' }),
            )}
            <label>
              Tipo de grade
              <select
                aria-label="Tipo de grade"
                value={draft.grid.type}
                onChange={(e) => grid({ type: e.target.value as VttScene['grid']['type'] })}
              >
                <option value="square">Quadrada</option>
                <option value="hex-flat">Hexagonal · horizontal</option>
                <option value="hex-point">Hexagonal · vertical</option>
                <option value="none">Sem grade</option>
              </select>
            </label>
            <label>
              Medida das diagonais
              <select
                aria-label="Medida das diagonais"
                value={draft.grid.diagonal}
                onChange={(e) => grid({ diagonal: e.target.value as VttScene['grid']['diagonal'] })}
              >
                <option value="five">D&D · mesma distância</option>
                <option value="alternating">Alternada · 5 / 10</option>
                <option value="euclidean">Euclidiana</option>
                <option value="manhattan">Soma dos eixos</option>
              </select>
            </label>
            <div className="vtt-two">
              <Num
                label="Tamanho da célula"
                value={draft.grid.size}
                min={10}
                max={500}
                onChange={(n) => grid({ size: n })}
              />
              <Num
                label="Largura da célula (× 70 px)"
                value={draft.grid.size / 70}
                min={10 / 70}
                max={500 / 70}
                step={0.1}
                onChange={(n) => grid({ size: Math.round(n * 70 * 100) / 100 })}
              />
            </div>
            <div className="vtt-two">
              <Num
                label="Deslocamento X"
                value={draft.grid.offsetX}
                min={-500}
                max={500}
                onChange={(n) => grid({ offsetX: n })}
              />
              <Num
                label="Deslocamento Y"
                value={draft.grid.offsetY}
                min={-500}
                max={500}
                onChange={(n) => grid({ offsetY: n })}
              />
            </div>
            <label>
              Cor da grade
              <input
                aria-label="Cor da grade"
                type="color"
                value={draft.grid.color}
                onChange={(e) => grid({ color: e.target.value })}
              />
            </label>
            {percent('Opacidade da grade', draft.grid.opacity, (n) => grid({ opacity: n }))}
            {toggle('Encaixar objetos na grade', draft.grid.snap, (n) => grid({ snap: n }))}
          </section>
          <section>
            <h3>Máscara, luz e camadas</h3>
            {toggle('Cobrir mapa com névoa', draft.fog, (n) =>
              change((s) => {
                s.fog = n;
                if (n && s.fogMode === 'vision') {
                  s.lighting = true;
                  s.ambient = 0;
                }
              }),
            )}
            <label>
              Revelação da névoa
              <select
                aria-label="Revelação da névoa"
                value={draft.fogMode}
                onChange={(e) =>
                  change((s) => {
                    s.fogMode = e.target.value as VttScene['fogMode'];
                    if (s.fog && s.fogMode === 'vision') {
                      s.lighting = true;
                      s.ambient = 0;
                    }
                  })
                }
              >
                <option value="vision">Automática · visão do personagem</option>
                <option value="manual">Manual · pincel do mestre</option>
              </select>
            </label>
            {percent('Escuridão para o mestre', draft.gmDarkness, (n) =>
              change((s) => {
                s.gmDarkness = n;
              }),
            )}
            {percent(
              'Opacidade da camada do mestre',
              draft.gmOpacity,
              (n) =>
                change((s) => {
                  s.gmOpacity = n;
                }),
              0.05,
            )}
            {toggle('Iluminação dinâmica', draft.lighting, (n) =>
              change((s) => {
                s.lighting = n;
              }),
            )}
            {percent('Luz ambiente', draft.ambient, (n) =>
              change((s) => {
                s.ambient = n;
              }),
            )}
            <p className="vtt-muted">
              Paredes, portas fechadas e janelas fechadas sempre bloqueiam a passagem dos
              personagens. Abra portas e janelas na camada de iluminação para permitir
              atravessá-las.
            </p>
            <p className="vtt-muted">
              A camada do mestre fica invisível aos jogadores. A opacidade afeta apenas sua
              visualização.
            </p>
          </section>
          <section>
            <h3>Áudio</h3>
            <label>
              Tocar ao abrir o mapa
              <select
                aria-label="Tocar ao abrir o mapa"
                value={draft.onLoadAudio || ''}
                onChange={(e) =>
                  change((s) => {
                    s.onLoadAudio = e.target.value || null;
                  })
                }
              >
                <option value="">Sem trilha automática</option>
                {allAssets
                  .filter((a) => a.kind === 'audio')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <p className="vtt-muted">As trilhas enviadas na aba Música aparecem aqui.</p>
          </section>
          <div className="vtt-row vtt-map-danger">
            <button
              type="button"
              disabled={!draft.archived && !others}
              onClick={() => persist({ ...draft, archived: !draft.archived })}
            >
              <Archive size={15} />
              {draft.archived ? 'Restaurar mapa' : 'Arquivar mapa'}
            </button>
            <button
              type="button"
              disabled={!others}
              className="vtt-delete"
              onClick={() => {
                if (confirm('Excluir este mapa e seus objetos permanentemente?')) remove();
              }}
            >
              <Trash2 size={15} />
              Excluir mapa
            </button>
          </div>
        </div>
        <footer>
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="vtt-gold" type="submit" disabled={busy}>
            Salvar configurações
          </button>
        </footer>
      </form>
    </VttModal>
  );
}

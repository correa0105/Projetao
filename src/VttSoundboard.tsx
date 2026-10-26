import { Fragment, useEffect, useRef, useState } from 'react';
import {
  Music,
  Wind,
  Volume2,
  Play,
  Square,
  Headphones,
  Upload,
  Plus,
  Star,
  Trash2,
  RotateCcw,
  Maximize2,
  Minimize2,
  Search,
} from 'lucide-react';
import { soundScenarios, soundMatches, soundDuration } from '../shared/vtt-sound-library';
import { VttScreenEffectControls } from './VttScreenEffects';
import { VttVoicePanel } from './VttVoicePanel';
import type { useVttVoice } from './useVttVoice';
import {
  soundCatalog,
  soundSettings,
  type SoundCommand,
  type SoundSettings,
  type SoundSnapshot,
  type SoundEntry,
} from '../shared/vtt-sounds';
import { actionMime } from '../shared/vtt-hotbar';
import type { VttAsset } from '../shared/vtt';
import './vtt-soundboard.css';
type Props = {
  snapshot: SoundSnapshot | null;
  sceneId: string;
  voice: ReturnType<typeof useVttVoice>;
  shareVoice: (file: File) => Promise<void>;
  assets: VttAsset[];
  gm: boolean;
  command: (c: SoundCommand) => Promise<void>;
  upload: (f: File) => Promise<unknown>;
  error: string;
  unlock: () => void;
  active: (id: string) => boolean;
  preview: (s: SoundSettings) => unknown;
  stopPreview: () => void;
  previewing: boolean;
};
export function VttSoundboard({
  snapshot,
  sceneId,
  voice,
  shareVoice,
  assets,
  gm,
  command,
  upload,
  error,
  unlock,
  active,
  preview,
  stopPreview,
  previewing,
}: Props) {
  const [kind, setKind] = useState('music'),
    [category, setCategory] = useState('Todas'),
    [query, setQuery] = useState(''),
    [scenario, setScenario] = useState('Todos'),
    [expanded, setExpanded] = useState(false),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState(''),
    [drafts, setDrafts] = useState<Record<string, SoundSettings>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingVolume = useRef<number | null>(null);
  useEffect(
    () => () => {
      for (const [id, timer] of timers.current) {
        clearTimeout(timer);
        const value = draftsRef.current[id];
        if (value) void command({ kind: 'settings', settings: value }).catch(() => {});
      }
      if (pendingVolume.current !== null)
        void command({ kind: 'volume', volume: pendingVolume.current }).catch(() => {});
      stopPreview();
    },
    [],
  );
  useEffect(() => {
    setDrafts((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, value]) => [
          id,
          timers.current.has(id)
            ? value
            : snapshot
              ? soundSettings(id, snapshot.soundboard)
              : value,
        ]),
      ),
    );
  }, [snapshot?.revision]);
  const sent: SoundEntry[] = assets
    .filter((a) => a.kind === 'audio')
    .map((a) => ({
      id: 'asset:' + a.id,
      name: a.name,
      kind: 'effect',
      category: 'Enviados',
      path: a.path,
      duration: 0,
      loop: false,
      volume: 0.65,
      credit: 'Arquivo da mesa',
      description: 'Você escolhe como usar este áudio.',
    }));
  const all = [...soundCatalog, ...sent],
    entries = all.filter(
      (e) =>
        (kind === 'removed'
          ? snapshot?.soundboard.hiddenSources.includes(e.id)
          : !snapshot?.soundboard.hiddenSources.includes(e.id)) &&
        (kind === 'favorites'
          ? snapshot?.soundboard.favorites.includes(e.id)
          : kind === 'removed'
            ? true
            : kind === 'uploads'
              ? e.id.startsWith('asset:')
              : !e.id.startsWith('asset:') && e.kind === kind),
    );
  const scenarios = [...new Set(entries.flatMap(soundScenarios))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const contextual = entries.filter(
    (e) => scenario === 'Todos' || soundScenarios(e).includes(scenario),
  );
  const categories = [...new Set(contextual.map((e) => e.category))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const filtered = contextual
    .filter((e) => (category === 'Todas' || category === e.category) && soundMatches(e, query))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category, 'pt-BR') ||
        a.name.localeCompare(b.name, 'pt-BR', { numeric: true }),
    );
  if (!snapshot) return <p className="vtt-muted">Carregando sons da mesa…</p>;
  const board = snapshot.soundboard;
  const settings = (id: string) =>
    drafts[id] ||
    board.settings.find((s) => s.sourceId === id) ||
    (id === 'asset:' + snapshot.music.assetId
      ? {
          sourceId: id,
          channel: 'music' as const,
          volume: snapshot.music.volume,
          loop: snapshot.music.loop,
        }
      : soundSettings(id, board));
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setFailure('');
    try {
      await fn();
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function persist(id: string) {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    const value = draftsRef.current[id] || settings(id);
    if (value) await command({ kind: 'settings', settings: value });
  }
  function adjust(value: SoundSettings) {
    draftsRef.current = { ...draftsRef.current, [value.sourceId]: value };
    setDrafts(draftsRef.current);
    const old = timers.current.get(value.sourceId);
    if (old) clearTimeout(old);
    timers.current.set(
      value.sourceId,
      setTimeout(() => void run(() => persist(value.sourceId)), 450),
    );
  }
  const pin = (entry: SoundEntry) =>
    void run(async () => {
      await persist(entry.id);
      window.dispatchEvent(
        new CustomEvent('vtt-pin-action', {
          detail: { kind: 'sound', sourceId: entry.id, label: entry.name },
        }),
      );
    });
  const playing = all.filter((e) => active(e.id));
  return (
    <div className={'vtt-soundboard' + (expanded ? ' is-expanded' : '')}>
      <div className="vtt-sound-library-heading">
        <div>
          <span>TRILHA DA AVENTURA</span>
          <strong>Som da mesa</strong>
          <small>
            {soundCatalog.filter((e) => e.kind === 'music').length} músicas ·{' '}
            {soundCatalog.filter((e) => e.kind === 'ambience').length} ambientes ·{' '}
            {soundCatalog.filter((e) => e.kind === 'effect').length} efeitos
          </small>
        </div>
        <button
          aria-label={expanded ? 'Recolher biblioteca de sons' : 'Ampliar biblioteca de sons'}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      <p className="vtt-muted">
        Combine uma música com ambientes e efeitos. Arraste <b>Fixar</b> para um dos dez atalhos ou
        clique para adicionar.
      </p>
      <div className="vtt-sound-master">
        <button onClick={unlock}>
          <Volume2 size={14} /> Ativar áudio neste navegador
        </button>
        {gm && (
          <>
            <label>
              Volume da mesa <output>{Math.round(board.volume * 100)}%</output>
              <input
                aria-label="Volume da mesa"
                type="range"
                min="0"
                max="1"
                step=".01"
                defaultValue={board.volume}
                key={board.volume}
                onChange={(e) => {
                  const volume = Number(e.target.value);
                  pendingVolume.current = volume;
                  const old = timers.current.get('master');
                  if (old) clearTimeout(old);
                  timers.current.set(
                    'master',
                    setTimeout(() => {
                      timers.current.delete('master');
                      pendingVolume.current = null;
                      void run(() => command({ kind: 'volume', volume }));
                    }, 450),
                  );
                }}
              />
            </label>
            <button
              className="vtt-stop-all"
              disabled={busy || (!board.voices.length && !snapshot.music.playing && !playing.length)}
              onClick={() => void run(() => command({ kind: 'stopAll' }))}
            >
              <Square size={12} /> Parar todos
            </button>
          </>
        )}
        <small>
          Cada participante mantém seus volumes de música e efeitos nas configurações do site.
        </small>
      </div>
      {(error || failure) && (
        <p className="vtt-sound-error" role="status">
          {failure || error}
        </p>
      )}
      {!!playing.length && (
        <section className="vtt-playing" aria-label="Sons tocando na mesa">
          <strong>Na mesa</strong>
          {playing.map((e) => (
            <div key={e.id}>
              <span className="vtt-audio-meter" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>{e.name}</span>
              {gm && (
                <button
                  aria-label={'Parar ' + e.name}
                  disabled={busy}
                  onClick={() => void run(() => command({ kind: 'stop', sourceId: e.id }))}
                >
                  <Square size={11} />
                </button>
              )}
            </div>
          ))}
        </section>
      )}
      {gm ? (
        <>
          <nav className="vtt-sound-tabs" aria-label="Tipos de som">
            {[
              ['music', 'Músicas'],
              ['ambience', 'Ambientes'],
              ['effect', 'Efeitos'],
              ['uploads', 'Enviados'],
              ['favorites', 'Favoritos'],
              ['removed', 'Removidos'],
              ['screen', 'Efeitos de tela'],
              ['voice', 'Microfone'],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={kind === id}
                onClick={() => {
                  stopPreview();
                  setKind(id);
                  setCategory('Todas');
                  setScenario('Todos');
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {kind === 'voice' ? (
            <VttVoicePanel voice={voice} gm={gm} share={shareVoice} />
          ) : kind === 'screen' ? (
            <VttScreenEffectControls
              snapshot={snapshot}
              sceneId={sceneId}
              command={command}
              unlock={unlock}
            />
          ) : (
            <>
              <div className="vtt-sound-search">
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label="Buscar sons"
                  type="search"
                  placeholder="Buscar: trovão, porta, dragão…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="vtt-sound-filters">
                <label className="vtt-sound-category">
                  Cenário
                  <select
                    aria-label="Cenário dos sons"
                    value={scenario}
                    onChange={(e) => {
                      setScenario(e.target.value);
                      setCategory('Todas');
                    }}
                  >
                    <option>Todos</option>
                    {scenarios.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label className="vtt-sound-category">
                  O que representa
                  <select
                    aria-label="Categoria de som"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option>Todas</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c} ({contextual.filter((e) => e.category === c).length})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {kind === 'uploads' && (
                <label className="vtt-file-button">
                  <Upload size={14} /> Enviar MP3, WAV ou OGG
                  <input
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/webm"
                    disabled={busy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void run(() => upload(f));
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              <small className="vtt-sound-count" role="status">
                {filtered.length} de {entries.length} sons · prévia só para você
              </small>
              {previewing && (
                <button className="vtt-preview-stop" onClick={stopPreview}>
                  <Square size={12} /> Parar prévia
                </button>
              )}
              <div className="vtt-sound-list">
                {filtered.map((entry, index) => {
                  const config = settings(entry.id),
                    isActive = active(entry.id),
                    Icon =
                      entry.kind === 'music' ? Music : entry.kind === 'ambience' ? Wind : Volume2;
                  return (
                    <Fragment key={entry.id}>
                      {(index === 0 || filtered[index - 1].category !== entry.category) && (
                        <h4 className="vtt-sound-group">
                          {entry.category}
                          <span>
                            {filtered.filter((e) => e.category === entry.category).length}
                          </span>
                        </h4>
                      )}
                      <article
                        key={entry.id}
                        className={'vtt-sound-card' + (isActive ? ' is-playing' : '')}
                        data-sound-id={entry.id}
                      >
                        <header>
                          <Icon size={17} />
                          <div>
                            <strong>{entry.name}</strong>
                            <small>
                              {entry.category}
                              {entry.duration > 0 ? ' · ' + soundDuration(entry.duration) : ''}
                            </small>
                          </div>
                          <button
                            aria-label={
                              (board.favorites.includes(entry.id)
                                ? 'Desmarcar favorito '
                                : 'Marcar favorito ') + entry.name
                            }
                            aria-pressed={board.favorites.includes(entry.id)}
                            disabled={busy || kind === 'removed'}
                            className="vtt-sound-star"
                            title="Favorito"
                            onClick={() =>
                              void run(() =>
                                command({
                                  kind: 'favorite',
                                  sourceId: entry.id,
                                  favorite: !board.favorites.includes(entry.id),
                                }),
                              )
                            }
                          >
                            <Star
                              size={16}
                              fill={board.favorites.includes(entry.id) ? 'currentColor' : 'none'}
                            />
                          </button>
                          <button
                            aria-label={
                              (kind === 'removed' ? 'Restaurar ' : 'Remover ') + entry.name
                            }
                            disabled={busy}
                            title={
                              kind === 'removed'
                                ? 'Restaurar na biblioteca da mesa'
                                : 'Remover da biblioteca desta mesa'
                            }
                            onClick={() => {
                              stopPreview();
                              void run(() =>
                                command({
                                  kind: 'hide',
                                  sourceId: entry.id,
                                  hidden: kind !== 'removed',
                                }),
                              );
                            }}
                          >
                            {kind === 'removed' ? <RotateCcw size={14} /> : <Trash2 size={14} />}
                          </button>
                        </header>
                        <p>{entry.description}</p>
                        {!!entry.tags?.length && (
                          <div className="vtt-sound-tags">
                            {entry.tags.slice(0, 3).map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        )}
                        {kind !== 'removed' && (
                          <>
                            <div className="vtt-sound-controls">
                              <button
                                className="vtt-sound-play"
                                aria-label={
                                  (isActive && config.loop ? 'Parar ' : 'Tocar ') + entry.name
                                }
                                disabled={busy}
                                onClick={() => {
                                  unlock();
                                  void run(() =>
                                    command(
                                      isActive && config.loop
                                        ? { kind: 'stop', sourceId: entry.id }
                                        : { kind: 'play', sourceId: entry.id, settings: config },
                                    ),
                                  );
                                }}
                              >
                                {isActive && config.loop ? (
                                  <Square size={15} />
                                ) : (
                                  <Play size={15} />
                                )}
                              </button>
                              <input
                                aria-label={'Volume de ' + entry.name}
                                type="range"
                                min="0"
                                max="1"
                                step=".01"
                                value={config.volume}
                                onChange={(e) =>
                                  adjust({ ...config, volume: Number(e.target.value) })
                                }
                              />
                              <output>{Math.round(config.volume * 100)}%</output>
                              <button
                                aria-label={'Ouvir prévia de ' + entry.name}
                                title="Ouvir só para você (12 segundos)"
                                onClick={() => preview(config)}
                              >
                                <Headphones size={14} />
                              </button>
                            </div>
                            <footer>
                              <label className="vtt-check">
                                <input
                                  type="checkbox"
                                  checked={config.loop}
                                  onChange={(e) => adjust({ ...config, loop: e.target.checked })}
                                />{' '}
                                Repetir
                              </label>
                              <button
                                className="vtt-pin-action"
                                title="Arraste para o acesso rápido ou clique para fixar"
                                aria-label={'Fixar ' + entry.name}
                                draggable
                                disabled={busy}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData(
                                    actionMime,
                                    JSON.stringify({
                                      kind: 'sound',
                                      sourceId: entry.id,
                                      label: entry.name,
                                    }),
                                  );
                                  e.dataTransfer.effectAllowed = 'copy';
                                  void run(() => persist(entry.id));
                                }}
                                onClick={() => pin(entry)}
                              >
                                <Plus size={12} /> Fixar
                              </button>
                            </footer>
                            {config.loop && (
                              <label className="vtt-sound-interval">
                                Repetição
                                <select
                                  aria-label={'Modo de repetição de ' + entry.name}
                                  value={config.repeatEvery ? 'interval' : 'continuous'}
                                  onChange={(event) =>
                                    adjust({
                                      ...config,
                                      repeatEvery:
                                        event.target.value === 'interval' ? 10 : undefined,
                                    })
                                  }
                                >
                                  <option value="continuous">Contínua</option>
                                  <option value="interval">A cada intervalo</option>
                                </select>
                                {config.repeatEvery && (
                                  <span>
                                    A cada{' '}
                                    <input
                                      type="number"
                                      min="1"
                                      max="3600"
                                      step="1"
                                      value={config.repeatEvery}
                                      aria-label={'Intervalo em segundos de ' + entry.name}
                                      onChange={(event) => {
                                        const value = Number(event.target.value);
                                        if (Number.isFinite(value) && value >= 1 && value <= 3600)
                                          adjust({ ...config, repeatEvery: value });
                                      }}
                                    />{' '}
                                    segundos
                                  </span>
                                )}
                              </label>
                            )}
                            {entry.id.startsWith('asset:') && (
                              <label>
                                Usar como
                                <select
                                  aria-label={'Usar ' + entry.name + ' como'}
                                  value={config.channel}
                                  onChange={(e) =>
                                    adjust({
                                      ...config,
                                      channel: e.target.value as SoundSettings['channel'],
                                    })
                                  }
                                >
                                  <option value="music">Música</option>
                                  <option value="ambience">Ambiente</option>
                                  <option value="effect">Efeito</option>
                                </select>
                              </label>
                            )}
                          </>
                        )}
                      </article>
                    </Fragment>
                  );
                })}
                {!filtered.length && (
                  <div className="vtt-sound-empty">
                    <Search size={24} />
                    <p>Nenhum som encontrado.</p>
                    <button
                      onClick={() => {
                        setQuery('');
                        setScenario('Todos');
                        setCategory('Todas');
                      }}
                    >
                      Limpar filtros
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <p className="vtt-muted">O mestre escolhe os sons compartilhados da mesa.</p>
          <VttVoicePanel voice={voice} gm={false} share={shareVoice} />
        </>
      )}
    </div>
  );
}

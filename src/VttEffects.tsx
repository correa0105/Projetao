import { useEffect, useRef, useState } from 'react';
import { Sparkles, Plus, Pencil, Trash2, X, Eye } from 'lucide-react';
import { actionMime } from '../shared/vtt-hotbar';
import {
  effectKinds,
  effectNames,
  effectColors,
  effectLibrary,
  effectPresetSchema,
  type EffectPreset,
} from '../shared/vtt-effects';
import type { VttToken } from '../shared/vtt';
import { ActionShortcut } from './VttHotbar';
import { VttEffectPreview } from './VttEffectPreview';
import './vtt-effects.css';
export function VttEffects({
  presets,
  tokens,
  busy,
  save,
  remove,
  apply,
  clear,
  preview,
  visualEffects = true,
}: {
  presets: EffectPreset[];
  tokens: VttToken[];
  busy: boolean;
  visualEffects?: boolean;
  save: (preset: EffectPreset) => Promise<void>;
  remove: (id: string) => Promise<void>;
  apply: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  preview: (preset: EffectPreset | null) => void;
}) {
  const token = tokens[0];
  const selectionKey = tokens.map((t) => t.id).join(',');
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<EffectPreset | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [previewing, setPreviewing] = useState(false),
    [previewId, setPreviewId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(presets.length === 0),
    [libraryGroup, setLibraryGroup] = useState('Todos'),
    [libraryQuery, setLibraryQuery] = useState(''),
    [animatedKind, setAnimatedKind] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  useEffect(() => {
    if (!draft) return;
    root.current?.querySelector('form')?.scrollIntoView({ block: 'nearest' });
  }, [draft?.id, open]);
  useEffect(() => {
    const preset = draft || presets.find((e) => e.id === previewId);
    previewRef.current(open && previewing && token && preset ? preset : null);
    return () => previewRef.current(null);
  }, [open, previewing, draft, previewId, selectionKey, presets]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if ((e.target as Element)?.closest?.('canvas[data-selection-count]')) return;
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', escape);
    };
  }, [open]);
  async function run(fn: () => Promise<void>) {
    if (working || busy) return;
    setWorking(true);
    setPreviewing(false);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  const blocked = working || busy;
  function createEffect(i: number) {
    setDraft({
      id: crypto.randomUUID(),
      name: effectNames[i],
      kind: effectKinds[i],
      color: effectColors[i],
      scale: 1,
      duration: i ? 5 : 0,
    });
    setPreviewing(true);
    setLibraryOpen(true);
  }
  return (
    <div className="vtt-effects" ref={root}>
      <button
        className="vtt-effects-toggle"
        aria-label="Efeitos do mestre"
        title="Efeitos do mestre"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Sparkles size={19} />
        <span>Efeitos</span>
      </button>
      {open && (
        <section
          className="vtt-effects-menu"
          data-editing={Boolean(draft)}
          aria-label="Efeitos salvos do mestre"
        >
          <header>
            <strong>
              {draft
                ? presets.some((e) => e.id === draft.id)
                  ? 'Editar efeito'
                  : 'Novo efeito'
                : 'Efeitos'}
            </strong>
            <button aria-label="Fechar efeitos" onClick={() => setOpen(false)}>
              <X size={15} />
            </button>
          </header>
          {error && <p role="alert">{error}</p>}
          {
            <>
              <p>
                Selecione um ou mais tokens para aplicar. Arraste um efeito salvo para a barra
                rápida.
              </p>
              <div className="vtt-effects-target">
                {token && token.layer !== 'map'
                  ? tokens.length > 1
                    ? 'Alvos · ' + tokens.length + ' tokens'
                    : 'Alvo · ' + token.name
                  : 'Nenhum token selecionado'}
              </div>
              <button
                className="vtt-effects-library-toggle"
                aria-expanded={libraryOpen}
                onClick={() => setLibraryOpen(!libraryOpen)}
              >
                <Sparkles size={14} /> Biblioteca de efeitos · {effectKinds.length}
              </button>
              {libraryOpen && (
                <section className="vtt-effects-library" aria-label="Biblioteca de efeitos">
                  <p>Clique para visualizar no token e ajustar tamanho e cor.</p>
                  <div className="vtt-effects-groups" aria-label="Categorias de efeitos">
                    {['Todos', 'Elementos', 'Magia', 'Natureza', 'Estado'].map((group) => (
                      <button
                        key={group}
                        aria-pressed={libraryGroup === group}
                        onClick={() => setLibraryGroup(group)}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                  <label className="vtt-effects-search">
                    Buscar efeito
                    <input
                      type="search"
                      value={libraryQuery}
                      maxLength={80}
                      placeholder="Nome ou descrição"
                      onChange={(event) => setLibraryQuery(event.target.value)}
                    />
                  </label>
                  <div className="vtt-effects-gallery">
                    {effectLibrary
                      .filter((e) => libraryGroup === 'Todos' || e.group === libraryGroup)
                      .filter((e) =>
                        (e.name + ' ' + e.description)
                          .normalize('NFD')
                          .replace(/[\u0300-\u036f]/g, '')
                          .toLowerCase()
                          .includes(
                            libraryQuery
                              .normalize('NFD')
                              .replace(/[\u0300-\u036f]/g, '')
                              .trim()
                              .toLowerCase(),
                          ),
                      )
                      .map((e) => (
                        <button
                          key={e.kind}
                          className="vtt-effect-card"
                          disabled={blocked || presets.length >= 100}
                          aria-label={'Criar efeito · ' + e.name}
                          title={e.description}
                          onPointerEnter={() => setAnimatedKind(e.kind)}
                          onPointerLeave={() => setAnimatedKind(null)}
                          onFocus={() => setAnimatedKind(e.kind)}
                          onBlur={() => setAnimatedKind(null)}
                          onClick={() => createEffect(effectKinds.indexOf(e.kind))}
                        >
                          {visualEffects && (
                            <VttEffectPreview
                              preset={{ id: 'library-' + e.kind, ...e, scale: 1, duration: 0 }}
                              animated={animatedKind === e.kind}
                            />
                          )}
                          <span>{e.name}</span>
                          <small>{e.group}</small>
                        </button>
                      ))}
                  </div>
                </section>
              )}
              {draft && (
                <form
                  aria-label="Editor de efeito"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await save(effectPresetSchema.parse(draft));
                      setDraft(null);
                    });
                  }}
                >
                  <strong>{draft.name}</strong>
                  <p className="vtt-effects-preview-note">
                    Prévia no token selecionado. Ajuste antes de aplicar.
                  </p>
                  {draft.kind !== 'death' ? (
                    <div className="vtt-effects-fields">
                      <label>
                        Cor
                        <input
                          aria-label="Cor do efeito"
                          type="color"
                          value={draft.color}
                          onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                        />
                      </label>
                      <label>
                        Tamanho
                        <input
                          aria-label="Tamanho do efeito"
                          type="number"
                          min="0.5"
                          max="3"
                          step="0.1"
                          required
                          value={draft.scale}
                          onChange={(e) => setDraft({ ...draft, scale: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        Duração (s)
                        <input
                          aria-label="Duração do efeito"
                          disabled={draft.duration === 0}
                          type="number"
                          min="0"
                          max="60"
                          required
                          value={draft.duration}
                          onChange={(e) => setDraft({ ...draft, duration: Number(e.target.value) })}
                        />
                      </label>
                      <label className="vtt-effects-infinite">
                        <input
                          type="checkbox"
                          aria-label="Efeito infinito"
                          checked={draft.duration === 0}
                          onChange={(e) =>
                            setDraft({ ...draft, duration: e.target.checked ? 0 : 5 })
                          }
                        />{' '}
                        Infinito · até limpar
                      </label>
                    </div>
                  ) : (
                    <p>
                      Token inteiro vermelho e sangue ao redor. Permanece até limpar ou recuperar PV
                      após chegar a zero.
                    </p>
                  )}
                  <div className="vtt-effects-editor-actions">
                    <details>
                      <summary>Nome do efeito</summary>
                      <input
                        aria-label="Nome do efeito"
                        required
                        maxLength={60}
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      />
                    </details>
                    <button
                      type="button"
                      className="vtt-gold"
                      disabled={blocked || !token || token.layer === 'map'}
                      onClick={() =>
                        void run(async () => {
                          const preset = effectPresetSchema.parse(draft);
                          await save(preset);
                          await apply(preset.id);
                          setDraft(null);
                        })
                      }
                    >
                      Aplicar efeito
                    </button>
                    <button type="submit" className="vtt-gold" disabled={blocked}>
                      Salvar efeito
                    </button>
                    <button type="button" disabled={blocked} onClick={() => setDraft(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
              <div className="vtt-effects-list">
                {!presets.length && <p>Nenhum efeito salvo. Crie o primeiro abaixo.</p>}
                {presets.map((e) => (
                  <div
                    className="vtt-effects-row"
                    key={e.id}
                    draggable={!blocked}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        actionMime,
                        JSON.stringify({ kind: 'effect', sourceId: e.id, label: e.name }),
                      );
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <button
                      className="vtt-effects-apply"
                      disabled={blocked || !token || token.layer === 'map'}
                      onClick={() => void run(() => apply(e.id))}
                      title="Aplicar nos tokens selecionados"
                    >
                      <Sparkles size={15} style={{ color: e.color }} />
                      <span>
                        {e.name}
                        <small>{effectNames[effectKinds.indexOf(e.kind)]}</small>
                      </span>
                    </button>
                    <ActionShortcut action={{ kind: 'effect', sourceId: e.id, label: e.name }} />
                    <button
                      aria-label={'Prévia de ' + e.name}
                      title="Visualizar antes de aplicar"
                      disabled={blocked || !token || token.layer === 'map'}
                      aria-pressed={previewing && previewId === e.id && !draft}
                      onClick={() => {
                        setDraft(null);
                        setPreviewId(e.id);
                        setPreviewing(!previewing || previewId !== e.id);
                      }}
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      aria-label={'Editar efeito ' + e.name}
                      disabled={blocked}
                      onClick={() => {
                        setDraft({ ...e });
                        setPreviewing(true);
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label={'Remover efeito ' + e.name}
                      disabled={blocked}
                      onClick={() => void run(() => remove(e.id))}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button disabled={blocked || presets.length >= 100} onClick={() => createEffect(1)}>
                <Plus size={14} /> Novo efeito
              </button>
            </>
          }
          {!draft && (
            <>
              <button
                disabled={blocked || !tokens.some((t) => t.deathAt || t.effects.length)}
                onClick={() => void run(clear)}
              >
                <Trash2 size={13} />{' '}
                {tokens.length > 1 ? 'Limpar efeitos dos tokens' : 'Limpar efeitos do token'}
              </button>
              <p className="vtt-effects-note">
                Efeitos visuais não alteram PV, condições ou recursos.
              </p>
            </>
          )}
        </section>
      )}
    </div>
  );
}

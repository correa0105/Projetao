import { useEffect, useRef, useState } from 'react';
import { Sparkles, Plus, Pencil, Trash2, X, Eye } from 'lucide-react';
import { actionMime } from '../shared/vtt-hotbar';
import {
  effectKinds,
  effectNames,
  effectColors,
  effectPresetSchema,
  type EffectPreset,
} from '../shared/vtt-effects';
import type { VttToken } from '../shared/vtt';
import { ActionShortcut } from './VttHotbar';
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
  editDeath,
}: {
  presets: EffectPreset[];
  tokens: VttToken[];
  busy: boolean;
  save: (preset: EffectPreset) => Promise<void>;
  remove: (id: string) => Promise<void>;
  apply: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  preview: (preset: EffectPreset | null) => void;
  editDeath: (patch: Pick<Partial<VttToken>, 'deathAt' | 'deathAutomatic'>) => Promise<void>;
}) {
  const token = tokens[0];
  const selectionKey = tokens.map((t) => t.id).join(',');
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<EffectPreset | null>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [previewing, setPreviewing] = useState(false),
    [previewId, setPreviewId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const editorName = useRef<HTMLInputElement>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;
  useEffect(() => {
    if (!draft) return;
    const menu = root.current?.querySelector('.vtt-effects-menu');
    if (menu) menu.scrollTop = 0;
    editorName.current?.focus({ preventScroll: true });
  }, [draft?.id, open]);
  useEffect(() => {
    const preset = draft || presets.find((e) => e.id === previewId);
    previewRef.current(open && previewing && token && preset ? preset : null);
    return () => previewRef.current(null);
  }, [open, previewing, draft, previewId, selectionKey, presets]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
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
        <section className="vtt-effects-menu" aria-label="Efeitos salvos do mestre">
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
          {!draft && (
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
              <fieldset
                className="vtt-effects-death"
                disabled={blocked || !token || token.layer === 'map'}
              >
                <legend>Efeito de morte</legend>
                <label className="vtt-check">
                  <input
                    type="checkbox"
                    checked={tokens.length > 0 && tokens.every((t) => t.deathAutomatic)}
                    ref={(input) => {
                      if (input)
                        input.indeterminate =
                          tokens.some((t) => t.deathAutomatic) &&
                          !tokens.every((t) => t.deathAutomatic);
                    }}
                    onChange={(e) =>
                      void run(() => editDeath({ deathAutomatic: e.target.checked }))
                    }
                  />
                  Automático ao zerar PV
                </label>
                <div className="vtt-row">
                  <button onClick={() => void run(() => editDeath({ deathAt: Date.now() }))}>
                    Aplicar efeito de morte
                  </button>
                  <button
                    disabled={!tokens.some((t) => t.deathAt)}
                    onClick={() => void run(() => editDeath({ deathAt: null }))}
                  >
                    Limpar efeito de morte
                  </button>
                </div>
              </fieldset>
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
                      onClick={() => setDraft({ ...e })}
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
              <button
                disabled={blocked || presets.length >= 100}
                onClick={() =>
                  setDraft({
                    id: crypto.randomUUID(),
                    name: effectNames[1],
                    kind: effectKinds[1],
                    color: effectColors[1],
                    scale: 1,
                    duration: 5,
                  })
                }
              >
                <Plus size={14} /> Novo efeito
              </button>
            </>
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
              <label>
                Nome do efeito
                <input
                  ref={editorName}
                  aria-label="Nome do efeito"
                  required
                  maxLength={60}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <button
                type="button"
                disabled={!token || token.layer === 'map'}
                aria-pressed={previewing}
                onClick={() => setPreviewing(!previewing)}
              >
                <Eye size={14} /> {previewing ? 'Encerrar prévia no token' : 'Visualizar no token'}
              </button>
              {previewing && (
                <p className="vtt-effects-preview-note">
                  Prévia no token · ainda não aplicada. Os outros participantes não veem esta
                  prévia.
                </p>
              )}
              <label>
                Modelo
                <select
                  aria-label="Modelo do efeito"
                  value={draft.kind}
                  onChange={(e) => {
                    const i = effectKinds.indexOf(e.target.value as EffectPreset['kind']);
                    setDraft({
                      ...draft,
                      kind: effectKinds[i],
                      name:
                        draft.name === effectNames[effectKinds.indexOf(draft.kind)]
                          ? effectNames[i]
                          : draft.name,
                      color: effectColors[i],
                      duration: i ? 5 : 0,
                    });
                  }}
                >
                  {effectKinds.map((kind, i) => (
                    <option key={kind} value={kind}>
                      {effectNames[i]}
                    </option>
                  ))}
                </select>
              </label>
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
                      onChange={(e) => setDraft({ ...draft, duration: e.target.checked ? 0 : 5 })}
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
                <button type="submit" className="vtt-gold" disabled={blocked}>
                  Salvar efeito
                </button>
                <button type="button" disabled={blocked} onClick={() => setDraft(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          )}
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

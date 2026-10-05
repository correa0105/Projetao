import { useEffect, useState } from 'react';
import { Check, Pencil, Save, Crown } from 'lucide-react';
import { api } from './api';
import { Modal } from './components';
import type {
  AchievementDefinition,
  AchievementCatalogResponse,
  AchievementState,
} from '../shared/achievements';
import type { CharacterTitle } from '../shared/titles';

export function AchievementHonors({
  characterId,
  titles,
  canEdit,
  onChanged,
  onCreateTitle,
  onDefinitions,
}: {
  characterId?: string;
  titles: CharacterTitle[];
  canEdit: boolean;
  onChanged: () => Promise<void>;
  onCreateTitle: (achievement: AchievementDefinition) => void;
  onDefinitions: (items: AchievementDefinition[]) => void;
}) {
  const [catalog, setCatalog] = useState<AchievementDefinition[]>([]);
  const [state, setState] = useState<AchievementState | null>(null);
  const [editing, setEditing] = useState<AchievementDefinition | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setState(null);
    Promise.all([
      api<AchievementCatalogResponse>('/achievements/catalog', { signal: abort.signal }),
      characterId
        ? api<AchievementState>('/characters/' + characterId + '/achievements', {
            signal: abort.signal,
          })
        : Promise.resolve(null),
    ])
      .then(([definitions, progress]) => {
        if (abort.signal.aborted) return;
        setCatalog(definitions.items);
        onDefinitions(definitions.items);
        setState(progress);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [characterId]);
  return (
    <section className="honor-achievements" aria-label="Conquistas e seus títulos">
      <header>
        <span className="eyebrow">MARCAS DA SUA JORNADA</span>
        <h2>Conquistas</h2>
        <p>
          Cada conquista pode conceder um título. Escolha o que deseja mostrar na tela do
          personagem.
        </p>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="honor-achievements-list">
        {catalog.map((a) => {
          const earned = state?.unlocked.some((u) => u.code === a.code);
          const progress = state?.progress[a.code];
          const linked = titles.filter(
            (t) => t.goal.kind === 'achievement' && t.goal.achievement === a.code,
          );
          return (
            <article key={a.code} data-code={a.code} data-earned={Boolean(earned)}>
              <span
                className="honor-achievement-mark"
                aria-label={earned ? 'Desbloqueada' : 'A conquistar'}
              >
                {earned ? <Check size={19} /> : <span>✦</span>}
              </span>
              <div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                {linked.length ? (
                  <small>
                    <Crown size={12} /> {linked.map((t) => t.name).join(' · ')}
                  </small>
                ) : (
                  <small>Sem título associado</small>
                )}
                {progress && !earned && (
                  <div className="honor-achievement-progress">
                    <progress
                      value={progress.current}
                      max={progress.target}
                      aria-label={'Progresso de ' + a.title}
                    />
                    <span>
                      {progress.available
                        ? progress.current + ' / ' + progress.target + ' ' + progress.unit
                        : 'Progressão ainda indisponível'}
                    </span>
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="honor-achievement-actions">
                  <button className="text-button" onClick={() => setEditing(a)}>
                    <Pencil size={13} />
                    Editar conquista
                  </button>
                  <button className="text-button" onClick={() => onCreateTitle(a)}>
                    <Crown size={13} />
                    Criar título
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {editing && canEdit && (
        <AchievementEditor
          achievement={editing}
          titles={titles}
          close={() => setEditing(null)}
          saved={async (updated) => {
            const changed = catalog.map((a) => (a.code === updated.code ? updated : a));
            setCatalog(changed);
            onDefinitions(changed);
            await onChanged();
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}
function AchievementEditor({
  achievement,
  titles,
  close,
  saved,
}: {
  achievement: AchievementDefinition;
  titles: CharacterTitle[];
  close: () => void;
  saved: (a: AchievementDefinition) => Promise<void>;
}) {
  const [name, setName] = useState(achievement.title);
  const [description, setDescription] = useState(achievement.description);
  const [title, setTitle] = useState(
    titles.find((t) => t.goal.kind === 'achievement' && t.goal.achievement === achievement.code)
      ?.id || '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      title="Editar conquista"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="achievement-definition-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const updated = await api<AchievementDefinition>(
              '/achievements/catalog/' + achievement.code,
              {
                method: 'PUT',
                body: JSON.stringify({
                  title: name,
                  description,
                  revision: achievement.revision,
                  title_id: title || null,
                }),
              },
            );
            await saved(updated);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <label>
            Nome da conquista
            <input
              aria-label="Nome da conquista"
              value={name}
              onChange={(e) => setName(e.target.value)}
              minLength={2}
              maxLength={120}
              required
            />
          </label>
          <label>
            Descrição da conquista
            <textarea
              aria-label="Descrição da conquista"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </label>
          <label>
            Título concedido
            <select
              aria-label="Título concedido"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            >
              <option value="">Nenhum título</option>
              {titles.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            O título escolhido será concedido a quem desbloquear esta conquista. Alterar o vínculo
            preserva os títulos já recebidos.
          </p>
          <button className="button primary">
            <Save size={14} />
            Salvar conquista
          </button>
        </fieldset>
        {error && <p role="alert">{error}</p>}
      </form>
    </Modal>
  );
}

import { useState } from 'react';
import { Save } from 'lucide-react';
import { api } from './api';
import { Modal } from './components';
import type { AchievementDefinition } from '../shared/achievements';
import type { CharacterTitle } from '../shared/titles';

export function AchievementEditor({
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

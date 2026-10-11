import { useState } from 'react';
import { api } from './api';
import { Modal } from './components';
import { MissionTagPicker } from './MissionTagPicker';
import type { Post } from './types';

export function MissionTags({
  mission,
  canEdit,
  refresh,
}: {
  mission: Post;
  canEdit: boolean;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false),
    [ids, setIds] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (mission.kind !== 'mission') return null;
  return (
    <div className="mission-tags">
      <div className="tag-choices" aria-label="Tags da missão">
        {mission.tags?.map((t) => (
          <span className="tag-pill" key={t.id}>
            {t.name}
          </span>
        ))}
      </div>
      {canEdit && ['open', 'active'].includes(mission.status) && (
        <button
          className="text-button"
          onClick={() => {
            setIds(mission.tags?.map((t) => t.id) || []);
            setError('');
            setEditing(true);
          }}
        >
          Editar tags
        </button>
      )}
      {editing && (
        <Modal
          title="Tags da missão"
          close={() => {
            if (!busy) setEditing(false);
          }}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError('');
              try {
                await api('/board/' + mission.id + '/tags', {
                  method: 'PATCH',
                  body: JSON.stringify({ tag_ids: ids }),
                });
                await refresh();
                setEditing(false);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <MissionTagPicker value={ids} onChange={setIds} disabled={busy} />
            {error && <p role="alert">{error}</p>}
            <button className="button primary" disabled={busy}>
              {busy ? 'Salvando…' : 'Salvar tags'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

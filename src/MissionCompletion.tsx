import { useEffect, useState, type FormEvent } from 'react';
import { api, post } from './api';
import { Modal } from './components';
import type { Post } from './types';

type Participant = { id: string; name: string; race: string; class: string };
export function MissionCompletion({
  mission,
  close,
  done,
}: {
  mission: Post;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [hook, setHook] = useState(false);
  useEffect(() => {
    let alive = true;
    api<Participant[]>(`/board/${mission.id}/participants`)
      .then((data) => {
        if (alive) setParticipants(data);
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [mission.id]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participants || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      await post(`/board/${mission.id}/complete`, {
        summary: form.get('summary'),
        rewards: participants.map((p) => ({
          character_id: p.id,
          experience: Number(form.get(`xp-${p.id}`)),
        })),
        ...(hook
          ? { hook: { title: form.get('hook-title'), description: form.get('hook-description') } }
          : {}),
      });
      await done();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Concluir missão"
      close={() => {
        if (!busy) close();
      }}
    >
      <form className="stack mission-completion" onSubmit={submit}>
        <p className="muted">{mission.title}</p>
        <label>
          Resumo da missão
          <textarea
            name="summary"
            minLength={10}
            maxLength={5000}
            rows={4}
            required
            placeholder="O que aconteceu nesta aventura?"
          />
        </label>
        <fieldset disabled={busy || participants === null}>
          <legend>Experiência dos participantes</legend>
          <p className="small muted">
            Informe o XP de cada personagem. Use 0 para concluir sem conceder experiência.
          </p>
          {participants === null ? (
            <p>Carregando participantes…</p>
          ) : participants.length === 0 ? (
            <p className="muted">Nenhum personagem se inscreveu nesta missão.</p>
          ) : (
            participants.map((p) => (
              <label className="mission-xp-row" key={p.id}>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.race} · {p.class}
                  </small>
                </span>
                <input
                  aria-label={`XP de ${p.name}`}
                  name={`xp-${p.id}`}
                  type="number"
                  min={0}
                  max={1000000}
                  step={1}
                  defaultValue={0}
                  required
                />
              </label>
            ))
          )}
        </fieldset>
        <label className="mission-hook-toggle">
          <input
            type="checkbox"
            checked={hook}
            onChange={(event) => setHook(event.target.checked)}
          />{' '}
          Criar um gancho a partir desta missão
        </label>
        {hook && (
          <>
            <label>
              Título do gancho
              <input name="hook-title" minLength={5} maxLength={100} required />
            </label>
            <label>
              Descrição do gancho
              <textarea name="hook-description" rows={3} minLength={15} maxLength={3000} required />
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy || participants === null}>
          {busy ? 'Concluindo…' : 'Confirmar conclusão'}
        </button>
      </form>
    </Modal>
  );
}

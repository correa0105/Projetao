import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkles, Trash2, X } from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import type { Character } from './types';
import type { ArtJob, ArtState } from '../shared/character-art';
import './character-camp.css';

export async function readArtReference(file: File) {
  if (file.size > 8 * 1024 * 1024) throw new Error('Escolha uma imagem de até 8 MB.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Use PNG, JPEG ou WebP.');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export function ReferenceInput({
  onChange,
  disabled = false,
}: {
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  return (
    <div className="art-reference">
      <label>
        Imagem de referência
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          disabled={disabled}
          onChange={async (e) => {
            onChange('');
            setPreview('');
            setError('');
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const data = await readArtReference(file);
              onChange(data);
              setPreview(`data:${file.type};base64,${data}`);
            } catch (error) {
              setError((error as Error).message);
            }
          }}
        />
      </label>
      <p className="muted small">
        O ilustrador preserva cabelo, rosto e características físicas, adaptando a arte à raça e à
        classe. Corpo inteiro e estilo fixo para todos. PNG, JPEG ou WebP · até 8 MB.
      </p>
      {preview && <img className="reference-preview" src={preview} alt="Referência selecionada" />}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function CharacterSilhouette() {
  return (
    <img
      className="character-silhouette"
      src="/character-silhouette-v2.png"
      alt=""
      aria-hidden="true"
    />
  );
}

export function CharacterCamp({
  characters,
  selectedId,
  onSelect,
  onCreate,
  onRefresh,
}: {
  characters: Character[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [state, setState] = useState<ArtState>({ available: false, jobs: [], pending_new: 0 });
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const snapshot = useRef('');
  const previousJobs = useRef(new Map<string, string>());
  const [notice, setNotice] = useState<ArtJob | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  useEffect(() => {
    let alive = true;
    const update = async () => {
      try {
        const result = await api<ArtState>('/character-art');
        if (!alive) return;
        const failed = result.jobs.find(
          (job) =>
            job.status === 'failed' &&
            ['queued', 'running'].includes(previousJobs.current.get(job.id) || ''),
        );
        previousJobs.current = new Map(result.jobs.map((job) => [job.id, job.status]));
        if (failed) setNotice(failed);
        const signature = JSON.stringify(result.jobs.map((j) => [j.id, j.status]));
        if (snapshot.current && signature !== snapshot.current) await refreshRef.current();
        snapshot.current = signature;
        setState(result);
        setLoadError('');
      } catch (error) {
        if (alive) setLoadError((error as Error).message);
      }
    };
    void update();
    const timer = setInterval(() => void update(), 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  const pending = state.jobs.filter((j) => ['queued', 'running'].includes(j.status));
  return (
    <section className="character-camp" aria-label="Acampamento dos personagens">
      <header className="camp-heading">
        <div>
          <span className="eyebrow">À volta da fogueira</span>
          <h1>Seu acampamento</h1>
          <p>Escolha quem parte para a próxima aventura.</p>
        </div>
        <span className="camp-capacity">
          {characters.length + state.pending_new} / 2 personagens
        </span>
      </header>
      <div className="camp-stage">
        {characters.map((character) => (
          <article
            key={character.id}
            className={`camp-character ${selectedId === character.id ? 'is-selected' : ''}`}
          >
            <button
              className="camp-figure"
              aria-label={`Selecionar ${character.name}`}
              onClick={() => onSelect(character.id)}
            >
              {character.portrait_revision > 0 ? (
                <img
                  src={`/api/characters/${character.id}/portrait?v=${character.portrait_revision}`}
                  alt={`${character.name}, corpo inteiro`}
                />
              ) : (
                <CharacterSilhouette />
              )}
            </button>
            <div className="camp-character-info">
              <button
                className="camp-delete"
                aria-label={`Excluir ${character.name}`}
                title="Excluir personagem"
                onClick={() => {
                  setDeleting(character);
                  setDeleteName('');
                  setDeleteError('');
                }}
              >
                <Trash2 size={15} />
              </button>
              <span className="eyebrow">
                Nível {character.level} {selectedId === character.id ? '· Selecionado' : ''}
              </span>
              <h2>{character.name}</h2>
              <p>
                {character.race} · {character.class}
              </p>
              <div className="camp-actions">
                <a
                  className="button small-button"
                  href="#profile"
                  onClick={() => onSelect(character.id)}
                >
                  Abrir ficha
                </a>
                <button
                  className="button outline small-button"
                  disabled={character.art_pending || !state.available}
                  onClick={() => {
                    if (character.art_used >= 2) {
                      setError(
                        'Este personagem já usou as duas imagens deste mês. Tente novamente no próximo mês.',
                      );
                      return;
                    }
                    setEditing(character);
                    setReference('');
                    setError('');
                    key.current = crypto.randomUUID();
                  }}
                >
                  <Sparkles size={15} />
                  {character.art_pending
                    ? 'Preparando arte…'
                    : character.portrait_revision
                      ? 'Nova imagem'
                      : 'Gerar imagem'}
                </button>
              </div>
            </div>
          </article>
        ))}
        {pending
          .filter((j) => !j.character_id)
          .map((job) => (
            <article className="camp-character camp-pending" key={job.id}>
              <div className="camp-figure">
                <CharacterSilhouette />
              </div>
              <div className="camp-character-info">
                <h2>{job.name}</h2>
                <p>
                  {job.status === 'running'
                    ? 'O ilustrador está dando vida ao personagem…'
                    : 'Aguardando o ilustrador…'}
                </p>
              </div>
            </article>
          ))}
        {characters.length + state.pending_new < 2 && (
          <button className="camp-new" onClick={onCreate}>
            <Plus size={25} />
            <span>Uma nova história</span>
            <small>Criar personagem</small>
          </button>
        )}
      </div>
      <footer className="camp-footer">
        <span
          className={`illustrator-status ${state.available ? 'is-online' : 'is-offline'}`}
          role="status"
        >
          <span className="illustrator-dot" aria-hidden="true" />
          {state.available ? 'Ilustrador disponível' : 'Ilustrador offline'}
        </span>
        <span>Duas imagens por personagem a cada mês.</span>
      </footer>
      {(loadError || (error && !editing)) && (
        <p className="form-error camp-page-error" role="alert">
          {loadError || error}
        </p>
      )}
      {(notice ? [notice] : []).map((job) => (
        <div className="camp-notice" role="status" key={job.id}>
          <span>
            {job.name}: {job.error}
          </span>
          <button
            type="button"
            className="camp-notice-dismiss"
            aria-label={`Dispensar aviso de ${job.name}`}
            title="Dispensar aviso"
            onClick={() => setNotice(null)}
          >
            <X size={18} />
          </button>
        </div>
      ))}
      {editing && (
        <Modal
          title={`Imagem de ${editing.name}`}
          close={() => {
            if (!busy) setEditing(null);
          }}
        >
          <form
            className="stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                await post('/character-art', {
                  character_id: editing.id,
                  reference,
                  idempotency_key: key.current,
                });
                await onRefresh();
                setEditing(null);
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>A imagem atual permanece até a nova ficar pronta.</p>
            <ReferenceInput onChange={setReference} disabled={busy} />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy || !reference}>
              {busy ? 'Enviando…' : 'Gerar imagem'}
            </button>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Excluir personagem"
          close={() => {
            if (!busy) setDeleting(null);
          }}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setDeleteError('');
              try {
                await api(`/characters/${deleting.id}`, {
                  method: 'DELETE',
                  body: JSON.stringify({ name: deleteName }),
                });
                await onRefresh();
                setState((current) => ({
                  ...current,
                  jobs: current.jobs.filter((job) => job.character_id !== deleting.id),
                }));
                setDeleting(null);
              } catch (error) {
                setDeleteError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>
              Excluir <strong>{deleting.name}</strong> do acampamento? Você perderá acesso à ficha,
              aos itens e à imagem. A vaga ficará livre para outro personagem.
            </p>
            <p className="muted small">
              Esta ação não pode ser desfeita pela interface. Registros de compras e participações
              em missões permanecem no histórico.
            </p>
            <label>
              Digite {deleting.name} para confirmar
              <input
                value={deleteName}
                onChange={(event) => setDeleteName(event.target.value)}
                autoComplete="off"
                required
                disabled={busy}
              />
            </label>
            {deleteError && (
              <p className="form-error" role="alert">
                {deleteError}
              </p>
            )}
            <div className="camp-delete-actions">
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() => setDeleting(null)}
              >
                Cancelar
              </button>
              <button
                className="button camp-delete-confirm"
                disabled={busy || deleteName !== deleting.name}
              >
                {busy ? 'Excluindo…' : 'Excluir definitivamente'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}

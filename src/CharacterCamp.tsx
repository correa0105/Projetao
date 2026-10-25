import { FlashMessage } from './FlashMessage';
import { CharacterTitleLabel } from './Titles';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import { api, post } from './api';
import { Modal, CharacterForm } from './components';
import type { Character } from './types';
import type { ArtJob, ArtState, CharacterCreation } from '../shared/character-art';
import { ART_MONTHLY_LIMIT } from '../shared/character-art';
import { ArtQuotaNotice } from './ArtQuotaNotice';
import type { EquipmentSlot } from '../shared/equipment';
import { ArtEquipmentChoices } from './ArtEquipmentChoices';
import { CampMount } from './CharacterMount';
import { CampPet } from './CharacterPet';
import { characterHeightScale } from '../shared/character-stature';
import './character-camp.css';
import { CampBackdrop } from './CampBackdrop';

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
  required = true,
}: {
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
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
          required={required}
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
      {error && <FlashMessage>{error}</FlashMessage>}
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
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [editing, setEditing] = useState<Character | null>(null);
  const [deleting, setDeleting] = useState<Character | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [reference, setReference] = useState('');
  const [equipmentSlots, setEquipmentSlots] = useState<EquipmentSlot[]>([]);
  const [helmetMode, setHelmetMode] = useState<'open' | 'closed'>('closed');
  const [equipmentReady, setEquipmentReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingQuota, setCheckingQuota] = useState(false);
  const key = useRef(crypto.randomUUID());
  const snapshot = useRef('');
  const previousJobs = useRef(new Map<string, string>());
  const [notice, setNotice] = useState<ArtJob | null>(null);
  const [savedDraft, setSavedDraft] = useState<{
    id: string;
    creation: CharacterCreation;
    reference: string;
  } | null>(null);
  const [showSavedCreations, setShowSavedCreations] = useState(false);
  useEffect(() => {
    if (!error || editing) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error, editing]);
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
        const signature = JSON.stringify(result.jobs.map((j) => [j.id, j.status, j.character_id]));
        if (snapshot.current && signature !== snapshot.current) await refreshRef.current();
        snapshot.current = signature;
        setState(result);
        setAvailability(result.available);
        setLoadError('');
      } catch (error) {
        if (alive) {
          setAvailability(null);
          setLoadError('Não foi possível consultar o ilustrador. Tentando novamente…');
        }
      }
    };
    void update();
    const timer = setInterval(() => void update(), 4000);
    const focus = () => void update();
    window.addEventListener('focus', focus);
    window.addEventListener('character-art-choice-updated', focus);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('character-art-choice-updated', focus);
    };
  }, []);
  const pending = state.jobs.filter((j) => ['queued', 'running'].includes(j.status));
  const constructed = editing?.race === 'Warforged' && editing.art_reference_mode === 'construction';
  const editingQuota = editing ? state.quotas?.[editing.id] ?? {
    used: editing.art_used,
    limit: editing.art_unlimited ? null : ART_MONTHLY_LIMIT,
  } : null;
  const quotaFull = editingQuota?.limit !== null && editingQuota !== null && editingQuota.used >= editingQuota.limit;
  return (
    <section className="character-camp" aria-label="Acampamento dos personagens">
      <CampBackdrop />
      {selectedId && <CampMount key={`mount-${selectedId}`} characterId={selectedId} />}
      {selectedId && <CampPet key={`pet-${selectedId}`} characterId={selectedId} />}
      <div className="page-header-spacer" aria-hidden="true" />
      <div className="camp-capacity-row">
        <span className="camp-capacity">
          {characters.length + state.pending_new} / 2 personagens
        </span>
        {state.jobs.some(job => job.status === 'failed' && !job.character_id) && (
          <button className="button outline camp-saved-creations-toggle" onClick={() => setShowSavedCreations(true)}>
            Criações salvas ({state.jobs.filter(job => job.status === 'failed' && !job.character_id).length})
          </button>
        )}
      </div>
      <div className="camp-stage">
        {characters.map((character) => (
          <article
            key={character.id}
            className={`camp-character ${selectedId === character.id ? 'is-selected' : ''}`}
            style={
              {
                '--stature-scale': characterHeightScale(character.race, character.species_size),
              } as CSSProperties
            }
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
              <div className="camp-name-line">
                <h2>{character.name}</h2>
                <CharacterTitleLabel characterId={character.id} />
              </div>
              <p>
                {character.race} · {character.class}
              </p>
              {character.art_unlimited && (
                <p className="muted small">Geração de imagens sem limite</p>
              )}
              <div className="camp-actions">
                <a
                  className="button outline small-button"
                  href="#achievements"
                  onClick={() => onSelect(character.id)}
                >
                  Escolher título
                </a>
                <a
                  className="button small-button"
                  href="#profile"
                  onClick={() => onSelect(character.id)}
                >
                  Abrir ficha
                </a>
                <button
                  className="button outline small-button"
                  disabled={character.art_pending || state.reviews?.some(review=>review.character_id===character.id)}
                  onClick={async () => {
                    setEditing(character);
                    setEquipmentReady(false);
                    setEquipmentSlots([]);
                    setReference('');
                    setError('');
                    key.current = crypto.randomUUID();
                    setCheckingQuota(true);
                    try {
                      const result = await api<ArtState>('/character-art');
                      setState(result);
                      setAvailability(result.available);
                    } catch {
                      setAvailability(null);
                      setError('Não foi possível atualizar a cota. Feche e abra novamente para tentar.');
                    } finally {
                      setCheckingQuota(false);
                    }
                  }}
                >
                  <Sparkles size={15} />
                  {character.art_pending
                    ? 'Preparando arte…'
                    : state.reviews?.some(review=>review.character_id===character.id)
                      ? 'Imagem pronta para escolher'
                    : character.portrait_revision
                      ? 'Nova imagem'
                      : 'Gerar imagem'}
                </button>
              </div>
              {state.jobs.filter(job => job.character_id === character.id && job.status === 'failed' && job.can_retry).slice(0, 1).map(job => (
                <button key={job.id} className="button outline small-button" disabled={busy || availability !== true}
                  onClick={async () => {
                    setBusy(true);
                    try { await post(`/character-art/${job.id}/retry`, {}); await onRefresh(); }
                    catch (error) { setError((error as Error).message); }
                    finally { setBusy(false); }
                  }}>Concluir token</button>
              ))}
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
          <article className="camp-character camp-create-slot">
            <button
              className="camp-new camp-figure"
              onClick={onCreate}
              aria-label="Criar personagem"
              title="Criar personagem"
            >
              <CharacterSilhouette />
            </button>
            <div aria-hidden="true" />
          </article>
        )}
      </div>
      {loadError && (
        <p className="camp-status" role="status">
          {loadError}
        </p>
      )}
      {showSavedCreations && (
        <Modal title="Criações salvas" close={() => setShowSavedCreations(false)}>
          {state.jobs
            .filter((job) => job.status === 'failed' && !job.character_id)
            .map((job) => (
              <section
                className="camp-saved-creation"
                key={job.id}
                aria-label={`Criação salva de ${job.name}`}
              >
                <h3>{job.name}: criação salva</h3>
                <p>
                  A arte não foi concluída. Seu nome, história e escolhas da ficha estão
                  preservados. Sua cota não foi descontada.
                </p>
                <p className="muted small">{job.error}</p>
                <div className="tag-actions">
                  {job.can_retry && (
                    <button
                      className="button primary"
                      disabled={busy || availability !== true}
                      onClick={async () => {
                        setBusy(true);
                        setError('');
                        try {
                          await post(`/character-art/${job.id}/retry`, {});
                          await onRefresh();
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Tentar novamente sem preencher tudo
                    </button>
                  )}
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const draft = await api<{ creation: CharacterCreation; reference: string }>(
                          `/character-art/${job.id}/draft`,
                        );
                        setShowSavedCreations(false);
                        setSavedDraft({ id: job.id, ...draft });
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Retomar preenchimento
                  </button>
                </div>
              </section>
            ))}
        </Modal>
      )}
      {savedDraft && (
        <Modal
          title={`Retomar ${savedDraft.creation.name}`}
          close={() => setSavedDraft(null)}
          dismissOnBackdrop={false}
          dismissOnEscape={false}
        >
          <CharacterForm
            initial={savedDraft.creation}
            initialReference={savedDraft.reference}
            initialJobId={savedDraft.id}
            done={async () => {
              setSavedDraft(null);
              await onRefresh();
            }}
          />
        </Modal>
      )}
      {error && !editing && <FlashMessage>{error}</FlashMessage>}
      {notice && (
        <FlashMessage key={notice.id}>
          {notice.name}: {notice.error}
        </FlashMessage>
      )}
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
              if (checkingQuota || quotaFull || availability !== true || busy) return;
              setBusy(true);
              setError('');
              try {
                await post('/character-art', {
                  character_id: editing.id,
                  reference: constructed ? undefined : reference,
                  idempotency_key: key.current,
                  equipment_slots: equipmentSlots,
                  helmet_mode: equipmentSlots.includes('head') ? helmetMode : 'closed',
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
            <p>A geração inclui a arte do personagem e um token visto de cima para o VTT.</p>
            {checkingQuota ? <p role="status">Consultando a cota mensal…</p> :
              editingQuota && <ArtQuotaNotice quota={editingQuota} subject="Personagem" initialFree accountWide />}
            <span
              className={`illustrator-status ${state.available ? 'is-online' : 'is-offline'}`}
              role="status"
            >
              <span className="illustrator-dot" aria-hidden="true" />
              {availability === null
                ? 'Consultando o ilustrador…'
                : availability
                  ? 'Ilustrador disponível'
                  : 'Ilustrador offline'}
            </span>
            {constructed ? <p className="muted">Warforged montado: a identidade salva será usada automaticamente, preservando corpo, cabeça, metal, acabamento e cores.</p> : <ReferenceInput onChange={setReference} disabled={busy} />}
            <ArtEquipmentChoices
              characterId={editing.id}
              selected={equipmentSlots}
              onChange={setEquipmentSlots}
              onReady={setEquipmentReady}
              disabled={busy}
              helmetMode={helmetMode}
              onHelmetModeChange={setHelmetMode}
            />
            {error && <FlashMessage>{error}</FlashMessage>}
            <button
              className="button primary"
              disabled={busy || checkingQuota || quotaFull || (!constructed && !reference) || !equipmentReady || availability !== true}
            >
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
            {deleteError && <FlashMessage>{deleteError}</FlashMessage>}
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

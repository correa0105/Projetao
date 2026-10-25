import { FlashMessage } from './FlashMessage';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { ReferenceInput } from './CharacterCamp';
import { ArtEquipmentChoices } from './ArtEquipmentChoices';
import { ART_MONTHLY_LIMIT, type ArtState } from '../shared/character-art';
import { ArtQuotaNotice } from './ArtQuotaNotice';
import type { EquipmentSlot } from '../shared/equipment';
import type { Character } from './types';

export function CharacterArtButton({
  character,
  onRefresh,
}: {
  character: Character;
  onRefresh: () => Promise<void>;
}) {
  const [state, setState] = useState<ArtState>({ available: false, jobs: [], pending_new: 0 });
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingQuota, setCheckingQuota] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [equipmentSlots, setEquipmentSlots] = useState<EquipmentSlot[]>([]);
  const [equipmentReady, setEquipmentReady] = useState(false);
  const [helmetMode, setHelmetMode] = useState<'open' | 'closed'>('closed');
  const key = useRef(crypto.randomUUID());
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    let alive = true;
    let updating = false;
    let previous = '';
    const update = async () => {
      if (updating) return;
      updating = true;
      try {
        const result = await api<ArtState>('/character-art');
        if (!alive) return;
        const signature = JSON.stringify(
          result.jobs
            .filter((job) => job.character_id === character.id)
            .map((job) => [job.id, job.status]),
        );
        const changed = previous && previous !== signature;
        previous = signature;
        setState(result);
        setAvailability(result.available);
        setAvailabilityError('');
        if (
          changed &&
          !result.jobs.some(
            (job) =>
              job.character_id === character.id && ['queued', 'running'].includes(job.status),
          )
        )
          await refresh.current();
      } catch {
        if (alive) {
          setAvailability(null);
          setAvailabilityError('Não foi possível consultar o ilustrador. Tentando novamente…');
        }
      } finally {
        updating = false;
      }
    };
    setAvailability(null);
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
  }, [character.id]);
  const pending =
    character.art_pending ||
    state.jobs.some(
      (job) => job.character_id === character.id && ['queued', 'running'].includes(job.status),
    );
  const latestJob = state.jobs.find((job) => job.character_id === character.id);
  const awaitingChoice=state.reviews?.some(review=>review.character_id===character.id);
  const quota = state.quotas?.[character.id] ?? {
    used: character.art_used,
    limit: character.art_unlimited ? null : ART_MONTHLY_LIMIT,
  };
  const quotaFull = quota.limit !== null && quota.used >= quota.limit;
  const constructed =
    character.race === 'Warforged' && character.art_reference_mode === 'construction';
  return (
    <div className="equipment-generate">
      <button
        className="button outline small-button"
        disabled={pending||awaitingChoice}
        onClick={async () => {
          key.current = crypto.randomUUID();
          setReference('');
          setEquipmentSlots([]);
          setEquipmentReady(false);
          setHelmetMode('closed');
          setError('');
          setOpen(true);
          setCheckingQuota(true);
          try {
            const result = await api<ArtState>('/character-art');
            setState(result);
            setAvailability(result.available);
            setAvailabilityError('');
          } catch {
            setAvailability(null);
            setError('Não foi possível atualizar a cota. Feche e abra novamente para tentar.');
          } finally {
            setCheckingQuota(false);
          }
        }}
      >
        <Sparkles size={15} />
        {pending ? 'Vestindo...' : awaitingChoice ? 'Imagem pronta para escolher' : 'Vestir'}
      </button>
      {!pending && availability !== true && (
        <p
          className="muted"
          role="status"
          data-illustrator-status={availability === null ? 'checking' : 'offline'}
        >
          {availabilityError ||
            (availability === null
              ? 'Consultando o ilustrador…'
              : 'Ilustrador offline. A disponibilidade será atualizada automaticamente.')}
        </p>
      )}
      {!pending && !open && latestJob?.status === 'failed' && (
        <p className="muted" role="status">
          {latestJob.error || 'A imagem não foi gerada. Tente novamente; sua cota foi preservada.'}
        </p>
      )}
      {error && !open && <FlashMessage>{error}</FlashMessage>}
      {open && (
        <Modal
          title={`Imagem de ${character.name}`}
          close={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="stack"
            onSubmit={async (event) => {
              event.preventDefault();
              if (checkingQuota || quotaFull || pending || availability !== true || busy) return;
              setBusy(true);
              setError('');
              try {
                await post('/character-art', {
                  character_id: character.id,
                  reference: constructed ? undefined : reference,
                  idempotency_key: key.current,
                  equipment_slots: equipmentSlots,
                  helmet_mode: equipmentSlots.includes('head') ? helmetMode : 'closed',
                });
                setOpen(false);
                await onRefresh();
              } catch (error) {
                setError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p>Quando a nova imagem ficar pronta, você poderá compará-la com a atual e escolher qual manter.</p>
            <p>A geração inclui a arte do personagem e um token visto de cima para o VTT.</p>
            {checkingQuota ? (
              <p role="status">Consultando a cota mensal…</p>
            ) : (
              <ArtQuotaNotice quota={quota} subject="Personagem" initialFree accountWide />
            )}
            <span
              className={`illustrator-status ${state.available ? 'is-online' : 'is-offline'}`}
              role="status"
            >
              <span className="illustrator-dot" aria-hidden="true" />
              {availabilityError ||
                (availability === null
                  ? 'Consultando o ilustrador…'
                  : availability
                    ? 'Ilustrador disponível'
                    : 'Ilustrador offline')}
            </span>
            {constructed ? (
              <p className="muted">
                Warforged montado: a identidade salva será usada automaticamente. Corpo, cabeça,
                metal, acabamento e cores serão preservados; somente as roupas e os equipamentos
                selecionados mudam.
              </p>
            ) : (
              <ReferenceInput onChange={setReference} disabled={busy} />
            )}
            <ArtEquipmentChoices
              characterId={character.id}
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
              disabled={
                busy ||
                checkingQuota ||
                quotaFull ||
                pending ||
                (!constructed && !reference) ||
                !equipmentReady ||
                availability !== true
              }
            >
              {busy ? 'Vestindo...' : 'Vestir'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

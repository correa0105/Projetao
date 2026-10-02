import { FlashMessage } from './FlashMessage';
import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api, post } from './api';
import { Modal } from './components';
import { ReferenceInput } from './CharacterCamp';
import { ArtEquipmentChoices } from './ArtEquipmentChoices';
import type { ArtState } from '../shared/character-art';
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
        if (previous && previous !== signature) await refresh.current();
        if (!alive) return;
        previous = signature;
        setState(result);
      } catch {
        if (alive) setState((current) => ({ ...current, available: false }));
      } finally {
        updating = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [character.id]);
  const pending =
    character.art_pending ||
    state.jobs.some(
      (job) => job.character_id === character.id && ['queued', 'running'].includes(job.status),
    );
  const latestJob = state.jobs.find((job) => job.character_id === character.id);
  return (
    <div className="equipment-generate">
      <button
        className="button outline small-button"
        disabled={pending || !state.available}
        onClick={() => {
          if (!character.art_unlimited && character.art_used >= 2) {
            setError(
              'Este personagem já usou as duas imagens deste mês. Tente novamente no próximo mês.',
            );
            return;
          }
          key.current = crypto.randomUUID();
          setReference('');
          setEquipmentSlots([]);
          setEquipmentReady(false);
          setHelmetMode('closed');
          setError('');
          setOpen(true);
        }}
      >
        <Sparkles size={15} />
        {pending ? 'Vestindo...' : 'Vestir'}
      </button>
      {!pending && !state.available && (
        <p className="muted" role="status">
          Ilustrador offline. A geração ficará disponível quando ele for iniciado.
        </p>
      )}
      {!pending && !open && latestJob?.status === 'failed' && (
        <FlashMessage>
          {latestJob.error || 'A imagem não foi gerada. Tente novamente; sua cota foi preservada.'}
        </FlashMessage>
      )}
      {error && !open && (
        <FlashMessage>
          {error}
        </FlashMessage>
      )}
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
              setBusy(true);
              setError('');
              try {
                await post('/character-art', {
                  character_id: character.id,
                  reference,
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
            <p>A imagem atual permanece até a nova ficar pronta.</p>
            <span
              className={`illustrator-status ${state.available ? 'is-online' : 'is-offline'}`}
              role="status"
            >
              <span className="illustrator-dot" aria-hidden="true" />
              {state.available ? 'Ilustrador disponível' : 'Ilustrador offline'}
            </span>
            <ReferenceInput onChange={setReference} disabled={busy} />
            <ArtEquipmentChoices
              characterId={character.id}
              selected={equipmentSlots}
              onChange={setEquipmentSlots}
              onReady={setEquipmentReady}
              disabled={busy}
              helmetMode={helmetMode}
              onHelmetModeChange={setHelmetMode}
            />
            {error && (
              <FlashMessage>
                {error}
              </FlashMessage>
            )}
            <button className="button primary" disabled={busy || !reference || !equipmentReady}>
              {busy ? 'Vestindo...' : 'Vestir'}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

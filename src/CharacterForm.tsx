import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Sparkles } from 'lucide-react';
import { FlashMessage } from './FlashMessage';
import { api, post } from './api';
import { races, classes } from '../shared/rules';
import { SheetChoices } from './SheetChoices';
import { defaultChoices, reconcileChoices, validateChoices } from '../shared/character-sheet';
import { ReferenceInput } from './CharacterCamp';
import type { ArtState } from '../shared/character-art';
export function CharacterForm({
  done,
  initial,
  initialReference = '',
  initialJobId,
}: {
  done: () => Promise<void>;
  initial?: import('../shared/character-art').CharacterCreation;
  initialReference?: string;
  initialJobId?: string;
}) {
  const [reference, setReference] = useState(initialReference);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState('');
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => {
    let alive = true;
    const update = async () => {
      try {
        const state = await api<ArtState>('/character-art');
        if (alive) {
          setAvailable(state.available);
          setAvailabilityError('');
        }
      } catch {
        if (alive) {
          setAvailable(null);
          setAvailabilityError('Não foi possível consultar o ilustrador. Tentando novamente…');
        }
      }
    };
    void update();
    const timer = setInterval(() => void update(), 4000);
    window.addEventListener('focus', update);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  const [race, setRace] = useState<string>(initial?.race || 'Humano');
  const [cls, setCls] = useState<string>(initial?.class || 'Guerreiro');
  const [choices, setChoices] = useState(
    () =>
      initial?.choices || defaultChoices(initial?.race || 'Humano', initial?.class || 'Guerreiro'),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post(initialJobId ? `/character-art/${initialJobId}/retry` : '/character-art', {
        creation: {
          ...form,
          race,
          class: cls,
          background: choices.backgroundType,
          choices: validateChoices(race, cls, choices),
        },
        reference,
        idempotency_key: requestKey.current,
      });
      await done();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="sheet-form-reset character-creation-form" onSubmit={submit}>
      <p className="muted">
        Escolha sua origem e treinamento. Depois da arte, abra a Ficha para rolar e distribuir os
        seis atributos. Regras de 2024 e suplementos, com as espécies atualizadas de Eberron (2025).
      </p>
      <p className="muted small">
        Sua imagem de corpo inteiro é obrigatória; o personagem chega ao acampamento quando ela
        estiver pronta.
      </p>
      <p
        className="muted small"
        role="status"
        data-illustrator-status={available === null ? 'checking' : available ? 'online' : 'offline'}
      >
        {availabilityError ||
          (available === null
            ? 'Consultando o ilustrador…'
            : available
              ? 'Ilustrador disponível.'
              : 'Ilustrador offline. A disponibilidade será atualizada automaticamente.')}
      </p>
      <label>
        Nome do personagem
        <input
          name="name"
          defaultValue={initial?.name}
          minLength={2}
          maxLength={60}
          placeholder="Como sua lenda será lembrada?"
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Espécie
          <select
            name="race"
            aria-label="Espécie"
            value={race}
            onChange={(e) => {
              setRace(e.target.value);
              setChoices((current) => reconcileChoices(e.target.value, cls, current));
            }}
          >
            {races.map((race) => (
              <option key={race}>{race}</option>
            ))}
          </select>
        </label>
        <label>
          Classe
          <select
            name="class"
            aria-label="Classe"
            value={cls}
            onChange={(e) => {
              setCls(e.target.value);
              setChoices((current) => reconcileChoices(race, e.target.value, current));
            }}
          >
            {classes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <SheetChoices race={race} cls={cls} value={choices} onChange={setChoices} />
      <label>
        Sua história <span className="muted">(opcional)</span>
        <textarea
          name="biography"
          defaultValue={initial?.biography}
          rows={3}
          maxLength={2000}
          placeholder="De onde você veio? O que procura?"
        />
      </label>
      <ReferenceInput onChange={setReference} disabled={busy} />
      {initialReference && (
        <p className="muted small">
          A imagem enviada anteriormente está preservada. Você pode mantê-la ou enviar outra.
        </p>
      )}
      {error && <FlashMessage>{error}</FlashMessage>}
      <button className="button primary full" disabled={busy || !reference || !available}>
        {busy ? 'Criando personagem…' : 'Dar vida ao personagem'}
        <Sparkles size={17} />
      </button>
    </form>
  );
}

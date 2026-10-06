import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Check, Coins, PawPrint, ShoppingBag, Maximize2, Pencil, Save, X } from 'lucide-react';
import { api, post } from './api';
import { useSoundEffects } from './SiteMusic';
import {
  pets,
  petVariants,
  petAppearance,
  garalhoQuestions,
  type Pet,
  type OwnedPet,
  defaultPetBreeds,
  type PetBreed,
  type PetBreedCatalog,
} from '../shared/pets';
import { usePetAppearanceSound } from './PetSounds';
import { money } from '../shared/rules';
import { petArtwork } from './pet-art';
import { Modal } from './components';
import { OwnedPetArt } from './OwnedPetArt';
import type { Character } from './types';
import './pet-shop.css';

export function PetArt({
  pet,
  appearance = 'original',
  className = '',
}: {
  pet: Pet;
  appearance?: string;
  className?: string;
}) {
  const variant = petAppearance(pet.id, appearance);
  const artwork = petArtwork(pet.id, appearance);
  const clip = useId();
  return (
    <span
      role="img"
      aria-label={variant?.name || pet.name}
      className={`pet-art ${className}`}
      data-pet={pet.id}
      data-appearance={appearance}
      style={{ '--pet-ratio': `${artwork.frame[2]} / ${artwork.frame[3]}` } as CSSProperties}
    >
      <svg viewBox={artwork.frame.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <clipPath id={clip}>
            <rect
              x={artwork.frame[0]}
              y={artwork.frame[1]}
              width={artwork.frame[2]}
              height={artwork.frame[3]}
            />
          </clipPath>
        </defs>
        <image
          href={artwork.source}
          width={artwork.sheetWidth}
          height={artwork.sheetHeight}
          clipPath={`url(#${clip})`}
        />
      </svg>
    </span>
  );
}
export function PetCollection({ characterId }: { characterId: string }) {
  const [items, setItems] = useState<OwnedPet[]>([]),
    [breeds, setBreeds] = useState<PetBreed[]>(defaultPetBreeds),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [artRefresh, setArtRefresh] = useState(0);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent<{ characterId?: string }>).detail?.characterId === characterId)
        setArtRefresh((value) => value + 1);
    };
    window.addEventListener('companion-art-updated', changed);
    return () => window.removeEventListener('companion-art-updated', changed);
  }, [characterId]);
  useEffect(() => {
    let active = true;
    void Promise.all([
      api<OwnedPet[]>(`/pets/${characterId}`),
      api<PetBreedCatalog>('/pets/catalog'),
    ])
      .then(([value, catalog]) => {
        if (active) {
          setItems(value);
          setBreeds(catalog.breeds);
          setError('');
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [characterId, artRefresh]);
  async function select(id: string | null) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/pets/${characterId}/display`, {
        method: 'PUT',
        body: JSON.stringify({ pet_id: id }),
      });
      setItems((items) => items.map((item) => ({ ...item, displayed: item.id === id })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inventory-pets" aria-label="Mascotes do personagem">
      <header>
        <PawPrint size={18} />
        <h3>Mascote</h3>
        <a href="#pets">Visitar Garalho →</a>
      </header>
      {error && <p role="alert">{error}</p>}
      {!items.length && !error && <p>Os mascotes que você levar para casa aparecem aqui.</p>}
      <div>
        {items.map((item) => {
          const pet = pets.find((pet) => pet.id === item.pet_id);
          return pet ? (
            <button
              key={item.id}
              className="inventory-pet-choice"
              disabled={busy}
              aria-pressed={item.displayed}
              aria-label={`Mostrar ${item.name} no acampamento`}
              onClick={() => void select(item.id)}
            >
              <OwnedPetArt pet={item} />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {breeds.find(
                    (breed) => breed.pet_id === item.pet_id && breed.appearance === item.appearance,
                  )?.name || pet.name}
                </small>
              </span>
              {item.displayed && <Check size={16} />}
            </button>
          ) : null;
        })}
      </div>
      {items.length > 0 && (
        <button
          className="text-button"
          disabled={busy || !items.some((item) => item.displayed)}
          onClick={() => void select(null)}
        >
          Ocultar mascote
        </button>
      )}
    </section>
  );
}

export function PetShop({
  character,
  onPurchased,
}: {
  character?: Character;
  onPurchased: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<Pet>(pets[0]);
  const [appearance, setAppearance] = useState('original');
  const [soundTrigger, setSoundTrigger] = useState(0);
  usePetAppearanceSound(selected.id, appearance, soundTrigger);
  const [name, setName] = useState('');
  const [catalog, setCatalog] = useState<PetBreedCatalog>({
    breeds: defaultPetBreeds(),
    can_edit: false,
  });
  const [editingBreed, setEditingBreed] = useState<PetBreed | null>(null);
  const [talking, setTalking] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'writing' | 'turning'>('ready');
  const [answer, setAnswer] = useState('Pode entrar. Os bichos são meus; o sofá é dos gatos.');
  const [reading, setReading] = useState(false);
  const [meow, setMeow] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const sound = useSoundEffects();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const key = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const live = useRef(true);
  const garden = useRef<HTMLDivElement>(null);
  const breed = catalog.breeds.find(
    (item) => item.pet_id === selected.id && item.appearance === appearance,
  )!;
  useEffect(() => {
    let active = true;
    void api<PetBreedCatalog>('/pets/catalog')
      .then((value) => {
        if (active) setCatalog(value);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!talking) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTalking(false);
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [talking]);
  function silence() {
    if (audio.current) {
      audio.current.pause();
      audio.current = null;
    }
  }
  useEffect(() => {
    live.current = true;
    const hidden = () => {
      if (document.hidden) silence();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      live.current = false;
      timers.current.forEach(clearTimeout);
      silence();
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => {
    if (sound.muted || sound.volume === 0) silence();
    else if (audio.current) audio.current.volume = sound.volume * 0.8;
  }, [sound.muted, sound.volume]);
  function meowSound() {
    if (sound.muted || !sound.volume || document.hidden) return;
    silence();
    try {
      const voice = new Audio('/audio/pets/cat.wav');
      audio.current = voice;
      voice.volume = sound.volume * 0.8;
      void voice.play().catch(() => {});
      voice.onended = () => {
        if (audio.current === voice) silence();
      };
    } catch {
      /* Text communication remains available if audio is unavailable. */
    }
  }
  function write(text: string, voice = '') {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMeow(voice);
    setReading(false);
    setPhase('writing');
    if (voice) meowSound();
    else silence();
    timers.current.push(
      setTimeout(() => {
        setAnswer(text);
        setPhase('turning');
        timers.current.push(setTimeout(() => setPhase('ready'), 480));
      }, 2500),
    );
  }
  async function buy() {
    if (!character || inFlight.current) return;
    const finalName = name.trim();
    if (!finalName) {
      setError('Dê um nome ao seu mascote antes de comprar.');
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await post<{ pet: OwnedPet }>(`/pets/purchase`, {
        character_id: character.id,
        pet_id: selected.id,
        appearance,
        name: finalName,
        idempotency_key: key.current,
      });
      if (live.current) {
        key.current = crypto.randomUUID();
        setNotice(`${result.pet.name} agora acompanha ${character.name}.`);
        write('Amigo novo. Agora você pode parar de conversar com a espada.');
      }
      await onPurchased();
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (live.current) setBusy(false);
    }
  }
  return (
    <section className="pet-shop" aria-label="Casa dos mascotes">
      <div className="pet-shop-garden" ref={garden}>
        <div className="pet-shop-background" aria-hidden="true" />
        <div className="pet-shop-atmosphere" aria-hidden="true" />
        <aside className="pet-shop-purchase" aria-label="Conheça seu companheiro">
          <header>
            <span className="eyebrow">O EMPÓRIO DE GARALHO</span>
            <h2>Amizades para a estrada.</h2>
            <p>Uma casa acolhedora. Um novo amigo à sua espera.</p>
          </header>
          <div className="pet-shop-details">
            <h3>{selected.name}</h3>
            <div className="pet-breed-heading">
              <span>{breed.name}</span>
              {catalog.can_edit && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => setEditingBreed(breed)}
                >
                  <Pencil size={13} /> Editar raça
                </button>
              )}
            </div>
            <p>{selected.description}</p>
            {petVariants.some((v) => v.pet_id === selected.id) && (
              <fieldset className="pet-appearances" disabled={busy}>
                <legend>Aparência</legend>
                {[
                  'original',
                  ...petVariants.filter((v) => v.pet_id === selected.id).map((v) => v.id),
                ].map((id) => (
                  <button
                    key={id}
                    aria-pressed={appearance === id}
                    onClick={() => {
                      setAppearance(id);
                      setSoundTrigger((value) => value + 1);
                      key.current = crypto.randomUUID();
                    }}
                  >
                    <PetArt pet={selected} appearance={id} />
                    <span>
                      {catalog.breeds.find(
                        (breed) => breed.pet_id === selected.id && breed.appearance === id,
                      )?.name || 'Clássico'}
                    </span>
                  </button>
                ))}
              </fieldset>
            )}
            <label>
              Como vai se chamar?
              <input
                maxLength={40}
                value={name}
                required
                disabled={busy}
                placeholder={`Nome do seu ${selected.name.toLocaleLowerCase('pt-BR')}`}
                onChange={(event) => {
                  setName(event.target.value);
                  key.current = crypto.randomUUID();
                }}
              />
            </label>
            <div className="pet-shop-price">
              <strong>{money(selected.price_cp)} PO</strong>
              <small>
                <Coins size={12} />{' '}
                {character
                  ? `${character.gold_unlimited ? '∞' : money(character.gold_cp)} PO disponíveis`
                  : 'Selecione um personagem'}
              </small>
            </div>
            {error && (
              <p className="pet-shop-error" role="alert">
                {error}
              </p>
            )}
            {notice && (
              <p className="pet-shop-notice" role="status">
                {notice}
              </p>
            )}
            <button
              className="button primary"
              disabled={
                busy ||
                !character ||
                !name.trim() ||
                (!character.gold_unlimited && character.gold_cp < selected.price_cp)
              }
              onClick={() => void buy()}
            >
              <ShoppingBag size={16} /> {busy ? 'Preparando a viagem…' : 'Levar este companheiro'}
            </button>
            {character && !name.trim() && <p>Dê um nome ao seu mascote para comprar.</p>}
            <a className="pet-shop-inventory-link" href="#inventory">
              Ver meus mascotes no inventário →
            </a>
          </div>
        </aside>
        <div
          className="pet-shop-preview"
          key={selected.id + appearance}
          style={
            { '--pet-width': `${petArtwork(selected.id, appearance).width}px` } as CSSProperties
          }
        >
          <PetArt pet={selected} appearance={appearance} />
          <span className="pet-shop-preview-name">{name.trim() || selected.name}</span>
        </div>
        <div className="garalho-scene" data-phase={phase}>
          <button
            className="garalho-portrait"
            aria-label="Conversar com Garalho"
            aria-expanded={talking}
            aria-controls={talking ? 'garalho-dialogue' : undefined}
            onClick={() => {
              setTalking((value) => !value);
              setMeow('');
              silence();
            }}
          >
            <img
              className="garalho-ready-pose"
              src="/pets/garalho-sign-ready-v2.png"
              alt="Garalho, pequeno gato de olhos dourados afastados, segurando uma placa de madeira com as duas patas"
            />
            <img
              className="garalho-writing-pose"
              src="/pets/garalho-sign-writing-v2.png"
              alt=""
              aria-hidden="true"
            />
            <img
              className="garalho-writing-paw"
              src="/pets/garalho-sign-writing-v2.png"
              alt=""
              aria-hidden="true"
            />
          </button>
          <div className="garalho-sign" data-phase={phase}>
            <div className="garalho-sign-front">
              <p aria-live="polite">{phase === 'ready' ? answer : ''}</p>
            </div>
          </div>
          <div className="garalho-caption">
            <span className="garalho-writing-status" role="status" aria-live="polite">
              {phase === 'writing'
                ? 'Garalho está escrevendo…'
                : phase === 'turning'
                  ? 'Virando a placa…'
                  : ''}
            </span>
            <button
              className="garalho-read-sign"
              disabled={phase !== 'ready'}
              onClick={() => setReading(true)}
            >
              <Maximize2 size={12} /> Ler placa
            </button>
          </div>
        </div>
        {talking && (
          <aside
            className="garalho-dialogue"
            id="garalho-dialogue"
            aria-label="Conversa com Garalho"
          >
            <header>
              <span>Garalho</span>
              <button
                aria-label="Fechar conversa com Garalho"
                onClick={() => {
                  setTalking(false);
                  silence();
                }}
              >
                <X size={15} />
              </button>
            </header>
            {meow ? (
              <p className="garalho-reply" aria-live="polite">
                {meow}
              </p>
            ) : (
              <p className="garalho-dialogue-intro">O gato ajeita a placa e espera sua pergunta.</p>
            )}
            <div className="garalho-questions" aria-label="Perguntas para Garalho">
              {garalhoQuestions.map((question) => (
                <button key={question.id} onClick={() => write(question.answer, question.meow)}>
                  {question.question}
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>
      <section className="pet-shop-catalog" aria-label="Mascotes à venda">
        <header>
          <div>
            <span className="eyebrow">PEQUENOS COMPANHEIROS</span>
            <h2>Quem segue com você?</h2>
          </div>
          <p>Escolha um mascote para conhecê-lo no jardim.</p>
        </header>
        <div className="pet-shop-choices">
          {pets.map((pet) => (
            <button
              key={pet.id}
              aria-pressed={selected.id === pet.id}
              disabled={busy}
              onClick={() => {
                setSelected(pet);
                setSoundTrigger((value) => value + 1);
                setAppearance('original');
                setName('');
                key.current = crypto.randomUUID();
                setNotice('');
                setError('');
                write(pet.sign);
                garden.current?.scrollIntoView({
                  behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'instant'
                    : 'smooth',
                  block: 'start',
                });
              }}
            >
              <span className="pet-choice-art">
                <PetArt pet={pet} />
              </span>
              <strong>{pet.name}</strong>
              <small>{money(pet.price_cp)} PO</small>
              {selected.id === pet.id && <Check className="pet-choice-check" size={15} />}
            </button>
          ))}
        </div>
      </section>
      <a
        className="pet-sound-credits"
        href="/audio/pets/CREDITS.md"
        target="_blank"
        rel="noopener noreferrer"
      >
        Créditos dos sons
      </a>
      {reading && (
        <Modal title="Placa de Garalho" close={() => setReading(false)}>
          <div className="garalho-reading-board">
            <p>{answer}</p>
            <small>Garalho</small>
          </div>
        </Modal>
      )}
      {editingBreed && (
        <PetBreedEditor
          breed={editingBreed}
          close={() => setEditingBreed(null)}
          saved={(breed) => {
            setCatalog((catalog) => ({
              ...catalog,
              breeds: catalog.breeds.map((item) =>
                item.pet_id === breed.pet_id && item.appearance === breed.appearance ? breed : item,
              ),
            }));
            setEditingBreed(null);
          }}
        />
      )}
    </section>
  );
}
function PetBreedEditor({
  breed,
  close,
  saved,
}: {
  breed: PetBreed;
  close: () => void;
  saved: (breed: PetBreed) => void;
}) {
  const [name, setName] = useState(breed.name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title="Editar raça do mascote"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="pet-breed-editor"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          setError('');
          void api<PetBreed>(`/pets/catalog/${breed.pet_id}/${breed.appearance}`, {
            method: 'PUT',
            body: JSON.stringify({ name: name.trim(), revision: breed.revision }),
          })
            .then(saved)
            .catch((e: Error) => setError(e.message))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Nome da raça
          <input
            required
            maxLength={80}
            value={name}
            disabled={busy}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p>O nome será atualizado na loja e nos mascotes que já foram comprados.</p>
        {error && <p role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button" disabled={busy} onClick={close}>
            Cancelar
          </button>
          <button className="button primary" disabled={busy}>
            <Save size={15} /> {busy ? 'Salvando…' : 'Salvar raça'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

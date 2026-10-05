import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { Check, Coins, PawPrint, ShoppingBag, Maximize2 } from 'lucide-react';
import { api, post } from './api';
import { useSoundEffects } from './SiteMusic';
import {
  pets,
  petVariants,
  petAppearance,
  garalhoQuestions,
  type Pet,
  type OwnedPet,
} from '../shared/pets';
import { usePetAppearanceSound } from './PetSounds';
import { money } from '../shared/rules';
import { petArtwork } from './pet-art';
import { Modal } from './components';
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
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void api<OwnedPet[]>(`/pets/${characterId}`)
      .then((value) => {
        if (active) setItems(value);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [characterId]);
  return (
    <section className="inventory-pets" aria-label="Mascotes do personagem">
      <header>
        <PawPrint size={18} />
        <h3>Pequenos companheiros</h3>
        <a href="#pets">Visitar Garalho →</a>
      </header>
      {error && <p role="alert">{error}</p>}
      {!items.length && !error && <p>Os mascotes que você levar para casa aparecem aqui.</p>}
      <div>
        {items.map((item) => {
          const pet = pets.find((pet) => pet.id === item.pet_id);
          return pet ? (
            <article key={item.id}>
              <PetArt pet={pet} appearance={item.appearance} />
              <span>
                <strong>{item.name}</strong>
                <small>{petAppearance(pet.id, item.appearance)?.name || pet.name}</small>
              </span>
            </article>
          ) : null;
        })}
      </div>
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
  usePetAppearanceSound(selected.id, appearance);
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<'ready' | 'writing' | 'turning'>('ready');
  const [answer, setAnswer] = useState(
    'Bem-vindo. Escolha um amigo. Aqui todos recebem abrigo e cuidado.',
  );
  const [reading, setReading] = useState(false);
  const [meow, setMeow] = useState('Miau…');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const sound = useSoundEffects();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const key = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  const live = useRef(true);
  const garden = useRef<HTMLDivElement>(null);
  function silence() {
    if (audio.current) {
      void audio.current.close().catch(() => {});
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
  }, [sound.muted, sound.volume]);
  function meowSound() {
    if (sound.muted || !sound.volume || document.hidden) return;
    silence();
    try {
      const context = new AudioContext();
      audio.current = context;
      const gain = context.createGain(),
        voice = context.createOscillator(),
        formant = context.createBiquadFilter();
      voice.type = 'triangle';
      voice.frequency.setValueAtTime(380, context.currentTime);
      voice.frequency.exponentialRampToValueAtTime(620, context.currentTime + 0.1);
      voice.frequency.exponentialRampToValueAtTime(230, context.currentTime + 0.55);
      formant.type = 'bandpass';
      formant.frequency.value = 1100;
      formant.Q.value = 1.4;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12 * sound.volume, context.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
      voice.connect(formant).connect(gain).connect(context.destination);
      voice.start();
      voice.stop(context.currentTime + 0.65);
      voice.onended = () => {
        if (audio.current === context) silence();
      };
    } catch {
      /* Text communication remains available if audio is unavailable. */
    }
  }
  function write(text: string, voice = 'Miau… miaaau.') {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMeow(voice);
    setReading(false);
    setPhase('writing');
    meowSound();
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
    inFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await post<{ pet: OwnedPet }>(`/pets/purchase`, {
        character_id: character.id,
        pet_id: selected.id,
        appearance,
        name: name.trim() || selected.name,
        idempotency_key: key.current,
      });
      if (live.current) {
        key.current = crypto.randomUUID();
        setNotice(`${result.pet.name} agora acompanha ${character.name}.`);
        write('Negócio feito. Seu amigo está no inventário. Cuide bem dele.', 'Miau!');
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
                      key.current = crypto.randomUUID();
                    }}
                  >
                    <PetArt pet={selected} appearance={id} />
                    <span>{petAppearance(selected.id, id)?.name || 'Clássico'}</span>
                  </button>
                ))}
              </fieldset>
            )}
            <label>
              Como vai se chamar?
              <input
                maxLength={40}
                value={name}
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
                  ? `${money(character.gold_cp)} PO disponíveis`
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
              disabled={busy || !character || character.gold_cp < selected.price_cp}
              onClick={() => void buy()}
            >
              <ShoppingBag size={16} /> {busy ? 'Preparando a viagem…' : 'Levar este companheiro'}
            </button>
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
            onClick={() =>
              write(
                'Garalho. Cuido desta casa e dos bichinhos. Eu escrevo; você lê. Miau!',
                'Miau…',
              )
            }
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
          <div className="garalho-meow" aria-live="polite">
            <small>Garalho</small>
            <em>{meow}</em>
          </div>
          <div className="garalho-sign" data-phase={phase}>
            <div className="garalho-sign-front">
              <p aria-live="polite">{phase === 'ready' ? answer : ''}</p>
            </div>
            <div className="garalho-sign-writing" aria-hidden="true">
              <svg viewBox="0 0 150 60">
                <path
                  pathLength="1"
                  d="M20 14q12-5 24 0t24 0 28 0M20 28q15-4 33 0t30 0 17 0M20 42q18-5 36 0t39 0"
                />
              </svg>
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
        <div className="garalho-questions" aria-label="Perguntas para Garalho">
          <span>Converse com o anfitrião</span>
          {garalhoQuestions.map((question) => (
            <button key={question.id} onClick={() => write(question.answer, question.meow)}>
              {question.question}
            </button>
          ))}
        </div>
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
                setAppearance('original');
                setName('');
                key.current = crypto.randomUUID();
                setNotice('');
                setError('');
                write(pet.sign, pet.id === 'cat' ? 'Miaaau.' : 'Miau…');
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
      {reading && (
        <Modal title="Placa de Garalho" close={() => setReading(false)}>
          <div className="garalho-reading-board">
            <p>{answer}</p>
            <small>Garalho · {meow}</small>
          </div>
        </Modal>
      )}
    </section>
  );
}

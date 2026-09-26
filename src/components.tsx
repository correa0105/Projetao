import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  X,
  LoaderCircle,
  Sparkles,
  Pause,
  Play,
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
} from 'lucide-react';
import { races, classes, statNames } from '../shared/rules';
import { authClient, api, post } from './api';
import type { AtlasData, AtlasLocation, Character, Post } from './types';
import { ReferenceInput } from './CharacterCamp';
import type { ArtState } from '../shared/character-art';

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Sparkles size={30} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Login() {
  const [started, setStarted] = useState(false);
  const [transition, setTransition] = useState<'idle' | 'opening' | 'closing'>('idle');
  const [showPassword, setShowPassword] = useState(false);
  const [atmospherePaused, setAtmospherePaused] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!started) return;
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
    const timer = window.setTimeout(() => emailRef.current?.focus({ preventScroll: true }), delay);
    return () => window.clearTimeout(timer);
  }, [started]);
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (transition === 'idle') return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = window.setTimeout(
      () => {
        const opening = transition === 'opening';
        setStarted(opening);
        setTransition('idle');
        if (!opening) {
          setError('');
          setRegister(false);
          setShowPassword(false);
          requestAnimationFrame(() => startRef.current?.focus({ preventScroll: true }));
        }
      },
      reducedMotion ? 0 : transition === 'opening' ? 180 : 220,
    );
    return () => window.clearTimeout(timer);
  }, [transition]);
  function returnToPresentation() {
    if (busy || transition !== 'idle') return;
    setTransition('closing');
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const credentials = {
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      };
      const result = register
        ? await authClient.signUp.email({ ...credentials, name: String(form.get('name')).trim() })
        : await authClient.signIn.email(credentials);
      if (result.error)
        setError(
          register
            ? 'Não foi possível criar a conta. Confira os dados ou tente entrar se já tem cadastro.'
            : 'E-mail ou senha incorretos. Confira seus dados e tente novamente.',
        );
    } catch {
      setError('Não foi possível conectar ao servidor. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={`entry-page ${started || transition === 'opening' ? 'entry-page--auth' : ''} ${atmospherePaused ? 'atmosphere-paused' : ''}`}
      data-transition={transition}
    >
      <div className="entry-atmosphere" aria-hidden="true">
        <div className="entry-map" />
        <div className="entry-mist" />
        <div className="entry-cloud-current">
          {[0, 1].map((copy) => (
            <div className="entry-cloud-field" key={copy}>
              <div className="entry-cloud entry-cloud--west" />
              <div className="entry-cloud entry-cloud--east" />
              <div className="entry-cloud entry-cloud--near" />
            </div>
          ))}
        </div>
        <div className="entry-vignette" />
      </div>
      <div className="entry-frame" aria-hidden="true" />
      <main
        className={started ? 'entry-content entry-auth' : 'entry-content entry-intro'}
        onClick={(event) => {
          if (started && event.target === event.currentTarget) returnToPresentation();
        }}
        onKeyDown={(event) => {
          if (started && event.key === 'Escape') {
            event.preventDefault();
            returnToPresentation();
          }
        }}
      >
        {started ? (
          <section
            className="auth-panel"
            aria-labelledby="auth-heading"
            inert={transition === 'closing'}
          >
            <div className="login-form">
              <h1 id="auth-heading">{register ? 'Criar conta' : 'Entrar'}</h1>
              <form onSubmit={submit}>
                {register && (
                  <label>
                    <span className="auth-field-name">Como podemos chamar você?</span>
                    <input
                      name="name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={60}
                      placeholder="Seu nome de aventureiro"
                      required
                    />
                  </label>
                )}
                <label>
                  <span className="auth-field-name">E-mail</span>
                  <span className="auth-input">
                    <Mail size={17} aria-hidden="true" />
                    <input
                      ref={emailRef}
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="Seu e-mail"
                      maxLength={254}
                      required
                    />
                  </span>
                </label>
                <label>
                  <span className="auth-field-name">Senha</span>
                  <span className="auth-input">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={register ? 'new-password' : 'current-password'}
                      minLength={register ? 10 : 1}
                      maxLength={128}
                      placeholder={register ? 'Pelo menos 10 caracteres' : 'Sua senha'}
                      required
                    />
                    <button
                      className="password-visibility"
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff size={17} aria-hidden="true" />
                      ) : (
                        <Eye size={17} aria-hidden="true" />
                      )}
                    </button>
                  </span>
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary full" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : register ? (
                    'Criar minha conta'
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>
              <p className="auth-switch">
                {register ? 'Já faz parte da guilda?' : 'Sua primeira visita?'}{' '}
                <button
                  disabled={busy}
                  onClick={() => {
                    setShowPassword(false);
                    setRegister(!register);
                    setError('');
                  }}
                >
                  {register ? 'Entrar' : 'Criar uma conta'}
                </button>
              </p>
            </div>
          </section>
        ) : (
          <section className="intro-story" aria-labelledby="intro-heading">
            <span className="entry-eyebrow">EXPLORE O DESCONHECIDO</span>
            <h1 id="intro-heading">
              <span className="wordmark-line">Alvorada</span>{' '}
              <span className="wordmark-line">Cinzenta</span>
            </h1>
            <div className="intro-rule" aria-hidden="true" />
            <button
              ref={startRef}
              className="adventure-button"
              disabled={transition !== 'idle'}
              onClick={() => setTransition('opening')}
            >
              Iniciar aventura
            </button>
          </section>
        )}
      </main>
      {!started && (
        <button
          className="atmosphere-toggle"
          aria-pressed={atmospherePaused}
          onClick={() => setAtmospherePaused(!atmospherePaused)}
        >
          {atmospherePaused ? <Play size={13} /> : <Pause size={13} />}
          {atmospherePaused ? 'Retomar atmosfera' : 'Pausar atmosfera'}
        </button>
      )}
    </div>
  );
}
export function CharacterForm({ done }: { done: () => Promise<void> }) {
  const [reference, setReference] = useState('');
  const [available, setAvailable] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  useEffect(() => {
    void api<ArtState>('/character-art')
      .then((state) => setAvailable(state.available))
      .catch(() => {});
  }, []);
  const [stats, setStats] = useState([15, 14, 13, 12, 10, 8]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post('/character-art', {
        creation: { ...form, stats },
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
    <form className="stack" onSubmit={submit}>
      <p className="muted">
        Nível 1, 150 PO e uma história só sua. A ficha usa uma base simplificada de D&D 5e.
      </p>
      <p className="muted small">
        Até dois personagens por conta. Sua imagem de corpo inteiro é obrigatória; o personagem
        chega ao acampamento quando ela estiver pronta.
      </p>
      {!available && (
        <p className="form-error" role="status">
          O ilustrador está offline. Volte quando ele estiver disponível.
        </p>
      )}
      <label>
        Nome do personagem
        <input
          name="name"
          minLength={2}
          maxLength={60}
          placeholder="Como sua lenda será lembrada?"
          required
        />
      </label>
      <div className="form-grid">
        <label>
          Raça
          <select name="race" aria-label="Raça">
            {races.map((race) => (
              <option key={race}>{race}</option>
            ))}
          </select>
        </label>
        <label>
          Classe
          <select name="class" aria-label="Classe" defaultValue="Guerreiro">
            {classes.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Antecedente
        <input name="background" defaultValue="Aventureiro" minLength={2} maxLength={40} required />
      </label>
      <fieldset>
        <legend>Atributos · matriz padrão</legend>
        <p className="muted small">Ao escolher um valor, os dois atributos trocam de posição.</p>
        <div className="stats-form">
          {statNames.map((name, index) => (
            <label key={name}>
              {name}
              <select
                aria-label={name}
                value={stats[index]}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  const copy = [...stats];
                  const previous = copy.indexOf(value);
                  copy[previous] = copy[index];
                  copy[index] = value;
                  setStats(copy);
                }}
              >
                {[15, 14, 13, 12, 10, 8].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Sua história <span className="muted">(opcional)</span>
        <textarea
          name="biography"
          rows={3}
          maxLength={2000}
          placeholder="De onde você veio? O que procura?"
        />
      </label>
      <ReferenceInput onChange={setReference} disabled={busy} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary full" disabled={busy || !reference || !available}>
        {busy ? 'Criando personagem…' : 'Dar vida ao personagem'}
        <Sparkles size={17} />
      </button>
    </form>
  );
}
export function PostForm({
  done,
  canCreateEvent = false,
  initialLocation,
  requireMappedLocation = false,
}: {
  done: () => Promise<void>;
  canCreateEvent?: boolean;
  initialLocation?: AtlasLocation;
  requireMappedLocation?: boolean;
}) {
  const [kind, setKind] = useState('mission');
  const [locations, setLocations] = useState<AtlasLocation[]>(
    initialLocation ? [initialLocation] : [],
  );
  const [locationId, setLocationId] = useState(initialLocation?.id || '');
  const [placesError, setPlacesError] = useState('');
  useEffect(() => {
    let alive = true;
    api<AtlasData>('/atlas')
      .then((data) => {
        if (alive)
          setLocations(
            data.locations.filter((place) =>
              data.regions.some((region) => region.id === place.region_id && region.available),
            ),
          );
      })
      .catch(() => {
        if (alive)
          setPlacesError('Não foi possível carregar os locais do mapa. Feche e tente novamente.');
      });
    return () => {
      alive = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await post<Post>('/board', {
        ...form,
        kind,
        location_id: locationId || undefined,
        starts_at: form.starts_at ? new Date(String(form.starts_at)).toISOString() : undefined,
        reward_cp: Math.round(Number(form.reward) * 100),
      });
      await done();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Título
        <input
          name="title"
          minLength={5}
          maxLength={100}
          required
          placeholder="Toda aventura começa com um chamado"
        />
      </label>
      <div className="form-grid">
        <label>
          Tipo
          <select
            name="kind"
            aria-label="Tipo"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="mission">Missão</option>
            {canCreateEvent && <option value="event">Evento</option>}
          </select>
        </label>
        <label>
          Dificuldade
          <select name="difficulty" aria-label="Dificuldade">
            <option>Tranquila</option>
            <option>Moderada</option>
            <option>Perigosa</option>
          </select>
        </label>
      </div>
      <label>
        Data e hora de início
        <input name="starts_at" type="datetime-local" required={kind === 'mission'} />
        <small className="muted">
          Horário local: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </small>
      </label>
      <label>
        Local no mapa
        <select
          aria-label="Local no mapa"
          value={locationId}
          required={requireMappedLocation}
          onChange={(event) => setLocationId(event.target.value)}
        >
          <option value="">
            {requireMappedLocation ? 'Escolha um local do reino' : 'Outro local (informar abaixo)'}
          </option>
          {locations.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name} · Reino do Norte
            </option>
          ))}
        </select>
      </label>
      {placesError && (
        <p className="form-error" role="alert">
          {placesError}
        </p>
      )}
      {!locationId && !requireMappedLocation && (
        <label>
          Local
          <input
            name="location"
            minLength={2}
            maxLength={100}
            required
            placeholder="Onde a história acontece?"
          />
        </label>
      )}
      <label>
        Descrição
        <textarea name="description" minLength={15} maxLength={3000} rows={4} required />
      </label>
      <label>
        Recompensa anunciada (PO)
        <input
          name="reward"
          type="number"
          min={0}
          max={100000}
          step="0.01"
          defaultValue={0}
          required
        />
      </label>
      <p className="muted small">
        Ouro é uma recompensa anunciada. O XP é concedido pelo criador ao concluir a missão.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button primary" disabled={busy}>
        {busy ? 'Publicando…' : 'Publicar no mural'}
      </button>
    </form>
  );
}

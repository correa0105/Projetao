import { WorldPlacePicker } from './WorldPlacePicker';
import {CharacterSlotDice} from './CharacterSlotDice';
import { defaultWarforgedAppearance, warforgedArtMode } from '../shared/warforged-appearance';
import { validateCreationAppearance } from '../shared/character-appearance';
import { RecoveryRequest } from './PasswordRecovery';
import { passwordMinimumLength, passwordPattern, passwordRule, validNewPassword } from '../shared/password-policy';
import { PersonalVttLink } from './PersonalVttLink';
import { MusicControls } from './SiteMusic';
import { FlashMessage } from './FlashMessage';
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
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
import { races, classes } from '../shared/rules';
import {
  RANKS,
  RANK_REWARD_CP,
  RANK_TEST_LEVELS,
  MISSION_THRESHOLDS,
  rankName,
  rankTitle,
  rankLabel,
  type Rank,
} from '../shared/progression';
import { authClient, api, post } from './api';
import { PaperPicker } from './NoticePaper';
import type { PaperStyle } from '../shared/notice-board';
import type { AtlasData, AtlasLocation, Character, Post } from './types';
import { SheetChoices } from './SheetChoices';
import { defaultChoices, reconcileChoices, validateChoices } from '../shared/character-sheet';
import { ReferenceInput } from './CharacterCamp';
import { MissionTagPicker } from './MissionTagPicker';
import type { ArtState } from '../shared/character-art';
const LoginWorldMap = lazy(() =>
  import('./WorldMap').then((module) => ({ default: module.WorldMap })),
);
const loginMarkers: [] = [];
const ignoreLoginSelection = () => {};

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
  parchment = false,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  parchment?: boolean;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      className={parchment ? 'character-sheet character-creation-dialog' : undefined}
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissOnEscape) close();
      }}
      onClick={(event) => {
        if (dismissOnBackdrop && event.target === event.currentTarget) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className={parchment ? 'dialog-inner sheet-panel' : 'dialog-inner'}>
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
  const [recover, setRecover] = useState(false);
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
          setRecover(false);
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
      if(register&&!validNewPassword(credentials.password)){setError(passwordRule);return;}
      const result = register
        ? await authClient.signUp.email({
            ...credentials,
            name: String(form.get('name')).trim(),
          })
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
        <div className="entry-map entry-map--world">
          <Suspense fallback={null}>
            <LoginWorldMap
              markers={loginMarkers}
              onSelect={ignoreLoginSelection}
              paused={atmospherePaused}
              decorative
            />
          </Suspense>
        </div>
        <div className="entry-vignette" />
      </div>
      <div className="entry-frame" aria-hidden="true" />
      <MusicControls login />
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
              <h1 id="auth-heading">{recover?'Recuperar senha':register ? 'Criar conta' : 'Entrar'}</h1>
              {recover?<RecoveryRequest onBack={()=>setRecover(false)}/>:<form onSubmit={submit}>
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
                      minLength={register ? passwordMinimumLength : 1}
                      pattern={register ? passwordPattern : undefined}
                      title={register ? passwordRule : undefined}
                      aria-describedby={register ? 'signup-password-rule' : undefined}
                      maxLength={128}
                      placeholder={register ? 'Pelo menos 6 caracteres' : 'Sua senha'}
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
                {register&&<p id="signup-password-rule" className="auth-password-rule">{passwordRule}</p>}
                {error && <FlashMessage>{error}</FlashMessage>}
                <button className="button primary full" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : register ? (
                    'Criar minha conta'
                  ) : (
                    'Entrar'
                  )}
                </button>
              </form>}
              {!register&&!recover&&<button className="auth-forgot" type="button" disabled={busy} onClick={()=>{setRecover(true);setError('');}}>Esqueci minha senha</button>}
              {!recover&&<p className="auth-switch">
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
              </p>}
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
      <button
        className="atmosphere-toggle"
        aria-pressed={atmospherePaused}
        onClick={() => setAtmospherePaused(!atmospherePaused)}
      >
        {atmospherePaused ? <Play size={13} /> : <Pause size={13} />}
        {atmospherePaused ? 'Retomar animação' : 'Pausar animação'}
      </button>
    </div>
  );
}
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
  const [creationSlot,setCreationSlot]=useState<number|null>(null);
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
  const useWarforgedReference = warforgedArtMode(choices) === 'reference';
  const needsReference = race !== 'Warforged' || useWarforgedReference;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if(!creationSlot)throw new Error('Confirme os seis atributos do slot antes de criar a aparência.');
      validateCreationAppearance(race, choices);
      await post(initialJobId ? `/character-art/${initialJobId}/retry` : '/character-art', {
        creation: {
          ...form,
          creation_slot:creationSlot,
          race,
          class: cls,
          background: choices.backgroundType,
          choices: validateChoices(race, cls, choices),
        },
        reference: race === 'Warforged' && !useWarforgedReference ? undefined : reference,
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
        Role os seis atributos antes de criar sua aparência. Depois da arte, abra a Ficha para
        distribuí-los. Regras de 2024 e suplementos, com as espécies atualizadas de Eberron (2025).
      </p>
      <CharacterSlotDice initialSlot={initial?.creation_slot} onReady={setCreationSlot}/>
      <fieldset disabled={!creationSlot||busy} style={{border:0,padding:0,minWidth:0}}>
      <p className="muted small">
        {race === 'Warforged'
          ? 'O ilustrador cria seu Warforged com a estrutura, a cabeça, as cores e o acabamento escolhidos. A imagem de referência é opcional.'
          : 'Envie uma imagem de referência; o personagem chega ao acampamento quando a arte de corpo inteiro estiver pronta.'}
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
      <SheetChoices race={race} cls={cls} value={choices} onChange={setChoices} requireAppearance warforgedModeControl={race === 'Warforged' && (
        <fieldset className="character-reference-choices" disabled={busy}>
          <legend>Como criar a aparência</legend>
          <label className="check">
            <input
              type="radio"
              name="warforged-reference-mode"
              checked={!useWarforgedReference}
              onChange={() => setChoices(current => ({...current,warforgedArtMode:'construction',warforgedAppearance:current.warforgedAppearance || {...defaultWarforgedAppearance,body:current.warforgedBody || defaultWarforgedAppearance.body},warforgedBody:undefined}))}
            />
            Criar apenas com as características escolhidas
          </label>
          <label className="check">
            <input
              type="radio"
              name="warforged-reference-mode"
              checked={useWarforgedReference}
              onChange={() => setChoices(current => ({...current,warforgedArtMode:'reference',warforgedBody:current.warforgedAppearance?.body || current.warforgedBody,warforgedAppearance:undefined}))}
            />
            Enviar uma imagem de referência
          </label>
          <p className="muted small">
            Nos dois modos, escolha as características físicas e a estrutura do corpo.
            Com referência, a cabeça, as cores e o acabamento vêm da imagem enviada.
            Sem referência, escolha também a cabeça e os materiais da montagem.
          </p>
        </fieldset>
      )} />
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
      {(race !== 'Warforged' || useWarforgedReference) && (
        <ReferenceInput onChange={setReference} disabled={busy} required={!reference} />
      )}
      {initialReference && (race !== 'Warforged' || useWarforgedReference) && (
        <p className="muted small">
          A imagem enviada anteriormente está preservada. Você pode mantê-la ou enviar outra.
        </p>
      )}
      {error && <FlashMessage>{error}</FlashMessage>}
      <button
        className="button primary full"
        disabled={busy || !creationSlot || (needsReference && !reference) || !available}
      >
        {busy ? 'Criando personagem…' : 'Dar vida ao personagem'}
        <Sparkles size={17} />
      </button>
      </fieldset>
    </form>
  );
}
export function PostForm({
  initialKind = 'mission',
  done,
  canCreateEvent = false,
  initialLocation,
  requireMappedLocation = false,
  initialEventId,
}: {
  done: () => Promise<void>;
  initialKind?: 'mission' | 'event';
  canCreateEvent?: boolean;
  initialLocation?: AtlasLocation;
  requireMappedLocation?: boolean;
  initialEventId?: string;
}) {
  const [kind, setKind] = useState<string>(canCreateEvent ? initialKind : 'mission');
  const [missionRank, setMissionRank] = useState<Rank>('Ferro');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [rankTest, setRankTest] = useState('');
  const [paperStyle, setPaperStyle] = useState<PaperStyle>('parchment');
  const [locationId, setLocationId] = useState(initialLocation?.id || '');
  const [regionId, setRegionId] = useState(initialLocation?.region_id || (requireMappedLocation ? 'reino-do-norte' : ''));
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
        event_source_id: initialEventId,
        tag_ids: kind === 'mission' ? tagIds : [],
        mission_rank: missionRank,
        rank_test_level:
          kind === 'mission' && form.rank_test_level ? Number(form.rank_test_level) : null,
        paper_style: paperStyle,
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
    <form className="stack board-post-form" onSubmit={submit}>
      {kind === 'mission' && <PersonalVttLink />}
      {initialEventId && (
        <p className="source-note">
          Esta missão será vinculada ao evento ativo. A disponibilidade será conferida novamente ao
          publicar.
        </p>
      )}
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
      {kind === 'mission' && (
        <label>
          Patente da missão
          <select
            aria-label="Patente da missão"
            value={missionRank}
            onChange={(event) => {
              setMissionRank(event.target.value as Rank);
              setRankTest('');
            }}
          >
            {RANKS.map((rank) => (
              <option key={rank} value={rank}>
                {rankLabel(rank)} · {RANK_REWARD_CP[rank] / 100} PO
              </option>
            ))}
          </select>
          <small className="muted">
            Somente personagens desta patente podem se inscrever, inclusive nos testes.
          </small>
        </label>
      )}
      {kind === 'mission' && (
        <label>
          Categoria da missão
          <select
            name="rank_test_level"
            value={rankTest}
            onChange={(event) => setRankTest(event.target.value)}
          >
            <option value="">Missão normal</option>
            {RANK_TEST_LEVELS.filter((level) => rankName(level) === missionRank).map((level) => (
              <option key={level} value={level}>
                Teste de patente · {rankLabel(missionRank)} → {rankTitle(level + 1)} (
                {MISSION_THRESHOLDS[level]} missões)
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Data e hora de início
        <input name="starts_at" type="datetime-local" required={kind === 'mission'} />
        <small className="muted">
          Horário local: {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </small>
      </label>
      {kind === 'mission' && (
        <MissionTagPicker value={tagIds} onChange={setTagIds} disabled={busy} />
      )}
      <WorldPlacePicker regionId={regionId} locationId={locationId} onRegionChange={setRegionId} onLocationChange={setLocationId} required={requireMappedLocation}/>
      {!locationId && !regionId && !requireMappedLocation && (
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
        Resumo no papel (opcional)
        <textarea
          name="paper_summary"
          maxLength={180}
          rows={2}
          placeholder="Um convite curto para a aventura"
        />
        <small className="muted">Sem resumo, usamos o início da descrição.</small>
      </label>
      <PaperPicker value={paperStyle} onChange={setPaperStyle} disabled={busy} />
      <label>
        Recompensa por participante (PO)
        {kind === 'mission' ? (
          <input
            name="reward"
            type="number"
            value={RANK_REWARD_CP[missionRank] / 100}
            readOnly
            aria-label="Recompensa por participante (PO)"
          />
        ) : (
          <input
            name="reward"
            type="number"
            min={0}
            max={100000}
            step="0.01"
            defaultValue={0}
            required
          />
        )}
        {kind === 'mission' && (
          <small className="muted">Valor fixo da patente, pago a cada inscrito na conclusão.</small>
        )}
      </label>
      <p className="muted small">
        {kind === 'mission'
          ? 'Ao concluir, cada inscrito recebe o ouro e a progressão é calculada automaticamente. Missões normais deixam de contar enquanto o teste de patente está pendente.'
          : 'Eventos não concedem progressão nem pagamento automático.'}
      </p>
      {error && <FlashMessage>{error}</FlashMessage>}
      <button className="button primary" disabled={busy}>
        {busy ? 'Publicando…' : 'Publicar no mural'}
      </button>
    </form>
  );
}

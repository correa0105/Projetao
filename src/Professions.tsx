import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  FlaskConical,
  Hammer,
  Layers,
  Leaf,
  LockKeyhole,
  Map as MapIcon,
  Package,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { api, post } from './api';
import {
  professions,
  professionMaterials,
  materialItemId,
  professionMaterialIds,
  professionUnlocked,
  validWorkshopInput,
  type Profession,
  type CraftRecipe,
  type CraftProject,
  type ProfessionState,
  type WorkshopStep,
  type WorkshopInput,
} from '../shared/professions';
import type { Character, Page } from './types';
import './professions.css';

const nodes = [
  'Ruínas',
  'Colina',
  'Torre',
  'Ponte',
  'Bosque',
  'Lago',
  'Acampamento',
  'Pedreira',
  'Clareira',
];
const point = (index: number) => ({
  x: 100 + (index % 3) * 180,
  y: 55 + Math.floor(index / 3) * 86,
});
function timeLeft(date: string, now: number) {
  const minutes = Math.max(0, Math.ceil((Date.parse(date) - now) / 60000));
  return minutes ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : 'Pronto para recolher';
}
function Workshop({
  step,
  disabled,
  busy,
  submit,
}: {
  step: WorkshopStep;
  disabled: boolean;
  busy: boolean;
  submit: (input: WorkshopInput) => void;
}) {
  const [value, setValue] = useState(50),
    [points, setPoints] = useState<number[]>([]);
  const input: WorkshopInput = step.kind === 'dial' ? { value } : { points };
  const matches = validWorkshopInput(step, input);
  const toggle = (index: number) =>
    setPoints((current) =>
      step.kind === 'pattern'
        ? current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index]
        : current.includes(index)
          ? current
          : [...current, index],
    );
  const lines = points.map((index) => point(index));
  return (
    <div className="pf-workshop" data-workshop-kind={step.kind}>
      <div className="pf-step-heading">
        <span className="pf-kicker">NA BANCADA</span>
        <h3>{step.title}</h3>
        <p>{step.instruction}</p>
      </div>
      <div className={'pf-work-surface pf-visual-' + step.visual}>
        <svg className="pf-work-svg" viewBox="0 0 600 310" role="img" aria-label={step.title}>
          <defs>
            <linearGradient id="pf-brass">
              <stop stopColor="#715234" />
              <stop offset=".5" stopColor="#d9ad70" />
              <stop offset="1" stopColor="#755136" />
            </linearGradient>
            <radialGradient id="pf-heat">
              <stop stopColor="#ffe0a1" />
              <stop offset=".45" stopColor="#ce7438" />
              <stop offset="1" stopColor="#5c3027" />
            </radialGradient>
          </defs>
          <path d="M28 280H572M24 290H576" stroke="#8d6543" opacity=".45" />
          {step.kind === 'dial' && (
            <>
              {step.visual === 'heat' ? (
                <>
                  <path d="M164 249 210 210H390L440 249Z" fill="#373633" stroke="#8b8070" />
                  <path d="M185 207H415L450 174H210Z" fill="url(#pf-brass)" />
                  <rect
                    x="242"
                    y="151"
                    width="130"
                    height="26"
                    rx="8"
                    fill="url(#pf-heat)"
                    style={{ opacity: 0.35 + value / 150 }}
                  />
                  <path
                    d="M282 130Q253 100 290 70Q278 103 304 91Q332 122 307 139"
                    fill="#d79752"
                    opacity={value / 100}
                  />
                </>
              ) : ['mixture', 'pressure'].includes(step.visual) ? (
                <>
                  <path
                    d="M270 45H330V114L387 226Q394 256 362 260H238Q206 256 213 226L270 114Z"
                    fill="#96b5bd16"
                    stroke="#9db2b5"
                    strokeWidth="3"
                  />
                  <path
                    d={`M225 ${242 - value}Q300 ${260 - value} 375 ${242 - value}L378 231Q386 249 358 250H242Q216 249 222 231Z`}
                    fill="#b88b6190"
                  />
                  <path d="M278 54H322M262 120H339" stroke="#c8ac80" strokeWidth="4" />
                  {[0, 1, 2].map((n) => (
                    <circle
                      key={n}
                      cx={270 + n * 28}
                      cy={210 - value / 2 - n * 12}
                      r={4 + n}
                      fill="#e8d9bb"
                      opacity=".6"
                    />
                  ))}
                </>
              ) : ['tension', 'tuning'].includes(step.visual) ? (
                <>
                  <path
                    d="M188 69Q300 10 412 69V216Q300 281 188 216Z"
                    fill="#6e4c2b"
                    stroke="#bd925b"
                    strokeWidth="3"
                  />
                  {[0, 1, 2, 3, 4].map((n) => (
                    <path
                      key={n}
                      d={`M${240 + n * 30} 57Q${240 + n * 30 + (value - 50) / 3} 147 ${240 + n * 30} 244`}
                      fill="none"
                      stroke="#d9c49a"
                      strokeWidth="2"
                    />
                  ))}
                </>
              ) : step.visual === 'compass' ? (
                <>
                  <circle
                    cx="300"
                    cy="150"
                    r="98"
                    fill="#1e292d"
                    stroke="url(#pf-brass)"
                    strokeWidth="9"
                  />
                  <path d="M300 65V235M215 150H385" stroke="#bd9c62" />
                  <g transform={`rotate(${(value - 50) * 2} 300 150)`}>
                    <path d="M300 75 316 150 300 225 284 150Z" fill="#bd9462" />
                    <path d="M300 75 316 150H284Z" fill="#d4d4c2" />
                  </g>
                </>
              ) : (
                <>
                  <rect
                    x="145"
                    y="77"
                    width="310"
                    height="145"
                    rx="12"
                    fill="#765635"
                    stroke="#c8a470"
                    strokeWidth="2"
                  />
                  <path d="M168 113H432M168 185H432" stroke="#30251e" opacity=".6" />
                  <path d={`M${165 + value * 2.7} 52V248`} stroke="#e2ba76" strokeWidth="4" />
                  <path d="M300 65V235" stroke="#dac7a1" strokeDasharray="5 8" />
                </>
              )}
              <text x="300" y="294" textAnchor="middle" fill="#e8d9bc" fontSize="15">
                {value}
                {step.unit} · alvo {step.target}
                {step.unit}
              </text>
            </>
          )}
          {step.kind === 'pattern' && (
            <>
              <rect
                x="55"
                y="24"
                width="485"
                height="250"
                rx={step.visual === 'gem' ? 60 : 15}
                fill={['hide', 'sole', 'mask'].includes(step.visual) ? '#76553c' : '#544a37'}
                stroke="#b49665"
                strokeWidth="2"
              />
              {Array.from({ length: 9 }, (_, i) => {
                const p = point(i);
                return (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y + 12}
                      r="17"
                      fill={points.includes(i) ? '#c6a06a' : '#292a26'}
                      stroke={points.includes(i) ? '#f2dcad' : '#8b8169'}
                      strokeWidth="2"
                    />
                    <text
                      x={p.x}
                      y={p.y + 18}
                      textAnchor="middle"
                      fill={points.includes(i) ? '#211c15' : '#d0c5ac'}
                      fontSize="15"
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </>
          )}
          {step.kind === 'map' && (
            <>
              <rect x="32" y="16" width="535" height="275" rx="10" fill="#c5af7e" />
              <path
                d="M80 20Q150 140 254 160T340 290"
                fill="none"
                stroke="#738f99"
                strokeWidth="13"
                opacity=".6"
              />
              <path
                d="M340 50 365 22 390 50M390 70 423 30 453 70M365 80 392 48 416 80"
                fill="#8d8966"
              />
              {lines.length > 1 && (
                <polyline
                  points={lines.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="#764627"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {nodes.map((label, i) => {
                const p = point(i);
                return (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="12"
                      fill={points.includes(i) ? '#a55d32' : '#485a4a'}
                    />
                    <text x={p.x} y={p.y + 28} textAnchor="middle" fill="#302a20" fontSize="12">
                      {label}
                    </text>
                  </g>
                );
              })}
            </>
          )}
          {step.kind === 'order' && (
            <>
              <rect
                x="48"
                y="78"
                width="502"
                height="152"
                rx="14"
                fill="#4a3829"
                stroke="#9d7b4e"
              />
              {step.tiles.map((_, index) => (
                <g key={index}>
                  <rect
                    x={65 + index * (460 / step.tiles.length)}
                    y="113"
                    width={440 / step.tiles.length}
                    height="85"
                    rx="5"
                    fill={points[index] === undefined ? '#282821' : '#8d6c42'}
                    stroke="#ae8b59"
                  />
                  <text
                    x={65 + index * (460 / step.tiles.length) + 220 / step.tiles.length}
                    y="159"
                    textAnchor="middle"
                    fill="#f0ddba"
                    fontSize="13"
                  >
                    {points[index] === undefined ? index + 1 : step.tiles[points[index]]}
                  </text>
                </g>
              ))}
            </>
          )}
        </svg>
        {step.kind === 'dial' ? (
          <div className="pf-adjustment">
            <label htmlFor="pf-adjust">
              {step.title}
              <output>
                {value}
                {step.unit}
              </output>
            </label>
            <div className="pf-dial-track">
              <span
                style={{
                  left: `${step.target - step.tolerance}%`,
                  width: `${step.tolerance * 2}%`,
                }}
              />
              <input
                id="pf-adjust"
                aria-label={step.title}
                type="range"
                min="0"
                max="100"
                value={value}
                disabled={disabled || busy}
                onChange={(e) => setValue(Number(e.target.value))}
              />
            </div>
            <small>
              Faixa desejada: {step.target - step.tolerance}–{step.target + step.tolerance}
              {step.unit}
            </small>
          </div>
        ) : (
          <>
            <div className="pf-pattern-reference">
              <strong>
                {step.kind === 'map' ? 'Percurso' : step.kind === 'pattern' ? 'Molde' : 'Sequência'}
              </strong>
              <span>
                {step.kind === 'map'
                  ? step.target.map((i) => nodes[i]).join(' → ')
                  : step.kind === 'pattern'
                    ? step.target.map((i) => i + 1).join(' · ')
                    : step.tiles.join(' → ')}
              </span>
            </div>
            <div className={'pf-points ' + (step.kind === 'pattern' ? 'pf-grid-points' : '')}>
              {(step.kind === 'order'
                ? [...step.tiles.keys()].reverse()
                : Array.from({ length: 9 }, (_, i) => i)
              ).map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={points.includes(i)}
                  disabled={disabled || busy || (step.kind !== 'pattern' && points.includes(i))}
                  onClick={() => toggle(i)}
                >
                  {step.kind === 'map' ? nodes[i] : step.kind === 'order' ? step.tiles[i] : i + 1}
                  {points.includes(i) && <Check size={14} />}
                </button>
              ))}
            </div>
            <button
              className="pf-reset"
              disabled={disabled || busy || !points.length}
              onClick={() => setPoints([])}
            >
              Recomeçar esta etapa
            </button>
          </>
        )}
      </div>
      <div className="pf-work-actions">
        <span>
          {matches ? (
            <>
              <Check size={16} /> Ajuste pronto
            </>
          ) : (
            'Siga a referência em dourado'
          )}
        </span>
        <button
          className="button pf-primary"
          disabled={disabled || busy || !matches}
          onClick={() => submit(input)}
        >
          {busy ? 'Registrando…' : 'Confirmar etapa'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function MaterialDelivery({
  rooms,
  onChanged,
}: {
  rooms: ProfessionState['rooms'];
  onChanged: () => Promise<void>;
}) {
  const [room, setRoom] = useState(rooms[0]?.id ?? ''),
    [people, setPeople] = useState<{ id: string; name: string; player_name: string }[]>([]),
    [recipient, setRecipient] = useState(''),
    [material, setMaterial] = useState(materialItemId('hide')),
    [quantity, setQuantity] = useState(1),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const request = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    setRecipient('');
    void api<typeof people>('/professions/rooms/' + room + '/characters')
      .then((rows) => {
        if (active) {
          setPeople(rows);
          setRecipient(rows[0]?.id ?? '');
        }
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
    };
  }, [room]);
  async function deliver() {
    if (busy) return;
    setBusy(true);
    setNotice('');
    request.current ??= crypto.randomUUID();
    try {
      await post('/professions/material-grants', {
        room_id: room,
        character_id: recipient,
        material_id: material,
        quantity,
        reason,
        request_id: request.current,
      });
      request.current = null;
      setReason('');
      setNotice('Material entregue à mochila e registrado na mesa.');
      await onChanged();
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const edit = () => {
    request.current = null;
  };
  return (
    <section className="pf-delivery" aria-label="Entregas de mesa">
      <div className="pf-kicker">
        <Users size={16} /> MESTRE DA MESA
      </div>
      <h2>O que a aventura trouxe?</h2>
      <p>Registre os materiais obtidos pelos personagens nas mesas que você conduz.</p>
      <div className="pf-delivery-fields">
        <label>
          Mesa
          <select
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              edit();
            }}
            disabled={busy}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Personagem participante
          <select
            value={recipient}
            onChange={(e) => {
              setRecipient(e.target.value);
              edit();
            }}
            disabled={busy}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.player_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Material
          <select
            value={material}
            onChange={(e) => {
              setMaterial(e.target.value);
              edit();
            }}
            disabled={busy}
          >
            {professionMaterials.map(([id, name]) => (
              <option key={id} value={materialItemId(id)}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quantidade
          <input
            type="number"
            min="1"
            max="99"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.valueAsNumber);
              edit();
            }}
            disabled={busy}
          />
        </label>
        <label className="pf-delivery-reason">
          Origem na aventura
          <textarea
            value={reason}
            maxLength={500}
            placeholder="Ex.: couro recolhido após a caçada no Vale do Carvalho."
            onChange={(e) => {
              setReason(e.target.value);
              edit();
            }}
            disabled={busy}
          />
        </label>
      </div>
      <button
        className="button pf-primary"
        disabled={
          busy ||
          !recipient ||
          reason.trim().length < 5 ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 99
        }
        onClick={() => void deliver()}
      >
        {busy ? 'Registrando…' : 'Registrar entrega'}
      </button>
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}

export function Professions({
  character,
  onChanged,
  go,
}: {
  character?: Character;
  onChanged: () => Promise<void>;
  go: (page: Page) => void;
}) {
  const [state, setState] = useState<ProfessionState>(),
    [selected, setSelected] = useState<string | null>(null),
    [recipeId, setRecipeId] = useState(''),
    [query, setQuery] = useState(''),
    [mine, setMine] = useState(false),
    [deliveries, setDeliveries] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [received, setReceived] = useState(Date.now());
  const locked = useRef(false),
    requestKeys = useRef(new Map<string, string>()),
    generation = useRef(0);
  async function reload() {
    const gen = ++generation.current;
    const data = await api<ProfessionState>(
      '/professions' + (character ? '?character_id=' + character.id : ''),
    );
    if (gen === generation.current) {
      setState(data);
      setReceived(Date.now());
    }
    return data;
  }
  useEffect(() => {
    let active = true;
    void reload().catch((e) => {
      if (active) setError(e.message);
    });
    const timer = window.setInterval(() => {
      setTick(Date.now());
      if (document.visibilityState === 'visible' && !locked.current) void reload().catch(() => {});
    }, 15000);
    return () => {
      active = false;
      ++generation.current;
      window.clearInterval(timer);
    };
  }, [character?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const profession = professions.find((p) => p.id === selected);
  const unlocked = !!profession && professionUnlocked(profession, state?.proficiencies ?? []);
  const active = state?.projects.find((p) => !p.claimed_at);
  const current = active?.profession_id === selected ? active : undefined;
  const recipe =
    current?.recipe ?? profession?.recipes.find((r) => r.id === recipeId) ?? profession?.recipes[0];
  const now = state ? Date.parse(state.server_time) + Math.max(0, tick - received) : tick;
  function open(p: Profession) {
    setSelected(p.id);
    setRecipeId(p.recipes[0].id);
    setDeliveries(false);
    setError('');
    setNotice('');
  }
  function key(id: string) {
    let value = requestKeys.current.get(id);
    if (!value) {
      value = crypto.randomUUID();
      requestKeys.current.set(id, value);
    }
    return value;
  }
  async function act(kind: 'start' | 'step' | 'collect', input?: WorkshopInput) {
    if (locked.current || !character || !profession || !recipe) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const operation =
      kind === 'start' ? 'start:' + recipe.id : kind + ':' + current?.id + ':' + current?.revision;
    try {
      if (kind === 'start')
        await post('/professions/projects', {
          character_id: character.id,
          recipe_id: recipe.id,
          request_id: key(operation),
        });
      else if (kind === 'step' && current)
        await post('/professions/projects/' + current.id + '/steps', {
          revision: current.revision,
          request_id: key(operation),
          input,
        });
      else if (kind === 'collect' && current)
        await post('/professions/projects/' + current.id + '/collect', {});
      requestKeys.current.delete(operation);
      await reload();
      if (kind === 'collect') setNotice('Criação recolhida. O resultado já está na mochila.');
      if (kind !== 'step') void onChanged().catch(() => {});
    } catch (e) {
      setError((e as Error).message);
      await reload().catch(() => {});
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function availability(r: CraftRecipe) {
    return r.ingredients.every(
      (i) => (state?.inventory.find((v) => v.id === i.item_id)?.available ?? 0) >= i.quantity,
    );
  }
  const filtered = professions.filter(
    (p) =>
      (!mine || professionUnlocked(p, state?.proficiencies ?? [])) &&
      (p.name + ' ' + p.tools.join(' '))
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLocaleLowerCase('pt-BR')
        .includes(
          query
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .toLocaleLowerCase('pt-BR'),
        ),
  );
  const banner = profession ?? professions[0];
  return (
    <section
      className={'professions ' + (profession ? 'pf-inside' : '')}
      style={{ '--pf-accent': banner.accent } as CSSProperties}
    >
      <img className="pf-scenery" src={banner.background} alt="" aria-hidden="true" />
      <div className="pf-content">
        <header className="pf-header">
          <div>
            <span className="pf-kicker">ALVORADA CINZENTA · OFÍCIOS</span>
            <h1>
              {deliveries
                ? 'Entregas de mesa'
                : (profession?.name ?? 'Toda aventura deixa matéria-prima.')}
            </h1>
            <p>
              {deliveries
                ? 'Os materiais da jornada seguem para as mãos de quem cria.'
                : (profession?.title ??
                  'Escolha seu ofício. Traga suas descobertas. Crie algo que faça parte da sua história.')}
            </p>
          </div>
          <div className="pf-header-actions">
            {character ? (
              <span className="pf-character">
                <span className="pf-small-dot" />
                {character.name}
              </span>
            ) : (
              <button className="button" onClick={() => go('characters')}>
                Selecionar personagem
              </button>
            )}
            {(selected || deliveries) && (
              <button
                className="button outline"
                onClick={() => {
                  setSelected(null);
                  setDeliveries(false);
                  setError('');
                  setNotice('');
                }}
              >
                <ArrowLeft size={16} /> Todas as profissões
              </button>
            )}
            {!!state?.rooms.length && !deliveries && (
              <button className="button outline" onClick={() => setDeliveries(true)}>
                <Users size={16} /> Entregas de mesa
              </button>
            )}
          </div>
        </header>
        {error && (
          <p className="pf-feedback pf-error" role="alert">
            {error}
            <button aria-label="Fechar erro" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </p>
        )}
        {notice && (
          <p className="pf-feedback" role="status">
            <Check size={18} />
            {notice}
          </p>
        )}
        {!state && (
          <p role="status" className="pf-loading">
            Abrindo as oficinas…
          </p>
        )}
        {deliveries && state ? (
          <MaterialDelivery
            rooms={state.rooms}
            onChanged={async () => {
              await reload();
              await onChanged();
            }}
          />
        ) : profession ? (
          <>
            <div className={'pf-access ' + (unlocked ? 'is-unlocked' : '')}>
              <img src={'/sheet/training-badges-20261019/' + profession.badge + '.webp'} alt="" />
              {unlocked ? (
                <>
                  <Check size={17} />
                  <span>
                    <strong>Bancada liberada</strong> · proficiência confirmada na ficha
                  </span>
                </>
              ) : (
                <>
                  <LockKeyhole size={17} />
                  <span>
                    <strong>Oficina para visita</strong> · exige{' '}
                    {profession.tools.length > 2
                      ? 'uma das proficiências deste ofício'
                      : profession.tools[0]}{' '}
                    na ficha concluída.
                  </span>
                </>
              )}
            </div>
            <div className="pf-studio-grid">
              <aside className="pf-recipe-shelf" aria-label="Receitas da profissão">
                <span className="pf-kicker">LIVRO DA OFICINA</span>
                <h2>O que vamos criar?</h2>
                <p>{profession.description}</p>
                {profession.recipes.map((r) => {
                  const item = state?.inventory.find((i) => i.id === r.output.item_id);
                  return (
                    <button
                      key={r.id}
                      className={'pf-recipe ' + (recipe?.id === r.id ? 'is-selected' : '')}
                      onClick={() => setRecipeId(r.id)}
                      disabled={!!current}
                      aria-pressed={recipe?.id === r.id}
                    >
                      {item?.image_path ? (
                        <img src={item.image_path} alt="" />
                      ) : (
                        <Package size={28} />
                      )}
                      <span>
                        <strong>{r.name}</strong>
                        <small>
                          {r.output.quantity > 1 ? r.output.quantity + ' unidades · ' : ''}
                          {r.hours} h de produção
                        </small>
                      </span>
                      <ArrowRight size={16} />
                    </button>
                  );
                })}
                {recipe && (
                  <div className="pf-ingredients">
                    <h3>Materiais da receita</h3>
                    <p>Estas quantidades serão consumidas ao iniciar.</p>
                    {recipe.ingredients.map((i) => {
                      const item = state?.inventory.find((v) => v.id === i.item_id),
                        table = professionMaterialIds.has(i.item_id),
                        amount = item?.available ?? 0;
                      return (
                        <div
                          className={
                            'pf-ingredient ' + (amount >= i.quantity ? 'is-available' : '')
                          }
                          key={i.item_id}
                        >
                          {table ? (
                            <Leaf size={20} />
                          ) : item?.image_path ? (
                            <img src={item.image_path} alt="" />
                          ) : (
                            <Package size={20} />
                          )}
                          <div>
                            <strong>{item?.name ?? i.item_id}</strong>
                            <small>{table ? 'Obtido em mesa' : 'Insumo do Empório'}</small>
                          </div>
                          <span
                            aria-label={
                              (item?.name ?? i.item_id) +
                              ': ' +
                              amount +
                              ' disponíveis de ' +
                              i.quantity +
                              ' necessários'
                            }
                          >
                            {amount}/{i.quantity}
                          </span>
                        </div>
                      );
                    })}
                    <button className="pf-shop-link" onClick={() => go('shop')}>
                      Visitar o Empório <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </aside>
              <main className="pf-bench" aria-label="Bancada de criação">
                {active && !current ? (
                  <div className="pf-other-job">
                    <Clock3 size={32} />
                    <h2>Seu trabalho continua em outra oficina.</h2>
                    <p>
                      {active.recipe.name} · {timeLeft(active.ready_at, now)}
                    </p>
                    <button
                      className="button pf-primary"
                      onClick={() => open(professions.find((p) => p.id === active.profession_id)!)}
                    >
                      Voltar ao trabalho
                    </button>
                  </div>
                ) : current ? (
                  <>
                    <div className="pf-project-title">
                      <div>
                        <span className="pf-kicker">TRABALHO EM ANDAMENTO</span>
                        <h2>{current.recipe.name}</h2>
                      </div>
                      <span>
                        <Clock3 size={16} />
                        {timeLeft(current.ready_at, now)}
                      </span>
                    </div>
                    <ol className="pf-stepper" aria-label="Etapas do trabalho">
                      {current.recipe.steps.map((step, i) => (
                        <li
                          key={i}
                          className={
                            current.step > i ? 'is-done' : current.step === i ? 'is-current' : ''
                          }
                        >
                          {current.step > i ? <Check size={16} /> : <span>{i + 1}</span>}
                          {step.title}
                        </li>
                      ))}
                    </ol>
                    {current.step < current.recipe.steps.length ? (
                      <Workshop
                        key={current.id + ':' + current.revision}
                        step={current.recipe.steps[current.step]}
                        disabled={!unlocked}
                        busy={busy}
                        submit={(input) => void act('step', input)}
                      />
                    ) : (
                      <div className="pf-ready">
                        <Sparkles size={42} />
                        <span className="pf-kicker">ETAPAS CONCLUÍDAS</span>
                        <h2>
                          {Date.parse(current.ready_at) <= now
                            ? 'Sua criação está pronta.'
                            : 'Agora, o tempo faz a sua parte.'}
                        </h2>
                        <p>
                          {Date.parse(current.ready_at) <= now
                            ? 'Recolha o resultado para guardar na mochila.'
                            : 'O preparo continua mesmo com o site fechado. Volte quando a produção terminar.'}
                        </p>
                        <strong className="pf-remaining">{timeLeft(current.ready_at, now)}</strong>
                        <button
                          className="button pf-primary"
                          disabled={busy || !unlocked || Date.parse(current.ready_at) > now}
                          onClick={() => void act('collect')}
                        >
                          <Package size={18} />
                          {busy ? 'Recolhendo…' : 'Recolher criação'}
                        </button>
                      </div>
                    )}
                  </>
                ) : recipe ? (
                  <div className="pf-project-intro">
                    <div className="pf-bench-symbol">
                      {['alchemy', 'herbalism', 'poison'].includes(profession.id) ? (
                        <FlaskConical size={58} />
                      ) : ['cartography', 'navigation'].includes(profession.id) ? (
                        <MapIcon size={58} />
                      ) : (
                        <Hammer size={58} />
                      )}
                    </div>
                    <span className="pf-kicker">UMA NOVA CRIAÇÃO</span>
                    <h2>{recipe.name}</h2>
                    <p>{profession.description}</p>
                    <div className="pf-preview-stages">
                      {recipe.steps.map((step, i) => (
                        <div key={i}>
                          <span>{i + 1}</span>
                          <strong>{step.title}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="pf-production-time">
                      <Clock3 size={18} />
                      {recipe.hours} horas reais · resultado na mochila
                    </div>
                    {!unlocked ? (
                      <p className="pf-locked-note">
                        <LockKeyhole size={17} /> Esta bancada aguarda a proficiência na ficha.
                      </p>
                    ) : !availability(recipe) ? (
                      <p className="pf-locked-note">
                        <Package size={17} /> Reúna os materiais indicados no livro da oficina.
                      </p>
                    ) : (
                      <p className="pf-start-note">
                        Ao iniciar, os materiais listados serão usados. O trabalho fica salvo para
                        você continuar depois.
                      </p>
                    )}
                    <button
                      className="button pf-primary"
                      disabled={!unlocked || !availability(recipe) || busy || !state}
                      onClick={() => void act('start')}
                    >
                      <Layers size={18} />
                      {busy ? 'Preparando…' : 'Usar materiais e iniciar'}
                    </button>
                  </div>
                ) : null}
              </main>
            </div>
            {!!state?.projects.some((p) => p.claimed_at && p.profession_id === selected) && (
              <section className="pf-history">
                <span className="pf-kicker">FEITO POR SUAS MÃOS</span>
                <h2>Criações recolhidas</h2>
                {state.projects
                  .filter((p) => p.claimed_at && p.profession_id === selected)
                  .slice(0, 6)
                  .map((p) => (
                    <div key={p.id}>
                      <Check size={16} />
                      <strong>{p.recipe.name}</strong>
                      <span>{new Date(p.claimed_at!).toLocaleDateString('pt-BR')}</span>
                    </div>
                  ))}
              </section>
            )}
          </>
        ) : (
          <>
            {active && (
              <button
                className="pf-active-banner"
                onClick={() => open(professions.find((p) => p.id === active.profession_id)!)}
              >
                <Clock3 size={23} />
                <span>
                  <strong>Continuar: {active.recipe.name}</strong>
                  <small>{timeLeft(active.ready_at, now)}</small>
                </span>
                <ArrowRight size={20} />
              </button>
            )}
            <div className="pf-catalog-toolbar">
              <label className="pf-search">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Encontrar um ofício…"
                  aria-label="Pesquisar profissões"
                />
              </label>
              <button
                className={'button outline ' + (mine ? 'is-active' : '')}
                aria-pressed={mine}
                onClick={() => setMine(!mine)}
              >
                Minhas profissões{' '}
                <span>
                  {
                    professions.filter((p) => professionUnlocked(p, state?.proficiencies ?? []))
                      .length
                  }
                </span>
              </button>
              <span>{filtered.length} oficinas</span>
            </div>
            <div className="pf-profession-grid">
              {filtered.map((p) => {
                const allowed = professionUnlocked(p, state?.proficiencies ?? []);
                return (
                  <button
                    key={p.id}
                    className={'pf-profession-card ' + (allowed ? 'is-unlocked' : '')}
                    onClick={() => open(p)}
                  >
                    <img
                      className="pf-card-scenery"
                      src={p.background.replace('.webp', '-thumb.webp')}
                      alt=""
                      loading="lazy"
                    />
                    <span className="pf-card-status">
                      {allowed ? (
                        <>
                          <Check size={13} /> Sua profissão
                        </>
                      ) : (
                        <>
                          <LockKeyhole size={12} /> Conhecer oficina
                        </>
                      )}
                    </span>
                    <div className="pf-card-copy">
                      <img
                        src={'/sheet/training-badges-20261019/' + p.badge + '.webp'}
                        alt=""
                        loading="lazy"
                      />
                      <div>
                        <h2>{p.name}</h2>
                        <p>{p.title}</p>
                      </div>
                      <ArrowRight size={19} />
                    </div>
                  </button>
                );
              })}
            </div>
            {!filtered.length && (
              <p className="pf-empty">
                {mine
                  ? 'Nenhuma proficiência deste ofício foi encontrada na ficha concluída. Você pode visitar todas as oficinas.'
                  : 'Nenhuma profissão encontrada. Tente outro nome.'}
              </p>
            )}
            <div className="pf-how">
              <div>
                <Leaf size={23} />
                <strong>Encontre na aventura</strong>
                <p>Couro, plantas, minérios e descobertas são entregues pelo mestre.</p>
              </div>
              <div>
                <Package size={23} />
                <strong>Complete no Empório</strong>
                <p>Compre os frascos, a tinta e os outros insumos que a receita pede.</p>
              </div>
              <div>
                <Hammer size={23} />
                <strong>Crie na sua bancada</strong>
                <p>Use sua proficiência, conclua o trabalho e guarde o resultado na mochila.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

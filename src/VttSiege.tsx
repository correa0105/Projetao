import { useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, Flame, Plus, RotateCcw, Volume2, X } from 'lucide-react';
import { api } from './api';
import { viewerSees, type VttState, type VttScene, type VttToken, type Point } from '../shared/vtt';
import {
  siegeKinds,
  siegeDefinitions,
  siegeImage,
  siegeStageNames,
  siegeAdjacent,
  siegeBearing,
  siegeDistance,
  type SiegeKind,
  type SiegeWeapon,
  type SiegeSnapshot,
  type SiegeCommand,
  type SiegeShot,
} from '../shared/vtt-siege';
import type { VttCamera } from './vtt-canvas';
import { useVttEffectAudio } from './vtt-effect-audio';
import './vtt-siege.css';
import { siegeMaterials, drawSiegeHarpoon, drawSiegeRope, harpoonLength } from './vtt-siege-materials';

export function useVttSiege(
  roomId: string | undefined,
  sceneId: string | undefined,
  hasWeapons: boolean,
) {
  const [snapshot, setSnapshot] = useState<SiegeSnapshot | null>(null),
    [error, setError] = useState(''),
    [queryError, setQueryError] = useState(''),
    [busy, setBusy] = useState(false),
    inFlight = useRef(false),
    current = useRef(roomId);
  current.current = roomId;
  useEffect(() => {
    setSnapshot(null);
    setError('');
    setQueryError('');
  }, [roomId, sceneId]);
  useEffect(() => {
    if (!roomId || !sceneId) {
      setSnapshot(null);
      return;
    }
    let live = true,
      pending = false;
    const poll = async () => {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const value = await api<SiegeSnapshot>(`/vtt/rooms/${roomId}/siege`);
        if (live) {
          setSnapshot((old) =>
            !old || old.sceneId !== value.sceneId || value.serverTime >= old.serverTime
              ? value
              : old,
          );
          setQueryError('');
        }
      } catch (e) {
        if (live) setQueryError((e as Error).message);
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), hasWeapons ? 750 : 2500);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [roomId, sceneId, hasWeapons]);
  const send = useCallback(
    async (command: SiegeCommand) => {
      if (!roomId || inFlight.current) throw Error('Aguarde a operação anterior.');
      inFlight.current = true;
      setBusy(true);
      setError('');
      try {
        const result = await api<SiegeSnapshot & { room: VttState }>(`/vtt/rooms/${roomId}/siege`, {
          method: 'POST',
          body: JSON.stringify({ ...command, sceneId, operationId: crypto.randomUUID() }),
        });
        const { room, ...value } = result;
        if (current.current === roomId)
          setSnapshot((old) =>
            !old || old.sceneId !== value.sceneId || value.serverTime >= old.serverTime
              ? value
              : old,
          );
        return result;
      } catch (e) {
        setError((e as Error).message);
        throw e;
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [roomId, sceneId],
  );
  return { snapshot, error: error || queryError, busy, send };
}
export type SiegeAiming = {
  weaponId: string;
  actorId: string;
  mode: 'normal' | 'advantage' | 'disadvantage';
  returnToToken?: boolean;
  surface?: 'auto' | 'ground' | 'water';
};
export function VttSiegePanel({
  snapshot,
  scene,
  userId,
  gm,
  disabled,
  error,
  selectedId,
  select,
  send,
  aim,
  compact = false,
  initialPreferences,
  onPreferencesChange,
  roomId,
  releaseCharacterSupport,
}: {
  snapshot: SiegeSnapshot | null;
  scene: VttScene;
  userId: string;
  gm: boolean;
  disabled: boolean;
  error: string;
  selectedId: string | undefined;
  select: (id: string) => void;
  send: (command: SiegeCommand) => Promise<void>;
  aim: (value: SiegeAiming) => void;
  compact?: boolean;
  initialPreferences?: Pick<SiegeAiming, 'actorId' | 'mode' | 'surface'>;
  onPreferencesChange?: (value: Pick<SiegeAiming, 'actorId' | 'mode' | 'surface'>) => void;
  roomId: string;
  releaseCharacterSupport?: { name: string; release: () => void };
}) {
  const [mode, setMode] = useState<'normal' | 'advantage' | 'disadvantage'>(
      initialPreferences?.mode || 'normal',
    ),
    [ammo, setAmmo] = useState(10),
    [muted, setMuted] = useState(false);
  const [surface, setSurface] = useState<'auto' | 'ground' | 'water'>(
      initialPreferences?.surface || 'auto',
    ),
    [impactCount, setImpactCount] = useState(20);
  const weapons = (snapshot?.sceneId === scene.id ? snapshot.weapons : []).filter(
    (w) => gm || scene.tokens.some((t) => t.id === w.id && !t.hidden && t.layer !== 'gm'),
  );
  const weapon = weapons.find((w) => w.id === selectedId) || weapons[0],
    token = scene.tokens.find((t) => t.id === weapon?.id);
  const operatorKey = `alvorada-siege-operator-v1:${userId}:${roomId}:${weapon?.id || ''}`;
  function readOperator() {
    try {
      return localStorage.getItem(operatorKey);
    } catch {
      return null;
    }
  }
  const [operatorChoice, setOperatorChoice] = useState<{ key: string; id: string | null }>(() => ({
    key: operatorKey,
    id: readOperator() ?? initialPreferences?.actorId ?? null,
  }));
  const actorId = operatorChoice.key === operatorKey ? operatorChoice.id : readOperator();
  useEffect(() => {
    const local = (event: Event) => {
      const value = (event as CustomEvent<{ key: string; id: string }>).detail;
      if (value?.key === operatorKey) setOperatorChoice({ key: operatorKey, id: value.id });
    };
    const external = (event: StorageEvent) => {
      if (event.key === operatorKey) setOperatorChoice({ key: operatorKey, id: event.newValue });
    };
    window.addEventListener('alvorada-siege-operator', local);
    window.addEventListener('storage', external);
    return () => {
      window.removeEventListener('alvorada-siege-operator', local);
      window.removeEventListener('storage', external);
    };
  }, [operatorKey]);
  function chooseOperator(id: string) {
    setOperatorChoice({ key: operatorKey, id });
    try {
      localStorage.setItem(operatorKey, id);
    } catch {
      /* Session choice remains usable when storage is unavailable. */
    }
    window.dispatchEvent(
      new CustomEvent('alvorada-siege-operator', { detail: { key: operatorKey, id } }),
    );
  }
  const actors = scene.tokens.filter(
    (t) =>
      t.layer === 'tokens' &&
      !t.sceneryToken &&
      (gm || t.controller === userId) &&
      !t.hidden &&
      t.hp > 0,
  );
  const actor =
    actorId === null
      ? (token ? actors.find((a) => siegeAdjacent(a, token, scene)) : null) || actors[0]
      : actors.find((t) => t.id === actorId);
  const near = !!actor && !!token && siegeAdjacent(actor, token, scene),
    turn = snapshot?.turn,
    actions = turn?.actions.find((a) => a.actorId === actor?.id),
    available =
      !turn?.active ||
      (turn.actorId === actor?.id && (actions?.used || 0) < (actions?.budget || 1));
  useEffect(() => {
    onPreferencesChange?.({ actorId: actor?.id || '', mode, surface });
  }, [actor?.id, mode, surface, onPreferencesChange]);
  useEffect(() => {
    if (weapon) {
      setAmmo(weapon.ammo);
      setMuted(weapon.muted);
    }
  }, [weapon?.id, weapon?.revision]);
  const run = (c: SiegeCommand) => void send(c).catch(() => {});
  return (
    <section
      className={`vtt-siege-panel${compact ? ' vtt-siege-panel-compact' : ''}`}
      aria-label={compact ? 'Controles da arma' : 'Armas de cerco'}
    >
      {!compact && (
        <header>
          <Crosshair size={20} />
          <div>
            <strong>Armas de cerco</strong>
            <small>Tripulação, mira e disparo</small>
          </div>
        </header>
      )}
      {gm && !compact && (
        <div className="vtt-siege-library">
          {siegeKinds.map((kind) => (
            <article
              key={kind}
              draggable={!disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-alvorada-siege', kind);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <img src={siegeImage(kind, kind === 'harpoon')} alt="" loading="lazy" />
              <strong>{siegeDefinitions[kind].name}</strong>
              <small>
                {siegeDefinitions[kind].damage} · {siegeDefinitions[kind].damageType}
              </small>
              <button disabled={disabled} onClick={() => run({ kind: 'create', weaponKind: kind })}>
                <Plus size={13} />
                Colocar no mapa
              </button>
            </article>
          ))}
        </div>
      )}
      {gm && !compact && (
        <p className="vtt-siege-hint">
          Arraste uma arma para o mapa ou coloque-a no centro. Pode vinculá-la ao convés de um
          veículo.
        </p>
      )}
      {!weapons.length ? (
        <p>Nenhuma arma de cerco visível neste mapa.</p>
      ) : (
        weapon &&
        token && (
          <>
            {!compact && (
              <label>
                Arma
                <select
                  aria-label="Arma de cerco"
                  value={weapon.id}
                  onChange={(e) => select(e.target.value)}
                >
                  {weapons.map((w) => (
                    <option key={w.id} value={w.id}>
                      {scene.tokens.find((t) => t.id === w.id)?.name ||
                        siegeDefinitions[w.kind].name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="vtt-siege-status">
              <strong>{siegeStageNames[weapon.stage]}</strong>
              <span>{weapon.ammo} munições de reserva</span>
              <span>
                CA {token.ac} · {token.hp}/{token.maxHp} PV
              </span>
            </div>
            {!compact && (
              <ol className="vtt-siege-steps" aria-label="Etapas da arma">
                {['Carregar', 'Mirar', 'Disparar'].map((name, i) => (
                  <li
                    key={name}
                    data-current={
                      i === ['empty', 'loaded', 'aimed'].indexOf(weapon.stage) || undefined
                    }
                  >
                    <b>{i + 1}</b>
                    {name}
                    <small>1 ação</small>
                  </li>
                ))}
              </ol>
            )}
            <label>
              Quem opera
              <select
                aria-label="Operador da arma"
                value={actor?.id || ''}
                onChange={(e) => chooseOperator(e.target.value)}
              >
                <option value="">Sem operador</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {!actor ? (
              <p className="vtt-siege-warning">
                {actors.length
                  ? 'Sem operador. Escolha um personagem próximo para carregar, mirar ou disparar.'
                  : 'Sem operador. Coloque um personagem que você controla no mapa para operar a arma.'}
              </p>
            ) : !near ? (
              <p className="vtt-siege-warning">Aproxime {actor.name} a até 5 pés da arma.</p>
            ) : turn?.active ? (
              <p className="vtt-siege-hint">
                {turn.actorId === actor.id
                  ? `${actions?.used || 0}/${actions?.budget || 1} ações de cerco usadas neste turno.`
                  : 'Aguarde o turno deste personagem.'}
              </p>
            ) : (
              <p className="vtt-siege-hint">
                Fora de combate: cada etapa representa uma ação da tripulação.
              </p>
            )}
            {!actor && releaseCharacterSupport && (
              <div className="vtt-siege-hint">
                <p>A arma acompanha {releaseCharacterSupport.name} por um vínculo.</p>
                <button disabled={disabled} onClick={releaseCharacterSupport.release}>
                  Soltar vínculo com {releaseCharacterSupport.name}
                </button>
              </div>
            )}
            <div className="vtt-siege-actions">
              <button
                disabled={
                  disabled || !near || !available || weapon.stage !== 'empty' || !weapon.ammo
                }
                onClick={() =>
                  actor &&
                  run({
                    kind: 'load',
                    weaponId: weapon.id,
                    revision: weapon.revision,
                    actorId: actor.id,
                  })
                }
              >
                <RotateCcw size={15} />
                Carregar
              </button>
              <button
                disabled={disabled || !near || !available || weapon.stage === 'empty'}
                onClick={() =>
                  actor &&
                  aim({
                    weaponId: weapon.id,
                    actorId: actor.id,
                    mode,
                    surface: gm ? surface : 'auto',
                  })
                }
              >
                <Crosshair size={15} />
                Mirar no mapa
              </button>
              <button
                className="vtt-siege-fire"
                disabled={
                  disabled || !near || !available || weapon.stage !== 'aimed' || !weapon.aim
                }
                onClick={() =>
                  actor &&
                  run({
                    kind: 'fire',
                    weaponId: weapon.id,
                    revision: weapon.revision,
                    actorId: actor.id,
                  })
                }
              >
                <Flame size={16} />
                Disparar
              </button>
            </div>
            <label>
              Condição do ataque
              <select
                aria-label="Condição do disparo"
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="normal">Normal</option>
                <option value="advantage">Vantagem</option>
                <option value="disadvantage">Desvantagem</option>
              </select>
            </label>
            {gm && (
              <label>
                Superfície do impacto
                <select
                  aria-label="Superfície do impacto"
                  value={surface}
                  onChange={(e) => setSurface(e.target.value as typeof surface)}
                >
                  <option value="auto">Automática · oceano e pintura</option>
                  <option value="ground">Terra ou superfície sólida</option>
                  <option value="water">Água</option>
                </select>
              </label>
            )}
            {weapon.stage === 'aimed' && weapon.aim && (
              <p className="vtt-siege-hint">
                Mira confirmada a {Math.round(siegeDistance(token, weapon.aim, scene))} pés. Se a
                arma ou o alvo se mover, mire novamente.
              </p>
            )}
            {weapon.stage === 'aimed' && !weapon.aim && (
              <p className="vtt-siege-hint">
                A mira atual não está visível para este personagem. Confirme uma nova mira para
                operar.
              </p>
            )}
            {gm && turn?.active && actor && turn.actorId === actor.id && (
              <button
                className="vtt-siege-extra"
                disabled={disabled}
                onClick={() => run({ kind: 'extraAction', actorId: actor.id })}
              >
                Autorizar ação extra para {actor.name}
              </button>
            )}
            {gm && (
              <details>
                <summary>Reservas e som</summary>
                <label>
                  Munições de reserva
                  <input
                    aria-label="Munições da arma"
                    type="number"
                    min="0"
                    max="9999"
                    value={ammo}
                    onChange={(e) => setAmmo(Math.max(0, Math.min(9999, Number(e.target.value))))}
                  />
                </label>
                <label className="vtt-siege-check">
                  <input
                    type="checkbox"
                    checked={muted}
                    onChange={(e) => setMuted(e.target.checked)}
                  />
                  <Volume2 size={14} />
                  Sons da arma desativados para todos
                </label>
                <button
                  disabled={disabled}
                  onClick={() =>
                    run({
                      kind: 'settings',
                      weaponId: weapon.id,
                      revision: weapon.revision,
                      ammunition: ammo,
                      muted,
                    })
                  }
                >
                  Salvar reservas e som
                </button>
              </details>
            )}
            <details>
              <summary>Regras desta arma</summary>
              <p>{siegeDefinitions[weapon.kind].description}</p>
              <p>
                Ataque +6 · {siegeDefinitions[weapon.kind].range}/
                {siegeDefinitions[weapon.kind].longRange} pés ·{' '}
                {siegeDefinitions[weapon.kind].damage} de {siegeDefinitions[weapon.kind].damageType}
                . Alcance longo impõe desvantagem. Um alvo por disparo; crítico dobra os dados.
              </p>
              <p>
                Objeto Grande · CA {siegeDefinitions[weapon.kind].ac} ·{' '}
                {siegeDefinitions[weapon.kind].hp} PV · imunidade a veneno e psíquico. Carregar,
                mirar e disparar usam uma ação cada; personagens próximos podem dividir essas
                etapas.
              </p>
              <a href={siegeDefinitions[weapon.kind].source} target="_blank" rel="noreferrer">
                Referência das estatísticas
              </a>
            </details>
          </>
        )
      )}
      {gm && !!snapshot?.impacts?.length && (
        <details className="vtt-siege-impact-list">
          <summary>Projéteis no mapa ({snapshot.impacts.length})</summary>
          <p className="vtt-siege-hint">Ficam na superfície até o mestre remover.</p>
          {snapshot.impacts.slice(-impactCount).map((impact, i) => (
            <div key={impact.id} data-impact-id={impact.id}>
              <span>{impact.kind === 'cannon' ? 'Bala de canhão' : 'Arpão preso'}</span>
              <button
                disabled={disabled}
                aria-label={`Remover ${impact.kind === 'cannon' ? 'bala de canhão' : 'arpão'} ${i + 1}`}
                onClick={() => run({ kind: 'removeImpact', impactId: impact.id })}
              >
                <X size={13} />
                Remover
              </button>
            </div>
          ))}
          {snapshot.impacts.length > impactCount && (
            <button onClick={() => setImpactCount((n) => n + 20)}>Mostrar mais projéteis</button>
          )}
        </details>
      )}
      {error && (
        <p role="alert" className="vtt-siege-warning">
          {error}
        </p>
      )}
    </section>
  );
}

export function VttSiegeAim({
  weapon,
  token,
  scene,
  camera,
  bounds,
  disabled,
  confirm,
  cancel,
}: {
  weapon: SiegeWeapon;
  token: VttToken;
  scene: VttScene;
  camera: VttCamera;
  bounds: { width: number; height: number };
  disabled: boolean;
  confirm: (point: Point) => Promise<void>;
  cancel: () => void;
}) {
  const [point, setPoint] = useState<Point>(
      weapon.aim || {
        x: Math.max(
          0,
          Math.min(
            scene.width,
            token.x + Math.sin((token.rotation * Math.PI) / 180) * scene.grid.size * 3,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            scene.height,
            token.y - Math.cos((token.rotation * Math.PI) / 180) * scene.grid.size * 3,
          ),
        ),
      },
    ),
    [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    root = useRef<HTMLDivElement>(null),
    distance = siegeDistance(token, point, scene),
    definition = siegeDefinitions[weapon.kind],
    inRange = distance <= definition.longRange;
  const submit = async (picked = point) => {
    if (disabled || !inRange) return;
    try {
      setError('');
      await confirm(picked);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const pointFromEvent = (e: {
    clientX: number;
    clientY: number;
    currentTarget: HTMLDivElement;
  }) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(scene.width, camera.x + (e.clientX - r.left - bounds.width / 2) / camera.zoom),
      ),
      y: Math.max(
        0,
        Math.min(scene.height, camera.y + (e.clientY - r.top - bounds.height / 2) / camera.zoom),
      ),
    };
  };
  useEffect(() => {
    root.current?.focus();
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    c.width = bounds.width * ratio;
    c.height = bounds.height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const project = (p: Point) => ({
        x: (p.x - camera.x) * camera.zoom + bounds.width / 2,
        y: (p.y - camera.y) * camera.zoom + bounds.height / 2,
      }),
      origin = project(token),
      target = project(point),
      angle = Math.atan2(target.y - origin.y, target.x - origin.x),
      base = ((token.rotation - 90) * Math.PI) / 180,
      radius = Math.min(95, Math.max(42, token.width * camera.zoom * 0.7)),
      sweep = ((angle - base + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    ctx.fillStyle = '#caa86919';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.arc(origin.x, origin.y, radius, base, base + sweep, sweep < 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d9bc7b88';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let d = 0; d < 360; d += 15) {
      const a = ((d - 90) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(origin.x + Math.cos(a) * (radius - 5), origin.y + Math.sin(a) * (radius - 5));
      ctx.lineTo(origin.x + Math.cos(a) * radius, origin.y + Math.sin(a) * radius);
      ctx.stroke();
    }
    ctx.strokeStyle = inRange ? '#f0cf8b' : '#e9947e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 3;
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(target.x - 9, target.y - 9);
    ctx.lineTo(target.x + 9, target.y + 9);
    ctx.moveTo(target.x + 9, target.y - 9);
    ctx.lineTo(target.x - 9, target.y + 9);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }, [point, camera, bounds, token, inRange]);
  return (
    <div
      ref={root}
      className="vtt-siege-aim"
      role="application"
      aria-label="Mira angular da arma"
      tabIndex={0}
      onPointerMove={(e) => {
        if (e.target instanceof Element && e.target.closest('.vtt-siege-aim-info')) return;
        const r = e.currentTarget.getBoundingClientRect();
        setPoint({
          x: Math.max(
            0,
            Math.min(scene.width, camera.x + (e.clientX - r.left - bounds.width / 2) / camera.zoom),
          ),
          y: Math.max(
            0,
            Math.min(
              scene.height,
              camera.y + (e.clientY - r.top - bounds.height / 2) / camera.zoom,
            ),
          ),
        });
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (!(e.target instanceof Element && e.target.closest('.vtt-siege-aim-info')))
          setPoint(pointFromEvent(e));
      }}
      onClick={(e) => {
        if (e.target instanceof Element && e.target.closest('.vtt-siege-aim-info')) return;
        const picked = pointFromEvent(e);
        setPoint(picked);
        void submit(picked);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          void submit();
        } else if (e.key.startsWith('Arrow')) {
          e.preventDefault();
          const step = scene.grid.size * (e.shiftKey ? 1 : 0.25);
          setPoint((p) => ({
            x: Math.max(
              0,
              Math.min(
                scene.width,
                p.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                scene.height,
                p.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
              ),
            ),
          }));
        }
      }}
    >
      <canvas ref={canvas} aria-hidden="true" />
      <div className="vtt-siege-aim-info">
        <strong>
          <Crosshair size={16} />
          {definition.name} · confirmar mira
        </strong>
        <span>
          {Math.round(siegeBearing(token, point))}° · {Math.round(distance)} pés ·{' '}
          {!inRange
            ? 'Fora de alcance'
            : distance > definition.range
              ? 'Alcance longo: desvantagem'
              : 'Alcance normal'}
        </span>
        <small>Clique no X para confirmar. Setas ajustam; Enter confirma; Esc cancela.</small>
        {error && <p role="alert">{error}</p>}
        <div>
          <button disabled={disabled || !inRange} onClick={() => void submit()}>
            {disabled ? 'Confirmando…' : 'Confirmar mira · 1 ação'}
          </button>
          <button onClick={cancel}>
            <X size={14} />
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

type ShotEvent = { shot: SiegeShot; weaponId: string; started: number };
export function VttSiegeShots({
  roomId,
  snapshot,
  scene,
  camera,
  bounds,
  enabled,
  gm,
  preview,
  viewer,
  soundEnabled,
  soundVolume,
}: {
  roomId: string;
  snapshot: SiegeSnapshot | null;
  scene: VttScene;
  camera: VttCamera;
  bounds: { width: number; height: number };
  enabled: boolean;
  gm: boolean;
  preview: boolean;
  viewer: VttToken | null;
  soundEnabled: boolean;
  soundVolume: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    events = useRef<ShotEvent[]>([]),
    seen = useRef(new Set<string>()),
    initialized = useRef(''),
    [version, redraw] = useState(0),
    audio = useVttEffectAudio(soundEnabled, soundVolume),
    live = useRef({ scene, camera, bounds, enabled, gm, preview, viewer });
  live.current = { scene, camera, bounds, enabled, gm, preview, viewer };
  useEffect(() => { siegeMaterials(); }, []);
  useEffect(() => {
    initialized.current = '';
    events.current = [];
    seen.current.clear();
    audio.stop();
  }, [roomId, scene.id]);
  useEffect(() => {
    if (!snapshot || snapshot.roomId !== roomId || snapshot.sceneId !== scene.id) return;
    const identity = roomId + scene.id;
    if (initialized.current !== identity) {
      initialized.current = identity;
      events.current = [];
      seen.current = new Set(
        (snapshot?.weapons || []).flatMap((w) => [
          ...(w.lastShot ? [w.lastShot.id] : []),
          ...(w.lastLoad ? [w.lastLoad.id] : []),
        ]),
      );
      audio.stop();
      return;
    }
    if (!snapshot) return;
    for (const w of snapshot.weapons) {
      const load = w.lastLoad;
      if (load && !seen.current.has(load.id)) {
        seen.current.add(load.id);
        const token = scene.tokens.find((t) => t.id === w.id);
        if (
          token &&
          snapshot.serverTime - load.at < 3500 &&
          !document.hidden &&
          !load.muted &&
          !w.muted &&
          ((gm && !preview) ||
            (!load.private &&
              !token.hidden &&
              token.layer !== 'gm' &&
              (!preview || (viewer && viewerSees(viewer, token, scene)))))
        )
          audio.play(`/audio/vtt-siege/${w.kind}-load-v1.wav`);
      }
      const shot = w.lastShot;
      if (!shot || seen.current.has(shot.id)) continue;
      seen.current.add(shot.id);
      if (seen.current.size > 256) seen.current.delete(seen.current.values().next().value!);
      const token = scene.tokens.find((t) => t.id === w.id);
      if (
        !token ||
        shot.sceneId !== scene.id ||
        snapshot.serverTime - shot.at > 3000 ||
        document.hidden ||
        ((!gm || preview) &&
          (shot.private ||
            token.hidden ||
            token.layer === 'gm' ||
            (preview && (!viewer || !viewerSees(viewer, token, scene)))))
      )
        continue;
      events.current = [
        ...events.current.slice(-15),
        { shot, weaponId: w.id, started: performance.now() },
      ];
      if (!shot.muted && !w.muted)
        audio.play(
          shot.kind === 'cannon'
            ? '/audio/vtt-siege/cannon-shot-v1.wav'
            : '/audio/vtt-attacks/bow-release.wav',
        );
      redraw((v) => v + 1);
    }
  }, [snapshot, roomId, scene.id]);
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let frame = 0,
      last = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const draw = (stamp: number) => {
      const o = live.current;
      events.current = events.current.filter((e) => stamp - e.started < 1800);
      if (!events.current.length) {
        ctx.clearRect(0, 0, c.width, c.height);
        return;
      }
      frame = requestAnimationFrame(draw);
      if (document.hidden || stamp - last < 1000 / 40) return;
      last = stamp;
      const ratio = Math.min(devicePixelRatio || 1, 1.5),
        w = Math.round(o.bounds.width * ratio),
        h = Math.round(o.bounds.height * ratio);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, o.bounds.width, o.bounds.height);
      if (!o.enabled) return;
      for (const e of events.current) {
        const t = (stamp - e.started) / 1000,
          shot = e.shot,
          from = {
            x: (shot.from.x - o.camera.x) * o.camera.zoom + o.bounds.width / 2,
            y: (shot.from.y - o.camera.y) * o.camera.zoom + o.bounds.height / 2,
          },
          to = {
            x: (shot.to.x - o.camera.x) * o.camera.zoom + o.bounds.width / 2,
            y: (shot.to.y - o.camera.y) * o.camera.zoom + o.bounds.height / 2,
          },
          angle = Math.atan2(to.y - from.y, to.x - from.x),
          token = o.scene.tokens.find((v) => v.id === e.weaponId),
          muzzle = (token?.height || 70) * o.camera.zoom * 0.34;
        from.x += Math.cos(angle) * muzzle;
        from.y += Math.sin(angle) * muzzle;
        const travel = 0.55,
          p = Math.min(1, t / travel),
          x = from.x + (to.x - from.x) * p,
          y = from.y + (to.y - from.y) * p;
        if (shot.kind === 'cannon') {
          if (t < 0.22) {
            const alpha = 1 - t / 0.22;
            const flash = ctx.createRadialGradient(
              from.x,
              from.y,
              0,
              from.x,
              from.y,
              42 * alpha + 3,
            );
            flash.addColorStop(0, '#fff3c8');
            flash.addColorStop(0.2, '#ffc36be8');
            flash.addColorStop(1, '#e8792c00');
            ctx.fillStyle = flash;
            ctx.fillRect(from.x - 48, from.y - 48, 96, 96);
          }
          if (!reduced.matches)
            for (let i = 0; i < 9; i++) {
              const phase = t + i * 0.045,
                r = 8 + phase * 19,
                sx = from.x + Math.cos(angle) * phase * 32 + Math.sin(i * 8) * phase * 24,
                sy = from.y + Math.sin(angle) * phase * 32 + Math.cos(i * 5) * phase * 24;
              ctx.globalAlpha = Math.max(0, 1 - t / 1.7) * 0.1;
              const smoke = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
              smoke.addColorStop(0, '#beb6a5');
              smoke.addColorStop(1, '#aaa18f00');
              ctx.fillStyle = smoke;
              ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
            }
          ctx.globalAlpha = 1;
          if (t < travel) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#000';
            ctx.fillStyle = '#262524';
            ctx.beginPath();
            ctx.arc(
              x,
              y,
              Math.max(3, Math.min(7, (token?.width || 70) * o.camera.zoom * 0.045)),
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.fillStyle = '#afa798';
            ctx.beginPath();
            ctx.arc(x - 1, y - 1, 1, 0, 7);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        } else {
          if (t < .6) {
            const grid = o.scene.grid.size * o.camera.zoom;
            const length = harpoonLength(grid, 1);
            const tail = {x:x-Math.cos(angle)*length*.96,y:y-Math.sin(angle)*length*.96};
            if (Math.hypot(x-from.x,y-from.y)>length) drawSiegeRope(ctx, from, tail, grid, 1,
              o.gm && !o.preview ? undefined : screen => !!o.viewer && viewerSees(o.viewer, {
                x:(screen.x-o.bounds.width/2)/o.camera.zoom+o.camera.x,
                y:(screen.y-o.bounds.height/2)/o.camera.zoom+o.camera.y,

              },o.scene), reduced.matches ? 0 : Math.sin(t*17)*grid*.035);
            ctx.save();ctx.translate(x,y);ctx.rotate(angle);
            drawSiegeHarpoon(ctx,grid,1);ctx.restore();
          }
        }
        if (t >= travel && t < travel + 0.5) {
          const impact = (t - travel) / 0.5;
          ctx.globalAlpha = (1 - impact) * 0.65;
          ctx.strokeStyle = shot.hit ? '#ebc884' : '#a69e8e';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(to.x, to.y, 5 + impact * 22, 0, Math.PI * 2);
          ctx.stroke();
          if (!reduced.matches)
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4;
              ctx.fillStyle = '#d3b78a';
              ctx.fillRect(
                to.x + Math.cos(a) * impact * 28 - 1,
                to.y + Math.sin(a) * impact * 28 - 1,
                2,
                2,
              );
            }
          ctx.globalAlpha = 1;
        }
      }
    };
    if (events.current.length) frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, c.width, c.height);
    };
  }, [version, roomId, scene.id]);
  return (
    <canvas
      ref={canvas}
      className="vtt-siege-shots"
      aria-hidden="true"
      data-siege-shots={version || undefined}
    />
  );
}

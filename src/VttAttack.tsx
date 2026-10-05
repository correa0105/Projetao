import { useEffect, useRef, useState } from 'react';
import { Dices, Swords } from 'lucide-react';
import {
  attackFormula,
  attackOutcome,
  criticalDamage,
  type AttackMode,
  type AttackRequest,
} from '../shared/vtt-attack';
import type { VttMessage, VttToken } from '../shared/vtt';
import './vtt-attack.css';
type Roll = NonNullable<VttMessage['roll']>;
export function VttAttack({
  request,
  target,
  active,
  roll,
  onBusy,
}: {
  request: AttackRequest;
  target?: VttToken;
  active: boolean;
  roll: (formula: string, label: string) => Promise<VttMessage['roll']>;
  onBusy: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState<AttackMode>('normal'),
    [result, setResult] = useState<{
      roll: Roll;
      target: VttToken;
      hit: boolean;
      critical: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [damage, setDamage] = useState<Roll[]>([]),
    [discarded, setDiscarded] = useState(false);
  const inFlight = useRef(false),
    completed = useRef<Roll[]>([]),
    context = `${request.actorId}:${target?.id || ''}:${active}`,
    currentContext = useRef(context);
  currentContext.current = context;
  useEffect(() => {
    setResult(null);
    setDamage([]);
    completed.current = [];
    setDiscarded(false);
    setError('');
  }, [context]);
  const formulas = result?.critical ? request.damage.flatMap(criticalDamage) : request.damage;
  const done = damage.length > 0 && damage.length === formulas.length;
  const pending = !!result?.hit && !discarded && !done && formulas.length > 0;
  async function run(fn: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  async function attack() {
    if (!target || !active || pending) return;
    const snapshot = { ...target },
      at = context;
    await run(async () => {
      setResult(null);
      setDamage([]);
      completed.current = [];
      setDiscarded(false);
      const value = await roll(
        attackFormula(request.attack, mode),
        request.name + ' → ' + snapshot.name + ' · ataque',
      );
      if (!value) throw Error('A rolagem não retornou um resultado.');
      if (currentContext.current === at)
        setResult({ roll: value, target: snapshot, ...attackOutcome(value, snapshot.ac) });
    });
  }
  async function hurt() {
    if (!result?.hit || discarded || done || !active || result.target.id !== target?.id) return;
    const at = context;
    await run(async () => {
      for (let i = completed.current.length; i < formulas.length; i++) {
        if (currentContext.current !== at) return;
        const value = await roll(
          formulas[i],
          request.name +
            ' → ' +
            result.target.name +
            (result.critical ? ' · dano crítico' : ' · dano'),
        );
        if (!value) throw Error('A rolagem de dano não retornou um resultado.');
        if (currentContext.current !== at) return;
        completed.current = [...completed.current, value];
        setDamage(completed.current);
      }
    });
  }
  async function discard() {
    if (!result?.hit || discarded) return;
    const at = context;
    await run(async () => {
      await roll('', request.name + ' → ' + result.target.name + ' · dano descartado');
      if (currentContext.current === at) setDiscarded(true);
    });
  }
  return (
    <div className="vtt-attack-inline" aria-label="Controles do ataque">
      <span className="vtt-attack-target" aria-live="polite">
        {target ? (
          <>
            Alvo: <b>{target.name}</b>
          </>
        ) : (
          'Clique em outro token para marcar o alvo vermelho.'
        )}
      </span>
      <select
        aria-label="Vantagem do ataque"
        value={mode}
        disabled={busy || pending}
        onChange={(e) => setMode(e.target.value as AttackMode)}
      >
        <option value="normal">Normal</option>
        <option value="advantage">Vantagem</option>
        <option value="disadvantage">Desvantagem</option>
      </select>
      <button disabled={busy || !target || !active || pending} onClick={() => void attack()}>
        <Swords size={14} /> {result ? 'Rolar novo ataque' : 'Rolar ataque'}
      </button>
      {!result && request.damage.length > 0 && (
        <button
          disabled={busy || !active}
          onClick={() =>
            void run(async () => {
              for (const formula of request.damage)
                await roll(formula, request.name + ' · dano separado');
            })
          }
        >
          Rolar dano separado
        </button>
      )}
      {result && (
        <div className={'vtt-attack-result ' + (result.hit ? 'hit' : 'miss')} aria-live="polite">
          <span>
            <b>{result.hit ? (result.critical ? 'Acerto crítico' : 'Acertou') : 'Não acertou'}</b> ·{' '}
            {result.roll.total} contra CA {result.target.ac} · {result.target.name}
          </span>
          {result.hit && !discarded && (
            <>
              {formulas.length > 0 && !done && (
                <button
                  disabled={busy || !active || result.target.id !== target?.id}
                  onClick={() => void hurt()}
                >
                  <Dices size={14} /> {damage.length ? 'Rolar dano restante' : 'Rolar dano'}
                </button>
              )}
              <button disabled={busy} onClick={() => void discard()}>
                Descartar dano
              </button>
              {!formulas.length && <small>A ficha não informa dano.</small>}
            </>
          )}
          {discarded ? (
            <b>Dano descartado</b>
          ) : (
            damage.length > 0 && <b>Dano rolado: {damage.reduce((sum, r) => sum + r.total, 0)}</b>
          )}
        </div>
      )}
      {!active && <small>Selecione o atacante amarelo para usar este ataque.</small>}
      {error && (
        <span role="alert" className="vtt-attack-error">
          {error}
        </span>
      )}
    </div>
  );
}

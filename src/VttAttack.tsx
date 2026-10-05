import { useState } from 'react';
import { Dices, Shield, Swords } from 'lucide-react';
import { VttModal } from './VttMaps';
import { attackOutcome, criticalDamage, type AttackRequest } from '../shared/vtt-attack';
import type { VttMessage, VttToken } from '../shared/vtt';
import './vtt-attack.css';
export function VttAttack({
  request,
  tokens,
  selected,
  close,
  roll,
}: {
  request: AttackRequest;
  tokens: VttToken[];
  selected?: string;
  close: () => void;
  roll: (formula: string, label: string) => Promise<VttMessage['roll']>;
}) {
  const targets = tokens.filter(
    (t) => t.id !== request.actorId && t.layer === 'tokens' && !t.hidden,
  );
  const [targetId, setTargetId] = useState(targets.some((t) => t.id === selected) ? selected! : ''),
    [result, setResult] = useState<{
      roll: NonNullable<VttMessage['roll']>;
      target: VttToken;
      hit: boolean;
      critical: boolean;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [damage, setDamage] = useState<VttMessage['roll'][] | null>(null);
  const target = targets.find((t) => t.id === targetId);
  async function attack() {
    if (!target || busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    setDamage(null);
    try {
      const value = await roll(request.attack, request.name + ' → ' + target.name + ' · ataque');
      if (!value) throw Error('A rolagem não retornou um resultado.');
      setResult({ roll: value, target: { ...target }, ...attackOutcome(value, target.ac) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function hurt() {
    if (!result?.hit || busy || damage) return;
    setBusy(true);
    setError('');
    try {
      const values: VttMessage['roll'][] = [];
      for (const formula of request.damage.flatMap((f) =>
        result.critical ? criticalDamage(f) : [f],
      ))
        values.push(
          await roll(
            formula,
            request.name +
              ' → ' +
              result.target.name +
              (result.critical ? ' · dano crítico' : ' · dano'),
          ),
        );
      setDamage(values);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="vtt-attack-layer">
      <VttModal title={'Ataque · ' + request.name} close={close}>
        <div className="vtt-attack-content">
          {error && <p role="alert">{error}</p>}
          <label>
            Alvo
            <select
              aria-label="Alvo do ataque"
              value={targetId}
              disabled={busy}
              onChange={(e) => {
                setTargetId(e.target.value);
                setResult(null);
                setDamage(null);
              }}
            >
              <option value="">Selecione um token</option>
              {targets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} · CA {t.ac}
                </option>
              ))}
            </select>
          </label>
          {!targets.length && <p>Nenhum outro token visível neste mapa.</p>}
          {target && (
            <p>
              <Shield size={16} /> {target.name} · CA {target.ac}
            </p>
          )}
          <button className="vtt-gold" disabled={busy || !target} onClick={() => void attack()}>
            <Swords size={16} /> Rolar ataque
          </button>
          {result && (
            <section
              className={'vtt-attack-result ' + (result.hit ? 'hit' : 'miss')}
              aria-live="polite"
            >
              <strong>
                {result.hit ? (result.critical ? 'Acerto crítico' : 'Acertou') : 'Não acertou'}
              </strong>
              <p>
                {result.roll.total} contra CA {result.target.ac} · {result.target.name}
              </p>
              {result.hit && request.damage.length > 0 && (
                <button disabled={busy || !!damage} onClick={() => void hurt()}>
                  <Dices size={16} /> Rolar dano
                </button>
              )}
              {damage && (
                <p>
                  Dano rolado: <b>{damage.reduce((sum, r) => sum + (r?.total || 0), 0)}</b> (
                  {damage.map((r) => r?.formula).join(' + ')})
                </p>
              )}
              {result.hit && request.damage.length === 0 && (
                <p>A ficha não informa uma fórmula de dano.</p>
              )}
            </section>
          )}
          <small>
            A rolagem vai ao chat. O mestre aplica o dano e eventuais regras adicionais.
          </small>
        </div>
      </VttModal>
    </div>
  );
}

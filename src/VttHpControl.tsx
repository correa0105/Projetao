import { useState } from 'react';
import { Heart, Minus, Plus } from 'lucide-react';
import type { VttToken } from '../shared/vtt';
export function VttHpControl({
  token,
  busy,
  apply,
}: {
  token: VttToken;
  busy: boolean;
  apply: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(''),
    [error, setError] = useState(''),
    [working, setWorking] = useState(false);
  return (
    <form
      className="vtt-hp-control"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || working) return;
        setWorking(true);
        setError('');
        void apply(value)
          .then(() => setValue(''))
          .catch((e) => setError(e.message))
          .finally(() => setWorking(false));
      }}
    >
      <div className="vtt-hp-status" data-low={token.hp <= token.maxHp * 0.25}>
        <div className="vtt-hp-heading">
          <span>
            <Heart size={14} /> Pontos de vida
          </span>
          <span>
            <strong>{token.hp}</strong>
            <small> / {token.maxHp}</small>
          </span>
        </div>
        <div
          className="vtt-hp-track"
          role="progressbar"
          aria-label="Pontos de vida"
          aria-valuemin={0}
          aria-valuemax={Math.max(1, token.maxHp)}
          aria-valuenow={Math.max(0, Math.min(token.hp, token.maxHp))}
        >
          <span
            style={{
              width: `${Math.max(0, Math.min(100, (token.hp / Math.max(1, token.maxHp)) * 100))}%`,
            }}
          />
        </div>
      </div>
      <div className="vtt-hp-modes" aria-label="Tipo de ajuste de vida">
        <button
          type="button"
          aria-pressed={value.startsWith('-')}
          disabled={busy || working}
          onClick={() => setValue('-' + value.replace(/^[+-]/, ''))}
        >
          <Minus size={13} /> Dano
        </button>
        <button
          type="button"
          aria-pressed={value.startsWith('+')}
          disabled={busy || working}
          onClick={() => setValue('+' + value.replace(/^[+-]/, ''))}
        >
          <Plus size={13} /> Cura
        </button>
      </div>
      <label>
        Editar PV
        <input
          aria-label="Editar PV do token"
          placeholder="20, +10 ou -5"
          value={value}
          disabled={busy || working}
          maxLength={8}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy || working || !/^[+-]?\d+$/.test(value.trim())}>
        Aplicar PV
      </button>
      <small>+ cura · − dano · número define PV</small>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

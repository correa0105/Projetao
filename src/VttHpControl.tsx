import { useState } from 'react';
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
      <div className="vtt-hp-orb" title="Pontos de vida">
        <strong>{token.hp}</strong>
        <small> / {token.maxHp}</small>
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
      <button type="submit" disabled={busy || working || !value.trim()}>
        Aplicar PV
      </button>
      <small>+ cura · − dano · número define PV</small>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

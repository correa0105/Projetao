import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dices } from 'lucide-react';
import { createPortal } from 'react-dom';
import './attribute-dice.css';

const dots: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, index, discarded }: { value: number; index: number; discarded: boolean }) {
  const side = [1, 2, 3, 4, 5, 6].find((v) => v !== value && v !== 7 - value)!;
  const top = [1, 2, 3, 4, 5, 6].find((v) => ![value, 7 - value, side, 7 - side].includes(v))!;
  return (
    <div
      className={`attribute-die-drop${discarded ? ' is-discarded' : ''}`}
      style={{ '--die-index': index } as CSSProperties}
      aria-hidden="true"
    >
      <div className="attribute-die-shadow" />
      <div className="attribute-die">
        {[value, 7 - value, side, 7 - side, top, 7 - top].map((face, i) => (
          <div className={`attribute-die-face face-${i}`} key={i}>
            {Array.from({ length: 9 }, (_, dot) => (
              <span className={dots[face].includes(dot) ? 'pip' : ''} key={dot} />
            ))}
          </div>
        ))}
      </div>
      <small>{discarded ? 'Descartado' : value}</small>
    </div>
  );
}

function DiceThrow({ dice, index, onKeep }: { dice: number[]; index: number; onKeep: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [settled, setSettled] = useState(false);
  const discard = dice.indexOf(Math.min(...dice));
  const total = dice.reduce((a, b) => a + b, 0) - dice[discard];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    const timer = setTimeout(
      () => setSettled(true),
      matchMedia('(prefers-reduced-motion: reduce)').matches ? 180 : 2300,
    );
    button.current?.focus();
    return () => {
      clearTimeout(timer);
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`attribute-dice-overlay${settled ? ' is-settled' : ''}`}
      aria-labelledby="dice-throw-title"
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
    >
      <header>
        <span>O destino está em suas mãos</span>
        <h2 id="dice-throw-title">Rolagem {index + 1} de 6</h2>
        <p>Quatro dados. Os três maiores formam seu resultado.</p>
      </header>
      <div className="attribute-dice-stage">
        {dice.map((value, i) => (
          <Die key={i} value={value} index={i} discarded={i === discard} />
        ))}
      </div>
      <div className="attribute-dice-outcome" aria-live="polite">
        {settled ? (
          <>
            <strong>{total}</strong>
            <p>
              {dice.join(' + ')} − {dice[discard]} descartado
            </p>
          </>
        ) : (
          <p>Os dados estão rolando…</p>
        )}
      </div>
      <button
        ref={button}
        className="button primary"
        onClick={() => (settled ? onKeep() : setSettled(true))}
      >
        {settled ? 'Guardar resultado' : 'Revelar resultado'}
      </button>
    </dialog>
  );
}

export function AttributeDice({
  rolls,
  revealed,
  onReveal,
}: {
  rolls: number[][];
  revealed: number;
  onReveal: (count: number) => void;
}) {
  const [throwing, setThrowing] = useState(false);
  return (
    <>
      <div className="sheet-rolls" aria-label="Resultados dos atributos">
        {rolls.map((dice, i) => (
          <div key={i} className={i >= revealed ? 'roll-unrevealed' : ''}>
            <small>Resultado {i + 1}</small>
            <strong>
              {i < revealed ? dice.reduce((a, b) => a + b, 0) - Math.min(...dice) : '—'}
            </strong>
            {i < revealed ? (
              <span>
                {dice.map((v, j) => (
                  <i className={j === dice.indexOf(Math.min(...dice)) ? 'discarded' : ''} key={j}>
                    {v}
                  </i>
                ))}
              </span>
            ) : (
              <small>{i === revealed ? 'Sua próxima rolagem' : 'Aguardando'}</small>
            )}
          </div>
        ))}
      </div>
      {revealed < 6 ? (
        <div className="attribute-roll-action">
          <button className="button primary" disabled={throwing} onClick={() => setThrowing(true)}>
            <Dices size={19} /> Lançar dados · resultado {revealed + 1}
          </button>
          <p className="muted small">Revele os seis resultados para distribuir seus atributos.</p>
        </div>
      ) : (
        <button className="button outline" onClick={() => onReveal(0)}>
          Rever rolagens em 3D
        </button>
      )}
      {throwing &&
        revealed < 6 &&
        createPortal(
          <DiceThrow
            dice={rolls[revealed]}
            index={revealed}
            onKeep={() => {
              setThrowing(false);
              onReveal(revealed + 1);
            }}
          />,
          document.body,
        )}
    </>
  );
}

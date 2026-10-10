import { useEffect, useRef, useState } from 'react';
import { Star, X } from 'lucide-react';

export function ProfileRating({
  average,
  count,
  own,
  enabled,
  save,
}: {
  average: number;
  count: number;
  own: { score: number; comment: string } | null;
  enabled: boolean;
  save: (score: number, comment: string) => Promise<void>;
}) {
  const [score, setScore] = useState(own?.score || 0),
    [hover, setHover] = useState(0);
  const [reason, setReason] = useState(own?.comment || ''),
    [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setScore(own?.score || 0);
    setReason(own?.comment || '');
  }, [own?.score, own?.comment]);
  useEffect(() => {
    if (asking) field.current?.focus();
  }, [asking]);
  async function submit(value: number, comment: string) {
    if (!enabled || busy) return;
    if (value < 3 && !comment.trim()) {
      setError('Justifique a nota de uma ou duas estrelas.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await save(value, comment.trim());
      setScore(value);
      setAsking(false);
      setMessage('Avaliação salva.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar a avaliação.');
      setScore(own?.score || 0);
    } finally {
      setBusy(false);
    }
  }
  function choose(value: number) {
    if (!enabled || busy) return;
    setScore(value);
    setError('');
    setMessage('');
    if (value < 3) {
      setReason(own?.comment || '');
      setAsking(true);
    } else {
      setAsking(false);
      void submit(value, '');
    }
  }
  function cancel() {
    setAsking(false);
    setScore(own?.score || 0);
    setError('');
  }
  const displayed = hover || (enabled ? score : Math.round(average));
  return (
    <div
      className="profile-rating-corner"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && asking) {
          e.stopPropagation();
          cancel();
        }
      }}
    >
      <span className="profile-rating-callout">Avalie</span>
      <div
        className="profile-rating-stars"
        role="radiogroup"
        aria-label={enabled ? 'Sua avaliação do perfil' : 'Avaliação geral do perfil'}
        onPointerLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={score === n}
            aria-label={'Avaliar com ' + n + (n === 1 ? ' estrela' : ' estrelas')}
            title={
              enabled
                ? 'Avaliar com ' + n + (n === 1 ? ' estrela' : ' estrelas')
                : count
                  ? average.toFixed(1) + ' de 5 · ' + count + ' avaliações'
                  : 'Ainda sem avaliações'
            }
            className={n <= displayed ? 'filled' : ''}
            disabled={!enabled || busy}
            onPointerEnter={() => enabled && setHover(n)}
            onFocus={() => enabled && setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => choose(n)}
            onKeyDown={(e) => {
              if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault();
              const to =
                e.key === 'Home'
                  ? 1
                  : e.key === 'End'
                    ? 5
                    : Math.max(1, Math.min(5, n + (e.key === 'ArrowRight' ? 1 : -1)));
              e.currentTarget.parentElement
                ?.querySelector<HTMLButtonElement>('button:nth-child(' + to + ')')
                ?.focus();
            }}
          >
            <Star size={21} />
          </button>
        ))}
      </div>
      {count > 0 && (
        <span className="profile-rating-average" title="Avaliação geral do perfil">
          {average.toFixed(1) + ' · ' + count}
        </span>
      )}
      <span className="profile-panel-announcement" role="status">
        {message}
      </span>
      {error && !asking && (
        <p className="profile-rating-error" role="alert">
          {error}
        </p>
      )}
      {asking && (
        <form
          className="profile-rating-reason"
          aria-label="Justificar avaliação"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(score, reason);
          }}
        >
          <header>
            <strong>Justifique sua avaliação</strong>
            <button type="button" disabled={busy} aria-label="Cancelar avaliação" onClick={cancel}>
              <X size={16} />
            </button>
          </header>
          <p>Notas de uma ou duas estrelas precisam de um motivo. Seu nome não será exibido.</p>
          <label>
            Justificativa
            <textarea
              ref={field}
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="O que poderia melhorar neste perfil?"
            />
          </label>
          {error && (
            <p className="profile-rating-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy || !reason.trim()}>
            {busy ? 'Salvando…' : 'Salvar avaliação'}
          </button>
        </form>
      )}
    </div>
  );
}

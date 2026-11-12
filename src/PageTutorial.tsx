import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, X } from 'lucide-react';
import { api } from './api';
import { pageTutorials } from './page-tutorial-content';
import { launchLockedAreas, type MaintenanceArea } from '../shared/maintenance';
import type { Page } from './types';
import './page-tutorial.css';

// These tabs share illustrations with their parent area.
const tutorialIcons: Partial<Record<Page, string>> = {
  overview: 'guild',
  missions: 'board',
  hooks: 'board',
  titles: 'achievements',
};

export function PageTutorial({
  page,
  userId,
  ready,
}: {
  page: Page;
  userId: string;
  ready: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [skip, setSkip] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const viewed = useRef(new Set<string>());
  const submitting = useRef(false);
  const titleId = useId();
  const panelId = useId();
  const [iconFailed, setIconFailed] = useState(false);
  const tutorial = pageTutorials[page];
  useEffect(() => {
    let active = true;
    viewed.current.clear();
    setDismissed(null);
    api<{ dismissed: string[] }>('/tutorials')
      .then((result) => {
        if (active) setDismissed(result.dismissed);
      })
      .catch(() => {
        if (active) setDismissed([]);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  useEffect(() => {
    setStep(0);
    setIconFailed(false);
    setError('');
    setSkip(dismissed?.includes(page) ?? false);
    setOpen(
      Boolean(
        ready &&
        dismissed &&
        !dismissed.includes(page) &&
        !viewed.current.has(page) &&
        !launchLockedAreas.includes(page as MaintenanceArea),
      ),
    );
  }, [page, ready, dismissed]);
  async function finish() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      if (skip !== Boolean(dismissed?.includes(page))) {
        await api('/tutorials/' + page, {
          method: 'PUT',
          body: JSON.stringify({ dismissed: skip }),
        });
        setDismissed((current) =>
          skip
            ? [...(current ?? []).filter((value) => value !== page), page]
            : (current ?? []).filter((value) => value !== page),
        );
      }
      viewed.current.add(page);
      setOpen(false);
    } catch {
      setError('Não foi possível salvar sua escolha. Tente concluir o tutorial novamente.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!open || busy) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) void finish();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open, busy, skip, page, dismissed]);
  return (
    <>
      <button
        type="button"
        className="page-tutorial-trigger"
        aria-label="Como usar esta aba"
        title="Como usar esta aba"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setStep(0);
          setSkip(dismissed?.includes(page) ?? false);
          setError('');
          setOpen(true);
        }}
      >
        <CircleHelp size={21} aria-hidden="true" />
      </button>
      {open && (
        <aside id={panelId} className="page-tutorial" aria-labelledby={titleId}>
          <header className="tutorial-heading">
            <span className="tutorial-icon" aria-hidden="true">
              {iconFailed ? (
                <CircleHelp size={24} />
              ) : (
                <img
                  src={`/navigation/illustrated-20261020/${tutorialIcons[page] ?? page}.webp`}
                  alt=""
                  width={32}
                  height={32}
                  onError={() => setIconFailed(true)}
                />
              )}
            </span>
            <div>
              <span className="tutorial-label">Guia da aba</span>
              <h2 id={titleId}>{tutorial.title}</h2>
            </div>
            <button
              type="button"
              className="tutorial-close"
              aria-label="Fechar guia"
              disabled={busy}
              onClick={() => void finish()}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <section className="tutorial-explanation" aria-live="polite">
            <span className="tutorial-position">
              Passo {step + 1} de {tutorial.steps.length}
            </span>
            <h3>{tutorial.steps[step].title}</h3>
            <p>{tutorial.steps[step].text}</p>
          </section>
          <footer className="tutorial-footer">
            <ol className="tutorial-steps" aria-label="Passos do guia">
              {tutorial.steps.map((entry, index) => (
                <li key={entry.title}>
                  <button
                    type="button"
                    aria-current={index === step ? 'step' : undefined}
                    disabled={busy}
                    aria-label={`Passo ${index + 1}: ${entry.title}`}
                    title={entry.title}
                    onClick={() => setStep(index)}
                  >
                    <span aria-hidden="true">{index < step ? <Check size={16} /> : index + 1}</span>
                  </button>
                </li>
              ))}
            </ol>
            <label>
              <input
                type="checkbox"
                checked={skip}
                disabled={busy}
                onChange={(event) => setSkip(event.target.checked)}
              />{' '}
              Não mostrar novamente nesta aba
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="tutorial-actions">
              <button
                type="button"
                className="button outline"
                disabled={busy}
                onClick={() => (step ? setStep(step - 1) : void finish())}
              >
                {step ? (
                  <>
                    <ArrowLeft size={15} /> Anterior
                  </>
                ) : (
                  'Agora não'
                )}
              </button>
              <button
                type="button"
                className="button primary"
                disabled={busy}
                onClick={() =>
                  step + 1 < tutorial.steps.length ? setStep(step + 1) : void finish()
                }
              >
                {step + 1 < tutorial.steps.length ? (
                  <>
                    Próximo <ArrowRight size={15} />
                  </>
                ) : (
                  <>
                    <Check size={15} /> Concluir
                  </>
                )}
              </button>
            </div>
          </footer>
        </aside>
      )}
    </>
  );
}

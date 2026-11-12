import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, X } from 'lucide-react';
import { pageTutorials } from './page-tutorial-content';
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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [iconFailed, setIconFailed] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelId = useId();
  const tutorial = pageTutorials[page];

  // Help is opt-in: entering a tab never opens a guide over the page.
  useEffect(() => {
    setOpen(false);
    setStep(0);
    setIconFailed(false);
  }, [page, userId, ready]);

  function close() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) close();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="page-tutorial-trigger"
        aria-label="Como usar esta aba"
        title="Como usar esta aba"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        disabled={!ready}
        onClick={() => {
          if (open) close();
          else {
            setStep(0);
            setOpen(true);
          }
        }}
      >
        <CircleHelp size={18} aria-hidden="true" />
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
                  width={28}
                  height={28}
                  onError={() => setIconFailed(true)}
                />
              )}
            </span>
            <div>
              <span className="tutorial-label">Ajuda rápida</span>
              <h2 id={titleId}>{tutorial.title}</h2>
            </div>
            <button
              type="button"
              className="tutorial-close"
              aria-label="Fechar guia"
              onClick={close}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </header>
          <section className="tutorial-explanation" aria-live="polite">
            <span className="tutorial-position">
              Dica {step + 1} de {tutorial.steps.length}
            </span>
            <h3>{tutorial.steps[step].title}</h3>
            <p>{tutorial.steps[step].text}</p>
          </section>
          <footer className="tutorial-actions">
            <button
              type="button"
              className="button outline"
              onClick={() => (step ? setStep(step - 1) : close())}
            >
              {step ? (
                <>
                  <ArrowLeft size={14} /> Anterior
                </>
              ) : (
                'Fechar'
              )}
            </button>
            <button
              type="button"
              className="button primary"
              onClick={() => (step + 1 < tutorial.steps.length ? setStep(step + 1) : close())}
            >
              {step + 1 < tutorial.steps.length ? (
                <>
                  Próxima <ArrowRight size={14} />
                </>
              ) : (
                <>
                  <Check size={14} /> Entendi
                </>
              )}
            </button>
          </footer>
        </aside>
      )}
    </>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp, X } from 'lucide-react';
import { api } from './api';
import { pageTutorials } from './page-tutorial-content';
import type { Page } from './types';
import './page-tutorial.css';

// These tabs share illustrations with their parent area.
const tutorialIcons: Partial<Record<Page, string>> = {
  overview: 'guild',
  missions: 'board',
  hooks: 'board',
  titles: 'achievements',
  professions: 'inventory',
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
  const [progress, setProgress] = useState({ page, index: 0 });
  const step = progress.page === page ? progress.index : 0;
  const setStep = (index: number) => setProgress({ page, index });
  const [iconFailed, setIconFailed] = useState(false);
  const [preferences, setPreferences] = useState<{ userId: string; dismissed: string[] } | null>(
    null,
  );
  const [pendingPreference, setPendingPreference] = useState<{
    userId: string;
    page: Page;
    dismissed: boolean;
  } | null>(null);
  const busy = pendingPreference !== null;
  const [preferenceError, setPreferenceError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [retry, setRetry] = useState(0);
  const automaticEntry = useRef(false);
  const current = useRef({ page, userId });
  current.current = { page, userId };
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const panelId = useId();
  const tutorial = pageTutorials[page];

  const loaded = preferences?.userId === userId;
  const dismissed = loaded && preferences.dismissed.includes(page);

  useEffect(() => {
    let active = true;
    setPreferences(null);
    setPreferenceError('');
    api<{ dismissed: string[] }>('/tutorials')
      .then((result) => {
        if (active) setPreferences({ userId, dismissed: result.dismissed });
      })
      .catch(() => {
        if (active) setPreferenceError('Não foi possível consultar sua preferência.');
      });
    return () => {
      active = false;
    };
  }, [userId, retry]);

  useEffect(() => {
    automaticEntry.current = false;
    setOpen(false);
    setStep(0);
    setIconFailed(false);
    setSaveError('');
  }, [page, userId]);

  useEffect(() => {
    if (!ready || !loaded || automaticEntry.current) return;
    automaticEntry.current = true;
    setOpen(!dismissed);
  }, [page, userId, ready, loaded, dismissed]);

  async function savePreference(skip: boolean) {
    if (busy || !loaded) return;
    setPendingPreference({ userId, page, dismissed: skip });
    setSaveError('');
    try {
      await api('/tutorials/' + page, {
        method: 'PUT',
        body: JSON.stringify({ dismissed: skip }),
      });
      setPreferences((value) =>
        value?.userId === userId
          ? {
              userId,
              dismissed: skip
                ? [...value.dismissed.filter((name) => name !== page), page]
                : value.dismissed.filter((name) => name !== page),
            }
          : value,
      );
    } catch {
      if (current.current.userId === userId && current.current.page === page)
        setSaveError('Não foi possível salvar sua escolha. Tente novamente.');
    } finally {
      setPendingPreference(null);
    }
  }

  function close() {
    automaticEntry.current = true;
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
          automaticEntry.current = true;
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
              <span className="tutorial-label">Como usar esta aba</span>
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
              Passo {step + 1} de {tutorial.steps.length}
            </span>
            <h3>{tutorial.steps[step].title}</h3>
            <p>{tutorial.steps[step].text}</p>
          </section>
          <footer>
            <label
              className="tutorial-preference"
              title="Vale somente para esta aba. Reabra pelo botão de ajuda quando precisar."
            >
              <input
                type="checkbox"
                aria-label="Não mostrar automaticamente nesta aba"
                checked={
                  pendingPreference?.userId === userId && pendingPreference.page === page
                    ? pendingPreference.dismissed
                    : dismissed
                }
                disabled={busy || !loaded}
                onChange={(event) => void savePreference(event.target.checked)}
              />
              Não abrir automaticamente
            </label>
            {busy && (
              <p className="tutorial-preference-hint" role="status">
                Salvando preferência…
              </p>
            )}
            {preferenceError && (
              <p className="tutorial-error" role="alert">
                {preferenceError}{' '}
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRetry((value) => value + 1)}
                >
                  Tentar novamente
                </button>
              </p>
            )}
            {saveError && (
              <p className="tutorial-error" role="alert">
                {saveError}
              </p>
            )}
            <div className="tutorial-actions">
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
            </div>
          </footer>
        </aside>
      )}
    </>
  );
}

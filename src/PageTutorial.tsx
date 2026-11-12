import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleHelp } from 'lucide-react';
import { Modal } from './components';
import { api } from './api';
import { pageTutorials } from './page-tutorial-content';
import { primaryPageAssets } from './page-assets';
import { launchLockedAreas, type MaintenanceArea } from '../shared/maintenance';
import type { Page } from './types';
import './page-tutorial.css';

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
  const art = primaryPageAssets[page]?.[0];
  return (
    <>
      <button
        type="button"
        className="page-tutorial-trigger"
        aria-label="Como usar esta aba"
        title="Como usar esta aba"
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
        <Modal
          title={tutorial.title}
          className="page-tutorial"
          close={() => {
            if (!busy) void finish();
          }}
        >
          <div className="tutorial-banner">
            {art && <img src={art} alt="" />}
            <span>Guia da aba</span>
            <p>{tutorial.description}</p>
          </div>
          <div className="tutorial-content">
            <ol className="tutorial-steps" aria-label="Passos do tutorial">
              {tutorial.steps.map((entry, index) => (
                <li key={entry.title}>
                  <button
                    type="button"
                    aria-current={index === step ? 'step' : undefined}
                    disabled={busy}
                    onClick={() => setStep(index)}
                  >
                    <span aria-hidden="true">{index < step ? <Check size={16} /> : index + 1}</span>
                    {entry.title}
                  </button>
                </li>
              ))}
            </ol>
            <section className="tutorial-explanation" aria-live="polite">
              <img
                className="tutorial-page-icon"
                src={`/navigation/illustrated-20261020/${page}.webp`}
                alt=""
              />
              <span className="tutorial-position">
                Passo {step + 1} de {tutorial.steps.length}
              </span>
              <h3>{tutorial.steps[step].title}</h3>
              <p>{tutorial.steps[step].text}</p>
            </section>
          </div>
          <div className="tutorial-footer">
            <label>
              <input
                type="checkbox"
                checked={skip}
                disabled={busy}
                onChange={(event) => setSkip(event.target.checked)}
              />{' '}
              Não mostrar novamente nesta aba
            </label>
            <small>Reabra este guia pelo botão de ajuda quando precisar.</small>
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
          </div>
        </Modal>
      )}
    </>
  );
}

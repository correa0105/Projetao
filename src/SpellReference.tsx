import { useEffect, useRef, useState } from 'react';
import { api } from './api';

type Reference = {
  label: string;
  level: number;
  school: string;
  time: string;
  range: string;
  duration: string;
  components: string;
  materialCost: number;
  materialConsumed: boolean;
  ritual: boolean;
  concentration: boolean;
  source: string;
  page: number;
  description: string;
  summary: boolean;
  srd?: boolean;
};
const loaded = new Map<string, Reference>();
export function SpellReference({
  id,
  label,
  close,
}: {
  id: string;
  label: string;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Reference | undefined>(loaded.get(id));
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let active = true;
    setError('');
    setData(loaded.get(id));
    if (!loaded.has(id))
      api<Reference>('/spell-reference/' + encodeURIComponent(id))
        .then((value) => {
          loaded.set(id, value);
          if (active) setData(value);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return (
    <dialog
      ref={ref}
      className="spell-reference-dialog"
      aria-label={'Consultar ' + label}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2>{label}</h2>
          <button type="button" onClick={close} aria-label="Fechar consulta de magia">
            Fechar
          </button>
        </div>
        {!data && !error && <p role="status">Carregando magia em português…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setAttempt((a) => a + 1)}>
              Tentar novamente
            </button>
          </div>
        )}
        {data && (
          <>
            <p>
              {data.level === 0 ? 'Truque' : `${data.level}º círculo`} · {data.school}
              {data.ritual ? ' · Ritual' : ''}
              {data.concentration ? ' · Concentração' : ''}
            </p>
            <dl className="spell-reference-facts">
              {[
                ['Conjuração', data.time],
                ['Alcance', data.range],
                ['Duração', data.duration],
                ['Componentes', data.components],
                ...(data.materialCost
                  ? [
                      [
                        'Custo do material',
                        `${data.materialCost / 100} PO${data.materialConsumed ? ' · consumido' : ''}`,
                      ],
                    ]
                  : []),
              ].map(([name, value]) => (
                <div key={name}>
                  <dt>{name}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {data.summary && (
              <p className="spell-reference-source">
                Resumo para consulta. A regra completa está na fonte indicada.
              </p>
            )}
            <div className="spell-reference-description">
              {data.description.split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <p className="spell-reference-source">
              Fonte: {data.source}, p. {data.page}. Regras de 2024.
            </p>
            {!data.summary && data.srd !== false && (
              <p className="spell-reference-source">
                Tradução do SRD 5.2.1, Wizards of the Coast LLC, sob{' '}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                .{' '}
                <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">
                  Texto original
                </a>
                .
              </p>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

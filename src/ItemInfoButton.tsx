import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api } from './api';
import './item-info.css';

type InfoItem = { id: string; name: string; description: string; category?: string };
type ItemRules = {
  title: string;
  description: string;
  descriptionPortuguese?: string;
  source_name: string;
  source_url: string;
  reference_url: string;
  edition?: string;
  project_content?: boolean;
};
function externalLink(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function ItemInfoButton({
  item,
  familyName,
}: {
  item?: InfoItem | null;
  familyName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<ItemRules | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const heading = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
  }, [open]);
  useEffect(() => {
    setRules(null);
    setFailed(false);
    if (!open || !item) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void api<ItemRules>(`/catalog/${encodeURIComponent(item.id)}/rules`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setRules(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, item?.id]);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }
  const sourceUrl = externalLink(rules?.source_url);
  const referenceUrl = externalLink(rules?.reference_url);
  const referenceLabel =
    referenceUrl && ['5e.tools', 'www.5e.tools'].includes(new URL(referenceUrl).hostname)
      ? 'Consultar no 5etools'
      : 'Consultar a referência';
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="item-info-button"
        aria-label="O que este item faz?"
        title="O que este item faz?"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden="true">?</span>
      </button>
      {open &&
        createPortal(
          <dialog
            className="item-info-dialog"
            ref={dialog}
            aria-labelledby={heading}
            onCancel={(event) => {
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                event.stopPropagation();
                close();
              }
            }}
          >
            <div className="dialog-inner">
              <div className="dialog-head">
                <h2 id={heading}>
                  {rules?.title || item?.name || familyName || 'Sobre este item'}
                </h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Fechar explicação"
                  onClick={close}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="item-info-content" aria-busy={loading}>
                {loading ? (
                  <p role="status">Consultando a descrição do item…</p>
                ) : !item ? (
                  <p>Escolha o tipo e a variante para ver as regras específicas deste item.</p>
                ) : (
                  <>
                    <p className="item-info-description">
                      {rules?.description || rules?.descriptionPortuguese || item.description}
                    </p>
                    {rules?.project_content && (
                      <p className="item-info-source">
                        Conteúdo do projeto. As funções descritas valem neste aplicativo.
                      </p>
                    )}
                    {failed && (
                      <p className="item-info-source" role="status">
                        Mostrando a descrição do catálogo; a referência de regras está indisponível
                        agora.
                      </p>
                    )}
                    {rules?.source_name && (
                      <p className="item-info-source">
                        Fonte: {rules.source_name}
                        {rules.edition ? ` · ${rules.edition}` : ''}.
                      </p>
                    )}
                    {(referenceUrl || sourceUrl) && (
                      <div className="item-info-links">
                        {referenceUrl && (
                          <a href={referenceUrl} target="_blank" rel="noopener noreferrer">
                            {referenceLabel}
                          </a>
                        )}
                        {sourceUrl && sourceUrl !== referenceUrl && (
                          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                            Consultar a fonte
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

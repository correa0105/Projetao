import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, ChevronRight } from 'lucide-react';
import { ScenePanel } from './ScenePanel';
import { accountPreviewKey, readAccountPreview } from './account-preview';
import type { User } from './types';
import './account-preview.css';

export function AccountPreview({
  user,
  children,
}: {
  user: User;
  children: (user: User, preview: boolean) => ReactNode;
}) {
  const [administrator, setAdministrator] = useState(false);
  const [account, setAccount] = useState(user);
  const [preview, setPreview] = useState(() => {
    const saved = readAccountPreview();
    if (saved?.userId !== user.id) {
      sessionStorage.removeItem(accountPreviewKey);
      return false;
    }
    return saved.active;
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    void fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => {
        if (!alive || !me) return;
        setAccount(me);
        setAdministrator(me.administrador === 1);
        if (me.administrador !== 1) {
          sessionStorage.removeItem(accountPreviewKey);
          setPreview(false);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user.id]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const check = () =>
      setEditing(
        !!document.querySelector(
          'dialog[open],.lore-library.is-editing,.rb-editor-bar,.h2-save-bar,.house-unsaved,.guild-draft-dot,.event-editor',
        ),
      );
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'open'],
    });
    return () => observer.disconnect();
  }, [open]);
  const active = !!preview;
  const displayed = active
    ? {
        ...account,
        administrador: 0 as const,
        role: 'player' as const,
        gold_unlimited: false,
        canEditKingdom: false,
      }
    : account;
  return (
    <>
      {children(displayed, active)}
      {administrator && (
        <div className="account-preview" ref={root} data-preview={active || undefined}>
          <button
            className="account-preview-trigger"
            aria-label="Menu de visualização da conta"
            aria-expanded={open}
            aria-controls="scene-panel-account-preview"
            onClick={() => setOpen((v) => !v)}
            title={active ? 'Prévia de conta básica' : 'Visualização de administrador'}
          >
            <Eye size={17} />
            <span>{active ? 'Conta básica' : 'Visualização'}</span>
            <ChevronRight size={14} />
          </button>
          {open && (
            <ScenePanel
              id="account-preview"
              title="Visualização da conta"
              close={() => setOpen(false)}
            >
              <div className="account-preview-options">
                <span className="account-preview-label">
                  {active ? 'CONTA BÁSICA' : 'ADMINISTRADOR'}
                </span>
                <p>
                  {active
                    ? 'Prévia de consulta: conteúdo e controles disponíveis para uma conta básica.'
                    : 'Confira cada página sem os privilégios administrativos. Seus personagens e propriedades continuam sendo os seus.'}
                </p>
                {editing && (
                  <p>
                    Feche a edição e salve ou descarte as alterações antes de trocar a visualização.
                  </p>
                )}
                <button
                  aria-pressed={active}
                  disabled={editing}
                  onClick={() => {
                    const next = !active;
                    sessionStorage.setItem(
                      accountPreviewKey,
                      JSON.stringify({ userId: user.id, active: next }),
                    );
                    setPreview(next);
                    setOpen(false);
                  }}
                >
                  <Eye size={15} />
                  {active ? 'Voltar à visão de administrador' : 'Ver como conta básica'}
                </button>
              </div>
            </ScenePanel>
          )}
        </div>
      )}
    </>
  );
}

import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  BookOpen,
  ChevronUp,
  Footprints,
  Heart,
  Minus,
  Settings2,
  Shield,
  Tags,
  X,
} from 'lucide-react';
import type { VttToken } from '../shared/vtt';
import type { VttCamera } from './vtt-canvas';
import './vtt-token-menu.css';

type Pane = 'settings' | 'conditions' | 'hp' | 'ac' | 'speed';
export const VttTokenMenu = forwardRef<
  HTMLDivElement,
  {
    token: VttToken;
    board: RefObject<HTMLCanvasElement | null>;
    camera: VttCamera;
    layoutKey: string;
    gm: boolean;
    busy: boolean;
    speed: string;
    hp: ReactNode;
    conditions: ReactNode;
    children: ReactNode;
    close: () => void;
    openSheet: () => void;
    completeSettings: () => void;
    edit: (patch: Partial<VttToken>) => void;
  }
>(function VttTokenMenu(
  {
    token,
    board,
    camera,
    layoutKey,
    gm,
    busy,
    speed,
    hp,
    conditions,
    children,
    close,
    openSheet,
    completeSettings,
    edit,
  },
  ref,
) {
  const [pane, setPane] = useState<Pane | null>(null),
    [minimized, setMinimized] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({
    x: 80,
    above: 12,
    below: 100,
    panelX: 180,
    panelY: 12,
    panelHeight: 400,
  });
  useLayoutEffect(() => {
    const measure = () => {
      const rect = board.current?.getBoundingClientRect();
      if (!rect) return;
      const angle = (token.rotation * Math.PI) / 180;
      const w =
        (Math.abs(Math.cos(angle)) * token.width + Math.abs(Math.sin(angle)) * token.height) *
        camera.zoom;
      const h =
        (Math.abs(Math.sin(angle)) * token.width + Math.abs(Math.cos(angle)) * token.height) *
        camera.zoom;
      const x = rect.left + rect.width / 2 + (token.x - camera.x) * camera.zoom;
      const y = rect.top + rect.height / 2 + (token.y - camera.y) * camera.zoom;
      const left = Math.max(8, rect.left + 8),
        right = Math.min(innerWidth - 8, rect.right - 8);
      const top = Math.max(8, rect.top + 8),
        bottom = Math.min(innerHeight - 8, rect.bottom - 8);
      const width = Math.min(320, innerWidth - 16);
      const center = Math.max(left + 108, Math.min(right - 108, x));
      const above = Math.max(top, Math.min(bottom - 66, y - h / 2 - 74));
      const below = Math.max(above + 70, Math.min(bottom - 48, y + h / 2 + 12));
      const toRight = x + Math.max(w / 2, 118) + 18,
        toLeft = x - Math.max(w / 2, 118) - width - 18;
      const side = toRight + width <= right || toLeft >= left;
      const panelX = Math.max(
        8,
        Math.min(
          innerWidth - width - 8,
          toRight + width <= right ? toRight : toLeft >= left ? toLeft : center - width / 2,
        ),
      );
      const preferredY = side ? above : below + 58;
      const panelY = Math.max(
        8,
        Math.min(preferredY, innerHeight - Math.min(340, innerHeight - 16) - 8),
      );
      setPosition({
        x: center,
        above,
        below,
        panelX,
        panelY,
        panelHeight: innerHeight - panelY - 8,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (board.current) observer.observe(board.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [
    board,
    camera.x,
    camera.y,
    camera.zoom,
    token.x,
    token.y,
    token.width,
    token.height,
    token.rotation,
    layoutKey,
  ]);
  function toggle(next: Pane, button: HTMLButtonElement) {
    trigger.current = button;
    setPane((p) => (p === next ? null : next));
  }
  function collapse() {
    setPane(null);
    setMinimized(true);
  }
  function dismissPane() {
    setPane(null);
    trigger.current?.focus();
  }
  const speedValue = speed.match(/\d+(?:[.,]\d+)?/)?.[0] || '—';
  const colors = ['#bc6060', '#648bad', '#7d8c60', '#b98b4c', '#9574b3', '#bb80a8', '#c9bf8b'];
  const titles: Record<Pane, string> = {
    settings: 'Configurações do token',
    conditions: 'Condições',
    hp: 'Pontos de vida',
    ac: 'Classe de armadura',
    speed: 'Deslocamento',
  };
  return (
    <div
      ref={ref}
      className="vtt-token-hud"
      data-token-id={token.id}
      data-minimized={minimized}
      onKeyDownCapture={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (pane) dismissPane();
          else close();
        }
      }}
    >
      {!minimized && (
        <>
          <div
            className="vtt-token-bubbles"
            role="group"
            aria-label="Valores do token"
            style={{ left: position.x, top: position.above }}
          >
            <button
              className="vtt-token-bubble hp"
              title={'Pontos de vida: ' + token.hp + '/' + token.maxHp}
              aria-label={'Pontos de vida: ' + token.hp + '/' + token.maxHp}
              aria-expanded={pane === 'hp'}
              onClick={(e) => toggle('hp', e.currentTarget)}
            >
              <strong>{token.hp}</strong>
              <span>PV</span>
            </button>
            <button
              className="vtt-token-bubble ac"
              title={'Classe de armadura: ' + token.ac}
              aria-label={'Classe de armadura: ' + token.ac}
              aria-expanded={pane === 'ac'}
              onClick={(e) => toggle('ac', e.currentTarget)}
            >
              <strong>{token.ac}</strong>
              <span>CA</span>
            </button>
            <button
              className="vtt-token-bubble speed"
              title={'Deslocamento: ' + speed}
              aria-label={'Deslocamento: ' + speed}
              aria-expanded={pane === 'speed'}
              onClick={(e) => toggle('speed', e.currentTarget)}
            >
              <strong>{speedValue}</strong>
              <span>ft</span>
            </button>
          </div>
          <div
            className="vtt-token-actions"
            role="group"
            aria-label="Ações do token"
            style={{ left: position.x, top: position.below }}
          >
            <button
              title="Configurações do token"
              aria-label="Configurações do token"
              aria-expanded={pane === 'settings'}
              onClick={(e) => toggle('settings', e.currentTarget)}
            >
              <Settings2 size={21} />
            </button>
            {token.layer === 'tokens' && (
              <button
                title="Condições"
                aria-label="Condições do token"
                aria-expanded={pane === 'conditions'}
                onClick={(e) => toggle('conditions', e.currentTarget)}
              >
                <Tags size={21} />
                {token.conditions.length > 0 && <b>{token.conditions.length}</b>}
              </button>
            )}
            <button title="Abrir ficha" aria-label="Abrir ficha" onClick={openSheet}>
              <BookOpen size={20} />
            </button>
            <button
              title="Minimizar menu do token"
              aria-label="Minimizar menu do token"
              onClick={collapse}
            >
              <Minus size={20} />
            </button>
            <button title="Fechar menu do token" aria-label="Fechar menu do token" onClick={close}>
              <X size={18} />
            </button>
          </div>
        </>
      )}
      {minimized && (
        <div className="vtt-token-minimized" style={{ left: position.x, top: position.below }}>
          <button aria-label={'Mostrar menu de ' + token.name} onClick={() => setMinimized(false)}>
            <ChevronUp size={16} />
            <span>{token.name}</span>
          </button>
          <button aria-label="Fechar menu do token" onClick={close}>
            <X size={15} />
          </button>
        </div>
      )}
      {pane && !minimized && (
        <div
          className="vtt-context-menu vtt-token-popover"
          role="dialog"
          aria-label={titles[pane]}
          style={{ left: position.panelX, top: position.panelY, maxHeight: position.panelHeight }}
        >
          <header>
            <span>
              {token.name}
              <small>{titles[pane]}</small>
            </span>
            <button aria-label="Fechar painel do token" onClick={dismissPane}>
              <X size={15} />
            </button>
          </header>
          {pane === 'settings' && (
            <>
              {children}
              <button className="vtt-token-complete-settings" onClick={completeSettings}>
                <Settings2 size={15} />
                Configurações completas
              </button>
            </>
          )}
          {pane === 'hp' &&
            (gm ? (
              hp
            ) : (
              <p className="vtt-token-value">
                <Heart size={18} /> {token.hp} / {token.maxHp} PV
              </p>
            ))}
          {pane === 'ac' && (
            <>
              <p className="vtt-token-value">
                <Shield size={20} />
                {token.ac} CA
              </p>
              {gm && <button onClick={completeSettings}>Editar classe de armadura</button>}
            </>
          )}
          {pane === 'speed' && (
            <p className="vtt-token-value">
              <Footprints size={20} />
              {speed}
            </p>
          )}
          {pane === 'conditions' && (
            <>
              {gm && (
                <div className="vtt-token-color-palette" role="group" aria-label="Cor do token">
                  {colors.map((color, i) => (
                    <button
                      key={color}
                      style={{ background: color }}
                      disabled={busy}
                      title={
                        'Cor do token: ' +
                        ['Vermelho', 'Azul', 'Musgo', 'Cobre', 'Violeta', 'Rosa', 'Pergaminho'][i]
                      }
                      aria-label={
                        'Cor do token: ' +
                        ['Vermelho', 'Azul', 'Musgo', 'Cobre', 'Violeta', 'Rosa', 'Pergaminho'][i]
                      }
                      aria-pressed={token.color.toLowerCase() === color}
                      onClick={() => edit({ color })}
                    />
                  ))}
                  <button
                    className="vtt-token-clear-conditions"
                    title="Remover todas as condições"
                    aria-label="Remover todas as condições"
                    disabled={busy || !token.conditions.length}
                    onClick={() => edit({ conditions: [] })}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
              {conditions}
            </>
          )}
        </div>
      )}
    </div>
  );
});

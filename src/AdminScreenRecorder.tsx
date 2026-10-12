import { useEffect, useRef, useState } from 'react';
import { Download, Monitor, Pause, Play, Square, Video, X } from 'lucide-react';
import { api } from './api';
import './admin-screen-recorder.css';

type State = 'ready' | 'selecting' | 'recording' | 'paused' | 'finishing' | 'saved';
type Clip = { url: string; filename: string; size: number };
const clock = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
};
const sizeLabel = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const stopTracks = (stream?: MediaStream) => stream?.getTracks().forEach((track) => track.stop());

export function AdminScreenRecorder({
  administrator,
  open,
  vtt,
  onOpen,
  onClose,
  onPermissionLost,
}: {
  administrator: boolean;
  open: boolean;
  vtt: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPermissionLost: () => void;
}) {
  const [state, setState] = useState<State>('ready');
  const [audio, setAudio] = useState(true);
  const [hasAudio, setHasAudio] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bytes, setBytes] = useState(0);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [clip, setClip] = useState<Clip>();
  const recorder = useRef<MediaRecorder | undefined>(undefined);
  const stream = useRef<MediaStream | undefined>(undefined);
  const preview = useRef<HTMLVideoElement>(null);
  const chunks = useRef<Blob[]>([]);
  const totalBytes = useRef(0);
  const activeTime = useRef(0);
  const started = useRef<number | undefined>(undefined);
  const mounted = useRef(true);
  const selecting = useRef(false);
  const resultUrl = useRef<string | undefined>(undefined);
  const startButton = useRef<HTMLButtonElement>(null);
  const live = state === 'recording' || state === 'paused';
  const supported =
    typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia;

  function markTime() {
    if (started.current !== undefined) activeTime.current += performance.now() - started.current;
    started.current = undefined;
    setElapsed(activeTime.current);
  }
  function finish() {
    const current = recorder.current;
    if (!current || current.state === 'inactive') return;
    markTime();
    setState('finishing');
    current.stop();
  }
  function pause() {
    const current = recorder.current;
    if (current?.state === 'recording') {
      current.pause();
      markTime();
      setState('paused');
    } else if (current?.state === 'paused') {
      current.resume();
      started.current = performance.now();
      setState('recording');
    }
  }
  useEffect(() => {
    if (open) startButton.current?.focus();
  }, [open]);
  useEffect(() => {
    if (preview.current && stream.current && live) {
      preview.current.srcObject = stream.current;
      void preview.current.play().catch(() => {});
    }
  }, [open, live]);
  useEffect(() => {
    if (state !== 'recording') return;
    const timer = window.setInterval(
      () =>
        setElapsed(
          activeTime.current +
            (started.current === undefined ? 0 : performance.now() - started.current),
        ),
      250,
    );
    return () => window.clearInterval(timer);
  }, [state]);
  useEffect(() => {
    if (!live) return;
    let checking = false,
      disposed = false;
    const check = async () => {
      if (checking || disposed) return;
      checking = true;
      try {
        const me = await api<{ administrador: number }>('/me');
        if (!disposed && me.administrador !== 1) {
          setError('A permissão de administrador foi removida. A gravação foi finalizada.');
          finish();
          onPermissionLost();
          onOpen();
        }
      } catch {
        if (!disposed) {
          setError('A sessão não pôde ser confirmada. A gravação foi finalizada.');
          finish();
          onOpen();
        }
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => void check(), 10000);
    const focus = () => void check();
    window.addEventListener('focus', focus);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [live, onPermissionLost, onOpen]);
  useEffect(() => {
    if (!administrator && live) finish();
  }, [administrator, live]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current) {
        recorder.current.ondataavailable = null;
        recorder.current.onstop = null;
        if (recorder.current.state !== 'inactive') recorder.current.stop();
      }
      stopTracks(stream.current);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
    };
  }, []);
  useEffect(() => {
    if (!live) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', leave);
    return () => window.removeEventListener('beforeunload', leave);
  }, [live]);

  async function start() {
    if (!administrator || !supported || selecting.current || live || state === 'finishing') return;
    selecting.current = true;
    setState('selecting');
    setError('');
    let captured: MediaStream | undefined;
    try {
      // The picker must start directly in the click handler, before awaiting the server.
      const capture = navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio,
      });
      const [picked, permission] = await Promise.allSettled([
        capture,
        api<{ administrador: number }>('/me'),
      ]);
      if (picked.status === 'fulfilled') captured = picked.value;
      if (permission.status === 'rejected')
        throw Error('Não foi possível confirmar sua sessão de administrador.');
      if (permission.value.administrador !== 1) {
        onPermissionLost();
        throw Error('Somente administradores podem usar este painel.');
      }
      if (picked.status === 'rejected') throw picked.reason;
      if (!mounted.current) {
        stopTracks(captured);
        return;
      }
      if (!captured?.getVideoTracks().some((track) => track.readyState === 'live'))
        throw Error('A tela selecionada deixou de estar disponível.');
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(captured, {
        ...(mimeType ? { mimeType } : {}),
        videoBitsPerSecond: 4_000_000,
      });
      chunks.current = [];
      totalBytes.current = 0;
      activeTime.current = 0;
      setBytes(0);
      setElapsed(0);
      stream.current = captured;
      recorder.current = next;
      setHasAudio(captured.getAudioTracks().length > 0);
      setSource(captured.getVideoTracks()[0].label || 'Tela compartilhada');
      next.ondataavailable = (event) => {
        if (!event.data.size) return;
        chunks.current.push(event.data);
        totalBytes.current += event.data.size;
        if (mounted.current) setBytes(totalBytes.current);
      };
      next.onerror = () => {
        if (mounted.current) {
          setError('A captura foi interrompida. Baixe o trecho que foi gravado.');
          finish();
          onOpen();
        }
      };
      next.onstop = () => {
        stopTracks(captured);
        stream.current = undefined;
        started.current = undefined;
        const blob = new Blob(chunks.current, { type: next.mimeType || 'video/webm' });
        chunks.current = [];
        recorder.current = undefined;
        if (!mounted.current) return;
        if (preview.current) preview.current.srcObject = null;
        if (!blob.size) {
          setState('ready');
          setError('Nenhum vídeo foi produzido. Inicie uma nova gravação.');
          return;
        }
        const url = URL.createObjectURL(blob);
        resultUrl.current = url;
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        setClip({
          url,
          size: blob.size,
          filename: `alvorada-cinzenta-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`,
        });
        setBytes(blob.size);
        setState('saved');
        onOpen();
      };
      captured.getVideoTracks()[0].addEventListener(
        'ended',
        () => {
          finish();
          onOpen();
        },
        { once: true },
      );
      next.start(1000);
      if (resultUrl.current) URL.revokeObjectURL(resultUrl.current);
      resultUrl.current = undefined;
      setClip(undefined);
      started.current = performance.now();
      setState('recording');
    } catch (failure) {
      stopTracks(captured);
      if (mounted.current) {
        setState(clip ? 'saved' : 'ready');
        setError(
          failure instanceof DOMException && failure.name === 'NotAllowedError'
            ? 'Compartilhamento cancelado. Escolha uma tela para tentar novamente.'
            : (failure as Error).message || 'Não foi possível iniciar a gravação.',
        );
      }
    } finally {
      selecting.current = false;
    }
  }

  if (!administrator && !live && !clip && !open) return null;
  return (
    <>
      {!open && (live || clip || (administrator && vtt)) && (
        <div className="admin-recorder-dock" aria-label="Controles de gravação">
          <button type="button" onClick={onOpen} aria-label="Abrir painel de gravação">
            <Video size={16} />
            {live ? (
              <>
                <span className="admin-recording-dot" data-paused={state === 'paused'} />
                {clock(elapsed)}
              </>
            ) : clip ? (
              'Vídeo pronto'
            ) : (
              'Gravar tela'
            )}
          </button>
          {live && (
            <button type="button" onClick={finish} aria-label="Finalizar gravação">
              <Square size={14} />
            </button>
          )}
        </div>
      )}
      {open && (
        <section
          className="admin-recorder"
          role="dialog"
          aria-labelledby="admin-recorder-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onClose();
            }
          }}
        >
          <header>
            <div>
              <span className="eyebrow">PAINEL DO ADMINISTRADOR</span>
              <h2 id="admin-recorder-title">
                <Video size={19} />
                Gravação de tela
              </h2>
            </div>
            <button
              type="button"
              className="admin-recorder-close"
              aria-label="Minimizar painel de gravação"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </header>
          <div className="admin-recorder-preview">
            {live ? (
              <video
                ref={preview}
                muted
                autoPlay
                playsInline
                aria-label="Prévia da tela compartilhada"
              />
            ) : clip ? (
              <video
                src={clip.url}
                controls
                playsInline
                preload="metadata"
                aria-label="Vídeo gravado"
              />
            ) : (
              <div>
                <Monitor size={32} />
                <span>Escolha uma aba, janela ou tela.</span>
              </div>
            )}
          </div>
          <div className="admin-recorder-status" role="status">
            <span>
              {state === 'recording'
                ? 'Gravando'
                : state === 'paused'
                  ? 'Pausada'
                  : state === 'selecting'
                    ? 'Escolhendo tela…'
                    : state === 'finishing'
                      ? 'Finalizando…'
                      : clip
                        ? 'Vídeo pronto para baixar'
                        : 'Pronto para gravar'}
            </span>
            <strong>{clock(elapsed)}</strong>
            <small>{sizeLabel(bytes)}</small>
          </div>
          {live && (
            <p className="admin-recorder-source">
              {source}
              <small>{hasAudio ? 'Com áudio compartilhado' : 'Sem áudio compartilhado'}</small>
            </p>
          )}
          {!live && state !== 'finishing' && (
            <label className="admin-recorder-audio">
              <input
                type="checkbox"
                checked={audio}
                disabled={state === 'selecting'}
                onChange={(event) => setAudio(event.target.checked)}
              />
              Solicitar áudio da aba ou sistema
            </label>
          )}
          {!live && !clip && (
            <p className="admin-recorder-help">
              Para capturar outras janelas, escolha Tela inteira no seletor do navegador. Marque
              também o áudio que deseja compartilhar.
            </p>
          )}
          {error && (
            <p className="admin-recorder-error" role="alert">
              {error}
            </p>
          )}
          {!supported && (
            <p className="admin-recorder-error" role="status">
              Este navegador não oferece gravação de tela. Abra o site no Chrome ou Edge em um
              computador.
            </p>
          )}
          <div className="admin-recorder-actions">
            {live ? (
              <>
                <button type="button" className="button" onClick={pause}>
                  {state === 'paused' ? <Play size={15} /> : <Pause size={15} />}
                  {state === 'paused' ? 'Retomar' : 'Pausar'}
                </button>
                <button type="button" className="button primary" onClick={finish}>
                  <Square size={14} />
                  Finalizar
                </button>
              </>
            ) : (
              <>
                {clip && (
                  <a className="button primary" href={clip.url} download={clip.filename}>
                    <Download size={16} />
                    Baixar vídeo
                  </a>
                )}
                {administrator && (
                  <button
                    ref={startButton}
                    type="button"
                    className={`button ${clip ? '' : 'primary'}`}
                    disabled={!supported || state === 'selecting' || state === 'finishing'}
                    onClick={() => void start()}
                  >
                    <Video size={16} />
                    {clip ? 'Nova gravação' : 'Iniciar gravação'}
                  </button>
                )}
              </>
            )}
          </div>
          <p className="admin-recorder-help">
            A gravação continua ao trocar de página no site, inclusive no VTT. O vídeo fica nesta
            aba até baixar.
          </p>
        </section>
      )}
    </>
  );
}

import { useState, type RefObject } from 'react';
import { Camera } from 'lucide-react';
import { renderVtt } from './vtt-canvas';
import type { VttScene } from '../shared/vtt';
import { api } from './api';

type Options = Parameters<typeof renderVtt>[2];
export type VttCaptureFrame = { scene: VttScene; options: Options };

export function renderVttCaptureFrame(
  frame: RefObject<VttCaptureFrame | null>,
  context: CanvasRenderingContext2D,
  scene: VttScene,
  options: Options,
) {
  frame.current = { scene, options };
  renderVtt(context, scene, options);
}

export function VttHighQualityCapture({
  administrator,
  frame,
  roomId,
}: {
  administrator: boolean;
  frame: RefObject<VttCaptureFrame | null>;
  roomId: string;
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function capture() {
    if (!administrator || busy || !frame.current) return;
    setBusy(true);
    setMessage('');
    const current = frame.current,
      canvas = document.createElement('canvas');
    try {
      await api(`/vtt/rooms/${roomId}/capture-permission`);
      await document.fonts.ready;
      await Promise.all(
        [...current.options.images.values()].map((image) => image.decode().catch(() => undefined)),
      );
      const { width, height } = current.options;
      if (width <= 0 || height <= 0) throw Error('Aguarde o mapa carregar.');
      const scale = Math.min(
        4,
        8192 / Math.max(width, height),
        Math.sqrt(32_000_000 / (width * height)),
      );
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext('2d');
      if (!context) throw Error('Captura indisponível.');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      renderVtt(context, current.scene, {
        ...current.options,
        dpr: scale,
        selected: [],
        resizeTokenId: undefined,
        target: undefined,
        currentTurn: undefined,
        nextTurn: undefined,
        ruler: [],
        lasso: [],
        draft: null,
        terrainDraft: null,
        terrainCursor: null,
        showWalls: false,
        ping: null,
        spellPreview: null,
      });
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(Error('Imagem indisponível.'))),
          'image/png',
        ),
      );
      const name = current.scene.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .slice(0, 60);
      const url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = `alvorada-${name}-${canvas.width}x${canvas.height}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage(`Captura salva em ${canvas.width} × ${canvas.height} pixels.`);
    } catch {
      setMessage(
        'Não foi possível capturar o mapa. Aguarde as imagens carregarem e tente novamente.',
      );
    } finally {
      canvas.width = canvas.height = 0;
      setBusy(false);
    }
  }
  if (!administrator) return null;
  return (
    <span className="vtt-quality-capture">
      <button
        type="button"
        aria-label="Capturar mapa em alta qualidade"
        title="Print em alta qualidade · PNG sem painéis, até 8K"
        disabled={busy}
        onClick={() => void capture()}
      >
        <Camera size={17} />
        <span>{busy ? 'Capturando…' : 'Print HD'}</span>
      </button>
      {message && (
        <span role="status" className="vtt-capture-status" onClick={() => setMessage('')}>
          {message}
        </span>
      )}
    </span>
  );
}

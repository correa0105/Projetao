import { useEffect, useRef } from 'react';
import { Footprints } from 'lucide-react';

const sheets = new Map<string, Promise<HTMLImageElement>>();
const originals = new Map<string, ImageData>();
const tinted = new Map<string, HTMLCanvasElement>();
const cells = {
  top: ['linen', 'cotton', 'road', 'vest'],
  trousers: ['straight', 'tied', 'wool', 'fitted'],
  footwear: ['shoes', 'boots', 'sandals'],
  sash: ['sash'],
};
export type OutfitPiece = keyof typeof cells;
function loadSheet(file: string) {
  if (!sheets.has(file))
    sheets.set(
      file,
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = `/character-creation/outfit-20261027/${file}-v1.png`;
      }),
    );
  return sheets.get(file)!;
}
async function illustration(piece: OutfitPiece, model: string, color: string) {
  const file = piece === 'top' ? 'tops' : piece === 'trousers' ? 'trousers' : 'accessories';
  const index = piece === 'sash' ? 3 : cells[piece].indexOf(model);
  const sourceKey = `${file}:${index}`,
    key = `${sourceKey}:${color}`;
  if (tinted.has(key)) return tinted.get(key)!;
  let source = originals.get(sourceKey);
  if (!source) {
    const image = await loadSheet(file),
      cell = image.naturalWidth / 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 300;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      image,
      (index % 2) * cell,
      Math.floor(index / 2) * cell,
      cell,
      cell,
      0,
      0,
      300,
      300,
    );
    source = ctx.getImageData(0, 0, 300, 300);
    originals.set(sourceKey, source);
  }
  const pixels = new ImageData(new Uint8ClampedArray(source.data), 300, 300);
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let i = 0; i < pixels.data.length; i += 4) {
    const d = pixels.data,
      r = d[i],
      g = d[i + 1],
      b = d[i + 2];
    // Keep the vest's cream undershirt and warm fastening details intact.
    if (!d[i + 3] || (piece === 'top' && model === 'vest' && r - b > 17 && r >= g)) continue;
    const light = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 142;
    for (let c = 0; c < 3; c++)
      d[i + c] =
        light <= 1 ? rgb[c] * light : rgb[c] + (255 - rgb[c]) * Math.min(1, (light - 1) / 0.8);
  }
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 300;
  canvas.getContext('2d')!.putImageData(pixels, 0, 0);
  if (tinted.size >= 48) tinted.delete(tinted.keys().next().value!);
  tinted.set(key, canvas);
  return canvas;
}
export function OutfitIllustration({
  piece,
  model,
  color,
  label,
}: {
  piece: OutfitPiece;
  model: string;
  color: string;
  label: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    if (model !== 'barefoot')
      illustration(piece, model, color)
        .then((image) => {
          if (!active) return;
          const ctx = canvas.current?.getContext('2d');
          ctx?.clearRect(0, 0, 300, 300);
          ctx?.drawImage(image, 0, 0);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [piece, model, color]);
  return model === 'barefoot' ? (
    <span className="outfit-barefoot" role="img" aria-label={label}>
      <Footprints size={42} />
      <span>Pés livres</span>
    </span>
  ) : (
    <canvas
      ref={canvas}
      width={300}
      height={300}
      role="img"
      aria-label={label}
      data-outfit-color={color}
    />
  );
}

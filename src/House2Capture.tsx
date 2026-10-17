import { useState, type RefObject } from 'react';
import { Camera } from 'lucide-react';
import { api } from './api';
import type { WorldClockSnapshot } from '../shared/world-clock';

const ns = 'http://www.w3.org/2000/svg';
const styleProperties = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'letter-spacing',
  'paint-order',
  'vector-effect',
  'color',
  'filter',
  'clip-path',
  'mask',
  'display',
  'visibility',
  'mix-blend-mode',
  'image-rendering',
];

/** Embed each image once so the exported SVG has no network or stylesheet dependencies. */
async function captureSvg(source: SVGSVGElement, width: number, height: number) {
  const clone = source.cloneNode(true) as SVGSVGElement;
  const originals = [source, ...source.querySelectorAll<SVGElement>('*')];
  const copies = [clone, ...clone.querySelectorAll<SVGElement>('*')];
  originals.forEach((node, index) => {
    const style = getComputedStyle(node);
    for (const property of styleProperties) {
      const value = style
        .getPropertyValue(property)
        .replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)');
      if (value) copies[index].style.setProperty(property, value);
    }
  });
  clone
    .querySelectorAll(
      '.h2-plot,.h2-item-border,.h2-owner-tooltip,[data-house2-border-piece],[data-house2-ground-editor],[data-house2-ground-cursor],[role="button"]',
    )
    .forEach((node) => node.remove());
  clone.querySelectorAll('text').forEach((node) => {
    if (node.textContent?.trim() === '+') node.parentElement?.remove();
  });
  clone.setAttribute('xmlns', ns);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  clone.style.width = width + 'px';
  clone.style.height = height + 'px';
  const defs = document.createElementNS(ns, 'defs');
  clone.prepend(defs);
  const assets = new Map<string, Promise<{ data: string; width: number; height: number }>>();
  const symbols = new Map<string, string>();
  async function asset(href: string) {
    if (!assets.has(href))
      assets.set(
        href,
        (async () => {
          const response = await fetch(new URL(href, location.href), {
            credentials: 'same-origin',
          });
          if (!response.ok) throw Error('Não foi possível carregar uma imagem da vizinhança.');
          const blob = await response.blob();
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(Error('Falha ao ler uma imagem.'));
            reader.readAsDataURL(blob);
          });
          const image = new Image();
          image.src = data;
          await image.decode();
          return { data, width: image.naturalWidth, height: image.naturalHeight };
        })(),
      );
    return assets.get(href)!;
  }
  const images = [...clone.querySelectorAll('image')];
  await Promise.all(
    images.map(async (image) => {
      const href =
        image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (!href || href.startsWith('#')) return;
      const loaded = await asset(href),
        aspect = image.getAttribute('preserveAspectRatio') || 'xMidYMid meet';
      const key = href + '|' + aspect;
      let id = symbols.get(key);
      if (!id) {
        id = 'house2-capture-image-' + symbols.size;
        symbols.set(key, id);
        const symbol = document.createElementNS(ns, 'symbol');
        symbol.id = id;
        symbol.setAttribute('viewBox', `0 0 ${loaded.width} ${loaded.height}`);
        symbol.setAttribute('preserveAspectRatio', aspect);
        const embedded = document.createElementNS(ns, 'image');
        embedded.setAttribute('width', String(loaded.width));
        embedded.setAttribute('height', String(loaded.height));
        embedded.setAttribute('href', loaded.data);
        symbol.append(embedded);
        defs.append(symbol);
      }
      const use = document.createElementNS(ns, 'use');
      for (const attr of image.attributes)
        if (attr.localName !== 'href' && attr.name !== 'preserveAspectRatio')
          use.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
      use.setAttribute('href', '#' + id);
      image.replaceWith(use);
    }),
  );
  return new XMLSerializer().serializeToString(clone);
}

export function House2Capture({
  map,
  administrator,
  name,
  disabled,
  notice,
}: {
  map: RefObject<SVGSVGElement | null>;
  administrator: boolean;
  name: string;
  disabled: boolean;
  notice: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function capture() {
    if (!administrator || busy || disabled || !map.current) return;
    setBusy(true);
    const canvas = document.createElement('canvas');
    try {
      const permission = await api<WorldClockSnapshot>('/world-clock');
      if (!permission.canEdit)
        throw Error('A captura em alta qualidade é exclusiva de administradores.');
      await document.fonts.ready;
      const source = map.current,
        bounds = source.getBoundingClientRect();
      const scale = Math.min(
        4,
        8192 / Math.max(bounds.width, bounds.height),
        Math.sqrt(32_000_000 / (bounds.width * bounds.height)),
      );
      canvas.width = Math.round(bounds.width * scale);
      canvas.height = Math.round(bounds.height * scale);
      const svg = await captureSvg(source, canvas.width, canvas.height);
      const image = new Image();
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await image.decode();
      const context = canvas.getContext('2d');
      if (!context) throw Error('Não foi possível iniciar a captura.');
      context.fillStyle = '#151712';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0);
      const png = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(Error('Não foi possível gerar o PNG.'))),
          'image/png',
        ),
      );
      const download = URL.createObjectURL(png),
        link = document.createElement('a');
      const filename = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9-]+/g, '-')
        .slice(0, 60);
      link.href = download;
      link.download = `house2-${filename}-${canvas.width}x${canvas.height}.png`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(download), 30_000);
      notice(`Print salvo em ${canvas.width} × ${canvas.height} pixels.`);
    } catch (error) {
      notice(error instanceof Error ? error.message : 'Não foi possível capturar a vizinhança.');
    } finally {
      canvas.width = canvas.height = 0;
      setBusy(false);
    }
  }
  if (!administrator) return null;
  return (
    <button
      type="button"
      className="h2-capture-button"
      aria-label="Print da House 2.0 em alta qualidade"
      title="Baixar PNG da vizinhança em alta qualidade, sem painéis de edição"
      disabled={disabled || busy}
      onClick={() => void capture()}
    >
      <Camera size={17} />
      <span className="h2-capture-full">{busy ? 'Gerando print…' : 'Print em alta qualidade'}</span>
      <span className="h2-capture-short">{busy ? 'Gerando…' : 'Print HD'}</span>
    </button>
  );
}

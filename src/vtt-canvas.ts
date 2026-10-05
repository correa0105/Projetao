import {
  sightPolygon,
  distance,
  visiblePoint,
  type Point,
  type VttScene,
  type VttToken,
  type VttDrawing,
} from '../shared/vtt';
export type VttCamera = { x: number; y: number; zoom: number };
export type RenderOptions = {
  camera: VttCamera;
  width: number;
  height: number;
  dpr: number;
  images: Map<string, HTMLImageElement>;
  selected: string[];
  gm: boolean;
  preview: boolean;
  viewer: VttToken | null;
  layer: string;
  ruler: Point[];
  draft: VttDrawing | null;
  showWalls: boolean;
  ping: Point | null;
};
function path(c: CanvasRenderingContext2D, points: Point[], closed = false) {
  c.beginPath();
  points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
  if (closed) c.closePath();
}
function polygon(c: CanvasRenderingContext2D, p: Point[]) {
  path(c, p, true);
}
function drawing(c: CanvasRenderingContext2D, d: VttDrawing) {
  const a = d.points[0],
    b = d.points.at(-1)!;
  c.save();
  c.strokeStyle = d.color;
  c.fillStyle = d.color + '35';
  c.lineWidth = d.width;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (d.kind === 'text') {
    c.font = `${Math.max(16, d.width * 8)}px Georgia`;
    c.fillStyle = d.color;
    c.fillText(d.text, a.x, a.y);
  } else if (d.kind === 'circle') {
    c.beginPath();
    c.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2);
    if (d.fill) c.fill();
    c.stroke();
  } else if (d.kind === 'rect') {
    if (d.fill) c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (d.kind === 'cone') {
    const radius = Math.hypot(b.x - a.x, b.y - a.y),
      angle = Math.atan2(b.y - a.y, b.x - a.x);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.arc(a.x, a.y, radius, angle - Math.PI / 6, angle + Math.PI / 6);
    c.closePath();
    if (d.fill) c.fill();
    c.stroke();
  } else {
    path(c, d.points);
    c.stroke();
  }
  c.restore();
}
export function tokenAt(p: Point, s: VttScene, layer: string, gm: boolean): VttToken | undefined {
  return [...s.tokens].reverse().find((t) => {
    if (t.layer !== layer || (!gm && (t.hidden || t.layer === 'gm'))) return false;
    const angle = (-t.rotation * Math.PI) / 180,
      dx = p.x - t.x,
      dy = p.y - t.y,
      x = dx * Math.cos(angle) - dy * Math.sin(angle),
      y = dx * Math.sin(angle) + dy * Math.cos(angle);
    return Math.abs(x) <= t.width / 2 && Math.abs(y) <= t.height / 2;
  });
}
export function renderVtt(c: CanvasRenderingContext2D, s: VttScene, o: RenderOptions) {
  const { width, height, dpr, camera: cam, images } = o;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, height);
  c.fillStyle = '#0c1115';
  c.fillRect(0, 0, width, height);
  c.translate(width / 2, height / 2);
  c.scale(cam.zoom, cam.zoom);
  c.translate(-cam.x, -cam.y);
  c.fillStyle = s.backgroundColor;
  c.fillRect(0, 0, s.width, s.height);
  const background = images.get(s.background);
  if (background?.complete && background.naturalWidth)
    c.drawImage(background, 0, 0, s.width, s.height);
  const g = s.grid;
  c.save();
  c.strokeStyle = g.color;
  c.globalAlpha = g.opacity;
  c.lineWidth = 1 / cam.zoom;
  const left = Math.max(0, cam.x - width / 2 / cam.zoom),
    right = Math.min(s.width, cam.x + width / 2 / cam.zoom),
    top = Math.max(0, cam.y - height / 2 / cam.zoom),
    bottom = Math.min(s.height, cam.y + height / 2 / cam.zoom);
  if (g.type === 'square') {
    c.beginPath();
    for (
      let x = Math.floor((left - g.offsetX) / g.size) * g.size + g.offsetX;
      x < right;
      x += g.size
    ) {
      c.moveTo(x, top);
      c.lineTo(x, bottom);
    }
    for (
      let y = Math.floor((top - g.offsetY) / g.size) * g.size + g.offsetY;
      y < bottom;
      y += g.size
    ) {
      c.moveTo(left, y);
      c.lineTo(right, y);
    }
    c.stroke();
  } else if (g.type.startsWith('hex')) {
    const flat = g.type === 'hex-flat',
      r = g.size / Math.sqrt(3),
      dx = flat ? 1.5 * r : g.size,
      dy = flat ? g.size : 1.5 * r;
    for (
      let col = Math.floor((left - g.offsetX) / dx) - 1;
      col < (right - g.offsetX) / dx + 1;
      col++
    )
      for (
        let row = Math.floor((top - g.offsetY) / dy) - 1;
        row < (bottom - g.offsetY) / dy + 1;
        row++
      ) {
        const x = col * dx + g.offsetX + (flat ? 0 : ((row % 2) * dx) / 2),
          y = row * dy + g.offsetY + (flat ? ((col % 2) * dy) / 2 : 0);
        polygon(
          c,
          Array.from({ length: 6 }, (_, i) => ({
            x: x + r * Math.cos((i * Math.PI) / 3 + (flat ? 0 : Math.PI / 6)),
            y: y + r * Math.sin((i * Math.PI) / 3 + (flat ? 0 : Math.PI / 6)),
          })),
        );
        c.stroke();
      }
  }
  c.restore();
  for (const layer of ['map', 'tokens', 'gm']) {
    if (layer === 'gm' && (!o.gm || o.preview)) continue;
    for (const d of s.drawings.filter((d) => d.layer === layer)) drawing(c, d);
    for (const t of s.tokens.filter((t) => t.layer === layer)) {
      if ((!o.gm || o.preview) && t.hidden) continue;
      if (
        o.preview &&
        o.viewer &&
        t.id !== o.viewer.id &&
        s.lighting &&
        !visiblePoint(o.viewer, t, s, (o.viewer.vision / g.scale) * g.size) &&
        !s.tokens.some((l) => visiblePoint(l, t, s, ((l.light + l.dimLight) / g.scale) * g.size))
      )
        continue;
      c.save();
      c.translate(t.x, t.y);
      c.rotate((t.rotation * Math.PI) / 180);
      c.globalAlpha = t.hidden || layer === 'gm' ? 0.45 : 1;
      const img = images.get(t.image);
      if (layer === 'map') {
        if (img?.complete && img.naturalWidth)
          c.drawImage(img, -t.width / 2, -t.height / 2, t.width, t.height);
        else {
          c.fillStyle = t.color;
          c.fillRect(-t.width / 2, -t.height / 2, t.width, t.height);
        }
      } else {
        c.shadowBlur = 9 / cam.zoom;
        c.shadowColor = '#000';
        c.fillStyle = '#10151b';
        c.beginPath();
        c.ellipse(0, 0, t.width / 2, t.height / 2, 0, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
        c.save();
        c.clip();
        if (img?.complete && img.naturalWidth) {
          const factor = Math.max(t.width / img.naturalWidth, t.height / img.naturalHeight);
          c.drawImage(
            img,
            (-img.naturalWidth * factor) / 2,
            (-img.naturalHeight * factor) / 2,
            img.naturalWidth * factor,
            img.naturalHeight * factor,
          );
        } else {
          const grad = c.createRadialGradient(
            -t.width * 0.15,
            -t.height * 0.2,
            1,
            0,
            0,
            t.width * 0.65,
          );
          grad.addColorStop(0, t.color);
          grad.addColorStop(1, '#10141d');
          c.fillStyle = grad;
          c.fillRect(-t.width / 2, -t.height / 2, t.width, t.height);
          c.fillStyle = '#f2e7cf';
          c.font = `bold ${t.height * 0.42}px Georgia`;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(t.name.slice(0, 2).toUpperCase(), 0, 0);
        }
        c.restore();
        c.strokeStyle = t.color;
        c.lineWidth = 3 / cam.zoom;
        c.stroke();
      }
      if (o.selected.includes(t.id)) {
        c.strokeStyle = '#efd293';
        c.lineWidth = 2 / cam.zoom;
        c.setLineDash([6 / cam.zoom, 3 / cam.zoom]);
        c.strokeRect(
          -t.width / 2 - 4 / cam.zoom,
          -t.height / 2 - 4 / cam.zoom,
          t.width + 8 / cam.zoom,
          t.height + 8 / cam.zoom,
        );
        c.setLineDash([]);
      }
      c.restore();
      if (layer !== 'map') {
        c.save();
        c.font = `${Math.max(11 / cam.zoom, 13)}px Inter,sans-serif`;
        c.textAlign = 'center';
        c.fillStyle = '#f1e8d4';
        c.shadowColor = '#000';
        c.shadowBlur = 5;
        c.fillText(t.name, t.x, t.y + t.height / 2 + 18 / cam.zoom);
        c.shadowBlur = 0;
        c.fillStyle = '#07100c';
        c.fillRect(t.x - t.width / 2, t.y - t.height / 2 - 9 / cam.zoom, t.width, 5 / cam.zoom);
        c.fillStyle = t.hp / t.maxHp > 0.35 ? '#88aa8f' : '#bb665d';
        c.fillRect(
          t.x - t.width / 2,
          t.y - t.height / 2 - 9 / cam.zoom,
          t.width * Math.max(0, Math.min(1, t.hp / t.maxHp)),
          5 / cam.zoom,
        );
        if (t.conditions.length) {
          c.font = `bold ${11 / cam.zoom}px sans-serif`;
          c.fillStyle = '#eac586';
          c.fillText(
            t.conditions.map((v) => v.slice(0, 2)).join(' · '),
            t.x,
            t.y - t.height / 2 - 16 / cam.zoom,
          );
        }
        c.restore();
      }
    }
  }
  if ((s.lighting || s.fog) && (!o.gm || o.preview)) {
    const mask = document.createElement('canvas');
    mask.width = Math.ceil(width * dpr);
    mask.height = Math.ceil(height * dpr);
    const m = mask.getContext('2d')!;
    m.scale(dpr, dpr);
    m.fillStyle = `rgba(0,0,0,${s.lighting ? 1 - s.ambient : 0})`;
    m.fillRect(0, 0, width, height);
    m.translate(width / 2, height / 2);
    m.scale(cam.zoom, cam.zoom);
    m.translate(-cam.x, -cam.y);
    m.globalCompositeOperation = 'destination-out';
    if (s.lighting) {
      const sources = s.tokens
        .filter((t) => t.light + t.dimLight > 0 && t.layer !== 'gm' && !t.hidden)
        .map((t) => ({
          t,
          r: ((t.light + t.dimLight) / g.scale) * g.size,
          bright: (t.light / g.scale) * g.size,
        }));
      const viewers = o.viewer ? [o.viewer] : s.tokens.filter((t) => o.selected.includes(t.id));
      for (const t of viewers)
        if (t.vision > 0)
          sources.push({
            t: { ...t, lightAngle: 360 },
            r: (t.vision / g.scale) * g.size,
            bright: (t.vision / g.scale) * g.size * 0.7,
          });
      for (const { t, r, bright } of sources) {
        if (t.light + t.dimLight > 0 && r > 0) {
          c.save();
          polygon(c, sightPolygon(t, r, s, t.rotation, t.lightAngle));
          c.clip();
          const tint = c.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
          tint.addColorStop(0, t.lightColor + '28');
          tint.addColorStop(1, t.lightColor + '00');
          c.fillStyle = tint;
          c.fillRect(t.x - r, t.y - r, 2 * r, 2 * r);
          c.restore();
        }
        m.save();
        polygon(m, sightPolygon(t, r, s, t.rotation, t.lightAngle));
        m.clip();
        const grad = m.createRadialGradient(t.x, t.y, 0, t.x, t.y, r);
        grad.addColorStop(0, '#000');
        grad.addColorStop(Math.min(0.95, bright / r), '#000');
        grad.addColorStop(1, 'transparent');
        m.fillStyle = grad;
        m.fillRect(t.x - r, t.y - r, r * 2, r * 2);
        m.restore();
      }
    }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(mask, 0, 0);
    c.restore();
    if (s.fog) {
      m.setTransform(1, 0, 0, 1, 0, 0);
      m.clearRect(0, 0, mask.width, mask.height);
      m.globalCompositeOperation = 'source-over';
      m.fillStyle = '#06090d';
      m.fillRect(0, 0, mask.width, mask.height);
      m.setTransform(
        dpr * cam.zoom,
        0,
        0,
        dpr * cam.zoom,
        dpr * (width / 2 - cam.x * cam.zoom),
        dpr * (height / 2 - cam.y * cam.zoom),
      );
      m.globalCompositeOperation = 'destination-out';
      for (const r of s.reveals) {
        m.beginPath();
        m.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        m.fill();
      }
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(mask, 0, 0);
      c.restore();
    }
  }
  if (o.showWalls && o.gm) {
    c.save();
    c.lineWidth = 4 / cam.zoom;
    for (const wall of s.walls) {
      c.strokeStyle =
        wall.kind === 'door'
          ? wall.open
            ? '#79a891'
            : '#dfb470'
          : wall.kind === 'window'
            ? '#82b4cc'
            : '#bc7770';
      c.setLineDash(wall.open ? [8 / cam.zoom, 8 / cam.zoom] : []);
      path(c, [wall.a, wall.b]);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      for (const p of [wall.a, wall.b]) {
        c.beginPath();
        c.arc(p.x, p.y, 4 / cam.zoom, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();
  }
  if (o.draft) drawing(c, o.draft);
  if (o.ruler.length > 1) {
    c.save();
    c.strokeStyle = '#ebce88';
    c.lineWidth = 2 / cam.zoom;
    c.setLineDash([8 / cam.zoom, 4 / cam.zoom]);
    path(c, o.ruler);
    c.stroke();
    c.setLineDash([]);
    const a = o.ruler[0],
      b = o.ruler.at(-1)!;
    const value = o.ruler.slice(1).reduce((sum, p, i) => sum + distance(o.ruler[i], p, g), 0);
    c.font = `bold ${14 / cam.zoom}px sans-serif`;
    c.textAlign = 'center';
    const label = `${value.toFixed(1)} ${g.unit}`,
      w = c.measureText(label).width + 20 / cam.zoom;
    c.fillStyle = '#171b20';
    c.fillRect((a.x + b.x) / 2 - w / 2, (a.y + b.y) / 2 - 20 / cam.zoom, w, 24 / cam.zoom);
    c.fillStyle = '#f6dfab';
    c.fillText(label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3 / cam.zoom);
    c.restore();
  }
  if (o.ping) {
    c.save();
    c.strokeStyle = '#ebc789';
    c.lineWidth = 3 / cam.zoom;
    for (const r of [15, 30, 45]) {
      c.beginPath();
      c.arc(o.ping.x, o.ping.y, r / cam.zoom, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }
  c.strokeStyle = '#5b5846';
  c.lineWidth = 2 / cam.zoom;
  c.strokeRect(0, 0, s.width, s.height);
}

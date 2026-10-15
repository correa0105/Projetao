import {vttVisualSource} from '../shared/vtt-asset-visuals';
import {lightAnimationState,sceneHasAnimatedLights} from '../shared/vtt-lighting';
import {drawMapObject} from './vtt-object-sprites';
import { drawTerrain } from './vtt-terrain-canvas';
import { renderBuffer, renderWorkCache, tokenOnScreen } from './vtt-render-cache';
import type { TerrainStroke } from '../shared/vtt';
import {houseAsset,houseContains,houseOccupied,houseRoofOccluded,houseWalls} from '../shared/vtt-houses';
import furniture from '../shared/vtt-home-furniture-catalog.json';
import {villageAssets,residentAsset,houseViewActors} from '../shared/vtt-village-assets';
const houseFurniture=new Set([...furniture,...villageAssets.filter(a=>!('actor' in a&&a.actor))].map(a=>vttVisualSource(a.image)));
import {drawHouseDoor} from './vtt-house-doors';
import {treeTrunk} from '../shared/vtt-tree-trunks';
import {drawHouseVision} from './vtt-house-vision';
import {drawHouseRoof} from './vtt-house-roof';
import { tokenRotationHandle, tokenResizeHandles } from '../shared/vtt-token-resize';
import { isTreeCanopy, canopyActor } from '../shared/vtt-canopies';
import { captureCanopyAreas, drawCanopyForeground, clipCanopyBase } from './vtt-canopies-canvas';
import { drawMapAtmosphere } from './vtt-atmosphere';
import {
  sightPolygon,
  rulerLabel,
  visiblePoint,
  orderedTokens,
  sceneLights,
  viewerSees,
  visionPixels,
  type Point,
  type VttScene,
  type VttToken,
  type VttDrawing,
} from '../shared/vtt';
import { drawDeath } from './vtt-death';
import { vttAssetId } from '../shared/vtt-token-image';
import { drawTokenEffects } from './vtt-effects-canvas';
import { drawConditionBadges } from './vtt-condition-badges';
import { drawBloodDecals, drawTokenBlood } from './vtt-blood-canvas';
import { drawPing, type VttPing } from './vtt-ping';
import { drawTurnEffect } from './vtt-turn-effect';
import { drawSpellEffects, drawSpellPreview, type SpellPreview } from './vtt-spell-effects';
import { drawAnimatedAsset } from './vtt-animated-assets';
import { spellTokenOpacity } from './vtt-spell-cinematic';
import type { SpellEffect } from '../shared/vtt-spells';
export type VttCamera = { x: number; y: number; zoom: number };
export type RenderOptions = {
  terrainDraft?: TerrainStroke | null;
  terrainCursor?: {x:number;y:number;radius:number;erase:boolean} | null;
  visualEffects?: boolean;
  bloodEnabled?: boolean;
  spellEffects?: SpellEffect[];
  spellPreview?: SpellPreview | null;
  camera: VttCamera;
  width: number;
  height: number;
  dpr: number;
  images: Map<string, HTMLImageElement>;
  selected: string[];
  resizeTokenId?: string;
  target?: string;
  currentTurn?: string;
  nextTurn?: string;
  gm: boolean;
  preview: boolean;
  viewer: VttToken | null;
  layer: string;
  ruler: Point[];
  lasso?: Point[];
  draft: VttDrawing | null;
  showWalls: boolean;
  ping: VttPing | null;
  userId?: string;
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
    d.text
      .split('\n')
      .forEach((line, i) => c.fillText(line, a.x, a.y + i * Math.max(20, d.width * 9.6)));
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
  return orderedTokens(s.tokens)
    .reverse()
    .find((t) => {
      if ((layer !== '*' && t.layer !== layer) || (!gm && (t.hidden || t.layer === 'gm')))
        return false;
      const angle = (-t.rotation * Math.PI) / 180,
        dx = p.x - t.x,
        dy = p.y - t.y,
        x = dx * Math.cos(angle) - dy * Math.sin(angle),
        y = dx * Math.sin(angle) + dy * Math.cos(angle);
      return Math.abs(x) <= t.width / 2 && Math.abs(y) <= t.height / 2;
    });
}
export function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function drawingBounds(d: VttDrawing) {
  const a = d.points[0],
    b = d.points.at(-1)!;
  if (d.kind === 'circle' || d.kind === 'cone') {
    const r = Math.hypot(b.x - a.x, b.y - a.y);
    return { x: a.x - r, y: a.y - r, width: r * 2, height: r * 2 };
  }
  if (d.kind === 'text')
    return {
      x: a.x,
      y: a.y - Math.max(16, d.width * 8),
      width:
        Math.max(...d.text.split('\n').map((line) => line.length)) * Math.max(10, d.width * 4.8),
      height: Math.max(20, d.width * 9.6) * d.text.split('\n').length,
    };
  const xs = d.points.map((p) => p.x),
    ys = d.points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}
export function drawingAt(p: Point, s: VttScene, layer: string, tolerance: number) {
  return [...s.drawings].reverse().find((d) => {
    if (d.layer !== layer) return false;
    const a = d.points[0],
      b = d.points.at(-1)!;
    if (d.kind === 'pen' || d.kind === 'line')
      return d.points
        .slice(1)
        .some((b, i) => segmentDistance(p, d.points[i], b) <= tolerance + d.width / 2);
    if (d.kind === 'circle') {
      const r = Math.hypot(b.x - a.x, b.y - a.y),
        delta = Math.hypot(p.x - a.x, p.y - a.y);
      return d.fill ? delta <= r + tolerance : Math.abs(delta - r) <= tolerance + d.width / 2;
    }
    if (d.kind === 'cone') {
      const r = Math.hypot(b.x - a.x, b.y - a.y),
        angle = Math.atan2(b.y - a.y, b.x - a.x),
        theta = Math.atan2(p.y - a.y, p.x - a.x);
      return (
        Math.hypot(p.x - a.x, p.y - a.y) <= r + tolerance &&
        Math.abs(Math.atan2(Math.sin(theta - angle), Math.cos(theta - angle))) <= Math.PI / 6
      );
    }
    const box = drawingBounds(d);
    if (
      p.x < box.x - tolerance ||
      p.x > box.x + box.width + tolerance ||
      p.y < box.y - tolerance ||
      p.y > box.y + box.height + tolerance
    )
      return false;
    return (
      d.fill ||
      d.kind === 'text' ||
      Math.min(
        Math.abs(p.x - box.x),
        Math.abs(p.x - box.x - box.width),
        Math.abs(p.y - box.y),
        Math.abs(p.y - box.y - box.height),
      ) <=
        tolerance + d.width / 2
    );
  });
}
const backdropCache = new WeakMap<HTMLImageElement, string>();
function dominantColor(image: HTMLImageElement, fallback: string) {
  if (!image.complete || !image.naturalWidth) return fallback;
  const cached = backdropCache.get(image);
  if (cached) return cached;
  const sample = document.createElement('canvas');
  sample.width = sample.height = 32;
  const c = sample.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(image, 0, 0, 32, 32);
  const pixels = c.getImageData(0, 0, 32, 32).data;
  const bins = new Map<string, { n: number; rgb: number[] }>();
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const key = [pixels[i] >> 5, pixels[i + 1] >> 5, pixels[i + 2] >> 5].join(',');
    const bin = bins.get(key) || { n: 0, rgb: [0, 0, 0] };
    bin.n++;
    for (let j = 0; j < 3; j++) bin.rgb[j] += pixels[i + j];
    bins.set(key, bin);
  }
  const dominant = [...bins.values()].sort((a, b) => b.n - a.n)[0];
  const value = dominant
    ? '#' +
      dominant.rgb
        .map((v) =>
          Math.round(v / dominant.n)
            .toString(16)
            .padStart(2, '0'),
        )
        .join('')
    : fallback;
  backdropCache.set(image, value);
  return value;
}
export function renderVtt(c: CanvasRenderingContext2D, s: VttScene, o: RenderOptions) {
  const { width, height, dpr, camera: cam, images } = o;
  const view = {left:cam.x-width/2/cam.zoom,top:cam.y-height/2/cam.zoom,right:cam.x+width/2/cam.zoom,bottom:cam.y+height/2/cam.zoom};
  const sortedTokens = orderedTokens(s.tokens);
  const now = Date.now(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, height);
  const background = images.get(s.background);
  const mapImage =
    background || images.get(s.tokens.find((t) => t.layer === 'map' && t.image)?.image || '');
  c.fillStyle =
    s.dominantBackdrop && mapImage ? dominantColor(mapImage, s.backdropColor) : s.backdropColor;
  c.fillRect(0, 0, width, height);
  c.translate(width / 2, height / 2);
  c.scale(cam.zoom, cam.zoom);
  c.translate(-cam.x, -cam.y);
  c.save();
  c.shadowColor = '#0009';
  c.shadowBlur = 28 / cam.zoom;
  c.shadowOffsetY = 9 / cam.zoom;
  c.fillStyle = s.backgroundColor;
  c.fillRect(0, 0, s.width, s.height);
  c.restore();
  c.save();
  c.beginPath();
  c.rect(0, 0, s.width, s.height);
  c.clip();
  if (background?.complete && background.naturalWidth)
    c.drawImage(background, 0, 0, s.width, s.height);
  drawTerrain(c,s,o);
  const g = s.grid;
  const drawGrid = () => {
    c.save();
    c.strokeStyle = g.color;
    c.globalAlpha = g.opacity;
    c.lineWidth = 1 / cam.zoom;
    c.shadowColor = '#000';c.shadowBlur=1.5/cam.zoom;
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
  };
  const visibleCanopyToken = (t: VttToken) => !((!o.gm || o.preview) && t.hidden) && !(o.preview && o.viewer && t.id !== o.viewer.id && !viewerSees(o.viewer,t,s));
  const canopyActors = s.tokens.filter(t=>canopyActor(t) && visibleCanopyToken(t));
  const houseActors=houseViewActors(canopyActors,o.gm&&!o.preview,o.userId??'',o.selected,o.preview?o.viewer?.id:undefined);
  const closedHouses=s.tokens.filter(h=>houseAsset(h)&&!houseOccupied(h,houseActors));
  let canopyCover: HTMLCanvasElement | null = null;
  for (const layer of ['map', 'tokens', 'gm']) {
    if (layer === 'gm') drawCanopyForeground(c,s,images,canopyActors,canopyCover,visibleCanopyToken,o.selected,cam.zoom);
    if (layer === 'tokens' && o.visualEffects !== false && o.bloodEnabled !== false)
      drawBloodDecals(
        c,
        s,
        {
          left: cam.x - width / 2 / cam.zoom,
          top: cam.y - height / 2 / cam.zoom,
          right: cam.x + width / 2 / cam.zoom,
          bottom: cam.y + height / 2 / cam.zoom,
        },
        o.gm && !o.preview,
      );
    if (layer === 'tokens' && o.visualEffects !== false && o.spellEffects) {
      drawSpellEffects(
        c,
        s,
        o.spellEffects,
        'behind',
        {
          left: cam.x - width / 2 / cam.zoom,
          top: cam.y - height / 2 / cam.zoom,
          right: cam.x + width / 2 / cam.zoom,
          bottom: cam.y + height / 2 / cam.zoom,
        },
        now,
        reduced,
        images,
      );
    }
    if (layer === 'gm' && (!o.gm || o.preview)) continue;
    for (const d of s.drawings.filter((d) => d.layer === layer)) {
      c.save();
      c.globalAlpha = layer === 'gm' ? s.gmOpacity : 1;
      drawing(c, d);
      c.restore();
    }
    for (const t of sortedTokens.filter((t) => t.layer === layer && !isTreeCanopy(t)).sort((a,b)=>Number(!!houseAsset(b))-Number(!!houseAsset(a)))) {
      if ((!o.gm || o.preview) && t.hidden) continue;
      if (!tokenOnScreen(t, view, cam.zoom)) continue;
      if (o.preview && o.viewer && t.id !== o.viewer.id && !viewerSees(o.viewer, t, s)) continue;
      if((houseFurniture.has(vttVisualSource(t.image))||residentAsset(t))&&closedHouses.some(h=>houseContains(h,t)))continue;
      c.save();
      if(layer === 'map') clipCanopyBase(c,s,t);
      c.translate(t.x, t.y);
      c.rotate((t.rotation * Math.PI) / 180);
      c.globalAlpha = t.hidden || layer === 'gm' ? s.gmOpacity : 1;
      if (o.visualEffects !== false) c.globalAlpha *= spellTokenOpacity(t, o.spellEffects || [], now, reduced);
      if (o.visualEffects !== false && (t.id === o.currentTurn || t.id === o.nextTurn))
        drawTurnEffect(c, Math.max(t.width, t.height) * 0.6, t.id === o.nextTurn);
      if (o.visualEffects !== false) {
        drawTokenEffects(c, t, 'behind', images.get(t.image));
        drawDeath(c, t);
      }
      c.save();
      if (t.deathAt && layer !== 'map')
        c.filter = 'brightness(.42) sepia(1) saturate(4) hue-rotate(320deg)';
      c.scale(t.flipX ? -1 : 1, t.flipY ? -1 : 1);
      const house=houseAsset(t),img=images.get(house&&houseOccupied(t,houseActors)?house.interior:t.image);
      if (t.animatedAsset) {
        drawAnimatedAsset(c, t, img, now, reduced, o.visualEffects !== false);
      } else if (layer === 'map') {
        if (img?.complete && img.naturalWidth) {
          const floor=house&&images.get(house.interior);
          if(house&&!houseOccupied(t,houseActors)){
            if(floor?.complete&&floor.naturalWidth)
              drawHouseRoof(c,t,img,floor,houseRoofOccluded(t,houseActors,s),()=>drawHouseDoor(c,s,t,reduced,images,true));
            else {drawHouseDoor(c,s,t,reduced,images,true);c.drawImage(img,-t.width/2,-t.height/2,t.width,t.height);}
          }else if(houseFurniture.has(vttVisualSource(t.image))){
            drawMapObject(c,t,img);
          }else {
            c.drawImage(img,-t.width/2,-t.height/2,t.width,t.height);
            if(house)drawHouseDoor(c,s,t,reduced,images,true);
          }
        } else {
          c.fillStyle = t.color;
          c.fillRect(-t.width / 2, -t.height / 2, t.width, t.height);
        }
      } else if (t.sceneryToken && img?.complete && img.naturalWidth) {
        drawMapObject(c,t,img);
      } else if (
        (t.image.startsWith('/vtt/monsters/') ||
          t.image.startsWith('/api/vtt/premium-art/') ||
          !!vttAssetId(t.image) || !!residentAsset(t)) &&
        img?.complete &&
        img.naturalWidth
      ) {
        const factor = Math.min(t.width / img.naturalWidth, t.height / img.naturalHeight) * (residentAsset(t)?.bodyScale??1);
        c.shadowBlur = 6 / cam.zoom;
        c.shadowColor = '#000b';
        c.drawImage(
          img,
          (-img.naturalWidth * factor) / 2,
          (-img.naturalHeight * factor) / 2,
          img.naturalWidth * factor,
          img.naturalHeight * factor,
        );
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
      c.restore();
      if (o.visualEffects !== false) drawTokenEffects(c, t, 'front', images.get(t.image));
      if (o.visualEffects !== false && o.bloodEnabled !== false)
        drawTokenBlood(c, t, images.get(t.image));
      if (o.selected.includes(t.id) || o.target === t.id) {
        const targeted = o.target === t.id;
        c.strokeStyle = targeted ? '#ef544b' : '#efd293';
        c.lineWidth = (targeted ? 3 : 2) / cam.zoom;
        c.shadowColor = targeted ? '#e64336' : 'transparent';
        c.shadowBlur = targeted ? 7 / cam.zoom : 0;
        c.setLineDash(targeted ? [] : [6 / cam.zoom, 3 / cam.zoom]);
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
        c.globalAlpha = t.hidden || layer === 'gm' ? s.gmOpacity : 1;
        c.font = `${11 / cam.zoom}px Inter,sans-serif`;
        c.textAlign = 'center';
        c.fillStyle = '#f1e8d4';
        c.shadowColor = '#000';
        c.shadowBlur = 5;
        c.fillText(t.name, t.x, t.y + t.height / 2 + 14 / cam.zoom);
        c.shadowBlur = 0;
        if (!t.sceneryToken) {
        const hpWidth = Math.min(t.width * 0.6, 84 / cam.zoom);
        c.fillStyle = '#07100c';
        c.fillRect(t.x - hpWidth / 2, t.y - t.height / 2 - 9 / cam.zoom, hpWidth, 4 / cam.zoom);
        c.fillStyle = t.hp / t.maxHp > 0.35 ? '#88aa8f' : '#bb665d';
        c.fillRect(
          t.x - hpWidth / 2,
          t.y - t.height / 2 - 9 / cam.zoom,
          hpWidth * Math.max(0, Math.min(1, t.hp / Math.max(1, t.maxHp))),
          4 / cam.zoom,
        );
        if (t.conditions.length) drawConditionBadges(c, t, cam.zoom);
        }
        c.restore();
      }
    }
    if (layer === 'map') { drawGrid(); canopyCover = captureCanopyAreas(c,s); }
  }
  const spellView = {
    left: cam.x - width / 2 / cam.zoom,
    top: cam.y - height / 2 / cam.zoom,
    right: cam.x + width / 2 / cam.zoom,
    bottom: cam.y + height / 2 / cam.zoom,
  };
  if (o.visualEffects !== false && o.spellEffects)
    drawSpellEffects(
      c,
      s,
      o.spellEffects,
      'front',
      spellView,
      now,
      reduced,
      images,
    );
  if (o.spellPreview) drawSpellPreview(c, s, o.spellPreview, spellView, cam.zoom);
  if (o.visualEffects !== false) drawMapAtmosphere(c, s, spellView, cam.zoom, width, height);
  if (s.lighting || (s.fog && s.fogMode === 'vision')) {
    const master = o.gm && !o.preview;
    const darkness = master ? s.gmDarkness : 1;
    const viewers = master
      ? []
      : o.gm
        ? o.viewer
          ? [o.viewer]
          : []
        : s.tokens.filter((t) => t.controller === o.userId && t.layer === 'tokens' && !t.hidden);
    const cache = renderWorkCache(c.canvas), sources = sceneLights(s);
    const lightTick=!reduced&&o.visualEffects!==false&&sceneHasAnimatedLights(s)?Math.floor(now/80)*80:0;
    const lightingKey = JSON.stringify([s.id,width,height,dpr,cam,master,s.ambient,s.grid.size,s.grid.unit,s.grid.scale,
      viewers.map(v=>[v.x,v.y,v.vision]),s.walls,houseWalls(s),sources,lightTick]);
    const rebuild = cache.lightingKey !== lightingKey;
    const light = renderBuffer(c.canvas,'light',rebuild), colors = renderBuffer(c.canvas,'colors',rebuild),
      mask = renderBuffer(c.canvas,'darkness',rebuild);
    if (rebuild) {
      const visibility = renderBuffer(c.canvas,'visibility'), los = renderBuffer(c.canvas,'los');
      const transform = (ctx: CanvasRenderingContext2D) => ctx.setTransform(
        dpr*cam.zoom,0,0,dpr*cam.zoom,dpr*(width/2-cam.x*cam.zoom),dpr*(height/2-cam.y*cam.zoom));
      const lc = light.getContext('2d')!, vc = visibility.getContext('2d')!,
        line = los.getContext('2d')!, tc = colors.getContext('2d')!;
      transform(lc); transform(vc); transform(line); transform(tc);
      for (const v of viewers) {
        polygon(line,sightPolygon(v,50000,s));line.fillStyle='#fff';line.fill();
        if (v.vision>0) {polygon(vc,sightPolygon(v,visionPixels(v.vision,s),s));vc.fillStyle='#fff';vc.fill();}
      }
      for (const source of sources) {
        const r=visionPixels(source.bright+source.dim,s);if(r<=0)continue;
        // Both light and tint use exactly the same visibility polygon.
        const shape=sightPolygon(source,r,s,source.rotation,source.angle);
        const pulse=lightAnimationState(source,lightTick,reduced||o.visualEffects===false);
        lc.save();polygon(lc,shape);lc.clip();lc.globalAlpha=pulse.intensity;
        const gradient=lc.createRadialGradient(source.x,source.y,0,source.x,source.y,r);
        gradient.addColorStop(0,'#fff');gradient.addColorStop(Math.min(.99,source.bright/(source.bright+source.dim)*pulse.core),'#fff');gradient.addColorStop(1,'#ffffff70');
        lc.fillStyle=gradient;lc.fillRect(source.x-r,source.y-r,r*2,r*2);lc.restore();
        tc.save();polygon(tc,shape);tc.clip();
        const tint=tc.createRadialGradient(source.x,source.y,0,source.x,source.y,r);
        tint.addColorStop(0,source.color+Math.round(32*(pulse.intensity+pulse.warmth)).toString(16).padStart(2,'0'));tint.addColorStop(1,source.color+'00');
        tc.fillStyle=tint;tc.fillRect(source.x-r,source.y-r,r*2,r*2);tc.restore();
      }
      lc.setTransform(1,0,0,1,0,0);
      if(!master){lc.globalCompositeOperation='destination-in';lc.drawImage(los,0,0);}
      vc.setTransform(1,0,0,1,0,0);
      if(s.ambient>.05)vc.drawImage(los,0,0);
      if(master&&s.ambient>.05){vc.fillStyle='#fff';vc.fillRect(0,0,width*dpr,height*dpr);}
      vc.drawImage(light,0,0);
      if(master&&!viewers.length)vc.drawImage(light,0,0);
      const m=mask.getContext('2d')!;
      m.fillStyle='#03060a';m.fillRect(0,0,mask.width,mask.height);
      m.globalCompositeOperation='destination-out';m.drawImage(visibility,0,0);
      cache.lightingKey=lightingKey;cache.lightingBuilds++;
    }
    c.save();c.setTransform(1,0,0,1,0,0);
    if(!master){
      const world=renderBuffer(c.canvas,'world'), colored=renderBuffer(c.canvas,'colored');
      world.getContext('2d')!.drawImage(c.canvas,0,0);
      c.filter=s.ambient<=.05?'grayscale(1) brightness(.62)':`brightness(${.35+s.ambient*.65})`;
      c.drawImage(world,0,0);c.filter='none';
      const cc=colored.getContext('2d')!;
      cc.drawImage(world,0,0);cc.drawImage(colors,0,0);cc.globalCompositeOperation='destination-in';cc.drawImage(light,0,0);
      c.drawImage(colored,0,0);
    }else c.drawImage(colors,0,0);
    c.globalAlpha=darkness;c.drawImage(mask,0,0);c.restore();
  }
  if (s.fog && s.fogMode === 'manual') {
    const cache = renderWorkCache(c.canvas);
    const fogKey = JSON.stringify([s.id,width,height,dpr,cam,s.reveals,s.fogAreas]);
    const mask = renderBuffer(c.canvas,'manual-fog',cache.fogKey !== fogKey);
    const m = mask.getContext('2d')!;
    if (cache.fogKey !== fogKey) {
    m.fillStyle = '#03060a';
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
    for (const area of s.fogAreas) {
      m.globalCompositeOperation = area.reveal ? 'destination-out' : 'source-over';
      m.fillStyle = '#03060a';
      polygon(m, area.points);
      m.fill();
    }
    cache.fogKey = fogKey;
    }
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = o.gm && !o.preview ? s.gmDarkness : 1;
    c.drawImage(mask, 0, 0);
    c.restore();
  }
  drawHouseVision(c,s,o);
  if (o.showWalls && o.gm && !o.preview && o.layer === 'lighting') {
    c.save();
    c.lineWidth = 4 / cam.zoom;
    for(const t of s.tokens){const trunk=treeTrunk(t);if(!trunk)continue;c.strokeStyle='#bc7770';c.setLineDash([]);c.beginPath();c.arc(trunk.x,trunk.y,trunk.radius,0,Math.PI*2);c.stroke();}
    for (const wall of [...s.walls,...houseWalls(s)]) {
      c.strokeStyle =
        wall.kind === 'door'
          ? wall.open
            ? '#79a891'
            : '#dfb470'
          : wall.kind === 'window'
            ? '#82b4cc'
            : '#bc7770';
      if (o.selected.includes(wall.id)) c.strokeStyle = '#fff0b1';
      c.setLineDash(wall.open ? [8 / cam.zoom, 8 / cam.zoom] : []);
      path(c, [wall.a, wall.b]);
      c.stroke();
      c.fillStyle = c.strokeStyle;
      for (const p of [wall.a, wall.b]) {
        if (wall.kind === 'window' || wall.kind === 'door') {
          const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) + Math.PI / 2;
          path(c, [
            {
              x: p.x + (Math.cos(angle) * 7) / cam.zoom,
              y: p.y + (Math.sin(angle) * 7) / cam.zoom,
            },
            {
              x: p.x - (Math.cos(angle) * 7) / cam.zoom,
              y: p.y - (Math.sin(angle) * 7) / cam.zoom,
            },
          ]);
          c.stroke();
        } else {
          c.beginPath();
          c.arc(p.x, p.y, 4 / cam.zoom, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    c.restore();
  }
  if (o.gm && !o.preview && o.layer === 'lighting')
    for (const l of s.lights) {
      c.save();
      c.globalAlpha = l.enabled ? 1 : 0.4;
      c.translate(l.x, l.y);
      c.fillStyle = '#18212b';
      c.strokeStyle = o.selected.includes(l.id) ? '#fff0b1' : l.color;
      c.lineWidth = 2 / cam.zoom;
      c.beginPath();
      c.arc(0, 0, 11 / cam.zoom, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = l.color;
      c.beginPath();
      c.arc(0, 0, 4 / cam.zoom, 0, Math.PI * 2);
      c.fill();
      c.font = `11px Inter`;
      c.scale(1 / cam.zoom, 1 / cam.zoom);
      c.textAlign = 'center';
      c.fillText(l.name, 0, 27);
      c.restore();
    }
  for (const d of s.drawings.filter((d) => o.selected.includes(d.id) && d.layer === o.layer)) {
    const box = drawingBounds(d);
    c.save();
    c.strokeStyle = '#efd293';
    c.lineWidth = 2 / cam.zoom;
    c.setLineDash([6 / cam.zoom, 3 / cam.zoom]);
    c.strokeRect(
      box.x - 6 / cam.zoom,
      box.y - 6 / cam.zoom,
      box.width + 12 / cam.zoom,
      box.height + 12 / cam.zoom,
    );
    c.restore();
  }
  if (o.draft) drawing(c, o.draft);
  if (o.lasso && o.lasso.length > 1) {
    c.save();
    polygon(c, o.lasso);
    c.fillStyle = '#d7b77225';
    c.fill('evenodd');
    c.strokeStyle = '#f0d38d';
    c.lineWidth = 2 / cam.zoom;
    c.lineJoin = 'round';
    c.setLineDash([7 / cam.zoom, 4 / cam.zoom]);
    c.stroke();
    c.restore();
  }
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
    const before = o.ruler.at(-2)!,
      angle = Math.atan2(b.y - before.y, b.x - before.x);
    c.fillStyle = '#ebce88';
    polygon(c, [
      b,
      {
        x: b.x - (Math.cos(angle - 0.45) * 12) / cam.zoom,
        y: b.y - (Math.sin(angle - 0.45) * 12) / cam.zoom,
      },
      {
        x: b.x - (Math.cos(angle + 0.45) * 12) / cam.zoom,
        y: b.y - (Math.sin(angle + 0.45) * 12) / cam.zoom,
      },
    ]);
    c.fill();
    c.font = `bold ${14 / cam.zoom}px sans-serif`;
    c.textAlign = 'center';
    const label = rulerLabel(o.ruler, g),
      w = c.measureText(label).width + 20 / cam.zoom;
    c.fillStyle = '#171b20';
    c.fillRect((a.x + b.x) / 2 - w / 2, (a.y + b.y) / 2 - 20 / cam.zoom, w, 24 / cam.zoom);
    c.fillStyle = '#f6dfab';
    c.fillText(label, (a.x + b.x) / 2, (a.y + b.y) / 2 - 3 / cam.zoom);
    c.restore();
  }
  if (o.ping && o.visualEffects !== false) drawPing(c, o.ping, cam.zoom);
  if (o.terrainCursor && o.gm && !o.preview) {
    c.save(); c.beginPath(); c.arc(o.terrainCursor.x,o.terrainCursor.y,o.terrainCursor.radius,0,Math.PI*2);
    c.strokeStyle = o.terrainCursor.erase ? '#f8b6a3' : '#f5e0a0'; c.lineWidth = 1.5/cam.zoom;
    c.setLineDash([5/cam.zoom,4/cam.zoom]); c.stroke(); c.restore();
  }
  if (o.gm && !o.preview && o.resizeTokenId) {
    const token = s.tokens.find(t => t.id === o.resizeTokenId && !t.locked && t.layer === o.layer);
    if (token) {
      c.save();
      c.setLineDash([]);
      c.lineWidth = 1.5 / cam.zoom;
      c.fillStyle = '#19252b';
      c.strokeStyle = '#f5d893';
      if(token.layer==='map'){
        const h=tokenRotationHandle(token,cam.zoom),a=token.rotation*Math.PI/180;
        path(c,[{x:token.x+Math.sin(a)*token.height/2,y:token.y-Math.cos(a)*token.height/2},h]);c.stroke();
        c.beginPath();c.arc(h.x,h.y,8/cam.zoom,0,Math.PI*2);c.fill();c.stroke();
        c.font=`${13/cam.zoom}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f5d893';c.fillText('↻',h.x,h.y);c.fillStyle='#19252b';
      }
      for (const h of tokenResizeHandles(token, cam.zoom)) {
        c.fillRect(h.x - 5 / cam.zoom, h.y - 5 / cam.zoom, 10 / cam.zoom, 10 / cam.zoom);
        c.strokeRect(h.x - 5 / cam.zoom, h.y - 5 / cam.zoom, 10 / cam.zoom, 10 / cam.zoom);
      }
      c.restore();
    }
  }
  c.strokeStyle = '#5b5846';
  c.lineWidth = 2 / cam.zoom;
  c.strokeRect(0, 0, s.width, s.height);
  c.restore();
}

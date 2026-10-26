import type { TerrainStroke, TerrainLayer, VttScene } from '../shared/vtt';
import { terrainTextures, woodlandFloorImage, isGrassTexture } from '../shared/vtt-terrain';
import { isTreeCanopy } from '../shared/vtt-canopies';
import { viewerSees, type VttToken } from '../shared/vtt';
import type { RenderOptions } from './vtt-canvas';
import { softenTerrainMask } from './vtt-terrain-blur';
import {terrainContactSoftness,roughenTerrainMargin} from './vtt-terrain-edge';
import { grassMaterial } from './vtt-grass-material';
import { waterShore } from './vtt-water-shore';

const TILE = 512;
// Neighbouring tiles render the same border pixels. The padded image can then
// be sampled across its edge without blending with transparent canvas pixels.
const GUTTER = 2;
const RASTER = TILE + GUTTER * 2;
const BUDGET = 96 * 1024 * 1024;
const defaultLayers: TerrainLayer[] = [{ id: 'base', name: 'Chão', visible: true, opacity: 1 }];
type Bounds = { left: number; top: number; right: number; bottom: number };
type Stroke = { value: TerrainStroke; bounds: Bounds };
type Split = { layer: string; under?: HTMLCanvasElement; active: HTMLCanvasElement; over?: HTMLCanvasElement };
type Tile = {
  bounds: Bounds; density: number; canvas: HTMLCanvasElement; valid: boolean;
  split?: Split; draft?: TerrainStroke; preview?: HTMLCanvasElement;
  baked?: {key:string;canvas:HTMLCanvasElement};
  revision: number; grass?: { scale: number; image: HTMLImageElement; canvas: HTMLCanvasElement };
  ground?: { signature: string; image: HTMLImageElement; canvas: HTMLCanvasElement };
  shore?: { revision: number; canvas: HTMLCanvasElement };
};
type Cache = {
  ocean?:boolean;
  epoch: number; flat?: {key:string;canvas:HTMLCanvasElement;filled:Set<string>;density:number;extent?:Bounds};
  scene: string; source?: TerrainStroke[]; strokes: Stroke[]; layers: TerrainLayer[];
  images: (HTMLImageElement | undefined)[]; imageWidths: number[];
  tiles: Map<string, Tile>; mask: HTMLCanvasElement; piece: HTMLCanvasElement; layer: HTMLCanvasElement; work: HTMLCanvasElement;
  coverage: HTMLCanvasElement; layerCoverage: HTMLCanvasElement; layerAlpha: HTMLCanvasElement;
  blurInput: Float32Array; blurOutput: Float32Array;
  masks: Map<string,{value:TerrainStroke;bounds:Bounds;density:number;canvas:HTMLCanvasElement}>;
  stats: { tilesBuilt: number; strokesDrawn: number; draftTilesRendered: number; groundTilesBuilt: number; shoreTilesBuilt: number };
};
const caches = new WeakMap<HTMLCanvasElement, Cache>();
const overlaps = (a: Bounds, b: Bounds) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function bounds(s: TerrainStroke): Bounds {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of s.points) { left = Math.min(left, p.x); top = Math.min(top, p.y); right = Math.max(right, p.x); bottom = Math.max(bottom, p.y); }
  const margin = s.radius * (1 + terrainContactSoftness(s));
  return { left: left - margin, top: top - margin, right: right + margin, bottom: bottom + margin };
}
function sameStroke(a: TerrainStroke, b: TerrainStroke) {
  if (a === b) return true;
  if (a.id !== b.id || a.texture !== b.texture || a.erase !== b.erase || a.radius !== b.radius ||
      a.softness !== b.softness || a.opacity !== b.opacity || a.textureScale !== b.textureScale ||
      (a.shape || 'round') !== (b.shape || 'round') || (a.layer || 'base') !== (b.layer || 'base') ||
      a.points.length !== b.points.length) return false;
  return a.points.every((p, i) => p.x === b.points[i].x && p.y === b.points[i].y);
}
function canvas() { const c = document.createElement('canvas'); c.width = c.height = RASTER; return c; }
function clear(c: HTMLCanvasElement, w = RASTER, h = RASTER) {
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.resetTransform(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.clearRect(0, 0, w, h);
  return ctx;
}
function bytes(t: Tile) { return RASTER * RASTER * 4 * (1 + (t.split ? 1 + Number(!!t.split.under) + Number(!!t.split.over) : 0) + (t.preview ? 1 : 0) + Number(!!t.grass) + Number(!!t.ground) + Number(!!t.shore) + Number(!!t.baked)); }
export function terrainCacheStats(c: HTMLCanvasElement) {
  const cache = caches.get(c);
  return cache ? { ...cache.stats, cacheBytes: (cache.flat?cache.flat.canvas.width*cache.flat.canvas.height*4:0)+[...cache.tiles.values()].reduce((n, t) => n + bytes(t), 0), maskBytes: [...cache.masks.values()].reduce((n, m) => n + m.canvas.width * m.canvas.height * 4, 0), tiles: cache.tiles.size } : null;
}

// Immutable documents may clone the paint during token movement. Compare only when
// that array changes; animation and cursor frames never serialize the stroke history.
function update(cache: Cache, scene: VttScene, images: RenderOptions['images']) {
  const oceanChange=cache.ocean!==!!scene.ocean?.enabled;cache.ocean=!!scene.ocean?.enabled;
  const layers = scene.terrainLayers || defaultLayers;
  const layerChange = oceanChange || layers.length !== cache.layers.length || layers.some((l, i) => {
    const old = cache.layers[i]; return !old || l.id !== old.id || l.visible !== old.visible || l.opacity !== old.opacity;
  });
  // Dimensions can arrive before the response finishes. Only snapshot drawable
  // images so completion invalidates tiles that were cached without this paint.
  const loaded = terrainTextures.map(t => {
    const image = images.get(t.image);
    return image?.complete && image.naturalWidth ? image : undefined;
  });
  const imageChange = loaded.some((img, i) => img !== cache.images[i] || (img?.naturalWidth || 0) !== cache.imageWidths[i]);
  const source = scene.terrain || [];
  if (layerChange || imageChange) cache.epoch++;
  if (layerChange || imageChange) for (const t of cache.tiles.values()) { t.valid = false; t.split = undefined; t.preview = undefined; t.draft = undefined; t.grass = undefined; t.revision++; }
  if (source !== cache.source) {
    const old = new Map(cache.strokes.map(s => [s.value.id, s]));
    const changed: Bounds[] = [];
    const next = source.map(value => {
      const previous = old.get(value.id); old.delete(value.id);
      if (previous && sameStroke(previous.value, value)) return { ...previous, value };
      const area = bounds(value); changed.push(area); if (previous) changed.push(previous.bounds);
      return { value, bounds: area };
    });
    for (const removed of old.values()) changed.push(removed.bounds);
    if(changed.length)cache.epoch++;
    for(const [key,mask] of cache.masks) if(!next.some(s=>s.value.id===mask.value.id)) cache.masks.delete(key);
    const appended = !layerChange && !imageChange && source.length >= cache.strokes.length &&
      cache.strokes.every((s, i) => sameStroke(s.value, source[i]));
    const additions = appended ? next.slice(cache.strokes.length) : [];
    cache.layers = layers.map(l => ({ ...l })); cache.images = loaded; cache.imageWidths = loaded.map(img => img?.naturalWidth || 0);
    for (const tile of cache.tiles.values()) {
      if (!changed.some(b => overlaps({left:b.left-26,top:b.top-26,right:b.right+26,bottom:b.bottom+26},tile.bounds))) continue;
      // Commit into the draft's cached layer without replaying older paint.
      if (tile.valid && tile.split && appended && additions.every(s => (s.value.layer || 'base') === tile.split!.layer)) {
        for (const s of additions) if (overlaps(s.bounds, tile.bounds)) apply(cache, tile, s.value, tile.split.active);
        compose(cache, tile, tile.canvas, tile.split.active);
      } else { tile.valid = false; tile.split = undefined; }
      tile.preview = undefined; tile.draft = undefined;
      tile.revision++;
    }
    cache.source = source; cache.strokes = next;
  }
  cache.layers = layers.map(l => ({ ...l })); cache.images = loaded; cache.imageWidths = loaded.map(img => img?.naturalWidth || 0);
}

function alphaMask(cache: Cache, tile: Tile, s: TerrainStroke) {
  const softness=terrainContactSoftness(s);
  const original = bounds(s), density = softness > 0 ? Math.min(tile.density, 1, 6 / Math.max(.01, s.radius * softness * .3)) : tile.density;
  const snap = (b: Bounds): Bounds => ({left:Math.floor(b.left*density)/density,top:Math.floor(b.top*density)/density,right:Math.ceil(b.right*density)/density,bottom:Math.ceil(b.bottom*density)/density});
  let area = snap(original);
  const complete = (area.right-area.left)*density*(area.bottom-area.top)*density <= 1024*1024;
  const key = s.id+':'+density;
  let stored = complete ? cache.masks.get(key) : undefined;
  if (stored && sameStroke(stored.value,s)) { cache.masks.delete(key);cache.masks.set(key,stored);return stored; }
  if (!complete) {
    const margin=s.radius*softness*.9+3/density;
    area=snap({left:Math.max(original.left,tile.bounds.left-margin),top:Math.max(original.top,tile.bounds.top-margin),right:Math.min(original.right,tile.bounds.right+margin),bottom:Math.min(original.bottom,tile.bounds.bottom+margin)});
  }
  const mw=Math.max(1,Math.round((area.right-area.left)*density)),mh=Math.max(1,Math.round((area.bottom-area.top)*density));
  const image = stored?.canvas || (complete ? canvas() : cache.mask);
  image.getContext('2d',{willReadFrequently:true});
  const mc=clear(image,mw,mh),sigma=s.radius*density*softness*.3;
  mc.setTransform(density,0,0,density,-area.left*density,-area.top*density);
  mc.fillStyle = mc.strokeStyle = '#fff'; mc.lineCap = mc.lineJoin = 'round';
  const radius = s.radius * (1 - softness * .35);
  if ((s.shape || 'round') === 'round') {
    mc.lineWidth = radius * 2; mc.beginPath();
    if (s.points.every(p => p.x === s.points[0].x && p.y === s.points[0].y)) { mc.arc(s.points[0].x, s.points[0].y, radius, 0, Math.PI * 2); mc.fill(); }
    else { s.points.forEach((p, i) => i ? mc.lineTo(p.x, p.y) : mc.moveTo(p.x, p.y)); mc.stroke(); }
  } else {
    // Filter the complete mask once instead of filtering every irregular stamp.
    const stamp = (x: number, y: number) => {
      if (s.shape === 'square') { mc.fillRect(x - radius, y - radius, radius * 2, radius * 2); return; }
      const seed = (Math.round(x * 13) * 73856093) ^ (Math.round(y * 13) * 19349663);
      mc.beginPath();
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI / 6, r = radius * (.65 + .35 * ((((seed ^ (i * 83492791)) >>> 0) % 1000) / 1000));
        const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
        if (i) mc.lineTo(px, py); else mc.moveTo(px, py);
      }
      mc.closePath(); mc.fill();
    };
    stamp(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1], b = s.points[i];
      const steps = Math.min(512, Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (radius * .4))));
      for (let j = 1; j <= steps; j++) stamp(a.x + (b.x - a.x) * j / steps, a.y + (b.y - a.y) * j / steps);
    }
  }

  if (sigma > .5) {
    const pixels=mc.getImageData(0,0,mw,mh),count=mw*mh;
    if(cache.blurInput.length<count){cache.blurInput=new Float32Array(count);cache.blurOutput=new Float32Array(count);}
    softenTerrainMask(pixels.data,mw,mh,sigma,cache.blurInput,cache.blurOutput);
    if(!s.erase)roughenTerrainMargin(pixels.data,mw,mh,area.left,area.top,density);
    mc.putImageData(pixels,0,0);
  }
  const result={value:s,bounds:area,density,canvas:image};
  if(complete){
    cache.masks.delete(key);cache.masks.set(key,result);
    let memory=[...cache.masks.values()].reduce((n,m)=>n+m.canvas.width*m.canvas.height*4,0);
    for(const [id,m] of cache.masks){if(memory<=24*1024*1024)break;memory-=m.canvas.width*m.canvas.height*4;cache.masks.delete(id);}
  }
  return result;
}
function apply(cache: Cache, tile: Tile, s: TerrainStroke, target: HTMLCanvasElement) {
  const image=cache.images[terrainTextures.findIndex(t=>t.id===s.texture)];
  if(!s.erase && (!image?.complete || !image.naturalWidth)) return;
  cache.stats.strokesDrawn++;
  const mask=alphaMask(cache,tile,s),area=mask.bounds;
  const left=Math.max(0,Math.floor((area.left-tile.bounds.left)*tile.density)),top=Math.max(0,Math.floor((area.top-tile.bounds.top)*tile.density));
  const right=Math.min(RASTER,Math.ceil((area.right-tile.bounds.left)*tile.density)),bottom=Math.min(RASTER,Math.ceil((area.bottom-tile.bounds.top)*tile.density));
  if(right<=left || bottom<=top)return;
  const w=right-left,h=bottom-top,pc=clear(cache.piece,w,h);
  if(!s.erase){
    if(isGrassTexture(s.texture)) {
      if(!tile.grass || tile.grass.scale !== s.textureScale || tile.grass.image !== image) tile.grass = { scale:s.textureScale, image:image!, canvas:grassMaterial(image!,tile.bounds,tile.density,s.textureScale) };
      pc.drawImage(tile.grass.canvas,left,top,w,h,0,0,w,h);
    } else {
      const pattern=pc.createPattern(image!,'repeat')!;
      pattern.setTransform(new DOMMatrix([s.textureScale/image!.naturalWidth*tile.density,0,0,s.textureScale/image!.naturalHeight*tile.density,-tile.bounds.left*tile.density-left,-tile.bounds.top*tile.density-top]));
      pc.fillStyle=pattern;pc.fillRect(0,0,w,h);
    }
    pc.globalCompositeOperation='destination-in';
  }
  pc.drawImage(mask.canvas,(area.left-tile.bounds.left)*tile.density-left,(area.top-tile.bounds.top)*tile.density-top,(area.right-area.left)*tile.density,(area.bottom-area.top)*tile.density);
  const tc=target.getContext('2d')!;tc.globalAlpha=s.opacity;tc.globalCompositeOperation=s.erase?'destination-out':'source-over';tc.drawImage(cache.piece,left,top);tc.globalAlpha=1;tc.globalCompositeOperation='source-over';
}
function renderLayer(cache: Cache, tile: Tile, layer: TerrainLayer, target: HTMLCanvasElement) {
  clear(target);
  for (const s of cache.strokes) if ((s.value.layer || 'base') === layer.id && overlaps(s.bounds, tile.bounds)) apply(cache, tile, s.value, target);
}
function buildTile(cache: Cache, tile: Tile, active?: string) {
  const out = clear(tile.canvas), temp = cache.layer;
  let split: Split | undefined;
  if (active) split = { layer: active, active: canvas() };
  let past = false;
  for (const l of cache.layers) {
    if (l.id === active) past = true;
    if (!l.visible || l.opacity <= 0) continue;
    if (!cache.strokes.some(s => (s.value.layer || 'base') === l.id && overlaps(s.bounds, tile.bounds))) continue;
    renderLayer(cache, tile, l, l.id === active ? split!.active : temp);
    const rendered = l.id === active ? split!.active : temp;
    out.globalAlpha = l.opacity; out.drawImage(rendered, 0, 0);
    if (split && l.id !== active) {
      const part = past ? 'over' : 'under'; split[part] ||= canvas();
      const c = split[part]!.getContext('2d')!; c.globalAlpha = l.opacity; c.drawImage(rendered, 0, 0);
    }
  }
  out.globalAlpha = 1; tile.valid = true; tile.split = split; tile.preview = undefined; tile.draft = undefined; tile.revision++; cache.stats.tilesBuilt++;
}

// Dirt/leaf contact patches belong to the ground, below actors and canopies.
// Build only tiles touched by a visible tree. Paint masks and complete overlays
// are cached; moving a character or camera never replays the brush history.
function woodlandGround(cache: Cache, tile: Tile, trees: VttToken[], image: HTMLImageElement) {
  const nearby = trees.filter(t => {
    const r = Math.max(t.width,t.height) * .62;
    return overlaps(tile.bounds,{left:t.x-r,top:t.y-r,right:t.x+r,bottom:t.y+r});
  });
  if(!nearby.length || !cache.strokes.some(s => isGrassTexture(s.value.texture) && !s.value.erase && overlaps(s.bounds,tile.bounds))) { tile.ground = undefined; return null; }
  const signature = tile.revision + ':' + nearby.map(t => [t.id,t.x,t.y,t.width,t.height,t.rotation,t.flipX,t.flipY].join(',')).join(';');
  if(tile.ground?.signature === signature && tile.ground.image === image) return tile.ground.canvas;
  const coverage = clear(cache.coverage);
  for(const layer of cache.layers) {
    if(!layer.visible || layer.opacity <= 0) continue;
    const gc = clear(cache.layerCoverage), ac = clear(cache.layerAlpha);
    for(const stroke of cache.strokes) {
      const s = stroke.value;
      if((s.layer || 'base') !== layer.id || !overlaps(stroke.bounds,tile.bounds)) continue;
      const texture = cache.images[terrainTextures.findIndex(t=>t.id===s.texture)];
      if(!s.erase && (!texture?.complete || !texture.naturalWidth)) continue;
      const mask = alphaMask(cache,tile,s), b = mask.bounds;
      for(const [c,grass] of [[gc,true],[ac,false]] as const) {
        c.globalAlpha = s.opacity;
        c.globalCompositeOperation = s.erase || (grass && !isGrassTexture(s.texture)) ? 'destination-out' : 'source-over';
        c.drawImage(mask.canvas,(b.left-tile.bounds.left)*tile.density,(b.top-tile.bounds.top)*tile.density,(b.right-b.left)*tile.density,(b.bottom-b.top)*tile.density);
      }
    }
    coverage.globalAlpha = layer.opacity;
    coverage.globalCompositeOperation = 'destination-out'; coverage.drawImage(cache.layerAlpha,0,0);
    coverage.globalCompositeOperation = 'lighter'; coverage.drawImage(cache.layerCoverage,0,0);
  }
  const out = tile.ground?.canvas || canvas(), c = clear(out);
  c.setTransform(tile.density,0,0,tile.density,-tile.bounds.left*tile.density,-tile.bounds.top*tile.density);
  for(const t of nearby) {
    c.save();c.translate(t.x,t.y);c.rotate(t.rotation*Math.PI/180);
    c.scale(t.flipX?-1:1,t.flipY?-1:1);c.globalAlpha=.65;
    c.drawImage(image,-t.width*.55,-t.height*.55,t.width*1.1,t.height*1.1);c.restore();
  }
  c.resetTransform();c.globalAlpha=1;c.globalCompositeOperation='destination-in';c.drawImage(cache.coverage,0,0);
  tile.ground={signature,image,canvas:out};cache.stats.groundTilesBuilt++;
  return out;
}
function compose(cache: Cache, tile: Tile, target: HTMLCanvasElement, active: HTMLCanvasElement) {
  const split = tile.split!, c = clear(target), metadata = cache.layers.find(l => l.id === split.layer);
  if (split.under) c.drawImage(split.under, 0, 0);
  if (metadata?.visible && metadata.opacity > 0) { c.globalAlpha = metadata.opacity; c.drawImage(active, 0, 0); }
  c.globalAlpha = 1; if (split.over) c.drawImage(split.over, 0, 0);
}
function draftTile(cache: Cache, tile: Tile, draft: TerrainStroke) {
  if (tile.draft === draft && tile.preview) return tile.preview;
  if (!tile.valid || tile.split?.layer !== (draft.layer || 'base')) buildTile(cache, tile, draft.layer || 'base');
  const active = cache.work; clear(active).drawImage(tile.split!.active, 0, 0);
  apply(cache, tile, draft, active);
  tile.preview ||= canvas(); compose(cache, tile, tile.preview, active);
  tile.draft = draft; cache.stats.draftTilesRendered++;
  return tile.preview;
}

function shoreline(cache: Cache, tile: Tile) {
  if(tile.shore?.revision === tile.revision) return tile.shore.canvas;
  if(!cache.ocean&&!cache.strokes.some(s=>s.value.texture==='water'&&!s.value.erase&&overlaps(s.bounds,tile.bounds))) {tile.shore=undefined;return null;}
  // A small mask with a 24-world-pixel neighbour margin; native water texture
  // remains full resolution. Reusing alphaMask avoids replaying geometry/blur.
  const density=Math.min(tile.density,.5),padding=26;
  const area={left:Math.floor((tile.bounds.left-padding)*density)/density,top:Math.floor((tile.bounds.top-padding)*density)/density,right:Math.ceil((tile.bounds.right+padding)*density)/density,bottom:Math.ceil((tile.bounds.bottom+padding)*density)/density};
  const w=Math.round((area.right-area.left)*density),h=Math.round((area.bottom-area.top)*density);
  const coverage=clear(cache.coverage,w,h);
  if(cache.ocean){coverage.fillStyle='#fff';coverage.fillRect(0,0,w,h);}
  for(const layer of cache.layers) {
    if(!layer.visible||layer.opacity<=0)continue;
    const gc=clear(cache.layerCoverage,w,h),ac=clear(cache.layerAlpha,w,h);
    for(const stroke of cache.strokes) {
      const s=stroke.value;
      if((s.layer||'base')!==layer.id||!overlaps(stroke.bounds,area))continue;
      const texture=cache.images[terrainTextures.findIndex(t=>t.id===s.texture)];
      if(!s.erase&&(!texture?.complete||!texture.naturalWidth))continue;
      const mask=alphaMask(cache,{...tile,bounds:area},s),b=mask.bounds;
      for(const [c,water] of [[gc,true],[ac,false]] as const) {
        c.globalAlpha=s.opacity;c.globalCompositeOperation=s.erase||(water&&s.texture!=='water')?'destination-out':'source-over';
        c.drawImage(mask.canvas,(b.left-area.left)*density,(b.top-area.top)*density,(b.right-b.left)*density,(b.bottom-b.top)*density);
      }
    }
    coverage.globalAlpha=layer.opacity;coverage.globalCompositeOperation='destination-out';coverage.drawImage(cache.layerAlpha,0,0);
    coverage.globalCompositeOperation='lighter';coverage.drawImage(cache.layerCoverage,0,0);
  }
  const out=waterShore(cache.coverage,area,density,tile.bounds,tile.density);
  tile.shore={revision:tile.revision,canvas:out};cache.stats.shoreTilesBuilt++;
  return out;
}

export function drawTerrain(c: CanvasRenderingContext2D, scene: VttScene, o: RenderOptions) {
  if (!(scene.terrain?.length || o.terrainDraft)) { caches.delete(c.canvas); return; }
  let cache = caches.get(c.canvas);
  if (!cache || cache.scene !== scene.id) {
    const mask = canvas(); mask.getContext('2d', { willReadFrequently: true });
    const coverage=canvas();coverage.getContext('2d',{willReadFrequently:true});
    cache = { epoch:0, scene: scene.id, strokes: [], layers: [], images: [], imageWidths: [], tiles: new Map(), mask, piece: canvas(), layer: canvas(), work: canvas(), coverage,layerCoverage:canvas(),layerAlpha:canvas(),blurInput: new Float32Array(0), blurOutput: new Float32Array(0), masks: new Map(), stats: { tilesBuilt: 0, strokesDrawn: 0, draftTilesRendered: 0, groundTilesBuilt:0, shoreTilesBuilt:0 } };
    caches.set(c.canvas, cache);
  }
  update(cache, scene, o.images);
  const zoom = o.camera.zoom * o.dpr, tx = c.canvas.width / 2 - o.camera.x * zoom, ty = c.canvas.height / 2 - o.camera.y * zoom;
  // World tiles survive camera moves and small zoom changes. Rasterize only the
  // visible tiles; the LRU budget bounds retained bitmap memory.
  // Fixed map resolution: scrolling no longer invalidates/replays brush history.
  // Full native detail. Large maps use consolidated chunks under the same LRU
  // ceiling instead of allocating a gigabyte-sized bitmap or blurring the art.
  const consolidate=scene.width*scene.height<=16*1024*1024&&Math.max(scene.width,scene.height)<=8192;
  const density=1,world=TILE;
  const visible = { left: Math.max(0, -tx / zoom), top: Math.max(0, -ty / zoom), right: Math.min(scene.width, (c.canvas.width - tx) / zoom), bottom: Math.min(scene.height, (c.canvas.height - ty) / zoom) };
  const draftBounds = o.terrainDraft ? bounds(o.terrainDraft) : null;
  const floorImage = o.images.get(woodlandFloorImage);
  const trees = floorImage?.complete && floorImage.naturalWidth ? (scene.tokens || []).filter(t => isTreeCanopy(t) && !((!o.gm || o.preview) && t.hidden) && !(o.preview && o.viewer && !viewerSees(o.viewer,t,scene))) : [];
  const key=[cache.epoch,scene.width,scene.height,density,floorImage?.naturalWidth||0,...trees.map(t=>[t.id,t.x,t.y,t.width,t.height,t.rotation,t.flipX,t.flipY].join(','))].join(':');
  if(!cache.flat||cache.flat.key!==key){
    const flat=cache.flat?.canvas||canvas();clear(flat,consolidate?scene.width:1,consolidate?scene.height:1);
    cache.flat={key,canvas:flat,filled:new Set(),density};
  }
  const flat=cache.flat,fc=flat.canvas.getContext('2d')!;
  c.save(); c.setTransform(zoom, 0, 0, zoom, tx, ty); c.beginPath(); c.rect(0, 0, scene.width, scene.height); c.clip();
  for (let y = Math.floor(visible.top / world); y < Math.ceil(visible.bottom / world); y++) {
    for (let x = Math.floor(visible.left / world); x < Math.ceil(visible.right / world); x++) {
      const key = `${density}:${x}:${y}`;
      if(!o.terrainDraft&&consolidate&&flat.filled.has(key))continue;
      let tile = cache.tiles.get(key);
      if (!tile) {
        const padding = GUTTER / density;
        const area = { left: x * world - padding, top: y * world - padding, right: (x + 1) * world + padding, bottom: (y + 1) * world + padding };
        const shoreArea={left:area.left-26,top:area.top-26,right:area.right+26,bottom:area.bottom+26};
        if (!cache.strokes.some(s => overlaps(s.bounds,shoreArea)) && !(draftBounds && overlaps(draftBounds,shoreArea))) continue;
        tile = { bounds: area, density, canvas: canvas(), valid: false, revision:0 }; cache.tiles.set(key, tile);
      }
      const affected = draftBounds && overlaps(draftBounds, tile.bounds);
      if (!tile.valid && !affected) buildTile(cache, tile);
      const image = affected ? draftTile(cache, tile, o.terrainDraft!) : tile.canvas;
      const bakedKey=flat.key+':'+tile.revision;
      let combined=image;
      if(!o.terrainDraft){
        if(tile.baked?.key!==bakedKey){
          const baked=tile.baked?.canvas||canvas(),bc=clear(baked);bc.drawImage(image,0,0);
          const shore=shoreline(cache,tile);if(shore)bc.drawImage(shore,0,0);
          if(trees.length){const ground=woodlandGround(cache,tile,trees,floorImage!);if(ground)bc.drawImage(ground,0,0);}
          tile.baked={key:bakedKey,canvas:baked};
        }
        combined=tile.baked!.canvas;
      }
      const intoAtlas=!o.terrainDraft&&consolidate,target=intoAtlas?fc:c;
      target.save();target.setTransform(intoAtlas?density:zoom,0,0,intoAtlas?density:zoom,intoAtlas?0:tx,intoAtlas?0:ty);
      target.beginPath();target.rect(x*world,y*world,world,world);target.clip();
      const size=RASTER/density;target.drawImage(combined,tile.bounds.left,tile.bounds.top,size,size);
      if(o.terrainDraft&&!affected){const shore=shoreline(cache,tile);if(shore)target.drawImage(shore,tile.bounds.left,tile.bounds.top,size,size);if(trees.length){const ground=woodlandGround(cache,tile,trees,floorImage!);if(ground)target.drawImage(ground,tile.bounds.left,tile.bounds.top,size,size);}}
      target.restore();if(intoAtlas){
        flat.filled.add(key);
        const b={left:Math.max(0,x*world-2),top:Math.max(0,y*world-2),right:Math.min(scene.width,(x+1)*world+2),bottom:Math.min(scene.height,(y+1)*world+2)};
        const old=flat.extent;flat.extent=old?{left:Math.min(old.left,b.left),top:Math.min(old.top,b.top),right:Math.max(old.right,b.right),bottom:Math.max(old.bottom,b.bottom)}:b;
      }
      cache.tiles.delete(key); cache.tiles.set(key, tile);
    }
  }
  if(!o.terrainDraft&&consolidate&&flat.extent){
    const b=flat.extent;c.drawImage(flat.canvas,b.left,b.top,b.right-b.left,b.bottom-b.top,b.left/density,b.top/density,(b.right-b.left)/density,(b.bottom-b.top)/density);
  }
  c.restore();
  let memory = [...cache.tiles.values()].reduce((n, t) => n + bytes(t), 0);
  for (const [key, tile] of cache.tiles) {
    if (memory <= BUDGET) break;
    memory -= bytes(tile); cache.tiles.delete(key);
  }
}

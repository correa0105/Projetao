import type {VttToken,VttScene} from '../shared/vtt';
import plants from '../shared/vtt-plants-catalog.json';
import {houseAsset,houseContains,houseWorld} from '../shared/vtt-houses';
const plantImages=new Set(plants.map(p=>p.image));
import {renderBuffer} from './vtt-render-cache';
/** Outdoor foliage can overlap wall faces, but cannot extend into a room. */
export function clipOutdoorPlants(c:CanvasRenderingContext2D,scene:VttScene,item:VttToken) {
  if(!plantImages.has(item.image)&&!item.image.startsWith('/vtt/trees-20261013/'))return;
  for(const h of scene.tokens){const a=houseAsset(h);if(!a||houseContains(h,item))continue;
    const f=a.footprint,points=[{x:f.left+.025,y:f.top+.025},{x:f.right-.025,y:f.top+.025},{x:f.right-.025,y:f.bottom-.025},{x:f.left+.025,y:f.bottom-.025}].map(p=>houseWorld(p,h));
    const path=new Path2D();path.rect(-32000,-32000,64000,64000);path.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))path.lineTo(p.x,p.y);path.closePath();c.clip(path,'evenodd');
  }
}
/** Native alpha keeps leaves in front of wall bases, while every closed roof stays above them. */
export function drawCanopiesBelowRoofs(c:CanvasRenderingContext2D,houses:VttToken[],images:Map<string,HTMLImageElement>,paint:(ctx:CanvasRenderingContext2D)=>void) {
  if(!houses.length){paint(c);return;}
  const surface=renderBuffer(c.canvas,'canopies-under-roofs'),ctx=surface.getContext('2d')!;
  ctx.setTransform(c.getTransform());paint(ctx);ctx.globalCompositeOperation='destination-out';ctx.globalAlpha=1;
  for(const h of houses){const roof=images.get(h.image);if(!roof?.complete||!roof.naturalWidth)continue;
    ctx.save();ctx.translate(h.x,h.y);ctx.rotate(h.rotation*Math.PI/180);ctx.scale(h.flipX?-1:1,h.flipY?-1:1);ctx.drawImage(roof,-h.width/2,-h.height/2,h.width,h.height);ctx.restore();
  }
  c.save();c.resetTransform();c.drawImage(surface,0,0);c.restore();
}

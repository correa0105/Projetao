import type {VttToken} from '../shared/vtt';

type Bounds={x:number;y:number;width:number;height:number;src:string};
const bounds=new WeakMap<HTMLImageElement,Bounds>();
/** Alpha padding is presentation space, not part of the object's physical footprint. */
export function objectSpriteBounds(image:HTMLImageElement):Bounds{
  const saved=bounds.get(image);if(saved?.src===image.src)return saved;
  const w=image.naturalWidth,h=image.naturalHeight;
  let result:Bounds={x:0,y:0,width:w,height:h,src:image.src};
  try{
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,w,h).data;let left=w,top=h,right=-1,bottom=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>16){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if(right>=left&&bottom>=top)result={x:left,y:top,width:right-left+1,height:bottom-top+1,src:image.src};
  }catch{/* An external custom image can still be drawn without inspecting its pixels. */}
  bounds.set(image,result);return result;
}
export function drawMapObject(c:CanvasRenderingContext2D,t:VttToken,image:HTMLImageElement){
  const b=objectSpriteBounds(image);
  const bed=/\/furniture-(011|012|014|016)\.webp$/.test(t.image);
  const fit=Math.min(t.width/b.width,t.height/b.height),w=bed?t.width:b.width*fit,h=bed?t.height:b.height*fit;
  c.drawImage(image,b.x,b.y,b.width,b.height,-w/2,-h/2,w,h);
}

import dimensions from './vtt-object-dimensions.json';

export const humanGridMetres=1.5;
const byImage=new Map(dimensions.map(d=>[d.image,d]));
// These two historical URLs still exist in saved scenes from before the art refinement.
for(const d of dimensions)if(d.image.includes('/home-furniture-refined-'))
  byImage.set(d.image.replace('/home-furniture-refined-','/home-furniture-'),d);
export function objectDimensions(image:string){
  const d=byImage.get(image);return d?{width:d.metres.width/humanGridMetres,height:d.metres.height/humanGridMetres}:undefined;
}
type ScaledToken={layer:string;image:string;width:number;height:number;assetScaleVersion?:2};
/** Calibrate untouched old defaults once; a deliberate custom size remains the user's size. */
export function calibrateObjectSizes<T extends {grid:{size:number};tokens:ScaledToken[]}>(scene:T):T{
  for(const t of scene.tokens){
    const d=byImage.get(t.image);if(t.layer!=='map'||!d||t.assetScaleVersion===2)continue;
    const g=scene.grid.size;
    if(Math.abs(t.width-d.previous.width*g)<.01&&Math.abs(t.height-d.previous.height*g)<.01){
      t.width=Math.max(8,d.metres.width/humanGridMetres*g);
      t.height=Math.max(8,d.metres.height/humanGridMetres*g);
    }
    t.assetScaleVersion=2;
  }
  return scene;
}

import {newToken,type Point,type VttScene} from './vtt';
import {natureAssets} from './vtt-nature-assets';
import {tokenPlacement} from './vtt-placement';
import {houseAsset,housePlacement} from './vtt-houses';
/** Natural grid dimensions also apply to drag/drop and scaled placement. */
export function createNatureToken(id:string,assetId:string,scene:VttScene,at:Point,scale=1){
 if(!Number.isFinite(scale)||scale<.25||scale>3)return null;
 const asset=natureAssets.find(a=>a.id===assetId);if(!asset)return null;
 const factor=Math.min(1,scene.width/(asset.width*scene.grid.size*scale),scene.height/(asset.height*scene.grid.size*scale),8000/(asset.width*scene.grid.size*scale),8000/(asset.height*scene.grid.size*scale));
 const width=Math.max(8,asset.width*scene.grid.size*scale*factor),height=Math.max(8,asset.height*scene.grid.size*scale*factor),p=tokenPlacement(at,{width,height},scene);
 const token=newToken(id,scene);
 Object.assign(token,{name:asset.name,image:asset.image,width,height,layer:asset.actor?'tokens':'map',vision:asset.actor?token.vision:0,bleeds:!!asset.actor,notes:asset.notes??'',x:p.x,y:p.y});
 if(houseAsset(token))Object.assign(token,housePlacement(token,scene));
 return token;
}

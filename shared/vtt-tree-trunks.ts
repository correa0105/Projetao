import {treeAssets} from './vtt-tree-assets';
import {canopyWorld} from './vtt-canopies';
import {pointSegmentDistance} from './vtt-collision';
import type {Point,VttScene,VttToken} from './vtt';
const trees=new Map(treeAssets.map(t=>[t.image,t]));
/** Ground footprint only; branches and canopy remain passable. */
export function treeTrunk(t:VttToken) {
  const asset=t.layer==='map'?trees.get(t.image):undefined;if(!asset)return null;
  const radius=asset.id==='baobab'?.105:['oak-ancient','oak-hollow','dead-oak','blight-tree','swamp-tree'].includes(asset.id)?.085:['oak-young','birch','birch-autumn','palm'].includes(asset.id)?.035:.055;
  return{...canopyWorld({x:.5,y:asset.id==='dead-oak'?.52:.54},t),radius:Math.min(t.width,t.height)*radius};
}
export function treeMovementBlocked(scene:VttScene,from:Point,to:Point,bodyRadius:number) {
  return scene.tokens.some(t=>{
    const trunk=treeTrunk(t);if(!trunk)return false;
    const radius=trunk.radius+bodyRadius,before=Math.hypot(from.x-trunk.x,from.y-trunk.y),after=Math.hypot(to.x-trunk.x,to.y-trunk.y);
    // A token from an older scene can leave an existing overlap, never deepen it.
    if(before<radius&&after>before&&(to.x-from.x)*(from.x-trunk.x)+(to.y-from.y)*(from.y-trunk.y)>=0)return false;
    return pointSegmentDistance(trunk,from,to)<radius-.001;
  });
}

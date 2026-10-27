import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardTableCardCorners,cardTableLayouts,cardTableMatrix,cardTableProjection,cardTableScenes,projectTablePoint,type TableKind} from '../src/card-table-projection';

test('card plane follows the four calibrated corners of each scene',()=>{
  for(const kind of ['wide','tall'] as const){
    const scene=cardTableScenes[kind],size=cardTableLayouts[kind],matrix=cardTableMatrix(scene.points,size);
    const {width:w,height:h}=size;
    for(const [i,[x,y]] of [[0,0],[w,0],[w,h],[0,h]].entries()){
      const point=projectTablePoint(matrix,x,y),expected=scene.points[i];
      assert(Math.abs(point.x-expected.x)<1e-6);assert(Math.abs(point.y-expected.y)<1e-6);
    }
  }
});
test('every rotated card corner remains on the felt and in the viewport, including filtered arcs',()=>{
  for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[768,1024],[390,844],[320,740],[320,922],[1920,720]]){
    const p=cardTableProjection(width,height),scene=cardTableScenes[p.kind];
    for(const count of [1,4,8]){
      for(let i=0;i<count;i++){
        for(const corner of cardTableCardCorners(p.kind,i,count)){
          const point=projectTablePoint(p.matrix,corner.x,corner.y);
          assert(point.x>=9.99&&point.x<=width-9.99);assert(point.y>=9.99&&point.y<=height-9.99);
          const x=(point.x-p.left)/p.scale,y=(point.y-p.top)/p.scale,felt=scene.felt;
          assert(x>=felt.left&&x<=felt.right&&y>=felt.top&&y<=felt.bottom,`Outside felt at ${width}x${height}`);
        }
      }
    }
  }
});

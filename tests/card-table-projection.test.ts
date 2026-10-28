import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardTableCardCorners,cardTableLayouts,cardTableMatrix,cardTableProjection,cardTableScenes,projectTablePoint} from '../src/card-table-projection';

test('equipment plane follows the four calibrated corners of each desk',()=>{
  for(const kind of ['wide','tall'] as const){
    const scene=cardTableScenes[kind],size=cardTableLayouts[kind],matrix=cardTableMatrix(scene.points,size);
    const {width:w,height:h}=size;
    for(const [i,[x,y]] of [[0,0],[w,0],[w,h],[0,h]].entries()){
      const point=projectTablePoint(matrix,x,y),expected=scene.points[i];
      assert(Math.abs(point.x-expected.x)<1e-6);assert(Math.abs(point.y-expected.y)<1e-6);
    }
  }
});
test('three separate equipment positions remain within the desk and viewport across cover crops',()=>{
  for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[768,1024],[390,844],[320,740],[320,922],[1920,720]]){
    const p=cardTableProjection(width,height);
    for(let i=0;i<3;i++){
      for(const corner of cardTableCardCorners(p.kind,i)){
        assert(corner.x>=0&&corner.x<=p.size.width&&corner.y>=0&&corner.y<=p.size.height);
        const point=projectTablePoint(p.matrix,corner.x,corner.y);
        assert(point.x>=9.99&&point.x<=width-9.99);assert(point.y>=9.99&&point.y<=height-9.99);
      }
    }
  }
});

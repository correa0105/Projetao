import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {newScene,newToken,blockingWalls,sceneSchema} from '../shared/vtt';
import {movementBlocked} from '../shared/vtt-movement';
import {houseAssets,houseWorld,houseOccupied,houseWalls} from '../shared/vtt-houses';
for(const asset of houseAssets)test(asset.name+': paredes, entrada e telhado acompanham giro e escala',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene),actor=newToken(randomUUID(),scene);
  Object.assign(house,{layer:'map',image:asset.image,width:asset.width*70,height:asset.height*70,x:1000,y:1000});
  scene.tokens=[house,actor];
  for(const rotation of [0,45,90,180,-90])for(const flipX of [false,true])for(const flipY of [false,true]){
    Object.assign(house,{rotation,flipX,flipY});
    assert.equal(houseWalls(scene).length,6);assert.equal(blockingWalls(scene,true).length,5);
    const center=houseWorld({x:.5,y:.5},house),doorOutside=houseWorld({x:.5,y:.97},house),westOutside=houseWorld({x:.02,y:.5},house);
    assert.equal(movementBlocked(scene,doorOutside,center),false);
    assert.equal(movementBlocked(scene,westOutside,center),true);
    Object.assign(actor,doorOutside);assert.equal(houseOccupied(house,[actor]),false);
    Object.assign(actor,center);assert.equal(houseOccupied(house,[actor]),true);
    actor.hidden=true;assert.equal(houseOccupied(house,[actor]),false);actor.hidden=false;
  }
  const restored=sceneSchema.parse(JSON.parse(JSON.stringify(scene)));
  assert.equal(houseWalls(restored).length,6);
  scene.tokens=[];assert.equal(blockingWalls(scene,true).length,0);
});
test('casas antigas e imagens arbitrárias não ganham barreiras ou interiores',()=>{
  const scene=newScene(randomUUID()),house=newToken(randomUUID(),scene);
  Object.assign(house,{layer:'map',image:'/vtt/crypt.svg'});scene.tokens=[house];assert.deepEqual(houseWalls(scene),[]);
  house.image=houseAssets[0].image;house.layer='tokens';assert.deepEqual(houseWalls(scene),[]);
});

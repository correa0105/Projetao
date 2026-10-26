import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {newScene,newToken} from '../shared/vtt';
import {vehicleArt,vehicleCoverImage,vehicleCoverImages,vehicleDefinitions,vehicleDrawParts,vehicleImage,type VehicleId} from '../shared/vtt-vehicles';
import {navalAtlas} from '../shared/vtt-naval';
test('cinco coberturas em zênite: PNG original, proporções circulares e tokens legados',async()=>{
 const ids:VehicleId[]=['galley','keelboat','longship','sailing-ship','warship'],manifest=JSON.parse(await readFile('data/vtt/vehicle-rigging-20261026.json','utf8')),scene=newScene(randomUUID(),'Mastros');assert.equal(manifest.assets.length,5);
 for(const id of ids){const a=manifest.assets.find((a:any)=>a.id===id);assert.ok(a);const bytes=await readFile('public'+a.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.equal(bytes[25],6);assert.ok(a.clearFraction>.7);
  const token=newToken(randomUUID(),scene);token.image=vehicleImage(id);token.vehicle={characterId:randomUUID(),itemId:id,copy:0};scene.tokens.push(token);assert.equal(vehicleArt(token)?.coverImage,a.path);assert.equal(vehicleCoverImage(id),a.path);
  for(const {source:r,target:q} of vehicleDrawParts(id,'cover')){assert.equal(r.length,4);assert.equal(q.length,4);assert.ok(r[0]>=0&&r[1]>=0&&r[0]+r[2]<=1.000001&&r[1]+r[3]<=1.000001);const sourceRatio=r[2]*a.width/(r[3]*a.height),destRatio=q[2]*vehicleDefinitions[id].widthFt/(q[3]*vehicleDefinitions[id].lengthFt);assert.ok(Math.abs(destRatio-sourceRatio)<1e-6,'A ponta circular do mastro não pode ser esticada: '+id);}
 }
 assert.deepEqual(vehicleCoverImages(scene.tokens).sort(),[...new Set(ids.map(navalAtlas))].sort());
});

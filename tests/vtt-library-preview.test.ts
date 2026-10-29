import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {vttLibraryPreview} from '../shared/vtt-library-preview';
import images from '../shared/vtt-library-thumbnails.json';
import posters from '../shared/vtt-animated-thumbnails.json';
import vehicles from '../shared/vtt-vehicle-thumbnails.json';

test('miniaturas públicas compartilham cache e não substituem texturas técnicas ou URLs privadas',()=>{
  const url='/vtt/animated-assets-20261009/portal-ring.webp';
  assert.match(vttLibraryPreview(url),/^\/optimized-images-20261028\/vtt-thumbnails\/[a-f0-9]{64}\.webp$/);
  assert.equal(vttLibraryPreview(url+'?v=1'),vttLibraryPreview(url));
  for(const original of ['/vtt/siege-materials-20261027/projectiles-v1.png','/vtt/temporal-20261009/ring-0.webp','blob:local-art'])assert.equal(vttLibraryPreview(original),original);
  const privatePath='/api/vtt/assets/00000000-0000-4000-8000-000000000001?v=8';
  assert.equal(vttLibraryPreview(privatePath),privatePath+'&thumbnail=1');
  assert.equal(vttLibraryPreview(vttLibraryPreview(privatePath)),vttLibraryPreview(privatePath));
  assert.equal(vttLibraryPreview(privatePath+'&original=1'),privatePath+'&original=1');
});
test('acervos usam cópias pequenas com alfa e prévias estáticas para animados e veículos',async()=>{
  const files=[...new Set(Object.values(images))];assert(files.length>1900);
  for(const path of [files[0],files[Math.floor(files.length/2)],files.at(-1)!,...Object.values(posters),...Object.values(vehicles)]){
    const metadata=await sharp(await readFile('public'+path)).metadata();
    assert(metadata.width!<=256&&metadata.height!<=256,path);assert.equal(metadata.pages||1,1,path);
    assert.equal(metadata.hasAlpha,true,path);
  }
  assert.equal(Object.keys(vehicles).length,12);
  assert.equal(Object.keys(posters).length,16);
});

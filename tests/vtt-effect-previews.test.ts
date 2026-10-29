import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {effectLibrary} from '../shared/vtt-effects';
import {screenEffectPresets} from '../shared/vtt-screen-effects';
import effects from '../shared/vtt-effect-previews.json';
import screen from '../shared/vtt-screen-previews.json';

test('all effect menus have small static previews that can use the public browser cache',async()=>{
 assert.deepEqual(Object.keys(effects).sort(),effectLibrary.map(e=>e.kind).sort());
 assert.deepEqual(Object.keys(screen).sort(),screenEffectPresets.map(e=>e.id).sort());
 const paths=[...Object.values(effects).map(e=>e.image),...Object.values(screen)];let bytes=0;
 for(const path of paths){
  assert.match(path,/^\/optimized-images-20261028\/vtt-effect-previews\/[a-f0-9]{64}\.webp$/);
  const data=await readFile('public'+path),m=await sharp(data).metadata();bytes+=data.length;
  assert(m.width!<=128&&m.height!<=128,path);assert.equal(m.pages||1,1,path);
 }
 assert(bytes<1024*1024);
});

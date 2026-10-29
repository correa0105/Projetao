import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createVttMedia,lazyVttMedia,watchVttMedia} from '../src/vtt-media';

test('effect media loads only on use, shares requests and can still be explicitly warmed',async()=>{
 const loaded:string[]=[],updates:string[]=[];
 const media=createVttMedia(['fire','water','smoke'],async key=>{loaded.push(key);});
 const stop=watchVttMedia(()=>updates.push('ready'));
 try{
  await Promise.resolve();assert.deepEqual(loaded,[]);
  const first=media.request('fire');assert.equal(media.request('fire'),first);await first;
  assert.deepEqual(loaded,['fire']);assert.equal(updates.length,1);
  let warms=0;const ready=lazyVttMedia(async()=>{warms++;await media.ready;});
  assert.equal(warms,0);await Promise.all([ready,ready]);assert.equal(warms,1);
  assert.deepEqual(loaded,['fire','water','smoke']);assert.equal(updates.length,3);
 }finally{stop();}
 await media.request('fire');assert.equal(updates.length,3);
});

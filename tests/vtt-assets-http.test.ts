import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {pool} from '../server/db.js';
import {migrate} from '../server/migrate.js';
import {vttProtocolVersion} from '../shared/vtt-protocol.js';

test('upload repetido aparece uma vez; cópias antigas em uso não são excluídas',async()=>{
 assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[0-9a-f]{32}$/);
 await migrate();
 const {createApp}=await import('../server/app.js');
 const server=createApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
 const address=server.address();assert(address&&typeof address!=='string');
 const base=`http://127.0.0.1:${address.port}/api`;
 let cookie='';
 const headers=()=>({Origin:(process.env.APP_ORIGIN||'http://localhost:3000').split(',')[0],Cookie:cookie,'Content-Type':'application/json','X-Vtt-Schema-Version':String(vttProtocolVersion)});
 const json=(path:string,method='GET',body?:unknown)=>fetch(base+path,{method,headers:headers(),body:body===undefined?undefined:JSON.stringify(body)});
 try{
  const auth=await json('/auth/sign-up/email','POST',{name:'Mestre',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});assert.equal(auth.status,200);
  cookie=auth.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1',[(await auth.json()).user.id]);
  const created=await json('/vtt','POST',{name:'Biblioteca'});assert.equal(created.status,201);const room=await created.json();
  const bytes=await sharp({create:{width:16,height:16,channels:4,background:'#bbaacc'}}).png().toBuffer();
  const upload=()=>fetch(base+`/vtt/rooms/${room.id}/assets?name=Irineu`,{method:'POST',headers:{...headers(),'Content-Type':'image/png'},body:bytes});
  const first=await upload();assert.equal(first.status,201);const asset=await first.json();
  const second=await upload();assert.equal(second.status,201);assert.equal((await second.json()).id,asset.id);
  const copy=(await pool.query(`INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height) SELECT room_id,name,kind,mime,bytes,width,height FROM vtt_assets WHERE id=$1 RETURNING id`,[asset.id])).rows[0].id;
  const listed=await (await json('/vtt/rooms/'+room.id)).json();assert.equal(listed.assets.length,1);
  const doc=listed.document;doc.scenes[0].background='/api/vtt/assets/'+copy;
  await pool.query('UPDATE vtt_rooms SET document=$2 WHERE id=$1',[room.id,JSON.stringify(doc)]);
  assert.equal((await json(`/vtt/rooms/${room.id}/assets/${asset.id}`,'DELETE')).status,409);
  assert.equal((await json('/vtt/assets/'+copy)).status,200);
  doc.scenes[0].background='';await pool.query('UPDATE vtt_rooms SET document=$2 WHERE id=$1',[room.id,JSON.stringify(doc)]);
  assert.equal((await json(`/vtt/rooms/${room.id}/assets/${asset.id}`,'DELETE')).status,200);
  assert.equal((await pool.query('SELECT count(*)::int n FROM vtt_assets WHERE room_id=$1',[room.id])).rows[0].n,0);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
});

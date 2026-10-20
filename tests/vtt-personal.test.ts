import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { newScene, newToken, activateScene } from '../shared/vtt';
import { VTT_STORAGE_LIMIT } from '../shared/vtt-storage';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { createLegacyTestCharacter } from './character-fixtures';
import { personalVttUrl } from '../server/vtt-accounts';

test('o link compartilhado usa o endereço acessível configurado, inclusive pelo Radmin',()=>{
  const before={origin:process.env.APP_ORIGIN,share:process.env.APP_SHARE_ORIGIN};
  try{
    process.env.APP_ORIGIN='http://localhost:3000,http://127.0.0.1:5173,http://26.1.2.3:3000,https://mesa.example.test';
    delete process.env.APP_SHARE_ORIGIN;
    assert.equal(personalVttUrl('permanente'),'http://26.1.2.3:3000/#vtt?table=permanente');
    process.env.APP_SHARE_ORIGIN='https://mesa.example.test';
    assert.equal(personalVttUrl('permanente'),'https://mesa.example.test/#vtt?table=permanente');
    process.env.APP_SHARE_ORIGIN='https://nao-autorizado.example.test';
    assert.equal(personalVttUrl('permanente'),'http://26.1.2.3:3000/#vtt?table=permanente');
  }finally{
    if(before.origin===undefined)delete process.env.APP_ORIGIN;else process.env.APP_ORIGIN=before.origin;
    if(before.share===undefined)delete process.env.APP_SHARE_ORIGIN;else process.env.APP_SHARE_ORIGIN=before.share;
  }
});

test('VTT pessoal, link permanente nas missões e 100 MB apenas para imagens externas',async t=>{
  assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate(); await seed();
  const {createApp}=await import('../server/app'); const server=createApp().listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${(server.address() as {port:number}).port}/api`,origin=(process.env.APP_ORIGIN||'http://localhost:3000').split(',')[0];
  type Account={id:string;cookie:string};
  async function req(path:string,who?:Account,method='GET',body?:unknown,raw?:Buffer){
    const response=await fetch(base+path,{method,headers:{Origin:origin,Cookie:who?.cookie||'','Content-Type':raw?'image/png':'application/json','X-Vtt-Schema-Version':String(vttProtocolVersion)},body:raw?new Uint8Array(raw):body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),headers:response.headers};
  }
  async function signup(name:string):Promise<Account>{
    const r=await req('/auth/sign-up/email',undefined,'POST',{name,email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});
    assert.equal(r.status,200);return{id:r.data.user.id,cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
  }
  try{
    const owner=await signup('Mestre sem cargo'),player=await signup('Jogador'),other=await signup('Outra conta');
    const listing=(await req('/vtt',owner)).data;
    const personal=listing.personal,root='/vtt/rooms/'+personal.room_id;
    assert.equal(personal.url,personalVttUrl(personal.public_id));
    await t.test('a conta básica prepara a própria mesa sem missão e sem ganhar privilégios globais',async()=>{
      assert.equal(listing.can_create,true); assert.equal(listing.storage.used,0);
      assert.equal((await req('/vtt',owner)).data.personal.public_id,personal.public_id);
      assert.equal((await req(root,owner)).data.is_gm,true);
      assert.equal((await req('/me',owner)).data.administrador,0);
      assert.equal((await req(root,other)).status,404);
      const current=(await req(root,owner)).data;const scene=newScene(randomUUID(),'Mapa preparado antes da missão');
      const hidden=newToken(randomUUID(),scene);hidden.hidden=true;hidden.notes='Segredo do mestre';scene.tokens.push(hidden);
      current.document.scenes.push(scene);activateScene(current.document,scene.id);
      const saved=await req(root,owner,'PUT',{revision:current.revision,document:current.document});
      assert.equal(saved.status,200,JSON.stringify(saved.data));
      const joined=await req('/vtt/personal/'+personal.public_id+'/join',player,'POST',{});
      assert.equal(joined.status,200);assert.equal(joined.data.document.activeScene,scene.id);
      assert.equal(joined.data.document.scenes.length,1);assert.equal(joined.data.document.scenes[0].tokens.length,0);
      assert.equal(joined.data.is_gm,false);assert.equal(joined.data.invite,undefined);
      assert.equal((await req(root,player,'PUT',{revision:saved.data.revision,document:saved.data.document})).status,403);
      assert.equal((await req('/vtt/rooms/'+personal.room_id+'/activate',player,'POST',{})).status,403);
    });
    await t.test('todas as missões publicadas usam o mesmo link sem criar outra mesa',async()=>{
      const before=(await pool.query('SELECT count(*) FROM vtt_rooms WHERE owner_id=$1',[owner.id])).rows[0].count;
      const posts=[];
      for(let i=0;i<2;i++){
        const result=await req('/board',owner,'POST',{kind:'mission',title:'Aventura pessoal '+i,description:'Uma missão com o mesmo VTT já preparado.',location:'Taverna do Norte',difficulty:'Moderada',starts_at:new Date(Date.now()+86400000).toISOString()});
        assert.equal(result.status,201,JSON.stringify(result.data));assert.equal(result.data.vtt_personal_id,personal.public_id);posts.push(result.data.id);
      }
      const board=(await req('/board',player)).data;
      for(const id of posts)assert.equal(board.find((p:any)=>p.id===id).vtt_personal_id,personal.public_id);
      assert.equal((await pool.query('SELECT count(*) FROM vtt_rooms WHERE owner_id=$1',[owner.id])).rows[0].count,before);
    });
    await t.test('o endereço pessoal permanece igual ao trocar mapas, salas ou código avulso',async()=>{
      const second=await req('/vtt',owner,'POST',{name:'Outro projeto preservado'});assert.equal(second.status,201);
      assert.equal(second.data.personal.public_id,personal.public_id);
      assert.equal((await req('/vtt/personal/'+personal.public_id,player)).data.room_id,second.data.id);
      const current=await req('/vtt/personal/'+personal.public_id+'/join',player,'POST',{});assert.equal(current.data.id,second.data.id);
      await req('/vtt/rooms/'+second.data.id+'/invite',owner,'POST',{});
      assert.equal((await req('/vtt',owner)).data.personal.public_id,personal.public_id);
      assert.equal((await req('/vtt/personal/'+personal.public_id+'/join',other,'POST',{})).status,200);
    });
    await t.test('a cota é por conta e uploads concorrentes em salas diferentes não ultrapassam 100 MB',async()=>{
      const account=owner,start=(await req('/vtt',account)).data;
      const first=start.personal.room_id,second=(await req('/vtt',account,'POST',{name:'Segundo mapa da conta'})).data.id;
      const {rows:[filler]}=await pool.query("INSERT INTO vtt_assets(room_id,name,kind,mime,bytes)VALUES($1,'Arquivo existente','image','image/webp',decode(repeat('78',$2),'hex'))RETURNING id",[first,VTT_STORAGE_LIMIT-256]);
      const attempts=await Promise.allSettled([first,second].map(room=>pool.query("INSERT INTO vtt_assets(room_id,name,kind,mime,bytes)VALUES($1,'Upload concorrente','image','image/webp',decode(repeat('79',200),'hex'))RETURNING id",[room])));
      assert.equal(attempts.filter(r=>r.status==='fulfilled').length,1);
      const rejected=attempts.find(r=>r.status==='rejected') as PromiseRejectedResult;
      assert.equal(rejected.reason.constraint,'vtt_account_storage_limit');
      const usage=(await req('/vtt',account)).data.storage;
      assert.equal(usage.used,VTT_STORAGE_LIMIT-56);assert.equal(usage.limit,VTT_STORAGE_LIMIT);
      assert.equal((await req('/vtt',other)).data.storage.used,0);
      const image=await sharp({create:{width:64,height:64,channels:4,background:'#804020'}}).png().toBuffer();
      const failed=await req('/vtt/rooms/'+first+'/assets?name=Imagem',account,'POST',undefined,image);
      assert.equal(failed.status,413);assert.match(failed.data.error,/100 MB.*imagens externas/);
      const character=await createLegacyTestCharacter(account.id,'Arte existente');
      await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)',[character.id,image]);
      const imported=await req('/vtt/rooms/'+first+'/characters/'+character.id,account,'POST',{});
      assert.equal(imported.status,201,JSON.stringify(imported.data));
      await pool.query("INSERT INTO vtt_assets(room_id,name,kind,mime,bytes)VALUES($1,'Som','audio','audio/wav',decode(repeat('00',512),'hex'))",[first]);
      assert.equal((await req('/vtt',account)).data.storage.used,usage.used);
      assert.equal((await req('/vtt/rooms/'+first+'/assets/'+filler.id,account,'DELETE')).status,200);
      assert.equal((await req('/vtt',account)).data.storage.used,200);
      const upload=await req('/vtt/rooms/'+first+'/assets?name=Imagem',account,'POST',undefined,image);
      assert.equal(upload.status,201,JSON.stringify(upload.data));
      const replay=await req('/vtt/rooms/'+first+'/assets?name=Repetida',account,'POST',undefined,image);
      assert.equal(replay.data.id,upload.data.id);
    });
  }finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
});

import{test}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{readFile}from'node:fs/promises';import{pool}from'../server/db';import{migrate}from'../server/migrate';import{createLegacyTestCharacter}from'./character-fixtures';
test('retrato WebP continua privado após cache aquecido e exclusão; download original permanece intacto',async()=>{
 assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[a-f0-9]{32}$/);await migrate();const{createApp}=await import('../server/app');const server=createApp().listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const base='http://127.0.0.1:'+(server.address() as {port:number}).port+'/api',origin=(process.env.APP_ORIGIN||'http://localhost:3000').split(',')[0];
 async function signup(){const r=await fetch(base+'/auth/sign-up/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Prévia privada',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()})});assert.equal(r.status,200);return{id:(await r.json()).user.id,cookie:r.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')};}
 try{
  const owner=await signup(),other=await signup(),hero=await createLegacyTestCharacter(owner.id,'Imagem privada'),original=await readFile('public/cards/arcana-emblems-20261028/vigil.png');
  await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)',[hero.id,original]);await pool.query('UPDATE characters SET portrait_revision=1 WHERE id=$1',[hero.id]);
  const url=base+'/characters/'+hero.id+'/portrait?v=1';
  const preview=await fetch(url,{headers:{Cookie:owner.cookie,Accept:'image/webp'}});assert.equal(preview.status,200);assert.equal(preview.headers.get('content-type'),'image/webp');assert.match(preview.headers.get('vary')!,/Cookie/);assert.match(preview.headers.get('vary')!,/Accept/);assert.match(preview.headers.get('cache-control')!,/^private,.*immutable/);assert((await preview.arrayBuffer()).byteLength<original.length);
  assert.equal((await fetch(url,{headers:{Cookie:other.cookie,Accept:'image/webp'}})).status,404);assert.equal((await fetch(url,{headers:{Accept:'image/webp'}})).status,401);
  const full=await fetch(url+'&original=1',{headers:{Cookie:owner.cookie,Accept:'image/webp'}});assert.deepEqual(Buffer.from(await full.arrayBuffer()),original);
  await pool.query('UPDATE characters SET deleted_at=now()WHERE id=$1',[hero.id]);assert.equal((await fetch(url,{headers:{Cookie:owner.cookie,Accept:'image/webp'}})).status,404);
 }finally{await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
});

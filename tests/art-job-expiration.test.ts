import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { expireArtJobs } from '../server/art-job-expiration.js';
import { completeArt } from '../server/character-art.js';
import { completeCompanionArt } from '../server/companion-equipment.js';
import { claimNextArtJob, recoverInterruptedCharacterArt, retryCharacterArt, characterArtFailure } from '../server/character-art-retries.js';
import { IllustratorError } from '../server/codex-illustrator.js';
import { ArtGenerationDeadlineError } from '../server/art-generation-deadline.js';
import { createLegacyTestCharacter, testArtImage, testTokenImage } from './character-fixtures.js';

test('limite total encerra as duas filas e bloqueia publicação tardia; retry autorizado renova só o mesmo pedido', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname,/^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp }=await import('../server/app.js');
  const server=createApp().listen(0,'127.0.0.1');
  await new Promise<void>(r=>server.once('listening',r));
  const address=server.address(); assert(address&&typeof address!=='string');
  const base=`http://127.0.0.1:${address.port}/api`,origin=(process.env.APP_ORIGIN||'http://localhost:3000').split(',')[0];
  let cookie='';
  async function req(path:string,body?:unknown){
    const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
    return {status:r.status,data:await r.json(),headers:r.headers};
  }
  try {
    const signup=await req('/auth/sign-up/email',{name:'Prazo de arte',email:randomUUID()+'@example.test',password:'Test-'+randomUUID()});
    assert.equal(signup.status,200);
    const uid=signup.data.user.id;
    cookie=signup.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    const c=await createLegacyTestCharacter(uid),portrait=await testArtImage(),token=await testTokenImage();
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)',[c.id,portrait]);
    await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)',[c.id,token]);
    const jid=(await pool.query(`INSERT INTO character_art_jobs(user_id,character_id,status,idempotency_key,reference,approved_portrait,replacement_revision,deadline_at)VALUES($1,$2,'running',$3,$4,$4,1,now()-interval '1 second')RETURNING id`,[uid,c.id,randomUUID(),portrait])).rows[0].id;
    // Publication itself enforces the deadline even before a sweep or browser poll.
    await assert.rejects(completeArt(jid,{portrait,token}),/cinco minutos/);
    const after=(await req('/character-art')).data.jobs.find((j:any)=>j.id===jid);
    assert.equal(after.status,'failed'); assert.match(after.error,/cinco minutos/);
    const saved=(await pool.query('SELECT * FROM character_art_jobs WHERE id=$1',[jid])).rows[0];
    assert.equal(saved.last_error_code,'generation_deadline'); assert.equal(saved.next_attempt_at,null);
    assert.deepEqual(saved.reference,portrait); assert.deepEqual(saved.approved_portrait,portrait);
    await recoverInterruptedCharacterArt();
    assert.equal(await retryCharacterArt(jid,new IllustratorError('token_rejected','Câmera')),undefined);
    assert.equal(await claimNextArtJob(),undefined);
    assert.equal(characterArtFailure(new ArtGenerationDeadlineError()).retry,false);
    await pool.query('INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()');
    assert.equal((await req('/character-art/'+jid+'/retry',{})).status,202);
    const retried=(await pool.query('SELECT * FROM character_art_jobs WHERE id=$1',[jid])).rows[0];
    assert.equal(retried.id,jid); assert.equal(retried.status,'queued');
    const remaining=new Date(retried.deadline_at).getTime()-Date.now();assert(remaining>295_000&&remaining<=300_000);
    assert.deepEqual(retried.approved_portrait,portrait);
    // An automatic retry does not extend that new owner's deadline.
    assert.equal((await claimNextArtJob()).id,jid);
    await retryCharacterArt(jid,new IllustratorError('connection','Interrompida'));
    assert.deepEqual((await pool.query('SELECT deadline_at FROM character_art_jobs WHERE id=$1',[jid])).rows[0].deadline_at,retried.deadline_at);
    await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1",[jid]);
    await pool.query("UPDATE characters SET race='Warforged' WHERE id=$1",[c.id]);
    await pool.query("UPDATE character_art_jobs SET reference_mode='construction' WHERE id=$1",[jid]);
    assert.equal((await req('/character-art/'+jid+'/retry',{})).status,202);
    assert.equal((await pool.query('SELECT reference_mode FROM character_art_jobs WHERE id=$1',[jid])).rows[0].reference_mode,'construction','Retomar um token não troca montagem por referência');
    await pool.query("UPDATE character_art_jobs SET status='failed' WHERE id=$1",[jid]);
    const pet=(await pool.query(`INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key)VALUES($1,'cat','Teste',0,$2)RETURNING id`,[c.id,randomUUID()])).rows[0];
    await pool.query("INSERT INTO companion_wardrobes(id,character_id,kind,pet_id)VALUES($1,$2,'pet',$1)",[pet.id,c.id]);
    const companion=(await pool.query(`INSERT INTO companion_art_jobs(user_id,character_id,wardrobe_id,kind,species_id,appearance,name,equipment_revision,reference,status,idempotency_key,deadline_at)VALUES($1,$2,$3,'pet','cat','black','Teste',0,$4,'running',$5,now()-interval '1 second')RETURNING id`,[uid,c.id,pet.id,portrait,randomUUID()])).rows[0].id;
    await pool.query("INSERT INTO companion_art_equipment(job_id,slot,item_id,name,image)VALUES($1,'neck','test','Teste',$2)",[companion,portrait]);
    await assert.rejects(completeCompanionArt(companion,{portrait,token}),/cinco minutos/);
    await expireArtJobs(); await expireArtJobs();
    const animal=(await pool.query('SELECT * FROM companion_art_jobs WHERE id=$1',[companion])).rows[0];
    assert.equal(animal.status,'failed');assert.match(animal.error,/cinco minutos/);assert.deepEqual(animal.reference,portrait);
    assert.equal((await pool.query('SELECT count(*)::int n FROM companion_art_equipment WHERE job_id=$1',[companion])).rows[0].n,1);
    assert.equal((await pool.query('SELECT count(*)::int n FROM companion_artworks WHERE wardrobe_id=$1',[pet.id])).rows[0].n,0);
  } finally { await new Promise<void>(r=>server.close(()=>r()));await pool.end(); }
});

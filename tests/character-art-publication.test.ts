import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { completeArt } from '../server/character-art';
import { claimNextArtJob, recoverInterruptedCharacterArt, retryCharacterArt, characterArtFailure } from '../server/character-art-retries';
import { IllustratorError, imageGenerationFailure } from '../server/codex-illustrator';
import { AppError } from '../server/services';
import { defaultChoices } from '../shared/character-sheet';
import { lockTestIllustrator, testArtImage, testTokenImage } from './character-fixtures';
import sharp from 'sharp';
import { normalizeCharacterToken } from '../server/character-token-art';

test('token aprovado conserva resolução, pixels e alfa do PNG original acima de 1024', async () => {
  const source = await sharp(await testTokenImage()).resize(1536, 1536).png().toBuffer();
  const normalized = await normalizeCharacterToken(source);
  const meta = await sharp(normalized).metadata();
  assert.equal(meta.width, 1536);
  assert.equal(meta.height, 1536);
  assert.equal(meta.hasAlpha, true);
  assert.deepEqual(await sharp(normalized).raw().toBuffer(), await sharp(source).raw().toBuffer());
});

test('criação e substituição publicam somente par completo; checkpoint e falha preservam slot, ouro, imagem e cota', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  const unlock = await lockTestIllustrator();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0],
    base = `http://127.0.0.1:${address.port}/api`;
  let cookie = '';
  async function req(path: string, method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  try {
    const signup = await req('/auth/sign-up/email', 'POST', {
      name: 'Publicação do par',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(signup.status, 200);
    const uid = signup.data.user.id;
    cookie = signup.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
    );
    await req('/character-slots');
    assert.equal((await req('/character-slots/1/roll', 'POST', {})).status, 200);
    for (let revealed = 1; revealed <= 6; revealed++)
      assert.equal((await req('/character-slots/1/reveal', 'POST', { revealed })).status, 200);
    const slot = (await req('/character-slots')).data[0],
      portrait = await testArtImage(),
      token = await testTokenImage();
    const choices = {
      ...defaultChoices('Orc', 'Guerreiro'),
      physicalTraits: { gender: 'male', height: 'average', build: 'average', age: 'elder' },
    };
    const queued = await req('/character-art', 'POST', {
      creation: {
        name: 'Par completo',
        race: 'Orc',
        class: 'Guerreiro',
        creation_slot: 1,
        choices,
      },
      reference: portrait.toString('base64'),
      idempotency_key: randomUUID(),
    });
    assert.equal(queued.status, 202, JSON.stringify(queued.data));
    const jid = queued.data.id;
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [jid]);
    assert.equal(await completeArt(jid, { portrait }), null);
    const count = async () =>
      (await pool.query('SELECT count(*)::int n FROM characters WHERE user_id=$1', [uid])).rows[0]
        .n;
    assert.equal(await count(), 0, 'Retrato sozinho não cria personagem');
    assert.deepEqual((await req('/characters')).data, []);
    const j = (
      await pool.query(
        'SELECT character_id,approved_portrait,status FROM character_art_jobs WHERE id=$1',
        [jid],
      )
    ).rows[0];
    assert.equal(j.character_id, null);
    assert(j.approved_portrait);
    assert.equal(j.status, 'running');
    assert.equal((await req('/character-slots')).data[0].pending, true);
    await assert.rejects(completeArt(jid, { portrait, token: portrait }));
    assert.equal(await count(), 0, 'Token inválido não publica o retrato');
    const retryNow = () => pool.query("UPDATE character_art_jobs SET next_attempt_at=now()-interval '1 second' WHERE id=$1", [jid]);
    for (let attempt = 1; attempt <= 5; attempt++) {
      const failures = await Promise.all([
        retryCharacterArt(jid, new IllustratorError('token_rejected', 'Câmera frontal reprovada')),
        retryCharacterArt(jid, new IllustratorError('token_rejected', 'Câmera frontal reprovada')),
      ]);
      assert.equal(failures.filter(Boolean).length, 1, 'A mesma falha só agenda uma retomada');
      const queued = (await req('/character-art')).data.jobs.find((job: any) => job.id === jid);
      assert.equal(queued.status, 'queued');
      assert.equal(queued.retry_count, attempt);
      assert.equal(queued.can_retry, false, 'Jogador não precisa reenviar a criação');
      assert(queued.next_attempt_at);
      assert.equal((await req('/character-slots')).data[0].pending, true);
      assert.equal(await claimNextArtJob(), undefined, 'Respeita o intervalo entre tentativas');
      if (attempt === 1) {
        const otherJob = (await pool.query(
          'INSERT INTO character_art_jobs(user_id,creation,reference,idempotency_key)VALUES($1,$2,$3,$4)RETURNING id',
          [uid, { name: 'Outro pedido', race: 'Orc', class: 'Guerreiro', choices }, portrait, randomUUID()],
        )).rows[0].id;
        assert.equal((await claimNextArtJob()).id, otherJob, 'Uma retomada futura não bloqueia novos pedidos');
        await pool.query('DELETE FROM character_art_jobs WHERE id=$1', [otherJob]);
      }
      await retryNow();
      const resumed = await claimNextArtJob();
      assert.equal(resumed.id, jid);
      assert.deepEqual(resumed.approved_portrait, j.approved_portrait);
      assert.deepEqual(resumed.reference, portrait);
      assert.deepEqual(resumed.creation.choices, choices);
      assert.equal(await count(), 0);
    }
    // A restart recovers only active work, retaining the same job and slot.
    await recoverInterruptedCharacterArt();
    await recoverInterruptedCharacterArt();
    const restarted = (await pool.query('SELECT * FROM character_art_jobs WHERE id=$1', [jid])).rows[0];
    assert.equal(restarted.retry_count, 6);
    assert.equal(restarted.last_error_code, 'interrupted');
    assert.deepEqual(restarted.approved_portrait, j.approved_portrait);
    assert.equal(restarted.creation_slot, 1);
    assert.equal(restarted.roll_generation, slot.generation);
    await retryNow();
    assert.equal((await claimNextArtJob()).id, jid);
    assert.equal(characterArtFailure(new IllustratorError('content_refused', 'Referência recusada')).retry, false);
    assert.equal(characterArtFailure(new AppError(409, 'Slot já ocupado')).retry, false);
    assert.equal(characterArtFailure(new AppError(400, 'Imagem inválida')).retry, true);
    assert.equal(characterArtFailure(imageGenerationFailure('tool_error')).retry, true);
    assert.equal(characterArtFailure(imageGenerationFailure('content refused by policy')).retry, false);
    assert.equal(imageGenerationFailure('usage limit exceeded').code, 'usage_limit');
    assert.equal(imageGenerationFailure('Failed to generate image').code, 'tool_error');
    await pool.query(
      "UPDATE character_art_jobs SET status='failed',error='Câmera frontal reprovada' WHERE id=$1",
      [jid],
    );
    const failed = (await req('/character-art')).data;
    assert.equal(failed.jobs.find((j: any) => j.id === jid).can_retry, true);
    assert.equal((await req(`/character-art/${jid}/retry`, 'POST', {})).status, 202);
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [jid]);
    const cid = await completeArt(jid, { portrait, token });
    assert(cid);
    assert.equal(await count(), 1);
    assert.equal(await completeArt(jid, { portrait, token }), cid);
    assert.equal(await retryCharacterArt(jid, new Error('Falha tardia')), undefined);
    const completed = (await pool.query('SELECT * FROM character_art_jobs WHERE id=$1', [jid])).rows[0];
    assert.equal(completed.status, 'completed');
    assert.equal(completed.next_attempt_at, null);
    assert.equal(completed.last_error_code, null);
    const current = async () =>
      (
        await pool.query(
          'SELECT c.portrait_revision,c.gold_cp,md5(p.image) portrait,md5(t.image) token,s.rolls FROM characters c JOIN character_portraits p ON p.character_id=c.id JOIN character_tokens t ON t.character_id=c.id JOIN character_sheets s ON s.character_id=c.id WHERE c.id=$1',
          [cid],
        )
      ).rows[0];
    const before = await current();
    assert(before.token && before.portrait);
    assert.deepEqual(before.rolls, slot.rolls);
    assert.equal((await req('/character-art')).data.quotas[cid].used, 0);
    // A replacement checkpoint is private too; only accepting the completed proposal publishes it.
    await pool.query('UPDATE character_art_worker SET heartbeat_at=now(),available=true');
    const replacement = await req('/character-art', 'POST', {
      character_id: cid,
      reference: portrait.toString('base64'),
      idempotency_key: randomUUID(),
    });
    assert.equal(replacement.status, 202, JSON.stringify(replacement.data));
    const rid = replacement.data.id;
    await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [rid]);
    await completeArt(rid, { portrait });
    assert.deepEqual(await current(), before);
    await retryCharacterArt(rid, new IllustratorError('connection', 'Conexão interrompida'));
    const replacementCheckpoint = (await pool.query('SELECT * FROM character_art_jobs WHERE id=$1', [rid])).rows[0];
    assert.deepEqual(replacementCheckpoint.reference, portrait, 'Substituições também conservam sua referência');
    assert(replacementCheckpoint.approved_portrait);
    assert.equal((await req('/character-art')).data.quotas[cid].used, 1, 'Retomada reserva apenas a geração original');
    await pool.query("UPDATE character_art_jobs SET next_attempt_at=now()-interval '1 second' WHERE id=$1", [rid]);
    assert.equal((await claimNextArtJob()).id, rid);
    await completeArt(rid, { portrait, token });
    assert.deepEqual(await current(), before);
    assert.equal((await req('/character-art')).data.reviews[0].id, rid);
    assert.equal(
      (await req(`/character-art/${rid}/decision`, 'POST', { decision: 'accepted' })).status,
      200,
    );
    const after = await current();
    assert.equal(after.portrait_revision, before.portrait_revision + 1);
    assert.equal(after.gold_cp, before.gold_cp);
    assert.deepEqual(after.rolls, before.rolls);
    assert.equal(after.token, before.token);
    assert.equal(after.portrait, before.portrait);
    // Recovery of an older partially published creation uses its existing character, not another slot.
    await pool.query('DELETE FROM character_tokens WHERE character_id=$1', [cid]);
    await pool.query(
      "UPDATE character_art_jobs SET status='running',approved_portrait=$2 WHERE id=$1",
      [jid, portrait],
    );
    assert.equal(await completeArt(jid, { portrait }), cid);
    assert.equal(
      (await pool.query('SELECT portrait_revision FROM characters WHERE id=$1', [cid])).rows[0]
        .portrait_revision,
      after.portrait_revision,
    );
    assert.equal(await completeArt(jid, { portrait, token }), cid);
    assert.equal(await count(), 1);
    assert.equal(
      (await req('/character-art')).data.quotas[cid].used,
      1,
      'Recuperação inicial não cobra uso extra',
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await unlock();
    await pool.end();
  }
});

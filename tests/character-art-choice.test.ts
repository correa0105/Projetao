import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { completeArt } from '../server/character-art';
import {
  createLegacyTestCharacter,
  testArtImage,
  testTokenImage,
  lockTestIllustrator,
} from './character-fixtures';

test('escolher arte: manter preserva o par, cota, base e revisão; decisão privada, concorrência, retomada e imagem atual alterada', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const unlock = await lockTestIllustrator();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  const req = async (path: string, cookie = '', method = 'GET', body?: unknown) => {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  };
  try {
    const registered = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Escolha de arte',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(registered.status, 200);
    const uid = registered.data.user.id,
      cookie = registered.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
    const hero = await createLegacyTestCharacter(uid, 'Escolha'),
      portrait = await testArtImage(),
      token = await testTokenImage(),
      alternative = await sharp(portrait).modulate({ brightness: 0.5 }).png().toBuffer();
    await pool.query(
      'INSERT INTO character_portraits(character_id,image,construction_base)VALUES($1,$2,$2)',
      [hero.id, portrait],
    );
    await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
      hero.id,
      token,
    ]);
    const current = () =>
      pool
        .query(
          'SELECT c.portrait_revision,p.image,p.construction_base,p.updated_at,t.image token,t.updated_at token_updated FROM characters c JOIN character_portraits p ON p.character_id=c.id JOIN character_tokens t ON t.character_id=c.id WHERE c.id=$1',
          [hero.id],
        )
        .then((r) => r.rows[0]);
    const snapshot = await current();
    const queue = async () => {
      await pool.query(
        'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
      );
      const r = await req('/character-art', cookie, 'POST', {
        character_id: hero.id,
        reference: portrait.toString('base64'),
        idempotency_key: randomUUID(),
      });
      assert.equal(r.status, 202, JSON.stringify(r.data));
      await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [r.data.id]);
      return r.data.id as string;
    };
    const id = await queue();
    await completeArt(id, { portrait: alternative });
    assert.deepEqual(await current(), snapshot, 'checkpoint não publica');
    await completeArt(id, { portrait: alternative, token });
    assert.deepEqual(await current(), snapshot, 'par novo não publica antes da escolha');
    await completeArt(id, { portrait: alternative, token });
    assert.deepEqual(await current(), snapshot);
    assert.equal(
      (
        await req('/character-art', cookie, 'POST', {
          character_id: hero.id,
          reference: portrait.toString('base64'),
          idempotency_key: randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal((await req('/character-art', cookie)).data.reviews.length, 1);
    assert.equal((await req('/character-art', cookie)).data.quotas[hero.id].used, 1);
    assert.equal(
      (await req(`/character-art/${id}/decision`, '', 'POST', { decision: 'kept' })).status,
      401,
    );
    assert.equal(
      (await req(`/character-art/${id}/decision`, cookie, 'POST', { decision: 'invalid' })).status,
      400,
    );
    const kept = await Promise.all([
      req(`/character-art/${id}/decision`, cookie, 'POST', { decision: 'kept' }),
      req(`/character-art/${id}/decision`, cookie, 'POST', { decision: 'kept' }),
    ]);
    assert(kept.every((r) => r.status === 200));
    assert.deepEqual(await current(), snapshot);
    assert.equal((await req('/character-art', cookie)).data.reviews.length, 0);
    assert.equal((await req('/character-art', cookie)).data.quotas[hero.id].used, 1);
    assert.equal((await req(`/character-art/${id}/proposed/portrait`, cookie)).status, 404);
    const record = (
      await pool.query(
        'SELECT status,art_decision,proposed_portrait,proposed_token FROM character_art_jobs WHERE id=$1',
        [id],
      )
    ).rows[0];
    assert.deepEqual(record, {
      status: 'completed',
      art_decision: 'kept',
      proposed_portrait: null,
      proposed_token: null,
    });
    const stale = await queue();
    await completeArt(stale, { portrait: alternative, token });
    await pool.query('UPDATE characters SET portrait_revision=portrait_revision+1 WHERE id=$1', [
      hero.id,
    ]);
    assert.equal(
      (await req(`/character-art/${stale}/decision`, cookie, 'POST', { decision: 'accepted' }))
        .status,
      409,
    );
    assert.equal(
      (await req(`/character-art/${stale}/decision`, cookie, 'POST', { decision: 'kept' })).status,
      200,
    );
    assert.deepEqual((await current()).image, portrait);
    const racing = await queue();
    await completeArt(racing, { portrait: alternative, token });
    const decisions = await Promise.all([
      req(`/character-art/${racing}/decision`, cookie, 'POST', { decision: 'accepted' }),
      req(`/character-art/${racing}/decision`, cookie, 'POST', { decision: 'kept' }),
    ]);
    assert.deepEqual(decisions.map((d) => d.status).sort(), [200, 409]);
    const resolved = (
      await pool.query('SELECT art_decision FROM character_art_jobs WHERE id=$1', [racing])
    ).rows[0].art_decision;
    assert.equal((await current()).portrait_revision, resolved === 'accepted' ? 2 : 1);
    assert.deepEqual((await current()).construction_base, portrait);
    const removed = await queue();
    await completeArt(removed, { portrait: alternative, token });
    assert.equal(
      (await req('/characters/' + hero.id, cookie, 'DELETE', { name: hero.name })).status,
      200,
    );
    assert.equal((await req('/character-art', cookie)).data.reviews.length, 0);
    assert.equal(
      (await req(`/character-art/${removed}/decision`, cookie, 'POST', { decision: 'accepted' }))
        .status,
      404,
    );
    assert.equal((await req(`/character-art/${removed}/proposed/portrait`, cookie)).status, 404);
    assert.equal(
      (await pool.query('SELECT proposed_portrait FROM character_art_jobs WHERE id=$1', [removed]))
        .rows[0].proposed_portrait,
      null,
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await unlock();
    await pool.end();
  }
});

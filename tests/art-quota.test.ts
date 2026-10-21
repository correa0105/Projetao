import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { defaultChoices } from '../shared/character-sheet.js';
import { finishTestArt, testArtImage } from './character-fixtures.js';

test('cotas mensais: inicial grátis, personagem 10, cada mascote/montaria 2, falhas e renovação', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`;
  let cookie = '';
  const req = async (path: string, body?: unknown) => {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Cookie: cookie,
        Origin: (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0],
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, data: await res.json(), headers: res.headers };
  };
  try {
    const account = await req('/auth/sign-up/email', {
      name: 'Cotas separadas',
      email: `${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(account.status, 200);
    cookie = account.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const beat = () =>
      pool.query(
        'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
      );
    await beat();
    const reference = (await testArtImage()).toString('base64');
    const creation = {
      name: 'Herói',
      race: 'Humano',
      class: 'Guerreiro',
      choices: defaultChoices('Humano', 'Guerreiro'),
    };
    const initial = await req('/character-art', {
      creation,
      reference,
      idempotency_key: randomUUID(),
    });
    assert.equal(initial.status, 202, JSON.stringify(initial.data));
    const cid = await finishTestArt(initial.data.id);
    const budget = async () => (await req('/character-art')).data.quotas[cid];
    assert.deepEqual(await budget(), { used: 0, limit: 10 });
    assert.equal((await req('/characters')).data.find((c: any) => c.id === cid).art_used, 0);
    const dress = () =>
      req('/character-art', { character_id: cid, reference, idempotency_key: randomUUID() });
    for (let i = 0; i < 10; i++) {
      const job = await dress();
      assert.equal(job.status, 202, JSON.stringify(job.data));
      assert.deepEqual(await budget(), { used: i + 1, limit: 10 });
      await finishTestArt(job.data.id);
    }
    assert.equal((await dress()).status, 409);
    // An exhausted character still has independent budgets for all its animals.
    await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [cid]);
    const animals: { kind: string; id: string }[] = [];
    for (const [kind, species] of [
      ['pet', 'dog'],
      ['mount', 'pony'],
      ['pet', 'cat'],
    ]) {
      const bought = await req(kind === 'pet' ? '/pets/purchase' : '/stable/purchase', {
        character_id: cid,
        [kind === 'pet' ? 'pet_id' : 'mount_id']: species,
        name: `Amigo ${species}`,
        idempotency_key: randomUUID(),
      });
      assert.equal(bought.status, 201, JSON.stringify(bought.data));
      animals.push({ kind, id: bought.data[kind].id });
    }
    const animalState = async () => (await req(`/companions/${cid}/equipment`)).data.companions;
    const animalDress = (animal: { kind: string; id: string }) =>
      req(`/companions/${cid}/art`, {
        kind: animal.kind,
        companion_id: animal.id,
        idempotency_key: randomUUID(),
      });
    for (const animal of animals) {
      for (let i = 0; i < 2; i++) {
        const job = await animalDress(animal);
        assert.equal(job.status, 202, JSON.stringify(job.data));
        await pool.query(
          "UPDATE companion_art_jobs SET status='completed',reference=NULL WHERE id=$1",
          [job.data.id],
        );
      }
      assert.equal((await animalDress(animal)).status, 409);
    }
    assert.deepEqual(
      (await animalState()).map((a: any) => [a.art_used, a.art_limit, a.quota_scope]),
      [
        [2, 2, 'companion'],
        [2, 2, 'companion'],
        [2, 2, 'companion'],
      ],
    );
    assert.deepEqual(await budget(), { used: 10, limit: 10 });
    // Failed and stale companion jobs release only their own budget.
    await pool.query(
      "UPDATE companion_art_jobs SET status='failed' WHERE id=(SELECT id FROM companion_art_jobs WHERE wardrobe_id=$1 ORDER BY created_at LIMIT 1)",
      [animals[0].id],
    );
    const replacement = await animalDress(animals[0]);
    assert.equal(replacement.status, 202);
    await pool.query("UPDATE companion_art_jobs SET status='stale' WHERE id=$1", [
      replacement.data.id,
    ]);
    assert.equal((await animalState()).find((a: any) => a.id === animals[0].id).art_used, 1);
    // A failed character job also releases a slot, and simultaneous requests cannot overspend it.
    await pool.query(
      "UPDATE character_art_jobs SET status='failed' WHERE id=(SELECT id FROM character_art_jobs WHERE character_id=$1 AND creation IS NULL ORDER BY created_at LIMIT 1)",
      [cid],
    );
    assert.equal((await budget()).used, 9);
    const concurrent = await Promise.all([dress(), dress()]);
    assert.deepEqual(concurrent.map((j) => j.status).sort(), [202, 409]);
    const accepted = concurrent.find((j) => j.status === 202)!;
    await finishTestArt(accepted.data.id);
    // Previous UTC calendar months do not consume this month, including for companions.
    for (const table of ['character_art_jobs', 'companion_art_jobs'])
      await pool.query(
        `UPDATE ${table} SET created_at=(date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 second' WHERE character_id=$1`,
        [cid],
      );
    assert.deepEqual(await budget(), { used: 0, limit: 10 });
    assert.ok((await animalState()).every((a: any) => a.art_used === 0));
    // Unlimited is read from the account, and is preserved for all three subjects.
    await pool.query('INSERT INTO character_art_allowances(user_id,unlimited) VALUES($1,true)', [
      account.data.user.id,
    ]);
    assert.equal((await budget()).limit, null);
    assert.ok((await animalState()).every((a: any) => a.art_limit === null));
    cookie = '';
    assert.equal((await req('/character-art')).status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

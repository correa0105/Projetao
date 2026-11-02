import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { completeArt } from '../server/character-art.js';
import { retryCharacterArt } from '../server/character-art-retries.js';
import { IllustratorError } from '../server/codex-illustrator.js';
import { characterAccountArtUsedSql } from '../server/art-quota.js';
import { createLegacyTestCharacter, testArtImage, testTokenImage } from './character-fixtures.js';

test('Vestir: cancelar com segurança sem perder referências ou publicar resultados atrasados', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const a = server.address();
  assert(a && typeof a !== 'string');
  const base = `http://127.0.0.1:${a.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Client = { id: string; cookie: string };
  async function req(path: string, client?: Client, body?: unknown) {
    const r = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Origin: origin, Cookie: client?.cookie || '', 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(): Promise<Client> {
    const r = await req('/auth/sign-up/email', undefined, {
      name: 'Teste vestir',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((s) => s.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup(),
      other = await signup(),
      c = await createLegacyTestCharacter(owner.id, 'Vestir');
    const portrait = await testArtImage(),
      token = await testTokenImage();
    await pool.query('UPDATE characters SET portrait_revision=3,gold_cp=123456 WHERE id=$1', [
      c.id,
    ]);
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      c.id,
      portrait,
    ]);
    await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
      c.id,
      token,
    ]);
    const imageState = async () =>
      (
        await pool.query(
          'SELECT c.portrait_revision,c.gold_cp,md5(p.image)portrait,md5(t.image)token FROM characters c JOIN character_portraits p ON p.character_id=c.id JOIN character_tokens t ON t.character_id=c.id WHERE c.id=$1',
          [c.id],
        )
      ).rows[0];
    const before = await imageState();
    async function job(status: string, retry = 0, code: string | null = null) {
      return (
        await pool.query(
          `INSERT INTO character_art_jobs(user_id,character_id,status,idempotency_key,reference,approved_portrait,replacement_revision,retry_count,last_error_code)
    VALUES($1,$2,$3,$4,$5,$5,3,$6,$7)RETURNING id`,
          [owner.id, c.id, status, randomUUID(), portrait, retry, code],
        )
      ).rows[0].id as string;
    }
    const used = async () =>
      Number(
        (await pool.query(`SELECT ${characterAccountArtUsedSql('$1')} AS used`, [owner.id])).rows[0]
          .used,
      );
    await job('completed');
    const queued = await job('queued'),
      running = await job('running');
    await t.test(
      'somente o dono cancela; reenvio concorrente preserva arte, referências e cota anterior',
      async () => {
        assert.equal(await used(), 3);
        assert.equal(
          (await req('/character-art/' + queued + '/cancel', undefined, {})).status,
          401,
        );
        assert.equal((await req('/character-art/' + queued + '/cancel', other, {})).status, 404);
        assert.equal(
          (await req('/character-art/' + queued + '/cancel', owner, { user_id: other.id })).status,
          400,
        );
        const results = await Promise.all([
          req('/character-art/' + queued + '/cancel', owner, {}),
          req('/character-art/' + queued + '/cancel', owner, {}),
        ]);
        assert(results.every((r) => r.status === 200));
        assert.equal(results.filter((r) => r.data.replayed).length, 1);
        assert.equal((await req('/character-art/' + running + '/cancel', owner, {})).status, 200);
        assert.equal(await used(), 1);
        const rows = (
          await pool.query(
            'SELECT status,last_error_code,next_attempt_at,reference,approved_portrait FROM character_art_jobs WHERE id=ANY($1::uuid[])',
            [[queued, running]],
          )
        ).rows;
        for (const r of rows) {
          assert.equal(r.status, 'failed');
          assert.equal(r.last_error_code, 'cancelled');
          assert.equal(r.next_attempt_at, null);
          assert.deepEqual(r.reference, portrait);
          assert.deepEqual(r.approved_portrait, portrait);
        }
        assert.deepEqual(await imageState(), before);
      },
    );
    await t.test(
      'resultado atrasado e retry de processo antigo não reativam nem publicam um pedido cancelado',
      async () => {
        await assert.rejects(() => completeArt(running, { portrait, token }), /cancelado/);
        await assert.rejects(() => completeArt(running, { portrait }), /cancelado/);
        assert.equal(
          await retryCharacterArt(running, new IllustratorError('token_rejected', 'Reprovado')),
          undefined,
        );
        assert.equal(
          (
            await pool.query('SELECT status,last_error_code FROM character_art_jobs WHERE id=$1', [
              running,
            ])
          ).rows[0].last_error_code,
          'cancelled',
        );
        assert.deepEqual(await imageState(), before);
        assert.equal(await used(), 1);
      },
    );
    await t.test(
      'uma imagem já pronta permanece disponível para escolha e não é cancelada',
      async () => {
        const done = await job('completed');
        await pool.query(
          "UPDATE character_art_jobs SET art_decision='pending',proposed_portrait=$2,proposed_token=$3 WHERE id=$1",
          [done, portrait, token],
        );
        assert.equal((await req('/character-art/' + done + '/cancel', owner, {})).status, 409);
        const r = (
          await pool.query(
            'SELECT art_decision,proposed_portrait,proposed_token FROM character_art_jobs WHERE id=$1',
            [done],
          )
        ).rows[0];
        assert.equal(r.art_decision, 'pending');
        assert.deepEqual(r.proposed_portrait, portrait);
        assert.deepEqual(r.proposed_token, token);
        assert.deepEqual(await imageState(), before);
      },
    );
    await t.test(
      'a recuperação automática permanece ativa e pode ser cancelada mesmo após várias retomadas',
      async () => {
        const visual = await job('running');
        for (let n = 1; n <= 5; n++) {
          if (n > 1)
            await pool.query("UPDATE character_art_jobs SET status='running' WHERE id=$1", [
              visual,
            ]);
          const r = await retryCharacterArt(
            visual,
            new IllustratorError('token_rejected', 'Token reprovado'),
          );
          assert.equal(r.retry_count, n);
          assert.equal(r.status, 'queued');
          assert(r.next_attempt_at);
        }
        const oldWorker = await job('running', 301, 'token_rejected');
        assert.equal((await req('/character-art/' + oldWorker + '/cancel', owner, {})).status, 200);
        assert.equal(
          await retryCharacterArt(oldWorker, new IllustratorError('token_rejected', 'Reprovado')),
          undefined,
        );
        const network = await job('running', 8, 'connection');
        assert.equal(
          (
            await retryCharacterArt(
              network,
              new IllustratorError('connection', 'Conexão interrompida'),
            )
          ).status,
          'queued',
        );
        const checkpoint = (
          await pool.query(
            'SELECT reference,approved_portrait FROM character_art_jobs WHERE id=$1',
            [visual],
          )
        ).rows[0];
        assert.deepEqual(checkpoint.reference, portrait);
        assert.deepEqual(checkpoint.approved_portrait, portrait);
        assert.equal((await req('/character-art/' + visual + '/cancel', owner, {})).status, 200);
        assert.deepEqual(await imageState(), before);
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

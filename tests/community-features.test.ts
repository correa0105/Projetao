import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { achievementCatalog } from '../shared/achievements.js';
import { emptyTitle } from '../shared/titles.js';
import { blankEvent } from '../shared/events.js';
test('mascotes, cartas, títulos, eventos e estante: economia, ownership e administração', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown, raw?: Buffer) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': raw ? 'image/png' : 'application/json',
      },
      body: raw ? new Uint8Array(raw) : body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: (response.headers.get('content-type') || '').includes('json')
        ? await response.json()
        : null,
      headers: response.headers,
    };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Jogador',
      email: `community-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
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
      admin = await signup();
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    const a = await createLegacyTestCharacter(owner.id, 'Arden'),
      b = await createLegacyTestCharacter(owner.id, 'Mira'),
      foreign = await createLegacyTestCharacter(admin.id, 'Outro');
    await pool.query('UPDATE characters SET gold_cp=100000 WHERE id=ANY($1::uuid[])', [
      [a.id, b.id, foreign.id],
    ]);
    await t.test(
      'mascote com aparência, preço canônico, replay concorrente e rejeição de invasão',
      async () => {
        const order = {
          character_id: a.id,
          pet_id: 'dog',
          appearance: 'shepherd',
          name: 'Brasa',
          idempotency_key: randomUUID(),
        };
        assert.equal((await req('/pets/purchase', '', 'POST', order)).status, 401);
        assert.equal((await req('/pets/purchase', admin.cookie, 'POST', order)).status, 404);
        assert.equal(
          (await req('/pets/purchase', owner.cookie, 'POST', { ...order, price_cp: 1 })).status,
          400,
        );
        assert.equal(
          (await req('/pets/purchase', owner.cookie, 'POST', { ...order, appearance: 'runic' }))
            .status,
          400,
        );
        const responses = await Promise.all([
          req('/pets/purchase', owner.cookie, 'POST', order),
          req('/pets/purchase', owner.cookie, 'POST', order),
        ]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
        assert.equal(responses[0].data.pet.appearance, 'shepherd');
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [a.id])).rows[0].gold_cp,
          99000,
        );
        assert.equal((await req('/pets/' + a.id, owner.cookie)).data.length, 1);
        assert.equal((await req('/pets/' + a.id, admin.cookie)).status, 404);
        assert.equal(
          (await req('/pets/purchase', owner.cookie, 'POST', { ...order, name: 'Outro' })).status,
          409,
        );
        await pool.query('UPDATE characters SET gold_cp=0 WHERE id=$1', [b.id]);
        assert.equal(
          (
            await req('/pets/purchase', owner.cookie, 'POST', {
              ...order,
              character_id: b.id,
              idempotency_key: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal((await req('/pets/' + b.id, owner.cookie)).data.length, 0);
      },
    );
    await t.test('cartas: três espaços, preço no servidor, compra única e isolamento', async () => {
      const order = { character_id: a.id, card_id: 'vigil', idempotency_key: randomUUID() };
      const responses = await Promise.all([
        req('/cards/purchase', owner.cookie, 'POST', order),
        req('/cards/purchase', owner.cookie, 'POST', order),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 201]);
      assert.equal(
        (await req('/cards/purchase', owner.cookie, 'POST', { ...order, price_cp: 0 })).status,
        400,
      );
      assert.equal(
        (
          await req('/cards/purchase', owner.cookie, 'POST', {
            ...order,
            card_id: 'roots',
            idempotency_key: randomUUID(),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await req('/cards/purchase', admin.cookie, 'POST', {
            ...order,
            idempotency_key: randomUUID(),
          })
        ).status,
        404,
      );
      for (const card_id of ['raven', 'mirror', 'moon'])
        assert.equal(
          (
            await req('/cards/purchase', owner.cookie, 'POST', {
              ...order,
              card_id,
              idempotency_key: randomUUID(),
            })
          ).status,
          201,
        );
      const items = (await req('/cards/' + a.id, owner.cookie)).data;
      assert.equal(items.length, 4);
      const ids = items.map((i: { id: string }) => i.id);
      const path = '/cards/' + a.id + '/equipment';
      assert.equal((await req(path, owner.cookie, 'PUT', { slots: ids })).status, 400);
      assert.equal(
        (await req(path, owner.cookie, 'PUT', { slots: [ids[0], ids[0], null] })).status,
        400,
      );
      assert.equal((await req(path, admin.cookie, 'PUT', { slots: ids.slice(0, 3) })).status, 404);
      assert.equal(
        (
          await req('/cards/' + b.id + '/equipment', owner.cookie, 'PUT', {
            slots: [ids[0], null, null],
          })
        ).status,
        403,
      );
      assert.equal((await req(path, owner.cookie, 'PUT', { slots: ids.slice(0, 3) })).status, 200);
      assert.equal(
        (await req('/cards/' + a.id, owner.cookie)).data.filter(
          (c: { slot: number | null }) => c.slot !== null,
        ).length,
        3,
      );
      assert.equal(
        (await req(path, owner.cookie, 'PUT', { slots: [ids[3], ids[1], ids[2]] })).status,
        200,
      );
      assert.equal(
        (
          await req('/cards/purchase', owner.cookie, 'POST', {
            ...order,
            idempotency_key: randomUUID(),
          })
        ).status,
        409,
      );
      assert.equal(
        (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [a.id])).rows[0].gold_cp,
        61500,
      );
    });
    await t.test(
      'títulos: metas do servidor, vínculo de conquista, concessão, revogação e revisão',
      async () => {
        await pool.query(
          "INSERT INTO achievements(character_id,code)VALUES($1,'first_character')ON CONFLICT DO NOTHING",
          [a.id],
        );
        const input = {
          ...emptyTitle,
          name: 'Guardião da estrada',
          goal: { kind: 'level', target: 2, achievement: '' },
        };
        assert.equal((await req('/titles/catalog', owner.cookie, 'POST', input)).status, 403);
        const created = await req('/titles/catalog', admin.cookie, 'POST', input);
        assert.equal(created.status, 201);
        const id = created.data.id;
        let state = (await req('/titles/' + a.id, owner.cookie)).data;
        assert.equal(state.items.find((i: { id: string }) => i.id === id).earned, false);
        assert.equal(
          state.items.find((i: { name: string }) => i.name === 'O Primeiro Capítulo').earned,
          true,
        );
        assert.equal(
          (await req('/titles/' + a.id + '/display', owner.cookie, 'PUT', { title_id: id })).status,
          403,
        );
        await pool.query('UPDATE characters SET level=2 WHERE id=$1', [a.id]);
        state = (await req('/titles/' + a.id, owner.cookie)).data;
        assert.equal(state.items.find((i: { id: string }) => i.id === id).earned, true);
        assert.equal(
          (await req('/titles/' + a.id + '/display', owner.cookie, 'PUT', { title_id: id })).status,
          200,
        );
        assert.equal((await req('/titles/' + a.id, admin.cookie)).status, 404);
        const grant = { character_id: b.id, title_id: id, action: 'grant' };
        assert.equal((await req('/titles/grant', owner.cookie, 'POST', grant)).status, 403);
        assert.equal((await req('/titles/grant', admin.cookie, 'POST', grant)).status, 200);
        assert.equal(
          (await req('/titles/' + b.id, owner.cookie)).data.items.find(
            (i: { id: string }) => i.id === id,
          ).earned,
          true,
        );
        assert.equal(
          (await req('/titles/grant', admin.cookie, 'POST', { ...grant, action: 'revoke' })).status,
          200,
        );
        assert.equal(
          (await req('/titles/' + b.id, owner.cookie)).data.items.find(
            (i: { id: string }) => i.id === id,
          ).earned,
          false,
        );
        assert.equal(
          (
            await req('/titles/catalog/' + id, admin.cookie, 'PUT', {
              ...input,
              name: 'Guardião da Alvorada',
              revision: 1,
            })
          ).status,
          200,
        );
        assert.equal(
          (await req('/titles/catalog/' + id, admin.cookie, 'PUT', { ...input, revision: 1 }))
            .status,
          409,
        );
        assert.equal((await req('/titles/characters?q=Arden', owner.cookie)).status, 403);
        assert.equal((await req('/titles/characters?q=Arden', admin.cookie)).data[0].id, a.id);
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
        assert.equal((await req('/titles/grant', admin.cookie, 'POST', grant)).status, 403);
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
      },
    );
    await t.test(
      'eventos: cenário integral, uploads privados, CRUD compartilhado e conflito',
      async () => {
        const scene = (await req('/events-scene', admin.cookie)).data;
        assert.equal(
          (
            await req('/events-scene', owner.cookie, 'PUT', {
              document: scene.document,
              revision: scene.revision,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req('/events-scene', admin.cookie, 'PUT', {
              document: { ...scene.document, title: 'Nosso salão' },
              revision: scene.revision,
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await req('/events-scene', admin.cookie, 'PUT', {
              document: scene.document,
              revision: scene.revision,
            })
          ).status,
          409,
        );
        const bytes = await sharp({
          create: { width: 30, height: 30, channels: 4, background: '#d7af66' },
        })
          .png()
          .toBuffer();
        assert.equal(
          (await req('/event-images', owner.cookie, 'POST', undefined, bytes)).status,
          403,
        );
        const upload = await req('/event-images', admin.cookie, 'POST', undefined, bytes);
        assert.equal(upload.status, 201);
        const path = upload.data.path.replace('/api', '');
        assert.equal((await req(path, owner.cookie)).status, 404);
        const input = {
          ...blankEvent,
          title: 'A festa da Alvorada',
          description: 'Encontro de viajantes e histórias.',
          presentation: {
            ...blankEvent.presentation,
            image: upload.data.path,
            featured: true,
            animation: 'sway',
          },
        };
        assert.equal((await req('/events', owner.cookie, 'POST', input)).status, 403);
        const e = await req('/events', admin.cookie, 'POST', input);
        assert.equal(e.status, 201);
        assert.equal((await req(path, owner.cookie)).status, 200);
        assert.equal(
          (await req('/events', owner.cookie)).data.items.some(
            (i: { id: string }) => i.id === e.data.id,
          ),
          true,
        );
        assert.equal(
          (await pool.query('SELECT kind FROM board_posts WHERE id=$1', [e.data.id])).rows[0].kind,
          'event',
        );
        assert.equal(
          (
            await req('/events/' + e.data.id, admin.cookie, 'PUT', {
              ...input,
              title: 'Nova festa',
              revision: 1,
            })
          ).status,
          200,
        );
        assert.equal(
          (await req('/events/' + e.data.id, admin.cookie, 'PUT', { ...input, revision: 1 }))
            .status,
          409,
        );
        assert.equal(
          (await req('/events/' + e.data.id, owner.cookie, 'DELETE', { revision: 2 })).status,
          403,
        );
        assert.equal(
          (await req('/events/' + e.data.id, admin.cookie, 'DELETE', { revision: 2 })).status,
          200,
        );
        assert.equal((await req(path, owner.cookie)).status, 404);
        assert.equal(
          (
            await req('/events', admin.cookie, 'POST', {
              ...input,
              presentation: { ...input.presentation, link: 'javascript:alert(1)' },
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'estante: sete peças na mesma prateleira, movimento vertical, persistência e conquista bloqueada',
      async () => {
        for (const item of achievementCatalog)
          await pool.query(
            'INSERT INTO achievements(character_id,code)VALUES($1,$2)ON CONFLICT DO NOTHING',
            [a.id, item.code],
          );
        const config = {
          material: 'walnut',
          medal_frame: 'bronze',
          slots: achievementCatalog.map((a) => a.code),
          positions: achievementCatalog.map((_, i) => i * 12),
          rows: achievementCatalog.map(() => 0),
        };
        const path = '/characters/' + a.id + '/achievements';
        const r = await req(path, owner.cookie, 'POST', config);
        assert.equal(r.status, 200);
        assert.deepEqual(r.data.shelf.rows, [0, 0, 0, 0, 0, 0, 0]);
        assert.equal((await req(path, admin.cookie, 'POST', config)).status, 404);
        assert.equal(
          (await req('/characters/' + b.id + '/achievements', owner.cookie, 'POST', config)).status,
          400,
        );
        assert.equal((await req(path, owner.cookie, 'POST', { ...config, rows: [0] })).status, 400);
        assert.equal(
          (await req(path, owner.cookie, 'POST', { ...config, rows: config.rows.map(() => 3) }))
            .status,
          400,
        );
        assert.equal(
          (await req(path, owner.cookie, 'POST', { ...config, rows: [2, 1, 0, 0, 0, 0, 0] }))
            .status,
          200,
        );
        await seed();
        assert.deepEqual((await req(path, owner.cookie)).data.shelf.rows, [2, 1, 0, 0, 0, 0, 0]);
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

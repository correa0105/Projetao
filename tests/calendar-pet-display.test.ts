import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import { blankEvent } from '../shared/events.js';
import sharp from 'sharp';
test('calendário e mascotes: persistência, edição administrativa, concorrência, fuso e ownership', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app.js'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup() {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name: 'Jogador',
      email: `calendar-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
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
      'nomes de raças exigem administrador e revisão; nomes pessoais permanecem',
      async () => {
        assert.equal((await req('/pets/catalog')).status, 401);
        const catalog = (await req('/pets/catalog', owner.cookie)).data;
        assert.equal(catalog.breeds.length, 17);
        assert.equal(catalog.can_edit, false);
        const path = '/pets/catalog/dog/shepherd',
          body = { name: 'Pastor alemão', revision: 0 };
        assert.equal((await req(path, owner.cookie, 'PUT', body)).status, 403);
        const changes = await Promise.all([
          req(path, admin.cookie, 'PUT', body),
          req(path, admin.cookie, 'PUT', { ...body, name: 'Pastor da estrada' }),
        ]);
        assert.deepEqual(changes.map((r) => r.status).sort(), [200, 409]);
        const saved = changes.find((r) => r.status === 200)!.data;
        assert.equal(saved.revision, 1);
        assert.equal(
          (await req(path, admin.cookie, 'PUT', { name: '  ', revision: 1 })).status,
          400,
        );
        assert.equal((await req('/pets/catalog/dog/runic', admin.cookie, 'PUT', body)).status, 404);
        await seed();
        assert.equal(
          (await req('/pets/catalog', owner.cookie)).data.breeds.find(
            (breed: { pet_id: string; appearance: string }) =>
              breed.pet_id === 'dog' && breed.appearance === 'shepherd',
          ).name,
          saved.name,
        );
      },
    );
    await t.test(
      'mascote exibido é único por personagem; replay e novas compras respeitam a escolha',
      async () => {
        const order = {
          character_id: a.id,
          pet_id: 'dog',
          appearance: 'shepherd',
          name: 'Brasa',
          idempotency_key: randomUUID(),
        };
        const first = await req('/pets/purchase', owner.cookie, 'POST', order);
        assert.equal(first.status, 201);
        assert.equal(first.data.pet.displayed, true);
        assert.equal(first.data.pet.name, 'Brasa');
        const second = await req('/pets/purchase', owner.cookie, 'POST', {
          ...order,
          pet_id: 'cat',
          appearance: 'original',
          name: 'Bolota',
          idempotency_key: randomUUID(),
        });
        assert.equal(second.data.pet.displayed, false);
        const other = await req('/pets/purchase', admin.cookie, 'POST', {
          ...order,
          character_id: foreign.id,
          idempotency_key: randomUUID(),
        });
        const display = `/pets/${a.id}/display`;
        assert.equal((await req(display, '', 'PUT', { pet_id: first.data.pet.id })).status, 401);
        assert.equal(
          (await req(display, admin.cookie, 'PUT', { pet_id: first.data.pet.id })).status,
          404,
        );
        assert.equal(
          (await req(display, owner.cookie, 'PUT', { pet_id: other.data.pet.id })).status,
          404,
        );
        assert.equal(
          (await req(`/pets/${b.id}/display`, owner.cookie, 'PUT', { pet_id: first.data.pet.id }))
            .status,
          404,
        );
        const choices = await Promise.all(
          [first, second].map((item) =>
            req(display, owner.cookie, 'PUT', { pet_id: item.data.pet.id }),
          ),
        );
        assert.ok(choices.every((item) => item.status === 200));
        assert.equal(
          (await req(`/pets/${a.id}`, owner.cookie)).data.filter(
            (item: { displayed: boolean }) => item.displayed,
          ).length,
          1,
        );
        await req(display, owner.cookie, 'PUT', { pet_id: second.data.pet.id });
        assert.equal((await req('/pets/purchase', owner.cookie, 'POST', order)).status, 200);
        assert.equal(
          (await req(`/pets/${a.id}`, owner.cookie)).data.find(
            (item: { displayed: boolean }) => item.displayed,
          ).id,
          second.data.pet.id,
        );
        await req(display, owner.cookie, 'PUT', { pet_id: null });
        await seed();
        assert.equal(
          (await req(`/pets/${a.id}`, owner.cookie)).data.some(
            (item: { displayed: boolean }) => item.displayed,
          ),
          false,
        );
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [a.id])).rows[0].gold_cp,
          97500,
        );
      },
    );
    await t.test(
      'calendário editável só pelo administrador; valida imagens e revisão',
      async () => {
        assert.equal((await req('/calendar?month=2026-10')).status, 401);
        assert.equal((await req('/calendar?month=2026-13', owner.cookie)).status, 400);
        const view = (await req('/calendar?month=2026-10', owner.cookie)).data;
        const input = {
          document: {
            ...view.document,
            title: 'As jornadas da guilda',
            week_start: 'sunday',
            accent: '#b79b66',
          },
          revision: view.revision,
        };
        assert.equal((await req('/calendar/settings', owner.cookie, 'PUT', input)).status, 403);
        assert.equal(
          (
            await req('/calendar/settings', admin.cookie, 'PUT', {
              ...input,
              document: { ...input.document, background: 'https://unknown.test/bg.png' },
            })
          ).status,
          400,
        );
        assert.equal((await req('/calendar/settings', admin.cookie, 'PUT', input)).status, 200);
        assert.equal((await req('/calendar/settings', admin.cookie, 'PUT', input)).status, 409);
        await seed();
        const saved = (await req('/calendar?month=2026-10', owner.cookie)).data;
        assert.equal(saved.document.title, input.document.title);
        assert.equal(saved.document.week_start, 'sunday');
        const bytes = await sharp({
          create: { width: 32, height: 24, channels: 3, background: '#27332b' },
        })
          .png()
          .toBuffer();
        const upload = await fetch(base + '/event-images', {
          method: 'POST',
          headers: { Origin: origin, Cookie: admin.cookie, 'Content-Type': 'image/png' },
          body: bytes,
        });
        assert.equal(upload.status, 201);
        const imagePath = (await upload.json()).path;
        const readImage = () =>
          fetch(base.replace(/\/api$/, '') + imagePath, { headers: { Cookie: owner.cookie } });
        assert.equal((await readImage()).status, 404);
        assert.equal(
          (
            await req('/calendar/settings', admin.cookie, 'PUT', {
              document: { ...saved.document, background: imagePath },
              revision: saved.revision,
            })
          ).status,
          200,
        );
        const publishedImage = await readImage();
        assert.equal(publishedImage.status, 200);
        assert.equal(publishedImage.headers.get('content-type'), 'image/webp');
        assert.equal(
          (await req('/events-scene', owner.cookie)).data.document.background,
          '/notice-village-empty-v4.png',
        );
      },
    );
    await t.test(
      'calendário usa eventos reais, missões e diário; limites mensais em Brasília e exclusão sincronizada',
      async () => {
        const early = await req('/events', admin.cookie, 'POST', {
          ...blankEvent,
          title: 'Fim de outubro',
          description: 'Na virada do mês.',
          starts_at: '2026-11-01T01:00:00Z',
        });
        const late = await req('/events', admin.cookie, 'POST', {
          ...blankEvent,
          title: 'Primeiro de novembro',
          description: 'Nova jornada.',
          starts_at: '2026-11-01T03:00:00Z',
        });
        assert.equal(early.status, 201);
        assert.equal(late.status, 201);
        await pool.query(
          "INSERT INTO board_posts(author_id,kind,title,description,starts_at,location,difficulty,reward_cp,status)VALUES($1,'mission','Missão do mês','Jornada marcada.','2026-10-15T22:00:00Z','Vigília','Tranquila',0,'open')",
          [owner.id],
        );
        const october = (await req('/calendar?month=2026-10', owner.cookie)).data.entries;
        assert.ok(october.some((item: { id: string }) => item.id === early.data.id));
        assert.ok(!october.some((item: { id: string }) => item.id === late.data.id));
        assert.ok(
          october.some(
            (item: { source: string; title: string }) =>
              item.source === 'mission' && item.title === 'Missão do mês',
          ),
        );
        const meeting = await pool.query(
          `INSERT INTO home_updates(author_id,title,body,kind,layout,image_side,image_fit,text_align,text_size,starts_at,location) VALUES($1,'Encontro do diário','Uma conversa marcada.','meeting','compact','left','contain','left','normal','2026-10-20T22:00:00Z','Taverna') RETURNING id`,
          [admin.id],
        );
        const withMeeting = (await req('/calendar?month=2026-10', owner.cookie)).data.entries;
        assert.equal((await req('/home-updates/' + meeting.rows[0].id)).status, 401);
        const publication = (await req('/home-updates/' + meeting.rows[0].id, admin.cookie)).data;
        assert.equal(publication.title, 'Encontro do diário');
        assert.equal(publication.can_edit, true);
        assert.ok(
          withMeeting.some(
            (item: { id: string; source: string }) =>
              item.id === meeting.rows[0].id && item.source === 'publication',
          ),
        );
        await pool.query('DELETE FROM home_updates WHERE id=$1', [meeting.rows[0].id]);
        assert.ok(
          !(await req('/calendar?month=2026-10', owner.cookie)).data.entries.some(
            (item: { id: string }) => item.id === meeting.rows[0].id,
          ),
        );
        const event = october.find((item: { id: string }) => item.id === early.data.id).event;
        assert.equal(
          (
            await req(`/events/${event.id}`, admin.cookie, 'DELETE', {
              revision: event.event_revision,
            })
          ).status,
          200,
        );
        assert.ok(
          !(await req('/calendar?month=2026-10', owner.cookie)).data.entries.some(
            (item: { id: string }) => item.id === early.data.id,
          ),
        );
        assert.ok(
          (await req('/calendar?month=2026-11', owner.cookie)).data.entries.some(
            (item: { id: string }) => item.id === late.data.id,
          ),
        );
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [admin.id]);
        const current = (await req('/calendar?month=2026-11', admin.cookie)).data;
        assert.equal(
          (
            await req('/calendar/settings', admin.cookie, 'PUT', {
              document: current.document,
              revision: current.revision,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await req('/pets/catalog/dog/original', admin.cookie, 'PUT', {
              name: 'Outro',
              revision: 0,
            })
          ).status,
          403,
        );
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

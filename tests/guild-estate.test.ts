import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  defaultGuildEstate,
  guildEstateSchema,
  guildEstateItemRoom,
  guildEstateFurnitureCatalog,
} from '../shared/guild-estate';
import { communitySettingsSchema, crestSchema } from '../shared/guilds';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';

test('sede começa com quatro instalações em quatro cômodos; valida paredes, quantidade e colisões', () => {
  const layout = defaultGuildEstate();
  assert(guildEstateSchema.safeParse(layout).success);
  assert.equal(new Set(layout.items.map((i) => guildEstateItemRoom(i)?.id)).size, 4);
  for (const bad of [
    { ...layout, items: layout.items.slice(1) },
    { ...layout, items: layout.items.map((i) => ({ ...i, id: 'main' })) },
    { ...layout, items: layout.items.map((i) => (i.id === 'main' ? { ...i, x: 30 } : i)) },
    {
      ...layout,
      items: layout.items.map((i) => (i.id === 'forge' ? { ...i, x: 25.5, y: 20.5 } : i)),
    },
  ])
    assert(!guildEstateSchema.safeParse(bad).success);
  assert(
    guildEstateSchema.safeParse({
      ...layout,
      items: layout.items.map((i) => (i.id === 'main' ? { ...i, x: 26, rotation: 90 } : i)),
    }).success,
  );
});
test('API da sede conserva broche/economia, protege o dono e salva posições com revisão', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const a = server.address();
  assert(a && typeof a !== 'string');
  const base = `http://127.0.0.1:${a.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function request(path: string, who?: Account, method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: who?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  }
  async function signup(name: string): Promise<Account> {
    const r = await fetch(base + '/auth/sign-up/email', {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      }),
    });
    assert.equal(r.status, 200);
    return {
      id: (await r.json()).user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const owner = await signup('Fundador'),
      other = await signup('Visitante'),
      hero = await createLegacyTestCharacter(owner.id),
      sibling = await createLegacyTestCharacter(owner.id);
    const settings = communitySettingsSchema.parse({ founding_po: 0 });
    await pool.query('UPDATE community_settings SET document=$1 WHERE singleton', [
      JSON.stringify(settings),
    ]);
    const crest = crestSchema.parse({ icon: 'wolf', fieldColor: '#234522' });
    const founded = await request('/guilds', owner, 'POST', {
      character_id: hero.id,
      request_id: randomUUID(),
      document: { name: 'Companhia do Campo', crest },
    });
    assert.equal(founded.status, 201);
    const id = founded.data.id;
    let g = (await request('/guilds/' + id, owner)).data;
    assert.deepEqual(g.document.crest, crest);
    assert.deepEqual(g.document.placements, []);
    assert.equal(g.document.estate.items.length, 4);
    const original = structuredClone(g.document.estate),
      estate = structuredClone(original);
    estate.items[0].x = 26;
    assert.equal(
      (await request(`/guilds/${id}/estate`, other, 'PATCH', { estate, revision: g.revision }))
        .status,
      403,
    );
    assert.equal(
      (
        await request(`/guilds/${id}/estate?character_id=${sibling.id}`, owner, 'PATCH', {
          estate,
          revision: g.revision,
        })
      ).status,
      403,
    );
    const before = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
      .rows[0];
    const moved = await request(`/guilds/${id}/estate?character_id=${hero.id}`, owner, 'PATCH', {
      estate,
      revision: g.revision,
    });
    assert.equal(moved.status, 200);
    assert.equal(
      (
        await request(`/guilds/${id}/estate`, owner, 'PATCH', {
          estate: original,
          revision: g.revision,
        })
      ).status,
      409,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.deepEqual(g.document.estate, estate);
    assert.deepEqual(g.document.crest, crest);
    const invalid = structuredClone(estate);
    invalid.items[0].x = 0;
    assert.equal(
      (
        await request(`/guilds/${id}/estate`, owner, 'PATCH', {
          estate: invalid,
          revision: g.revision,
        })
      ).status,
      400,
    );
    const races = await Promise.all(
      [estate, original].map((estate) =>
        request(`/guilds/${id}/estate`, owner, 'PATCH', { estate, revision: g.revision }),
      ),
    );
    assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
    g = (await request('/guilds/' + id, owner)).data;
    const saved = structuredClone(g.document.estate);
    const newCrest = { ...crest, icon: 'tree' };
    assert.equal(
      (
        await request(`/guilds/${id}/crest`, owner, 'PATCH', {
          crest: newCrest,
          revision: g.revision,
        })
      ).status,
      200,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.deepEqual(g.document.estate, saved);
    assert.equal(g.document.crest.icon, 'tree');
    await pool.query('UPDATE player_guilds SET treasury_cp=100000 WHERE id=$1', [id]);
    assert.equal(
      (await request(`/guilds/${id}/facilities/main/upgrade`, owner, 'POST', { level: 2 })).status,
      200,
    );
    assert.equal(
      (await request(`/guilds/${id}/facilities/main/upgrade`, owner, 'POST', { level: 2 })).status,
      200,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.equal(g.facilities.find((f: { room: string }) => f.room === 'main').level, 2);
    assert.equal(g.treasury_cp, 90000);
    assert.deepEqual(g.document.estate, saved);
    assert.deepEqual(
      (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0],
      before,
    );
    // Documents created before this renderer retain their data and get a layout only on save.
    await pool.query("UPDATE player_guilds SET document=document-'estate' WHERE id=$1", [id]);
    g = (await request('/guilds/' + id, owner)).data;
    assert.equal(g.document.estate, undefined);
    assert.equal(
      (
        await request(`/guilds/${id}/estate`, owner, 'PATCH', {
          estate: saved,
          revision: g.revision,
        })
      ).status,
      200,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.equal(g.document.crest.icon, 'tree');
    assert.equal(g.facilities[0].level, 2);
    const catalog = guildEstateFurnitureCatalog.find((f) => f.id === 'furniture-004')!,
      key = randomUUID();
    await pool.query('UPDATE player_guilds SET treasury_cp=100000 WHERE id=$1', [id]);
    const purchases = await Promise.all(
      [1, 2].map(() =>
        request(`/guilds/${id}/estate/furniture`, owner, 'POST', {
          catalog_id: catalog.id,
          request_id: key,
        }),
      ),
    );
    assert(purchases.every((r) => r.status === 200));
    assert.equal(purchases[0].data.item_id, purchases[1].data.item_id);
    g = (await request('/guilds/' + id, owner)).data;
    assert.equal(g.treasury_cp, 100000 - catalog.price * 100);
    assert.equal(g.document.estate.furniture.length, 1);
    assert.equal(g.document.estate.furniture[0].x, null);
    assert.equal(
      (
        await pool.query(
          "SELECT count(*)::int n FROM player_guild_ledger WHERE guild_id=$1 AND kind='furniture'",
          [id],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await request(`/guilds/${id}/estate/furniture`, other, 'POST', {
          catalog_id: catalog.id,
          request_id: randomUUID(),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(`/guilds/${id}/estate/furniture`, owner, 'POST', {
          catalog_id: 'furniture-005',
          request_id: key,
        })
      ).status,
      409,
    );
    const edited = structuredClone(g.document.estate);
    edited.furniture[0].x = 23.5;
    edited.furniture[0].y = 19;
    edited.finishes = { roof: 'red', floor: 'pine', walls: 'brick', trees: true };
    assert.equal(
      (
        await request(`/guilds/${id}/estate`, owner, 'PATCH', {
          estate: edited,
          revision: g.revision,
        })
      ).status,
      200,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.deepEqual(g.document.estate, edited);
    const forged = structuredClone(edited);
    forged.furniture.push({ ...forged.furniture[0], id: randomUUID(), x: null, y: null });
    assert.equal(
      (
        await request(`/guilds/${id}/estate`, owner, 'PATCH', {
          estate: forged,
          revision: g.revision,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/guilds/${id}`, owner, 'PUT', {
          document: { ...g.document, estate: forged },
          revision: g.revision,
        })
      ).status,
      200,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.equal(g.document.estate.furniture.length, 1);
    assert.equal(g.document.crest.icon, 'tree');
    const stored = structuredClone(g.document.estate);
    stored.furniture[0].x = null;
    stored.furniture[0].y = null;
    assert.equal(
      (
        await request(`/guilds/${id}/estate`, owner, 'PATCH', {
          estate: stored,
          revision: g.revision,
        })
      ).status,
      200,
    );
    await pool.query('UPDATE player_guilds SET treasury_cp=0 WHERE id=$1', [id]);
    assert.equal(
      (
        await request(`/guilds/${id}/estate/furniture`, owner, 'POST', {
          catalog_id: catalog.id,
          request_id: randomUUID(),
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/guilds/${id}/estate/furniture`, owner, 'POST', {
          catalog_id: 'fake',
          request_id: randomUUID(),
        })
      ).status,
      400,
    );
    const actorPath = `/guilds/${id}/estate/actors`,
      actorQuery = '?character_id=' + hero.id;
    const position = { x: 22.2, y: 19.1, rotation: 37, scale: 1.2 };
    assert.equal(
      (await request(actorPath + '/me' + actorQuery, owner, 'PATCH', position)).status,
      200,
    );
    const actorList = (await request(actorPath + actorQuery, owner)).data;
    assert.equal(actorList.actors.length, 1);
    assert.equal(actorList.actors[0].id, hero.id);
    assert.equal(actorList.actors[0].can_move, true);
    assert.equal(actorList.actors[0].x, position.x);
    assert.equal(
      (await request(actorPath + '/me' + actorQuery, other, 'PATCH', position)).status,
      404,
    );
    assert.equal((await request(actorPath, other)).status, 403);
    assert.equal(
      (await request(actorPath + '/me' + actorQuery, owner, 'PATCH', { ...position, x: 80 }))
        .status,
      400,
    );
    g = (await request('/guilds/' + id, owner)).data;
    assert.equal(
      (await request('/guilds/' + id, owner, 'PUT', { document: g.document, revision: g.revision }))
        .status,
      200,
    );
    assert.equal((await request(actorPath + actorQuery, owner)).data.actors[0].x, position.x);
    assert.equal(
      (
        await request(actorPath + '/me' + actorQuery, owner, 'PATCH', {
          ...position,
          present: false,
        })
      ).status,
      200,
    );
    assert.equal((await request(actorPath + actorQuery, owner)).data.actors.length, 0);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

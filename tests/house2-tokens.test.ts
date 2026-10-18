import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { createLegacyTestCharacter } from './character-fixtures';
import { house2Houses } from '../shared/house-v2';
import { house2FinishesCatalog } from '../shared/house2-finishes';
import sharp from 'sharp';
import { house2Doorway, house2Floor, house2HouseWorld } from '../shared/house2-tokens';

test('House 2.0: tokens próprios, pets, portas, concorrência e dados originais', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function req(path: string, account?: Account, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: account?.cookie || '',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      data: response.headers.get('content-type')?.includes('application/json')
        ? await response.json()
        : Buffer.from(await response.arrayBuffer()),
      headers: response.headers,
    };
  }
  async function signup(name: string): Promise<Account> {
    const r = await req('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
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
    const owner = await signup('Morador'),
      other = await signup('Vizinho'),
      admin = await signup('Admin');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [admin.id]);
    const a = await createLegacyTestCharacter(owner.id, 'Aurora'),
      a2 = await createLegacyTestCharacter(owner.id, 'Faísca'),
      b = await createLegacyTestCharacter(other.id, 'Bruma');
    const image = await readFile('public/character-silhouette-v2.png');
    await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
      a.id,
      image,
    ]);
    const pet = (
      await pool.query(
        "INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key)VALUES($1,'cat','Luar',0,$2)RETURNING id",
        [a.id, randomUUID()],
      )
    ).rows[0];
    const foreignPet = (
      await pool.query(
        "INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key)VALUES($1,'dog','Nuvem',0,$2)RETURNING id",
        [b.id, randomUUID()],
      )
    ).rows[0];
    const directory = (await req('/house-v2', owner)).data,
      n = directory.neighborhoods[0].id;
    const path = `/house-v2/neighborhoods/${n}`,
      scene = (await req(path, owner)).data,
      lot = scene.plots[0];
    const original = (
      await pool.query('SELECT id,gold_cp,level,portrait_revision FROM characters ORDER BY id')
    ).rows;
    await t.test(
      'pátios maiores preservam o centro do vilarejo e não sobrepõem vizinhos',
      async () => {
        assert(scene.plots.every((p: any) => p.width === 18 && p.height === 18));
        assert.equal(lot.x, 0);
        assert.equal(lot.y, 32);
        for (const p of scene.plots)
          for (const q of scene.plots)
            if (p.id !== q.id)
              assert(
                !(
                  p.x < q.x + q.width &&
                  p.x + p.width > q.x &&
                  p.y < q.y + q.height &&
                  p.y + p.height > q.y
                ),
              );
      },
    );
    let actor: any, animal: any, neighbor: any;
    await t.test(
      'biblioteca contém todos os personagens e apenas os pets próprios; autenticação é obrigatória',
      async () => {
        assert.equal((await req('/house-v2/token-library')).status, 401);
        const library = (await req('/house-v2/token-library', owner)).data.sources;
        assert.deepEqual(
          library
            .filter((s: any) => s.kind === 'character')
            .map((s: any) => s.id)
            .sort(),
          [a.id, a2.id].sort(),
        );
        assert.deepEqual(
          library.filter((s: any) => s.kind === 'pet').map((s: any) => s.id),
          [pet.id],
        );
        assert(library.every((s: any) => !('gold_cp' in s) && !('user_id' in s)));
        for (const source of [
          { kind: 'character', source_id: b.id },
          { kind: 'pet', source_id: foreignPet.id },
        ])
          assert.equal(
            (await req(path + '/tokens', owner, 'POST', { ...source, position: { x: 25, y: 25 } }))
              .status,
            403,
          );
      },
    );
    await t.test(
      'importação repetida conserva um único token e imagem só é compartilhada enquanto colocado',
      async () => {
        const body = { kind: 'character', source_id: a.id, position: { x: 25, y: 25 } };
        const pair = await Promise.all([
          req(path + '/tokens', owner, 'POST', body),
          req(path + '/tokens', owner, 'POST', body),
        ]);
        assert.deepEqual(
          pair.map((r) => r.status),
          [201, 201],
        );
        assert.equal(pair[0].data.id, pair[1].data.id);
        actor = pair[0].data;
        animal = (
          await req(path + '/tokens', owner, 'POST', {
            kind: 'pet',
            source_id: pet.id,
            position: { x: 27, y: 25 },
          })
        ).data;
        neighbor = (
          await req(path + '/tokens', other, 'POST', {
            kind: 'character',
            source_id: b.id,
            position: { x: 29, y: 25 },
          })
        ).data;
        const visit = (await req(path + '/tokens', other)).data.tokens;
        assert.equal(visit.find((v: any) => v.id === actor.id).can_control, false);
        assert.equal(visit.find((v: any) => v.id === neighbor.id).can_control, true);
        assert.equal(visit.length, 3);
        assert.equal((await req(actor.image_url.replace('/api', ''), other)).status, 200);
        assert.equal((await req(animal.image_url.replace('/api', ''), other)).status, 200);
        assert.equal((await req(`/characters/${a.id}/token`, other)).status, 404);
        assert.equal((await req(actor.image_url.replace('/api', ''))).status, 401);
        assert.equal(
          (
            await req(
              `/house-v2/neighborhoods/${directory.neighborhoods[1].id}/tokens/${actor.id}/image`,
              other,
            )
          ).status,
          404,
        );
      },
    );
    const body = (actor: any, x: number, y = actor.y) => ({
      revision: actor.revision,
      x,
      y,
      rotation: actor.rotation,
      size: actor.size,
    });
    await t.test(
      'duas pessoas movem seus tokens simultaneamente; revisão antiga e controle alheio são rejeitados',
      async () => {
        const pair = await Promise.all([
          req(path + '/tokens/' + actor.id, owner, 'PATCH', body(actor, 26)),
          req(path + '/tokens/' + neighbor.id, other, 'PATCH', body(neighbor, 30)),
        ]);
        assert.deepEqual(
          pair.map((r) => r.status),
          [200, 200],
        );
        assert.equal(
          (await req(path + '/tokens/' + actor.id, owner, 'PATCH', body(actor, 28))).status,
          409,
        );
        actor = pair[0].data;
        neighbor = pair[1].data;
        for (const account of [other, admin]) {
          assert.equal(
            (await req(path + '/tokens/' + actor.id, account, 'PATCH', body(actor, 28))).status,
            403,
          );
          assert.equal(
            (
              await req(path + '/tokens/' + actor.id, account, 'DELETE', {
                revision: actor.revision,
              })
            ).status,
            403,
          );
        }
        const positions = (await req(path + '/tokens', owner)).data.tokens;
        assert.equal(positions.find((v: any) => v.id === actor.id).x, 26);
        assert.equal(positions.find((v: any) => v.id === neighbor.id).x, 30);
        assert.equal(
          (await req(path + '/tokens/' + actor.id, owner, 'PATCH', body(actor, 150))).status,
          400,
        );
      },
    );
    await t.test(
      'porta fecha o caminho; aberta permite entrar e impede fechar sobre um personagem',
      async () => {
        const bought = await req(`/house-v2/plots/${lot.id}/purchase`, owner, 'POST', {
          character_id: a.id,
          idempotency_key: randomUUID(),
        });
        assert.equal(bought.status, 200);
        assert.equal(
          (
            await req(`/house-v2/plots/${lot.id}/house`, owner, 'POST', {
              character_id: a.id,
              idempotency_key: randomUUID(),
              catalog_id: house2Houses[0].id,
            })
          ).status,
          200,
        );
        const house = (await req(path, owner)).data.plots.find((p: any) => p.id === lot.id),
          door = house2Doorway(house)!,
          floor = house2Floor(house)!;
        assert.equal(
          (await req(path + '/doors/' + lot.id, other, 'PATCH', { open: true })).status,
          403,
        );
        // Reimport at the doorstep, then move through the actual footprint doorway.
        assert.equal(
          (await req(path + '/tokens/' + actor.id, owner, 'DELETE', { revision: actor.revision }))
            .status,
          200,
        );
        actor = (
          await req(path + '/tokens', owner, 'POST', {
            kind: 'character',
            source_id: a.id,
            position: { x: door.x, y: door.y + 1 },
          })
        ).data;
        assert.equal(
          (await req(path + '/tokens/' + actor.id, owner, 'PATCH', body(actor, door.x, door.y - 1)))
            .status,
          400,
        );
        assert.equal(
          (await req(path + '/doors/' + lot.id, owner, 'PATCH', { open: true })).status,
          200,
        );
        let move = await req(
          path + '/tokens/' + actor.id,
          owner,
          'PATCH',
          body(actor, door.x, door.y),
        );
        assert.equal(move.status, 200);
        actor = move.data;
        assert.equal(
          (await req(path + '/doors/' + lot.id, owner, 'PATCH', { open: false })).status,
          409,
        );
        move = await req(
          path + '/tokens/' + actor.id,
          owner,
          'PATCH',
          body(actor, door.x, door.y - 1),
        );
        assert.equal(move.status, 200);
        actor = move.data;
        const across = house2HouseWorld(house, { x: floor.right + 1, y: 0 });
        assert.equal(
          (await req(path + '/tokens/' + actor.id, owner, 'PATCH', body(actor, across.x, across.y)))
            .status,
          400,
        );
        assert.equal(
          (await req(path + '/doors/' + lot.id, owner, 'PATCH', { open: false })).status,
          200,
        );
        assert.equal(
          (await req(path, owner)).data.plots.find((p: any) => p.id === lot.id).revision,
          house.revision,
        );
      },
    );
    await t.test(
      'retirar token preserva personagem, pet, compras e decoração; imagem deixa de ser pública',
      async () => {
        assert.equal(
          (await req(path + '/tokens/' + animal.id, owner, 'DELETE', { revision: animal.revision }))
            .status,
          200,
        );
        assert.equal((await req(animal.image_url.replace('/api', ''), other)).status, 404);
        assert.equal(
          (await pool.query('SELECT id FROM character_pets WHERE id=$1', [pet.id])).rowCount,
          1,
        );
        assert.deepEqual(
          (
            await pool.query(
              'SELECT id,gold_cp,level,portrait_revision FROM characters ORDER BY id',
            )
          ).rows,
          original,
        );
        assert.equal((await pool.query('SELECT count(*)::int n FROM house2_items')).rows[0].n, 0);
        assert.equal((await pool.query('SELECT count(*)::int n FROM house2_tokens')).rows[0].n, 2);
      },
    );
    await t.test(
      'montarias próprias usam pelagem e arte equipada, coexistem com personagens e respeitam controle',
      async () => {
        const mounts: Array<{ id: string; mount_id: string }> = [];
        for (const [species, coat] of [
          ['warhorse', 'alternate'],
          ['pony', 'original'],
          ['riding-horse', 'original'],
          ['mule', 'alternate'],
        ]) {
          mounts.push(
            (
              await pool.query(
                'INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,coat)VALUES($1,$2,$3,100,$4,$5)RETURNING *',
                [a.id, species, species, randomUUID(), coat],
              )
            ).rows[0],
          );
        }
        const foreign = (
          await pool.query(
            "INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key)VALUES($1,'warhorse','Alheio',100,$2)RETURNING id",
            [b.id, randomUUID()],
          )
        ).rows[0];
        const custom = await sharp({
          create: { width: 64, height: 64, channels: 4, background: '#c52d67' },
        })
          .png()
          .toBuffer();
        await pool.query(
          "INSERT INTO companion_wardrobes(id,character_id,kind,mount_id,image_revision)VALUES($1,$2,'mount',$1,7)",
          [mounts[1].id, a.id],
        );
        await pool.query(
          'INSERT INTO companion_artworks(wardrobe_id,equipment_revision,image,token_image)VALUES($1,0,$2,$2)',
          [mounts[1].id, custom],
        );
        const library = (await req('/house-v2/token-library', owner)).data.sources.filter(
          (s: any) => s.kind === 'mount',
        );
        assert.deepEqual(library.map((s: any) => s.id).sort(), mounts.map((m) => m.id).sort());
        assert.match(
          library.find((s: any) => s.id === mounts[0].id).image_url,
          /mount-warhorse-alternate-v1.webp$/,
        );
        assert.match(
          library.find((s: any) => s.id === mounts[1].id).image_url,
          /\/mount\/.*\/token\?v=7$/,
        );
        assert.equal(
          (
            await req(path + '/tokens', owner, 'POST', {
              kind: 'mount',
              source_id: foreign.id,
              position: { x: 25, y: 25 },
            })
          ).status,
          403,
        );
        const body = { kind: 'mount', source_id: mounts[0].id, position: { x: 25, y: 25 } };
        const pair = await Promise.all([
          req(path + '/tokens', owner, 'POST', body),
          req(path + '/tokens', owner, 'POST', body),
        ]);
        assert.deepEqual(
          pair.map((r) => r.status),
          [201, 201],
        );
        assert.equal(pair[0].data.id, pair[1].data.id);
        const horse = pair[0].data;
        assert.equal(horse.kind, 'mount');
        assert.equal(horse.size, 1.9);
        assert.equal(horse.source_id, mounts[0].id);
        assert.equal((await req(horse.image_url.replace('/api', ''), other)).status, 200);
        assert.equal((await req(horse.image_url.replace('/api', ''))).status, 401);
        for (const account of [other, admin]) {
          assert.equal(
            (
              await req(path + '/tokens/' + horse.id, account, 'PATCH', {
                revision: 0,
                x: 25,
                y: 24,
                size: horse.size,
                rotation: 90,
              })
            ).status,
            403,
          );
          assert.equal(
            (await req(path + '/tokens/' + horse.id, account, 'DELETE', { revision: 0 })).status,
            403,
          );
        }
        const moved = await req(path + '/tokens/' + horse.id, owner, 'PATCH', {
          revision: 0,
          x: 25,
          y: 24,
          size: horse.size,
          rotation: 127,
        });
        assert.equal(moved.status, 200);
        assert.equal(moved.data.rotation, 127);
        assert.equal(
          (
            await req(path + '/tokens/' + horse.id, owner, 'PATCH', {
              revision: 0,
              x: 25,
              y: 24,
              size: horse.size,
              rotation: 0,
            })
          ).status,
          409,
        );
        const current = (await req(path + '/tokens', other)).data.tokens;
        assert(current.some((s: any) => s.id === actor.id));
        assert.equal(current.find((s: any) => s.id === horse.id).rotation, 127);
        for (const mount of mounts.slice(1)) {
          const placed = await req(path + '/tokens', owner, 'POST', {
            kind: 'mount',
            source_id: mount.id,
            position: { x: 26, y: 24 },
          });
          assert.equal(placed.status, 201);
          assert.equal(placed.data.size, mount.mount_id === 'riding-horse' ? 1.9 : 1.35);
          const art = await req(placed.data.image_url.replace('/api', ''), other);
          assert.equal(art.status, 200);
          if (mount.id === mounts[1].id)
            assert((await sharp(art.data).stats()).channels[0].mean > 190);
          await req(path + '/tokens/' + placed.data.id, owner, 'DELETE', { revision: 0 });
        }
        assert.equal(
          (
            await req(path + '/tokens/' + horse.id, owner, 'DELETE', {
              revision: moved.data.revision,
            })
          ).status,
          200,
        );
        assert.equal((await req(horse.image_url.replace('/api', ''), other)).status, 404);
        assert.deepEqual(
          (
            await pool.query('SELECT * FROM character_mounts WHERE character_id=$1 ORDER BY id', [
              a.id,
            ])
          ).rows,
          [...mounts].sort((a, b) => a.id.localeCompare(b.id)),
        );
        assert.deepEqual(
          (
            await pool.query(
              'SELECT id,gold_cp,level,portrait_revision FROM characters ORDER BY id',
            )
          ).rows,
          original,
        );
      },
    );
    await t.test(
      '25 opções em cada revestimento: compra idempotente, categoria, aplicação e restauração',
      async () => {
        assert.equal(house2FinishesCatalog.filter((f) => f.kind === 'roof').length, 25);
        assert.equal(house2FinishesCatalog.filter((f) => f.kind === 'floor').length, 25);
        assert.equal(house2FinishesCatalog.filter((f) => f.kind === 'walls').length, 25);
        const before = (await req('/house-v2', owner)).data.balance;
        for (const id of ['roof-style-025', 'floor-dwarven-inlay', 'walls-oak']) {
          const spec = house2FinishesCatalog.find((f) => f.id === id)!;
          const body = { character_id: a.id, catalog_id: id, idempotency_key: randomUUID() };
          const pair = await Promise.all([
            req('/house-v2/finishes', owner, 'POST', body),
            req('/house-v2/finishes', owner, 'POST', body),
          ]);
          assert.deepEqual(
            pair.map((r) => r.status),
            [200, 200],
          );
          let lotState = (await req(path, owner)).data.plots.find((p: any) => p.id === lot.id);
          const action = { kind: spec.kind, catalog_id: id, revision: lotState.revision };
          assert.equal(
            (await req(`/house-v2/plots/${lot.id}/finish`, other, 'POST', action)).status,
            403,
          );
          assert.equal(
            (
              await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', {
                ...action,
                kind: spec.kind === 'walls' ? 'roof' : 'walls',
              })
            ).status,
            403,
          );
          assert.equal(
            (await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', action)).status,
            200,
          );
          assert.equal(
            (await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', action)).status,
            409,
          );
          lotState = (await req(path, owner)).data.plots.find((p: any) => p.id === lot.id);
          assert.equal(lotState.finishes[spec.kind], id);
          assert.equal(
            (
              await req(`/house-v2/plots/${lot.id}/finish`, owner, 'POST', {
                kind: spec.kind,
                catalog_id: null,
                revision: lotState.revision,
              })
            ).status,
            200,
          );
        }
        const directory = (await req('/house-v2', owner)).data;
        assert.equal(
          directory.balance,
          before - house2FinishesCatalog.find((f) => f.id === 'roof-style-025')!.price - 250 - 220,
        );
        assert(
          directory.finishes.includes('roof-style-025') &&
            directory.finishes.includes('floor-dwarven-inlay') &&
            directory.finishes.includes('walls-oak'),
        );
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

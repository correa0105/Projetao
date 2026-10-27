import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { administrationFor, isAdministrator } from '../server/administrators';
import { adminScopes } from '../shared/admin-scopes';
import { blankEvent } from '../shared/events';
import { newToken } from '../shared/vtt';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { createLegacyTestCharacter } from './character-fixtures';
import { canManageVtt } from '../server/vtt-permissions';

test('Mural/Eventos/Torre/VTT: escopos isolados, administração de mesas alheias e revogação sem transferir dono', async () => {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  assert.match(dbUrl.pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  assert.notEqual(dbUrl.port, '5437');
  await migrate();
  await seed();
  const previousMaintenance = process.env.MAINTENANCE_AREAS;
  process.env.MAINTENANCE_AREAS = 'events,tower';
  const { createApp } = await import('../server/app'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`,
    trustedOrigin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(
    path: string,
    cookie: string,
    method = 'GET',
    body?: unknown,
    preview = false,
  ) {
    const r = await fetch(origin + '/api' + path, {
      method,
      headers: {
        Origin: trustedOrigin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
        ...(preview ? { 'X-Account-Preview': 'basic' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await req('/auth/sign-up/email', '', 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id as string,
      cookie: r.headers
        .getSetCookie()
        .map((p) => p.split(';')[0])
        .join('; '),
    };
  }
  try {
    assert.equal(
      canManageVtt(
        { owner_id: 'owner', administrator: true, administrator_user_id: 'admin' },
        'visitor',
      ),
      false,
    );
    assert.equal(
      canManageVtt(
        { owner_id: 'owner', administrator: true, administrator_user_id: 'admin' },
        'admin',
      ),
      true,
    );
    const limited = await signup('Segunda administração'),
      owner = await signup('Mestre original'),
      outsider = await signup('Outra conta'),
      root = owner;
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [root.id]);
    const made = await req('/vtt', owner.cookie, 'POST', { name: 'Mesa privada original' });
    assert.equal(made.status, 201);
    let room = made.data;
    const path = '/vtt/rooms/' + room.id,
      s = room.document.scenes[0],
      hidden = newToken(randomUUID(), s);
    Object.assign(hidden, {
      layer: 'gm',
      hidden: true,
      name: 'Segredo do mestre',
      notes: 'Anotações privadas',
    });
    s.tokens.push(hidden);
    room = (
      await req(path, owner.cookie, 'PUT', { revision: room.revision, document: room.document })
    ).data;
    assert.equal((await req(path, limited.cookie)).status, 404);
    const mission = (
      await pool.query(
        "INSERT INTO board_posts(author_id,kind,title,description,location,difficulty) VALUES($1,'mission','Missão de outro mestre','Descrição da missão.','','Tranquila') RETURNING *",
        [owner.id],
      )
    ).rows[0];
    const event = await req('/events', root.cookie, 'POST', {
      ...blankEvent,
      title: 'Evento de outro administrador',
      description: 'Encontro',
    });
    assert.equal(event.status, 201);
    for (const scope of ['board', 'events', 'tower', 'vtt'] as const) {
      await pool.query('DELETE FROM administrator_scopes WHERE user_id=$1', [limited.id]);
      await pool.query('INSERT INTO administrator_scopes(user_id,scope) VALUES($1,$2)', [
        limited.id,
        scope,
      ]);
      for (const area of adminScopes)
        assert.equal(
          await administrationFor(area).has(limited.id),
          area === scope,
          scope + ' -> ' + area,
        );
      assert.equal(await isAdministrator(limited.id), false);
      assert.equal(
        (await req('/mission-tags/catalog', limited.cookie)).data.can_edit,
        scope === 'board',
      );
      assert.equal((await req('/events', limited.cookie)).status, scope === 'events' ? 200 : 503);
      assert.equal((await req('/tower', limited.cookie)).status, scope === 'tower' ? 200 : 503);
      assert.equal((await req(path, limited.cookie)).status, scope === 'vtt' ? 200 : 404);
      const listing = (await req('/vtt', limited.cookie)).data;
      assert.equal(
        listing.rooms.some((r: { id: string }) => r.id === room.id),
        scope === 'vtt',
      );
    }
    // A VTT administrator receives the real GM tools, while the room keeps its owner.
    const adminRoom = await req(path, limited.cookie);
    assert.equal(adminRoom.data.is_gm, true);
    assert.equal(adminRoom.data.administrativeAccess, true);
    assert.equal((await req(path + '/activate', limited.cookie, 'POST', {})).status, 403);
    const ownersCharacter = await createLegacyTestCharacter(
      owner.id,
      'Personagem do dono original',
    );
    const roster = (await req(path + '/characters', limited.cookie)).data;
    assert(roster.characters.some((c: { id: string }) => c.id === ownersCharacter.id));
    assert(
      adminRoom.data.document.scenes[0].tokens.some((t: { id: string }) => t.id === hidden.id),
    );
    adminRoom.data.document.name = 'Mesa administrada sem troca de dono';
    const saved = await req(path, limited.cookie, 'PUT', {
      revision: adminRoom.data.revision,
      document: adminRoom.data.document,
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const imported = await req(
      path + '/characters/' + ownersCharacter.id,
      limited.cookie,
      'POST',
      {},
    );
    assert.equal(imported.status, 201, JSON.stringify(imported.data));
    assert.equal(
      imported.data.document.scenes[0].tokens.find(
        (t: { characterId: string }) => t.characterId === ownersCharacter.id,
      ).controller,
      owner.id,
    );
    for (const suffix of ['/characters', '/vehicles', '/companions', '/capture-permission'])
      assert.equal((await req(path + suffix, limited.cookie)).status, 200, suffix);
    assert.equal(
      (await req(path + '/combat', limited.cookie, 'POST', { kind: 'end' })).status,
      200,
    );
    assert.equal(
      (
        await req(path + '/sounds', limited.cookie, 'POST', {
          kind: 'screenPlay',
          settings: {
            preset: 'cave-in',
            sceneId: s.id,
            duration: 5,
            intensity: 0.5,
            volume: 0,
            muted: true,
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await req(path + '/sounds', limited.cookie, 'POST', { kind: 'screenStop' })).status,
      200,
    );
    const {
      rows: [ownership],
    } = await pool.query('SELECT owner_id FROM vtt_rooms WHERE id=$1', [room.id]);
    assert.equal(ownership.owner_id, owner.id);
    assert.equal(
      (
        await pool.query('SELECT 1 FROM vtt_members WHERE room_id=$1 AND user_id=$2', [
          room.id,
          limited.id,
        ])
      ).rowCount,
      0,
    );
    assert.equal((await req(path, outsider.cookie)).status, 404);
    assert.equal(
      (await req('/vtt/join', outsider.cookie, 'POST', { invite: room.invite, role: 'spectator' }))
        .status,
      200,
    );
    const spectator = (await req(path, outsider.cookie)).data;
    assert.equal(spectator.is_gm, false);
    assert(!spectator.document.scenes[0].tokens.some((t: { id: string }) => t.id === hidden.id));
    assert.equal(
      (await req(path + '/combat', outsider.cookie, 'POST', { kind: 'end' })).status,
      403,
    );
    await pool.query(
      'INSERT INTO administrator_scopes(user_id,scope) SELECT $1,unnest($2::text[]) ON CONFLICT DO NOTHING',
      [limited.id, adminScopes],
    );
    const me = (await req('/me', limited.cookie)).data;
    assert.equal(me.administrador, 0);
    assert.equal(me.gold_unlimited, false);
    assert.deepEqual(me.maintenance_areas, []);
    assert.deepEqual([...me.admin_scopes].sort(), [...adminScopes].sort());
    const publication = await req('/events/' + event.data.id, limited.cookie, 'PUT', {
      ...blankEvent,
      title: 'Evento revisado',
      description: 'Conteúdo revisado',
      revision: 1,
    });
    assert.equal(publication.status, 200, JSON.stringify(publication.data));
    assert.equal(
      (
        await req('/board/' + mission.id + '/paper', limited.cookie, 'PATCH', {
          paper_x: 0.3,
          paper_y: 0.4,
          paper_style: mission.paper_style,
        })
      ).status,
      200,
    );
    assert.equal(
      (await req('/board/' + mission.id, limited.cookie, 'PATCH', { status: 'active' })).status,
      200,
    );
    assert.equal(
      (
        await req('/board/' + mission.id + '/complete', limited.cookie, 'POST', {
          summary: 'Missão concluída pela administração.',
          rewards: [],
        })
      ).status,
      200,
    );
    assert.equal((await req('/board/' + mission.id, limited.cookie, 'DELETE')).status, 200);
    const tower = (await req('/tower', limited.cookie)).data;
    assert.equal(tower.can_create, true);
    const f = tower.floors[0],
      floor = {
        revision: f.revision,
        name: f.name,
        description: f.description,
        challenge: f.challenge,
        hazard: f.hazard,
        traps: f.traps,
        creatures: f.creatures,
        boss: f.boss,
        boss_name: f.boss_name,
        base_gold_cp: f.base_gold_cp,
        base_crystals: f.base_crystals,
      };
    assert.equal(
      (await req('/tower/floors/' + f.number, limited.cookie, 'POST', floor)).status,
      200,
    );
    // Neither the eight-area role nor forged fields grants unrelated privileges.
    await req('/auth/update-user', limited.cookie, 'POST', { administrador: 1, role: 'admin' });
    assert.equal(await isAdministrator(limited.id), false);
    assert.equal(
      (await pool.query('SELECT 1 FROM guild_staff WHERE user_id=$1', [limited.id])).rowCount,
      0,
    );
    const preview = (await req('/me', root.cookie, 'GET', undefined, true)).data;
    assert.deepEqual(preview.admin_scopes, []);
    const foreignRoom = await req('/vtt', outsider.cookie, 'POST', { name: 'Outra mesa privada' });
    assert.equal(
      (await req('/vtt/rooms/' + foreignRoom.data.id, root.cookie, 'GET', undefined, true)).status,
      404,
    );
    await pool.query(
      "DELETE FROM administrator_scopes WHERE user_id=$1 AND scope IN ('board','events','tower','vtt')",
      [limited.id],
    );
    assert.equal((await req(path, limited.cookie)).status, 404);
    assert.equal(
      (await req(path + '/combat', limited.cookie, 'POST', { kind: 'end' })).status,
      404,
    );
    assert.equal((await req('/events', limited.cookie)).status, 503);
    assert.equal((await req('/tower', limited.cookie)).status, 503);
    assert.equal((await req('/mission-tags/catalog', limited.cookie)).data.can_edit, false);
    assert.equal((await req('/lore', limited.cookie)).data.can_manage_folders, true);
    assert.equal((await req(path, owner.cookie)).data.is_gm, true);
    assert.equal(
      (await pool.query('SELECT owner_id FROM vtt_rooms WHERE id=$1', [room.id])).rows[0].owner_id,
      owner.id,
    );
  } finally {
    if (previousMaintenance === undefined) delete process.env.MAINTENANCE_AREAS;
    else process.env.MAINTENANCE_AREAS = previousMaintenance;
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

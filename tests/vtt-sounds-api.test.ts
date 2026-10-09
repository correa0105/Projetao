import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { soundCatalog } from '../shared/vtt-sounds';
test('mixer e atalhos em PostgreSQL descartável: autorização, persistência e concorrência', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Who = { id: string; cookie: string };
  async function req(path: string, who?: Who, method = 'GET', body?: unknown) {
    const response = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: who?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': '4',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  async function signup(name: string) {
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
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const gm = await signup('Mestre'),
      player = await signup('Jogador'),
      spectator = await signup('Espectador');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [gm.id]);
    const room = (await req('/vtt', gm, 'POST', { name: 'Sons' })).data;
    const path = '/vtt/rooms/' + room.id,
      sounds = path + '/sounds';
    assert.equal((await req(sounds, spectator)).status, 404);
    for (const [who, role] of [
      [player, 'player'],
      [spectator, 'spectator'],
    ] as const)
      assert.equal(
        (await req('/vtt/join', who, 'POST', { invite: room.invite, role })).status,
        200,
      );
    await t.test('somente o mestre com administrador vigente edita; membros ouvem', async () => {
      assert.equal((await req(sounds)).status, 401);
      assert.equal((await req(sounds, player)).status, 200);
      assert.equal((await req(sounds, spectator)).status, 200);
      for (const who of [player, spectator])
        assert.equal(
          (await req(sounds, who, 'POST', { kind: 'play', sourceId: 'music-old-inn' })).status,
          403,
        );
    });
    await t.test('música exclusiva, ambientes sobrepostos e efeitos redisparados', async () => {
      for (const sourceId of ['music-old-inn', 'amb-hearth', 'amb-forest', 'sfx-dooropen-1'])
        assert.equal((await req(sounds, gm, 'POST', { kind: 'play', sourceId })).status, 200);
      const before = (await req(sounds, player)).data.soundboard;
      assert.equal(before.voices.length, 4);
      const old = before.voices.find((v: any) => v.sourceId === 'sfx-dooropen-1');
      await req(sounds, gm, 'POST', { kind: 'play', sourceId: old.sourceId });
      const current = (await req(sounds, player)).data.soundboard;
      assert.notEqual(
        current.voices.filter((v: any) => v.sourceId === old.sourceId).at(-1).id,
        old.id,
      );
      assert.equal(current.voices.filter((v: any) => v.sourceId === old.sourceId).length, 2);
      await req(sounds, gm, 'POST', { kind: 'play', sourceId: 'music-bards-tale' });
      const after = (await req(sounds, player)).data.soundboard;
      assert.equal(after.voices.filter((v: any) => v.channel === 'music').length, 1);
      assert.ok(after.voices.some((v: any) => v.sourceId === 'amb-hearth'));
    });
    await t.test(
      'ajustes e atalhos preservam volumes e loop; tranca e revisão funcionam',
      async () => {
        const settings = { sourceId: 'amb-hearth', channel: 'ambience', volume: 0.27, loop: true };
        await req(sounds, gm, 'POST', { kind: 'settings', settings });
        assert.deepEqual(
          (await req(sounds, gm)).data.soundboard.settings.find(
            (s: any) => s.sourceId === settings.sourceId,
          ),
          settings,
        );
        const hot = (await req(path + '/hotbar', gm)).data;
        hot.document.pages[0].slots[0] = {
          kind: 'sound',
          sourceId: settings.sourceId,
          label: 'Lareira',
        };
        const saved = await req(path + '/hotbar', gm, 'PUT', hot);
        assert.equal(saved.status, 200, JSON.stringify(saved.data));
        assert.equal((await req(path + '/hotbar', gm, 'PUT', hot)).status, 409);
        const locked = structuredClone(saved.data);
        locked.document.pages[0].locked = true;
        const lock = await req(path + '/hotbar', gm, 'PUT', locked);
        assert.equal(lock.status, 200);
        const overwrite = structuredClone(lock.data);
        overwrite.document.pages[0].slots[0] = null;
        assert.equal((await req(path + '/hotbar', gm, 'PUT', overwrite)).status, 403);
        const p = (await req(path + '/hotbar', player)).data;
        p.document.pages[0].slots[0] = hot.document.pages[0].slots[0];
        assert.equal((await req(path + '/hotbar', player, 'PUT', p)).status, 403);
      },
    );
    await t.test(
      'arquivos da mesa são validados por ownership e tipo, inclusive pelo PUT geral',
      async () => {
        const audio = randomUUID(),
          image = randomUUID(),
          foreign = randomUUID();
        const otherRoom = (await req('/vtt', gm, 'POST', { name: 'Outra sala' })).data;
        for (const [id, kind, rid] of [
          [audio, 'audio', room.id],
          [image, 'image', room.id],
          [foreign, 'audio', otherRoom.id],
        ])
          await pool.query(
            'INSERT INTO vtt_assets(id,room_id,kind,name,mime,bytes)VALUES($1,$2,$3,$4,$5,$6)',
            [
              id,
              rid,
              kind,
              'Teste',
              kind === 'audio' ? 'audio/ogg' : 'image/png',
              Buffer.from([1, 2, 3]),
            ],
          );
        assert.equal(
          (await req(sounds, gm, 'POST', { kind: 'play', sourceId: 'asset:' + audio })).status,
          200,
        );
        const legacy = (await req(path, gm)).data;
        legacy.document.music = { assetId: audio, playing: true, loop: true, volume: 0.44 };
        legacy.document.soundboard.voices = [];
        assert.equal(
          (await req(path, gm, 'PUT', { revision: legacy.revision, document: legacy.document }))
            .status,
          200,
        );
        await req(sounds, gm, 'POST', {
          kind: 'settings',
          settings: { sourceId: 'asset:' + audio, channel: 'music', volume: 0.22, loop: false },
        });
        assert.deepEqual((await req(sounds, gm)).data.music, {
          assetId: audio,
          playing: true,
          loop: false,
          volume: 0.22,
        });
        for (const id of [image, foreign, randomUUID()])
          assert.equal(
            (await req(sounds, gm, 'POST', { kind: 'play', sourceId: 'asset:' + id })).status,
            400,
          );
        const state = (await req(path, gm)).data;
        state.document.soundboard.settings.push({
          sourceId: 'asset:' + foreign,
          channel: 'effect',
          volume: 0.5,
          loop: false,
        });
        assert.equal(
          (await req(path, gm, 'PUT', { revision: state.revision, document: state.document }))
            .status,
          400,
        );
      },
    );
    await t.test(
      'favoritos e remoção persistem na mesa; restaurar conserva ajustes e atalhos',
      async () => {
        const sourceId = 'amb-hearth';
        for (const who of [player, spectator])
          for (const command of [
            { kind: 'favorite', sourceId, favorite: true },
            { kind: 'hide', sourceId, hidden: true },
          ])
            assert.equal((await req(sounds, who, 'POST', command)).status, 403);
        await Promise.all(
          ['amb-hearth', 'music-old-inn'].map((sourceId) =>
            req(sounds, gm, 'POST', { kind: 'favorite', sourceId, favorite: true }),
          ),
        );
        assert.deepEqual(
          new Set((await req(sounds, gm)).data.soundboard.favorites),
          new Set(['amb-hearth', 'music-old-inn']),
        );
        const settings = {
          sourceId,
          channel: 'ambience',
          volume: 0.29,
          loop: true,
          repeatEvery: 12,
        };
        assert.equal((await req(sounds, gm, 'POST', { kind: 'settings', settings })).status, 200);
        assert.equal((await req(sounds, gm, 'POST', { kind: 'play', sourceId })).status, 200);
        assert.equal(
          (await req(sounds, gm, 'POST', { kind: 'hide', sourceId, hidden: true })).status,
          200,
        );
        let board = (await req(sounds, player)).data.soundboard;
        assert.ok(board.hiddenSources.includes(sourceId));
        assert.ok(!board.voices.some((v: any) => v.sourceId === sourceId));
        assert.equal((await req(sounds, gm, 'POST', { kind: 'play', sourceId })).status, 400);
        assert.deepEqual(
          board.settings.find((s: any) => s.sourceId === sourceId),
          settings,
        );
        assert.equal(
          (await req(sounds, gm, 'POST', { kind: 'hide', sourceId, hidden: false })).status,
          200,
        );
        assert.equal((await req(sounds, gm, 'POST', { kind: 'play', sourceId })).status, 200);
        board = (await req(sounds, gm)).data.soundboard;
        assert.equal(board.voices.find((v: any) => v.sourceId === sourceId).repeatEvery, 12);
        assert.ok((await req(path + '/hotbar', gm)).data.document.pages[0].slots[0]);
        await req(sounds, gm, 'POST', { kind: 'favorite', sourceId, favorite: false });
        assert.ok(!(await req(sounds, gm)).data.soundboard.favorites.includes(sourceId));
        const other = (await req('/vtt', gm, 'POST', { name: 'Outra biblioteca' })).data;
        assert.deepEqual(
          (await req('/vtt/rooms/' + other.id + '/sounds', gm)).data.soundboard.hiddenSources,
          [],
        );
        for (const repeatEvery of [0, 3601])
          assert.equal(
            (
              await req(sounds, gm, 'POST', {
                kind: 'settings',
                settings: { ...settings, repeatEvery },
              })
            ).status,
            400,
          );
      },
    );
    await t.test('limites, fontes e parâmetros maliciosos são recusados', async () => {
      for (const sourceId of ['https://attacker.test/file.ogg', 'asset:../../secret', 'not-found'])
        assert.equal((await req(sounds, gm, 'POST', { kind: 'play', sourceId })).status, 400);
      for (const volume of [-1, 1.01])
        assert.equal((await req(sounds, gm, 'POST', { kind: 'volume', volume })).status, 400);
      assert.equal(
        (
          await req(sounds, gm, 'POST', {
            kind: 'play',
            sourceId: 'amb-hearth',
            settings: { sourceId: 'amb-forest', channel: 'ambience', volume: 0.5, loop: true },
          })
        ).status,
        400,
      );
      await req(sounds, gm, 'POST', { kind: 'stopAll' });
      const entries = soundCatalog.filter((s) => s.kind === 'effect').slice(0, 17);
      for (const [i, e] of entries.entries()) {
        const r = await req(sounds, gm, 'POST', {
          kind: 'play',
          sourceId: e.id,
          settings: { sourceId: e.id, channel: 'effect', volume: 0.5, loop: true },
        });
        assert.equal(r.status, i < 16 ? 200 : 400);
      }
    });
    await t.test(
      'comandos concorrentes são atômicos e parar tudo não apaga ajustes nem atalhos',
      async () => {
        await req(sounds, gm, 'POST', { kind: 'stopAll' });
        const out = await Promise.all(
          ['amb-hearth', 'amb-forest', 'music-battle'].map((sourceId) =>
            req(sounds, gm, 'POST', { kind: 'play', sourceId }),
          ),
        );
        assert.ok(out.every((r) => r.status === 200));
        assert.equal((await req(sounds, gm)).data.soundboard.voices.length, 3);
        await req(sounds, gm, 'POST', { kind: 'stopAll' });
        const after = (await req(sounds, gm)).data;
        assert.equal(after.soundboard.voices.length, 0);
        assert.equal(after.music.playing, false);
        assert.ok(after.soundboard.settings.length);
        assert.ok((await req(path + '/hotbar', gm)).data.document.pages[0].slots[0]);
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [gm.id]);
        assert.equal(
          (await req(sounds, gm, 'POST', { kind: 'play', sourceId: 'music-old-inn' })).status,
          403,
        );
        assert.equal((await req(sounds, gm)).status, 200);
        for (const command of [
          { kind: 'favorite', sourceId: 'amb-hearth', favorite: true },
          { kind: 'hide', sourceId: 'amb-hearth', hidden: true },
        ])
          assert.equal((await req(sounds, gm, 'POST', command)).status, 403);
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

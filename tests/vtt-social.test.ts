import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';
import {
  newToken,
  newScene,
  snapPoint,
  distance,
  visiblePoint,
  documentSchema,
  sightPolygon,
} from '../shared/vtt.js';
import { defaultHallSettings, profileSettingsSchema, fameScore } from '../shared/social.js';

test('VTT, perfis e comunidade: persistência e permissões em PostgreSQL descartável', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  try {
    await migrate();
    await seed();
  } catch (error) {
    await pool.end();
    throw error;
  }
  const { createApp } = await import('../server/app.js'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  const base = `http://127.0.0.1:${addr.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Account = { id: string; cookie: string };
  async function request(path: string, who?: Account, method = 'GET', body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { Origin: origin, Cookie: who?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: `vtt-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; '),
    };
  }
  try {
    const adm = await signup('Administrador'),
      player = await signup('Viajante'),
      other = await signup('Visitante');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adm.id]);
    const a = await createLegacyTestCharacter(adm.id, 'Arden'),
      p = await createLegacyTestCharacter(player.id, 'Mira'),
      o = await createLegacyTestCharacter(other.id, 'Outro');
    await pool.query('UPDATE characters SET gold_cp=100000,biography=$2 WHERE id=$1', [
      p.id,
      'Uma viajante do Norte.',
    ]);
    let room: any, privateAsset: string;
    await t.test(
      'mesa: somente dono administrador edita, convite, conflito de revisão e revogação',
      async () => {
        assert.equal((await request('/vtt')).status, 401);
        assert.equal((await request('/vtt', player, 'POST', { name: 'Teste' })).status, 403);
        const r = await request('/vtt', adm, 'POST', { name: 'A cripta' });
        assert.equal(r.status, 201, JSON.stringify(r.data));
        room = r.data;
        assert.equal((await request(`/vtt/rooms/${room.id}`, other)).status, 404);
        assert.equal(
          (await request('/vtt/join', player, 'POST', { invite: room.invite })).status,
          200,
        );
        assert.equal((await request(`/vtt/rooms/${room.id}`, player)).data.invite, undefined);
        const path = `/vtt/rooms/${room.id}`;
        assert.equal(
          (await request(path, player, 'PUT', { revision: room.revision, document: room.document }))
            .status,
          403,
        );
        const versions = await Promise.all(
          [1, 2].map((i) =>
            request(path, adm, 'PUT', {
              revision: room.revision,
              document: { ...room.document, name: 'Versão ' + i },
            }),
          ),
        );
        assert.deepEqual(versions.map((r) => r.status).sort(), [200, 409]);
        room = versions.find((r) => r.status === 200)!.data;
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [adm.id]);
        assert.equal((await request(path, adm)).data.is_gm, false);
        assert.equal(
          (await request(path, adm, 'PUT', { revision: room.revision, document: room.document }))
            .status,
          403,
        );
        await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adm.id]);
      },
    );
    await t.test(
      'imagem privada, fonte de outra mesa, tokens ocultos, fichas e notas do mestre',
      async () => {
        const png = await sharp({
          create: { width: 16, height: 20, channels: 4, background: '#88aaaa' },
        })
          .png()
          .toBuffer();
        const upload = await fetch(base + `/vtt/rooms/${room.id}/assets?name=Segredo`, {
          method: 'POST',
          headers: { Origin: origin, Cookie: adm.cookie, 'Content-Type': 'image/png' },
          body: png,
        });
        assert.equal(upload.status, 201);
        privateAsset = (await upload.json()).path;
        const denied = await fetch(base + privateAsset.replace('/api', ''), {
          headers: { Cookie: player.cookie },
        });
        assert.equal(denied.status, 404);
        const scene = room.document.scenes[0],
          token = newToken(randomUUID(), scene);
        token.name = 'Oculto';
        token.hidden = true;
        token.image = privateAsset;
        token.notes = 'segredo';
        scene.tokens.push(token);
        const publicToken = {
          ...newToken(randomUUID(), scene),
          name: 'Visível',
          notes: 'nota privada',
          sheet: {
            source: 'Teste',
            race: 'Humano',
            class: 'Guerreiro',
            level: 1,
            stats: [10, 10, 10, 10, 10, 10],
            speed: 30,
            biography: '',
            details: 'secreto',
          },
        };
        scene.tokens.push(publicToken);
        room = (
          await request(`/vtt/rooms/${room.id}`, adm, 'PUT', {
            revision: room.revision,
            document: room.document,
          })
        ).data;
        const snapshot = (await request(`/vtt/rooms/${room.id}`, player)).data;
        assert.equal(
          snapshot.document.scenes[0].tokens.some((t: any) => t.name === 'Oculto'),
          false,
        );
        assert.equal(
          snapshot.assets.some((a: any) => a.path === privateAsset),
          false,
        );
        const visible = snapshot.document.scenes[0].tokens.find((t: any) => t.name === 'Visível');
        assert.equal(visible.notes, '');
        assert.equal(visible.sheet, null);
        const another = (await request('/vtt', adm, 'POST', { name: 'Segunda mesa' })).data;
        another.document.scenes[0].background = privateAsset;
        assert.equal(
          (
            await request(`/vtt/rooms/${another.id}`, adm, 'PUT', {
              revision: another.revision,
              document: another.document,
            })
          ).status,
          400,
        );
        const traversal = structuredClone(room.document);
        traversal.scenes[0].background = '/vtt/../../.env';
        assert.equal(documentSchema.safeParse(traversal).success, false);
      },
    );
    await t.test(
      'importação de ficha respeita ownership e preserva personagem; barreiras bloqueiam movimento',
      async () => {
        const path = `/vtt/rooms/${room.id}`;
        assert.equal((await request(path + '/characters/' + a.id, player, 'POST', {})).status, 404);
        const before = (await pool.query('SELECT * FROM characters WHERE id=$1', [p.id])).rows[0];
        const r = await request(path + '/characters/' + p.id, player, 'POST', {});
        assert.equal(r.status, 201, JSON.stringify(r.data));
        room = (await request(path, adm)).data;
        const token = room.document.scenes[0].tokens.find((t: any) => t.characterId === p.id);
        assert.equal(token.controller, player.id);
        assert.equal(token.sheet.biography, before.biography);
        token.x = 100;
        token.y = 100;
        room.document.scenes[0].restrictMovement = true;
        room.document.scenes[0].walls = [
          {
            id: randomUUID(),
            a: { x: 150, y: 0 },
            b: { x: 150, y: 500 },
            kind: 'wall',
            open: false,
          },
        ];
        room = (
          await request(path, adm, 'PUT', { revision: room.revision, document: room.document })
        ).data;
        assert.equal(
          (await request(path + '/tokens/' + token.id, player, 'PATCH', { x: 200, y: 100 })).status,
          400,
        );
        assert.equal(
          (await request(path + '/tokens/' + token.id, player, 'PATCH', { x: 150, y: 100 })).status,
          400,
        );
        assert.equal(
          (await request(path + '/tokens/' + token.id, other, 'PATCH', { x: 110 })).status,
          404,
        );
        assert.equal(
          (await request(path + '/tokens/' + token.id, player, 'PATCH', { image: privateAsset }))
            .status,
          400,
        );
        assert.equal(
          (
            await request(path + '/tokens/' + token.id, player, 'PATCH', {
              x: 120,
              hp: 3,
              conditions: ['Caído'],
            })
          ).status,
          200,
        );
        assert.deepEqual(
          (await pool.query('SELECT * FROM characters WHERE id=$1', [p.id])).rows[0],
          before,
        );
      },
    );
    await t.test(
      'rolagens validadas pelo servidor e chat privado da mesa só autor/mestre',
      async () => {
        const path = `/vtt/rooms/${room.id}/messages`;
        assert.equal(
          (
            await request(path, player, 'POST', {
              formula: '2d20kh1+3',
              text: 'Ataque',
              private: true,
            })
          ).status,
          201,
        );
        assert.equal((await request(path, player, 'POST', { formula: '1000d20' })).status, 400);
        assert.equal((await request(path, player, 'POST', { formula: 'alert(1)' })).status, 400);
        await request('/vtt/join', other, 'POST', { invite: room.invite });
        const forOther = (await request(`/vtt/rooms/${room.id}`, other)).data;
        assert.equal(
          forOther.messages.some((m: any) => m.text === 'Ataque'),
          false,
        );
        const msg = (await request(`/vtt/rooms/${room.id}`, adm)).data.messages.find(
          (m: any) => m.text === 'Ataque',
        );
        assert.equal(msg.roll.dice.length, 2);
        assert.equal(msg.roll.total, Math.max(...msg.roll.dice) + 3);
        const invite = (await request(`/vtt/rooms/${room.id}/invite`, adm, 'POST', {})).data.invite;
        assert.notEqual(invite, room.invite);
        assert.equal(
          (await request('/vtt/join', other, 'POST', { invite: room.invite })).status,
          404,
        );
        assert.equal(
          (await request(`/vtt/rooms/${room.id}/members/${other.id}`, adm, 'DELETE')).status,
          200,
        );
        assert.equal((await request(`/vtt/rooms/${room.id}`, other)).status, 404);
      },
    );
    await t.test('biblioteca aberta SRD 2024 tem monstros e magias normalizados', async () => {
      const library = (await request('/vtt/compendium', player)).data;
      assert.equal(library.monsters.length, 330);
      assert.equal(library.spells.length, 339);
      assert.ok(library.monsters.every((m: any) => m.name && m.stats.length === 6));
      assert.ok(library.spells.every((m: any) => m.name && typeof m.details === 'string'));
    });
    await t.test(
      'música e imagem: tipo correto, upload do mestre, referências e leitura parcial',
      async () => {
        const path = `/vtt/rooms/${room.id}`,
          wav = Buffer.alloc(44 + 1600);
        wav.write('RIFF', 0);
        wav.writeUInt32LE(wav.length - 8, 4);
        wav.write('WAVEfmt ', 8);
        wav.writeUInt32LE(16, 16);
        wav.writeUInt16LE(1, 20);
        wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(8000, 24);
        wav.writeUInt32LE(16000, 28);
        wav.writeUInt16LE(2, 32);
        wav.writeUInt16LE(16, 34);
        wav.write('data', 36);
        wav.writeUInt32LE(1600, 40);
        async function audio(who: Account, bytes: Buffer) {
          const r = await fetch(base + path + '/assets?name=Trilha', {
            method: 'POST',
            headers: { Origin: origin, Cookie: who.cookie, 'Content-Type': 'audio/wav' },
            body: new Uint8Array(bytes),
          });
          return { status: r.status, data: await r.json() };
        }
        assert.equal((await audio(player, wav)).status, 403);
        assert.equal((await audio(adm, Buffer.from('não é áudio'))).status, 400);
        const media = await audio(adm, wav);
        assert.equal(media.status, 201);
        room = (await request(path, adm)).data;
        const wrong = structuredClone(room.document);
        wrong.scenes[0].background = media.data.path;
        assert.equal(
          (await request(path, adm, 'PUT', { revision: room.revision, document: wrong })).status,
          400,
        );
        room.document.music.assetId = media.data.id;
        room.document.music.playing = true;
        const saved = await request(path, adm, 'PUT', {
          revision: room.revision,
          document: room.document,
        });
        assert.equal(saved.status, 200);
        room = saved.data;
        const partial = await fetch(base + '/vtt/assets/' + media.data.id, {
          headers: { Cookie: player.cookie, Range: 'bytes=10-20' },
        });
        assert.equal(partial.status, 206);
        assert.equal((await partial.arrayBuffer()).byteLength, 11);
        assert.equal(partial.headers.get('Content-Type'), 'audio/wav');
        assert.equal((await request(path + '/assets/' + media.data.id, adm, 'DELETE')).status, 409);
      },
    );
    await t.test(
      'perfis públicos não expõem e-mail, ouro, inventário; imagens e destaque exigem ownership',
      async () => {
        assert.equal((await request('/profiles')).status, 401);
        const profile = (await request('/profiles/' + player.id, other)).data;
        assert.equal(profile.email, undefined);
        assert.equal(profile.is_owner, false);
        assert.equal(profile.characters[0].gold_cp, undefined);
        assert.equal(profile.characters[0].experience, undefined);
        const details = (await request(`/profiles/${player.id}/characters/${p.id}`, other)).data;
        assert.equal(details.character.name, 'Mira');
        assert.equal(details.inventory, undefined);
        assert.equal(details.character.gold_cp, undefined);
        assert.equal(
          (await request(`/profiles/${player.id}/characters/${o.id}`, other)).status,
          404,
        );
        const body = {
          document: profileSettingsSchema.parse({ tagline: 'Meu perfil', featured: [p.id] }),
          revision: 0,
        };
        assert.equal((await request('/profiles/' + player.id, other, 'PUT', body)).status, 403);
        assert.equal(
          (
            await request('/profiles/' + player.id, player, 'PUT', {
              ...body,
              document: { ...body.document, featured: [o.id] },
            })
          ).status,
          400,
        );
        const saves = await Promise.all(
          [1, 2].map((i) =>
            request('/profiles/' + player.id, player, 'PUT', {
              ...body,
              document: { ...body.document, tagline: 'História ' + i },
            }),
          ),
        );
        assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
        assert.equal(
          (
            await request('/profiles/' + player.id, player, 'PUT', {
              document: { ...body.document, avatar: 'https://example.com/image.png' },
              revision: 1,
            })
          ).status,
          400,
        );
        assert.equal((await request('/profiles?q=Mira', player)).data.items.length, 0);
        assert.ok(
          (await request('/profiles?q=' + player.id, player)).data.items.some(
            (u: any) => u.id === player.id,
          ),
        );
      },
    );
    await t.test(
      'amizade aceita antes do chat, pedidos privados e isolamento de mensagens',
      async () => {
        const path = '/social/friends/' + other.id;
        assert.equal(
          (await request('/social/chat/' + other.id, player, 'POST', { body: 'Oi' })).status,
          403,
        );
        const sends = await Promise.all([
          request(path, player, 'POST', {}),
          request('/social/friends/' + player.id, other, 'POST', {}),
        ]);
        assert.ok(sends.every((r) => r.status === 201));
        assert.equal(
          (await pool.query('SELECT count(*)::int AS n FROM social_friendships')).rows[0].n,
          1,
        );
        const friend = (await request('/social/friends', player)).data.items[0];
        const acceptor = friend.incoming ? player : other,
          requester = friend.incoming ? other : player;
        assert.equal(
          (await request('/social/friends/' + acceptor.id, requester, 'PATCH', {})).status,
          404,
        );
        assert.equal(
          (await request('/social/friends/' + requester.id, acceptor, 'PATCH', {})).status,
          200,
        );
        assert.equal(
          (await request('/social/chat/' + other.id, player, 'POST', { body: 'Só entre nós.' }))
            .status,
          201,
        );
        assert.equal((await request('/social/chat/' + player.id, adm)).data.items.length, 0);
        assert.equal(
          (await request('/social/chat/' + player.id, other)).data.items[0].body,
          'Só entre nós.',
        );
        assert.equal((await request('/social/inbox', other)).data[0].unread, 1);
        await request('/social/chat/' + player.id + '/read', other, 'POST', {});
        assert.equal((await request('/social/inbox', other)).data[0].unread, 0);
        await request('/social/blocks/' + player.id, other, 'POST', {});
        assert.equal((await request('/social/friends', player)).data.items.length, 0);
        assert.equal(
          (await request('/social/chat/' + other.id, player, 'POST', { body: 'Bloqueado' })).status,
          403,
        );
        assert.equal(
          (await request('/social/friends/' + other.id, player, 'POST', {})).status,
          403,
        );
        assert.equal(
          (await request('/profiles/' + other.id + '/review', player, 'POST', { score: 4 })).status,
          403,
        );
        await request('/social/blocks/' + player.id, other, 'DELETE');
      },
    );
    await t.test(
      'uma avaliação por conta, sem autoavaliação; pesos só administrador e pontuação real',
      async () => {
        const path = '/profiles/' + player.id + '/review';
        assert.equal((await request(path, player, 'POST', { score: 5 })).status, 403);
        assert.equal((await request(path, other, 'POST', { score: 6 })).status, 400);
        assert.equal(
          (await request(path, other, 'POST', { score: 5, comment: 'Ótima companheira.' })).status,
          200,
        );
        await request(path, other, 'POST', { score: 4, comment: 'Editado.' });
        assert.equal((await request('/profiles/' + player.id, other)).data.rating.count, 1);
        const hall = (await request('/hall', player)).data,
          entry = hall.entries.find((e: any) => e.id === p.id);
        const expected = fameScore(entry, hall.document.weights);
        assert.equal(entry.score, expected.score);
        assert.equal(entry.gold_cp, undefined);
        const payload = { document: defaultHallSettings, revision: hall.revision };
        assert.equal((await request('/hall/settings', player, 'PUT', payload)).status, 403);
        const edits = await Promise.all(
          [1, 2].map((n) =>
            request('/hall/settings', adm, 'PUT', {
              ...payload,
              document: { ...defaultHallSettings, title: 'Memórias ' + n },
            }),
          ),
        );
        assert.deepEqual(edits.map((r) => r.status).sort(), [200, 409]);
        await request(path, other, 'DELETE');
        assert.equal((await request('/profiles/' + player.id, other)).data.rating.count, 0);
      },
    );
    await t.test(
      'grade quadrada/hexagonal, diagonais e luz obstruída por paredes/portas/janelas',
      async () => {
        const s = newScene(randomUUID()),
          g = s.grid;
        g.size = 70;
        g.scale = 5;
        assert.deepEqual(snapPoint({ x: 78, y: 130 }, g), { x: 70, y: 140 });
        g.diagonal = 'five';
        assert.equal(distance({ x: 0, y: 0 }, { x: 140, y: 140 }, g), 10);
        g.diagonal = 'alternating';
        assert.equal(distance({ x: 0, y: 0 }, { x: 140, y: 140 }, g), 15);
        for (const type of ['hex-flat', 'hex-point'] as const) {
          g.type = type;
          const p = snapPoint({ x: 120, y: 145 }, g);
          assert.deepEqual(snapPoint(p, g), p);
        }
        s.walls = [
          {
            id: randomUUID(),
            a: { x: 100, y: 0 },
            b: { x: 100, y: 300 },
            kind: 'wall',
            open: false,
          },
        ];
        assert.equal(visiblePoint({ x: 50, y: 100 }, { x: 150, y: 100 }, s, 500), false);
        s.walls[0].kind = 'door';
        s.walls[0].open = true;
        assert.equal(visiblePoint({ x: 50, y: 100 }, { x: 150, y: 100 }, s, 500), true);
        s.walls[0].kind = 'window';
        assert.equal(visiblePoint({ x: 50, y: 100 }, { x: 150, y: 100 }, s, 500), true);
        assert.ok(sightPolygon({ x: 50, y: 100 }, 500, s).length > 100);
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

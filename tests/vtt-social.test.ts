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
  newDocument,
  orderedTokens,
  lightSchema,
  carveOpening,
  viewerSees,
  manualFogSees,
  visionPixels,
  activateTokenVision,
} from '../shared/vtt.js';
import { emptyHotbar } from '../shared/vtt-hotbar.js';
import { monsterActions } from '../shared/vtt-monster-actions.js';
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
      headers: {
        Origin: origin,
        Cookie: who?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': '3',
      },
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
        room = (await request(`/vtt/rooms/${room.id}`, adm)).data;
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
        scene.lighting = false;
        scene.fog = false;
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
      'ficha completa, consumo transacional, idempotência e restauração exclusiva do mestre',
      async () => {
        const root = `/vtt/rooms/${room.id}`;
        const token = room.document.scenes[0].tokens.find((t: any) => t.characterId === p.id);
        const path = root + '/sheets/' + token.id;
        await pool.query(
          "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'rations',1)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=1",
          [p.id],
        );
        assert.equal((await request(path, player)).status, 200);
        assert.equal((await request(path, other)).status, 404);
        const start = (await request(path, player)).data;
        assert.equal(start.is_gm, false);
        assert.equal(start.character.id, p.id);
        const key = randomUUID(),
          consume = { kind: 'consumable', item_id: 'rations', idempotency_key: key };
        const uses = await Promise.all([
          request(path + '/use', player, 'POST', consume),
          request(path + '/use', player, 'POST', consume),
        ]);
        assert.deepEqual(
          uses.map((r) => r.status),
          [200, 200],
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM inventory WHERE character_id=$1 AND item_id='rations'",
              [p.id],
            )
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await request(path + '/use', player, 'POST', {
              ...consume,
              idempotency_key: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(path + '/use', player, 'POST', {
              kind: 'consumable',
              item_id: 'longsword',
              idempotency_key: randomUUID(),
            })
          ).status,
          400,
        );
        const audit = uses[0].data.uses.find((u: any) => u.kind === 'consumable');
        assert.equal(
          (await request(path + '/restore', player, 'POST', { kind: 'use', use_id: audit.id }))
            .status,
          403,
        );
        assert.equal(
          (await request(path + '/restore', adm, 'POST', { kind: 'use', use_id: audit.id })).status,
          200,
        );
        assert.equal(
          (await request(path + '/restore', adm, 'POST', { kind: 'use', use_id: audit.id })).status,
          409,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='rations'",
              [p.id],
            )
          ).rows[0].quantity,
          1,
        );
        assert.equal(
          (await request(path + '/slots', player, 'PUT', { totals: [2, 0, 0, 0, 0, 0, 0, 0, 0] }))
            .status,
          403,
        );
        assert.equal(
          (await request(path + '/slots', adm, 'PUT', { totals: [2, 0, 0, 0, 0, 0, 0, 0, 0] }))
            .status,
          200,
        );
        const slot = await request(path + '/use', player, 'POST', {
          kind: 'slot',
          slot: 1,
          idempotency_key: randomUUID(),
        });
        assert.equal(slot.status, 200);
        assert.equal(
          (await request(path + '/restore', player, 'POST', { kind: 'slot', slot: 1 })).status,
          403,
        );
        const slotUse = slot.data.uses.find((u: any) => u.kind === 'slot');
        assert.equal(
          (await request(path + '/restore', adm, 'POST', { kind: 'slot', slot: 1 })).status,
          200,
        );
        assert.equal(
          (await request(path + '/restore', adm, 'POST', { kind: 'use', use_id: slotUse.id }))
            .status,
          409,
        );
        assert.equal(
          (await request(root + '/tokens/' + token.id, player, 'PATCH', { hp: token.maxHp }))
            .status,
          403,
        );
        const damaged = await request(path + '/damage', player, 'POST', { amount: 1 });
        assert.equal(damaged.status, 200);
        assert.equal(damaged.data.token.hp, 2);
        assert.equal(
          (await request(path + '/restore', player, 'POST', { kind: 'hp' })).status,
          403,
        );
        await request(root + '/characters/' + p.id, player, 'POST', {});
        room = (await request(root, adm)).data;
        assert.equal(
          room.document.scenes[0].tokens.filter((t: any) => t.characterId === p.id).length,
          1,
        );
        assert.equal(room.document.scenes[0].tokens.find((t: any) => t.id === token.id).hp, 2);
        assert.equal((await request(path + '/heal', player, 'POST', { amount: 1 })).status, 403);
        assert.equal((await request(path + '/heal', other, 'POST', { amount: 1 })).status, 404);
        assert.equal((await request(path + '/heal', adm, 'POST', { amount: -1 })).status, 400);
        const healed = await request(path + '/heal', adm, 'POST', { amount: 1 });
        assert.equal(healed.status, 200, JSON.stringify(healed.data));
        assert.equal(healed.data.token.hp, 3);
        const full = await request(path + '/heal', adm, 'POST', { amount: 100000 });
        assert.equal(full.data.token.hp, full.data.token.maxHp);
        room = (await request(root, adm)).data;
        const forged = structuredClone(room.document);
        const fake = { ...token, id: randomUUID(), characterId: o.id };
        forged.scenes[0].tokens.push(fake);
        const saved = await request(root, adm, 'PUT', {
          revision: room.revision,
          document: forged,
        });
        assert.equal(saved.status, 200);
        assert.equal((await request(root + '/sheets/' + fake.id, adm)).status, 403);
        room = (
          await request(root, adm, 'PUT', {
            revision: saved.data.revision,
            document: room.document,
          })
        ).data;
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
        const advanced = await request(path, player, 'POST', {
          formula: '4d6kh3+1',
          text: 'Teste personalizado',
        });
        assert.equal(advanced.status, 201);
        const advancedMessage = (await request('/vtt/rooms/' + room.id, adm)).data.messages.find(
          (m: any) => m.text === 'Teste personalizado',
        );
        assert.equal(
          advancedMessage.roll.total,
          [...advancedMessage.roll.dice]
            .sort((a: number, b: number) => b - a)
            .slice(0, 3)
            .reduce((a: number, b: number) => a + b, 1),
        );
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
      'mapa vazio, pastas sem ciclos, profundidade decimal, janela recorta parede e luz independente',
      () => {
        const doc = newDocument(randomUUID());
        const scene = doc.scenes[0];
        assert.equal(scene.background, '');
        assert.equal(scene.width, 1750);
        assert.equal(scene.height, 1750);
        const parent = { id: randomUUID(), name: 'Norte', parentId: null },
          child = { id: randomUUID(), name: 'Porão', parentId: parent.id };
        doc.folders = [parent, child];
        scene.folderId = child.id;
        assert.equal(documentSchema.safeParse(doc).success, true);
        parent.parentId = child.id as any;
        assert.equal(documentSchema.safeParse(doc).success, false);
        parent.parentId = null;
        const a = newToken(randomUUID(), scene),
          b = newToken(randomUUID(), scene),
          c = newToken(randomUUID(), scene);
        a.level = 0.1;
        b.level = 0;
        c.level = -0.1;
        scene.tokens = [a, b, c];
        assert.deepEqual(
          orderedTokens(scene.tokens).map((t) => t.id),
          [c.id, b.id, a.id],
        );
        scene.walls = [
          {
            id: randomUUID(),
            a: { x: 100, y: 0 },
            b: { x: 100, y: 300 },
            kind: 'wall',
            open: false,
          },
        ];
        const opening = {
          id: randomUUID(),
          a: { x: 102, y: 80 },
          b: { x: 102, y: 140 },
          kind: 'window' as const,
          open: false,
        };
        carveOpening(scene, opening, randomUUID);
        scene.walls.push(opening);
        assert.equal(scene.walls.length, 3);
        assert.equal(opening.a.x, 100);
        assert.equal(visiblePoint({ x: 50, y: 110 }, { x: 150, y: 110 }, scene, 500), true);
        assert.equal(visiblePoint({ x: 50, y: 180 }, { x: 150, y: 180 }, scene, 500), false);
        scene.lighting = true;
        scene.ambient = 0;
        scene.fog = true;
        scene.fogMode = 'vision';
        a.x = 50;
        a.y = 110;
        a.vision = 0;
        const target = { x: 150, y: 110 };
        assert.equal(viewerSees(a, target, scene), false);
        scene.lights = [
          lightSchema.parse({ id: randomUUID(), x: 150, y: 110, bright: 20, dim: 10 }),
        ];
        assert.equal(scene.tokens.length, 3);
        assert.equal(viewerSees(a, target, scene), true);
        scene.lights = [];
        a.vision = 60;
        assert.equal(viewerSees(a, target, scene), true);
        assert.equal(viewerSees(a, { x: 150, y: 180 }, scene), false);
      },
    );
    await t.test(
      'magia completa no histórico e paginação mantém isolamento de mensagens privadas',
      async () => {
        const root = `/vtt/rooms/${room.id}`,
          compendium = (await request('/vtt/compendium', player)).data;
        const spell =
          compendium.spells.find((s: any) => s.details.length > 2000) || compendium.spells[0];
        const posted = await request(root + '/messages', player, 'POST', { spell_id: spell.id });
        assert.equal(posted.status, 201);
        assert.equal(posted.data.messages.at(-1).spell.details, spell.details);
        assert.equal(
          (await request(root + '/messages', player, 'POST', { spell_id: 'inventada' })).status,
          404,
        );
        await pool.query(
          "INSERT INTO vtt_messages(room_id,author_id,author,text)SELECT $1,$2,'Mestre','História '||i FROM generate_series(1,110)i",
          [room.id, adm.id],
        );
        const latest = (await request(root + '/messages', player)).data;
        assert.equal(latest.messages.length, 100);
        assert.equal(latest.has_more, true);
        const earlier = (await request(root + '/messages?before=' + latest.messages[0].id, player))
          .data;
        assert.ok(earlier.messages.some((m: any) => m.spell?.id === spell.id));
        assert.equal(
          earlier.messages.some((m: any) => m.private && m.author !== 'Viajante'),
          false,
        );
        assert.equal((await request(root + '/messages', other)).status, 404);
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
    await t.test(
      'boss público sem dados privados, cura, morte automática e controle exclusivo do mestre',
      async () => {
        const root = `/vtt/rooms/${room.id}`;
        room = (await request(root, adm)).data;
        const s = room.document.scenes.find((s: any) => s.id === room.document.activeScene);
        const boss = newToken(randomUUID(), s);
        Object.assign(boss, {
          name: 'Guardião',
          hp: 25,
          maxHp: 50,
          hidden: true,
          notes: 'segredo-do-boss',
          bossStyle: 'royal',
          deathAutomatic: true,
        });
        s.tokens.push(boss);
        room = (
          await request(root, adm, 'PUT', { revision: room.revision, document: room.document })
        ).data;
        const publicState = (await request(root, player)).data;
        assert.deepEqual(
          publicState.bossBars.find((b: any) => b.tokenId === boss.id),
          { tokenId: boss.id, name: 'Guardião', hp: 25, maxHp: 50, style: 'royal' },
        );
        assert.equal(
          publicState.document.scenes[0].tokens.some((t: any) => t.id === boss.id),
          false,
        );
        assert.equal(JSON.stringify(publicState.bossBars).includes('segredo-do-boss'), false);
        const change = async (hp: number) => {
          const t = room.document.scenes
            .find((s: any) => s.id === room.document.activeScene)
            .tokens.find((t: any) => t.id === boss.id);
          t.hp = hp;
          const r = await request(root, adm, 'PUT', {
            revision: room.revision,
            document: room.document,
          });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          room = r.data;
          return room.document.scenes
            .find((s: any) => s.id === room.document.activeScene)
            .tokens.find((t: any) => t.id === boss.id);
        };
        assert.ok((await change(0)).deathAt > 0);
        const at = room.document.scenes
          .find((s: any) => s.id === room.document.activeScene)
          .tokens.find((t: any) => t.id === boss.id).deathAt;
        assert.equal((await change(0)).deathAt, at);
        assert.equal((await change(15)).deathAt, null);
        assert.equal(
          (await request(root, player, 'PUT', { revision: room.revision, document: room.document }))
            .status,
          403,
        );
        assert.equal(
          (await request(root + '/tokens/' + boss.id, player, 'PATCH', { deathAutomatic: true }))
            .status,
          400,
        );
      },
    );
    await t.test(
      'barra de ações privada, persistida, com abas trancadas e referências reais',
      async () => {
        const root = `/vtt/rooms/${room.id}`,
          path = root + '/hotbar';
        await pool.query(
          "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'potion-of-healing',3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=3",
          [p.id],
        );
        const start = await request(path, player);
        assert.equal(start.status, 200);
        let bar = start.data;
        bar.document.pages[0].slots[0] = {
          kind: 'consumable',
          characterId: p.id,
          sourceId: 'potion-of-healing',
          label: 'Poção de cura',
        };
        const put = async (document: any, revision = bar.revision) =>
          request(path, player, 'PUT', { revision, document });
        let r = await put(bar.document);
        assert.equal(r.status, 200, JSON.stringify(r.data));
        bar = r.data;
        assert.equal(
          (await request(path, player)).data.document.pages[0].slots[0].characterId,
          p.id,
        );
        assert.equal((await request(path, adm)).data.document.pages[0].slots[0], null);
        const foreign = structuredClone(bar.document);
        foreign.pages[0].slots[1] = { ...foreign.pages[0].slots[0], characterId: o.id };
        assert.equal((await put(foreign)).status, 403);
        const fake = structuredClone(bar.document);
        fake.pages[0].slots[1] = { ...fake.pages[0].slots[0], sourceId: 'full-plate' };
        assert.equal((await put(fake)).status, 400);
        const lock = structuredClone(bar.document);
        lock.pages[0].locked = true;
        r = await put(lock);
        assert.equal(r.status, 200);
        bar = r.data;
        const remove = structuredClone(bar.document);
        remove.pages[0].slots[0] = null;
        assert.equal((await put(remove)).status, 403);
        remove.pages[0].locked = false;
        assert.equal((await put(remove)).status, 403);
        const unlock = structuredClone(bar.document);
        unlock.pages[0].locked = false;
        r = await put(unlock);
        assert.equal(r.status, 200);
        bar = r.data;
        const second = emptyHotbar(randomUUID()).pages[0];
        bar.document.pages.push(second);
        bar.document.active = second.id;
        r = await put(bar.document);
        assert.equal(r.status, 200);
        bar = r.data;
        assert.equal((await request(path, player)).data.document.pages.length, 2);
        assert.equal((await put(bar.document, 1)).status, 409);
      },
    );
    await t.test(
      'efeitos salvos e ataques de monstros: mestre, atalhos, persistência e privacidade',
      async () => {
        const root = `/vtt/rooms/${room.id}`;
        room = (await request(root, adm)).data;
        const s = room.document.scenes.find((s: any) => s.id === room.document.activeScene);
        s.fog = false;
        s.lighting = false;
        const monster = newToken(randomUUID(), s);
        monster.sheet = {
          source: 'Teste',
          race: '',
          class: '',
          level: 0,
          stats: [10, 10, 10, 10, 10, 10],
          speed: 30,
          biography: '',
          details:
            'Rend\nAtaque m 11, reach 10 ft. Acerto: 13 (2d6 + 6) Slashing damage plus 4 (1d8) Acid damage.\nAcid Breath\nSalvaguarda dex 18. Falha: 54 (12d8) Acid damage.',
        };
        const parsed = monsterActions(monster.sheet.details);
        assert.equal(parsed[0].attack, '1d20+11');
        assert.deepEqual(parsed[0].damage, ['2d6+6', '1d8']);
        assert.deepEqual(parsed[1].damage, ['12d8']);
        assert.equal(parsed[1].attack, null);
        assert.equal(
          monsterActions(
            'Bite\nMelee Weapon Attack: 3 to hit. Hit: 7 (1d6 + 4) piercing damage.',
          )[0].attack,
          '1d20+3',
        );
        s.tokens.push(monster);
        const preset = {
          id: randomUUID(),
          name: 'Efeito privado do mestre',
          kind: 'fire',
          color: '#d68a44',
          scale: 1.2,
          duration: 5,
        };
        const blood = { ...preset, id: randomUUID(), name: 'Sangue', kind: 'death', duration: 0 };
        room.document.effects.push(preset, blood);
        let r = await request(root, adm, 'PUT', {
          revision: room.revision,
          document: room.document,
        });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        room = r.data;
        assert.deepEqual((await request(root, adm)).data.document.effects.slice(-2), [
          preset,
          blood,
        ]);
        assert.deepEqual((await request(root, player)).data.document.effects, []);
        const apply = root + '/effects/' + preset.id + '/apply';
        assert.equal((await request(apply, player, 'POST', { tokenId: monster.id })).status, 403);
        assert.equal((await request(apply, adm, 'POST', { tokenId: randomUUID() })).status, 404);
        r = await request(apply, adm, 'POST', { tokenId: monster.id });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        room = r.data;
        const publicMonster = (await request(root, player)).data.document.scenes[0].tokens.find(
          (v: any) => v.id === monster.id,
        );
        assert.equal(publicMonster.effects[0].kind, 'fire');
        assert.equal(publicMonster.hp, 10);
        assert.equal(publicMonster.sheet, null);
        r = await request(root + '/effects/' + blood.id + '/apply', adm, 'POST', {
          tokenId: monster.id,
        });
        assert.equal(r.status, 200);
        room = r.data;
        const dead = room.document.scenes
          .find((v: any) => v.id === s.id)
          .tokens.find((v: any) => v.id === monster.id);
        assert.ok(dead.deathAt > 0);
        assert.equal(dead.hp, 10);
        const action = {
          kind: 'monster',
          tokenId: monster.id,
          sourceId: parsed[0].id,
          label: 'Rend',
        };
        const effect = { kind: 'effect', sourceId: preset.id, label: preset.name };
        let bar = (await request(root + '/hotbar', adm)).data;
        bar.document.pages[0].slots[0] = effect;
        bar.document.pages[0].slots[1] = action;
        r = await request(root + '/hotbar', adm, 'PUT', {
          revision: bar.revision,
          document: bar.document,
        });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        bar = r.data;
        assert.deepEqual(
          (await request(root + '/hotbar', adm)).data.document.pages[0].slots.slice(0, 2),
          [effect, action],
        );
        const playerBar = (await request(root + '/hotbar', player)).data;
        for (const a of [effect, action]) {
          playerBar.document.pages[0].slots[0] = a;
          assert.equal(
            (
              await request(root + '/hotbar', player, 'PUT', {
                revision: playerBar.revision,
                document: playerBar.document,
              })
            ).status,
            403,
          );
        }
        const source = root + '/hotbar/monster/' + monster.id + '/' + parsed[0].id;
        assert.equal((await request(source, player)).status, 403);
        assert.deepEqual((await request(source, adm)).data.action, parsed[0]);
        bar.document.pages[0].locked = true;
        r = await request(root + '/hotbar', adm, 'PUT', {
          revision: bar.revision,
          document: bar.document,
        });
        assert.equal(r.status, 200);
        bar = r.data;
        bar.document.pages[0].slots[0] = null;
        assert.equal(
          (
            await request(root + '/hotbar', adm, 'PUT', {
              revision: bar.revision,
              document: bar.document,
            })
          ).status,
          403,
        );
        const malformed = structuredClone(room.document);
        malformed.effects[0].scale = 100;
        assert.equal(
          (await request(root, adm, 'PUT', { revision: room.revision, document: malformed }))
            .status,
          400,
        );
        bar = (await request(root + '/hotbar', adm)).data;
        bar.document.pages[0].locked = false;
        r = await request(root + '/hotbar', adm, 'PUT', {
          revision: bar.revision,
          document: bar.document,
        });
        assert.equal(r.status, 200);
        bar = r.data;
        room.document.effects = room.document.effects.filter((e: any) => e.id !== preset.id);
        room.document.scenes.find((v: any) => v.id === s.id).tokens = room.document.scenes
          .find((v: any) => v.id === s.id)
          .tokens.filter((v: any) => v.id !== monster.id);
        r = await request(root, adm, 'PUT', { revision: room.revision, document: room.document });
        assert.equal(r.status, 200);
        room = r.data;
        assert.equal((await request(source, adm)).status, 404);
        bar.document.pages[0].slots[0] = null;
        bar.document.pages[0].slots[1] = null;
        assert.equal(
          (
            await request(root + '/hotbar', adm, 'PUT', {
              revision: bar.revision,
              document: bar.document,
            })
          ).status,
          200,
        );
      },
    );
    await t.test(
      'névoa por polígono permite revelar, ocultar e resetar; visão converte pés em metros',
      () => {
        const s = newScene(randomUUID());
        const p = { x: 50, y: 50 };
        const points = [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
          { x: 0, y: 100 },
        ];
        s.fogAreas.push({ id: randomUUID(), points, reveal: true });
        assert.equal(manualFogSees(p, s), true);
        assert.equal(manualFogSees({ x: 150, y: 50 }, s), false);
        s.fogAreas.push({ id: randomUUID(), points, reveal: false });
        assert.equal(manualFogSees(p, s), false);
        s.fogAreas.push({ id: randomUUID(), points, reveal: true });
        assert.equal(manualFogSees(p, s), true);
        s.fogAreas = [];
        assert.equal(manualFogSees(p, s), false);
        s.grid.unit = 'm';
        s.grid.scale = 1.524;
        assert.ok(Math.abs(visionPixels(60, s) - 840) < 0.001);
        s.lighting = false;
        s.fogMode = 'manual';
        s.ambient = 0.12;
        activateTokenVision(s);
        assert.deepEqual([s.lighting, s.fog, s.fogMode, s.ambient], [true, true, 'vision', 0]);
      },
    );
    await t.test(
      'perfil mantém avatar e cenário legado; novo envio de cenário fica indisponível',
      async () => {
        const png = await sharp({
          create: { width: 16, height: 16, channels: 4, background: '#555555' },
        })
          .png()
          .toBuffer();
        const asset = await fetch(base + '/social/assets', {
          method: 'POST',
          headers: { Origin: origin, Cookie: player.cookie, 'Content-Type': 'image/png' },
          body: png,
        });
        assert.equal(asset.status, 201);
        const path = (await asset.json()).path;
        const root = '/profiles/' + player.id;
        let profile = (await request(root, player)).data;
        let r = await request(root, player, 'PUT', {
          revision: profile.revision,
          document: { ...profile.document, avatar: path },
        });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        profile = r.data;
        r = await request(root, player, 'PUT', {
          revision: profile.revision,
          document: { ...profile.document, background: path },
        });
        assert.equal(r.status, 403);
        await pool.query(
          "UPDATE player_profiles SET document=jsonb_set(document,'{background}',to_jsonb($2::text)) WHERE user_id=$1",
          [player.id, path],
        );
        profile = (await request(root, player)).data;
        r = await request(root, player, 'PUT', {
          revision: profile.revision,
          document: { ...profile.document, tagline: 'Cenário preservado' },
        });
        assert.equal(r.status, 200, JSON.stringify(r.data));
        assert.equal(r.data.document.background, path);
      },
    );
    await t.test(
      'entrada jogador/espectador, visão delegada e bloqueio completo de ações',
      async () => {
        const before = (await pool.query('SELECT * FROM characters WHERE user_id=$1', [player.id]))
          .rows;
        const created = (await request('/vtt', adm, 'POST', { name: 'Observação segura' })).data,
          root = '/vtt/rooms/' + created.id;
        const watch = await request('/vtt/join', other, 'POST', {
          invite: created.invite,
          role: 'spectator',
        });
        assert.equal(watch.status, 200, JSON.stringify(watch.data));
        assert.equal(watch.data.role, 'spectator');
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int AS n FROM vtt_character_links WHERE room_id=$1',
              [created.id],
            )
          ).rows[0].n,
          0,
        );
        const play = await request('/vtt/join', player, 'POST', {
          invite: created.invite,
          role: 'player',
        });
        assert.equal(play.data.role, 'player');
        assert.equal(
          play.data.document.scenes[0].tokens.filter((t: any) => t.characterId === p.id).length,
          1,
        );
        let master = (await request(root, adm)).data;
        const scene = master.document.scenes[0],
          origin = scene.tokens.find((t: any) => t.characterId === p.id);
        origin.x = 200;
        origin.y = 200;
        origin.vision = 60;
        scene.width = 2000;
        scene.height = 2000;
        const near = {
            ...newToken(randomUUID(), scene),
            name: 'Perto',
            x: 260,
            y: 200,
            notes: 'segredo',
          },
          far = { ...near, id: randomUUID(), name: 'Longe', x: 1600 },
          hidden = { ...near, id: randomUUID(), name: 'Oculto', hidden: true },
          gmOnly = { ...near, id: randomUUID(), name: 'Mestre', layer: 'gm' };
        scene.tokens.push(near, far, hidden, gmOnly);
        const saved = await request(root, adm, 'PUT', {
          revision: master.revision,
          document: master.document,
        });
        assert.equal(saved.status, 200, JSON.stringify(saved.data));
        master = saved.data;
        assert.equal(
          (await request(root + '/viewpoint', other, 'PUT', { userId: adm.id })).status,
          400,
        );
        const selected = await request(root + '/viewpoint', other, 'PUT', { userId: player.id });
        assert.equal(selected.status, 200, JSON.stringify(selected.data));
        assert.equal(selected.data.viewingUser, player.id);
        const tokens = selected.data.document.scenes[0].tokens;
        assert.ok(tokens.some((t: any) => t.id === near.id));
        for (const t of [far, hidden, gmOnly]) assert.ok(!tokens.some((v: any) => v.id === t.id));
        assert.ok(tokens.every((t: any) => !t.sheet && !t.notes));
        assert.equal(selected.data.invite, undefined);
        for (const [suffix, method, body] of [
          ['/messages', 'POST', { text: 'Não permitido' }],
          ['/characters/' + o.id, 'POST', {}],
          ['/tokens/' + origin.id, 'PATCH', { x: 300 }],
          ['/hotbar', 'PUT', {}],
          ['/sheets/' + origin.id + '/damage', 'POST', { amount: 1 }],
          ['/sheets/' + origin.id + '/heal', 'POST', { amount: 1 }],
        ] as const) {
          assert.equal((await request(root + suffix, other, method, body)).status, 403, suffix);
        }
        assert.equal((await request(root + '/sheets/' + origin.id, other)).status, 403);
        assert.equal((await request(root + '/hotbar', other)).status, 403);
        assert.equal((await request(root, adm)).data.revision, master.revision);
        // Changing role imports once, and moving back to spectator never keeps control.
        const asPlayer = await request(root + '/participation', other, 'POST', { role: 'player' });
        assert.equal(asPlayer.status, 200);
        const own = asPlayer.data.document.scenes[0].tokens.find(
          (t: any) => t.characterId === o.id,
        );
        assert.ok(own);
        const again = await request(root + '/participation', other, 'POST', { role: 'player' });
        assert.equal(
          again.data.document.scenes[0].tokens.filter((t: any) => t.characterId === o.id).length,
          1,
        );
        await request(root + '/participation', other, 'POST', { role: 'spectator' });
        assert.equal(
          (await request(root + '/tokens/' + own.id, other, 'PATCH', { hp: 0 })).status,
          403,
        );
        const after = (await request(root, adm)).data;
        assert.equal(
          (await request(root, adm, 'PUT', { revision: after.revision, document: after.document }))
            .status,
          200,
        );
        assert.deepEqual(
          (await pool.query('SELECT * FROM characters WHERE user_id=$1', [player.id])).rows,
          before,
        );
      },
    );
    await t.test(
      'combate: seleção, iniciativa real, controle do mestre e espectadores sem ações',
      async () => {
        const created = (await request('/vtt', adm, 'POST', { name: 'Carrossel' })).data,
          root = '/vtt/rooms/' + created.id;
        await request('/vtt/join', player, 'POST', { invite: created.invite, role: 'player' });
        await request('/vtt/join', other, 'POST', { invite: created.invite, role: 'spectator' });
        let state = (await request(root, adm)).data,
          scene = state.document.scenes[0];
        Object.assign(scene, { fog: false, lighting: false });
        const own = scene.tokens.find((t: any) => t.controller === player.id),
          monster = newToken(randomUUID(), scene);
        assert.ok(own);
        monster.name = 'Guardião';
        monster.notes = 'segredo';
        scene.tokens.push(monster);
        const hidden = { ...monster, id: randomUUID(), name: 'Emboscada secreta', hidden: true };
        scene.tokens.push(hidden);
        await request(root, adm, 'PUT', { revision: state.revision, document: state.document });
        const before = (await request(root, adm)).data,
          charsBefore = (await pool.query('SELECT * FROM characters ORDER BY id')).rows;
        assert.equal(
          (await request(root + '/combat', other, 'POST', { kind: 'add', tokenIds: [own.id] }))
            .status,
          403,
        );
        assert.equal(
          (await request(root + '/combat', adm, 'POST', { kind: 'add', tokenIds: [hidden.id] }))
            .status,
          400,
        );
        assert.equal(
          (await request(root + '/combat', player, 'POST', { kind: 'add', tokenIds: [own.id] }))
            .status,
          403,
        );
        const added = await request(root + '/combat', adm, 'POST', {
          kind: 'add',
          tokenIds: [own.id, monster.id, own.id],
        });
        assert.equal(added.status, 200, JSON.stringify(added.data));
        assert.equal(added.data.entries.length, 2);
        assert.equal((await request(root + '/combat', adm, 'POST', { kind: 'start' })).status, 409);
        assert.equal(
          (await request(root + '/combat', player, 'POST', { kind: 'roll', tokenId: monster.id }))
            .status,
          403,
        );
        assert.equal(
          (
            await request(root + '/combat', player, 'POST', {
              kind: 'roll',
              tokenId: own.id,
              bonus: 100,
            })
          ).status,
          400,
        );
        const rolled = await request(root + '/combat', player, 'POST', {
          kind: 'roll',
          tokenId: own.id,
        });
        assert.equal(rolled.status, 200, JSON.stringify(rolled.data));
        const ownRoll = rolled.data.entries.find((e: any) => e.tokenId === own.id);
        assert.ok(ownRoll.die >= 1 && ownRoll.die <= 20);
        assert.equal(ownRoll.value, ownRoll.die + ownRoll.bonus);
        assert.equal(
          (
            await request(root + '/combat', player, 'POST', {
              kind: 'set',
              tokenId: own.id,
              value: 100,
            })
          ).status,
          403,
        );
        await request(root + '/combat', adm, 'POST', {
          kind: 'set',
          tokenId: monster.id,
          value: 100,
        });
        const started = await request(root + '/combat', adm, 'POST', { kind: 'start' });
        assert.equal(started.data.currentId, monster.id);
        assert.equal(started.data.nextId, own.id);
        assert.equal(
          (await request(root + '/combat', player, 'POST', { kind: 'step', direction: 1 })).status,
          403,
        );
        assert.equal(
          (await request(root + '/combat', player, 'POST', { kind: 'roll', tokenId: own.id }))
            .status,
          409,
        );
        const next = await request(root + '/combat', adm, 'POST', { kind: 'step', direction: 1 });
        assert.equal(next.data.currentId, own.id);
        const nextRound = await request(root + '/combat', adm, 'POST', {
          kind: 'step',
          direction: 1,
        });
        assert.equal(nextRound.data.round, 2);
        const backwards = await request(root + '/combat', adm, 'POST', {
          kind: 'step',
          direction: -1,
        });
        assert.equal(backwards.data.round, 1);
        const chosen = await request(root + '/combat', adm, 'POST', {
          kind: 'goto',
          tokenId: monster.id,
        });
        assert.equal(chosen.data.currentId, monster.id);
        const spectator = (await request(root + '/combat', other)).data;
        assert.ok(spectator.entries.every((e: any) => !e.canRoll));
        assert.ok(!JSON.stringify(spectator).includes('segredo'));
        const after = (await request(root, adm)).data;
        assert.equal(after.revision, before.revision);
        assert.deepEqual(after.document, before.document);
        assert.deepEqual(
          (await pool.query('SELECT * FROM characters ORDER BY id')).rows,
          charsBefore,
        );
        const ended = await request(root + '/combat', adm, 'POST', { kind: 'end' });
        assert.equal(ended.data.active, false);
        assert.equal(ended.data.entries.length, 0);
      },
    );
    await t.test(
      'sinal do mestre chega a jogador/espectador sem alterar revisão ou revelar dados',
      async () => {
        const created = (await request('/vtt', adm, 'POST', { name: 'Sinais da mesa' })).data,
          root = '/vtt/rooms/' + created.id;
        await request('/vtt/join', player, 'POST', { invite: created.invite, role: 'player' });
        await request('/vtt/join', other, 'POST', { invite: created.invite, role: 'spectator' });
        const before = (await request(root, adm)).data;
        const body = { sceneId: before.document.activeScene, x: 100, y: 150 };
        assert.equal((await request(root + '/signal', player, 'POST', body)).status, 403);
        assert.equal((await request(root + '/signal', other, 'POST', body)).status, 403);
        assert.equal(
          (await request(root + '/signal', adm, 'POST', { ...body, x: 50000 })).status,
          400,
        );
        const result = await request(root + '/signal', adm, 'POST', body);
        assert.equal(result.status, 200, JSON.stringify(result.data));
        for (const who of [adm, player, other]) {
          const signal = await request(root + '/signal', who);
          assert.equal(signal.status, 200);
          assert.deepEqual(signal.data, result.data);
          assert.deepEqual(Object.keys(signal.data).sort(), ['at', 'id', 'sceneId', 'x', 'y']);
        }
        assert.equal((await request('/vtt/rooms/' + randomUUID() + '/signal', player)).status, 404);
        const after = (await request(root, adm)).data;
        assert.equal(after.revision, before.revision);
        assert.deepEqual(after.document, before.document);
      },
    );
    await t.test('cliente antigo não pode substituir o documento com efeitos atuais', async () => {
      const root = '/vtt/rooms/' + room.id,
        current = (await request(root, adm)).data;
      const r = await fetch(base + root, {
        method: 'PUT',
        headers: { Origin: origin, Cookie: adm.cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: current.revision, document: current.document }),
      });
      assert.equal(r.status, 409);
      assert.match((await r.json()).error, /Recarregue/);
      assert.equal((await request(root, adm)).data.revision, current.revision);
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import sharp from 'sharp';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { createLegacyTestCharacter } from './character-fixtures';
import {
  communitySettingsSchema,
  guildDocumentSchema,
  accountProgress,
  guildWeek,
  guildRooms,
  guildDecor,
  crestSchema,
} from '../shared/guilds';
import { profileSettingsSchema } from '../shared/social';

test('Brasões antigos mantêm formato e bordas novas são independentes', () => {
  const old = {
    icon: 'book',
    field: 'quartered',
    border: 'shield',
    iconColor: '#e5c681',
    fieldColor: '#283b36',
    borderColor: '#b28a4c',
  };
  const crest = crestSchema.parse(old);
  assert.equal(crest.border, 'shield');
  assert.equal(crest.ornament, 'beveled');
  assert.equal(crest.fieldColor2, '#17272d');
  for (const ornament of ['riveted', 'braided', 'runic', 'laurel', 'thorns']) {
    const next = crestSchema.parse({ ...old, ornament, fieldColor2: '#203344' });
    assert.equal(next.border, old.border);
    assert.equal(next.icon, old.icon);
    assert.equal(next.borderColor, old.borderColor);
  }
  assert.equal(crestSchema.safeParse({ ...old, ornament: 'unknown' }).success, false);
  assert.equal(
    crestSchema.safeParse({ ...old, borderColor: 'javascript:bad' }).success,
    false,
  );
});
test('Guildas, economia, missões e perfis em banco descartável', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
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
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    // Capacity fixtures use signed test sessions, avoiding signup throttling.
    if (name.startsWith('Membro') || name.startsWith('Último')) {
      const id = randomUUID(),
        token = randomUUID();
      await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [
        id,
        name,
        id + '@example.test',
      ]);
      await pool.query(
        'INSERT INTO session(id,token,"userId","expiresAt") VALUES($1,$2,$3,now()+interval \'1 hour\')',
        [randomUUID(), token, id],
      );
      const signed =
        token +
        '.' +
        createHmac('sha256', process.env.BETTER_AUTH_SECRET!).update(token).digest('base64');
      return { id, cookie: 'better-auth.session_token=' + encodeURIComponent(signed) };
    }
    const r = await request('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
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
      owner = await signup('Fundador'),
      stranger = await signup('Visitante');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [adm.id]);
    const ch = await createLegacyTestCharacter(owner.id, 'Fundador personagem'),
      other = await createLegacyTestCharacter(stranger.id),
      alternate = await createLegacyTestCharacter(owner.id, 'Outro aventureiro');
    await pool.query('UPDATE characters SET gold_cp=200000 WHERE id=$1', [ch.id]);
    let cfg = communitySettingsSchema.parse({}),
      revision = 0,
      id = '',
      doc = guildDocumentSchema.parse({ name: 'Companhia do Amanhecer' });
    const rid = randomUUID();
    await t.test(
      'custo somente configurado por administrador e revisão otimista',
      async () => {
        assert.equal(
          (
            await request('/guilds', owner, 'POST', {
              document: doc,
              character_id: ch.id,
              request_id: rid,
            })
          ).status,
          409,
        );
        cfg.founding_po = 500;
        cfg.missions = [
          {
            id: 'adventure',
            name: 'Uma nova crônica',
            metric: 'missions',
            goal: 1,
            gold_po: 50,
            prestige: 200,
          },
        ];
        assert.equal(
          (await request('/community/settings', owner, 'PUT', { document: cfg, revision }))
            .status,
          403,
        );
        assert.equal(
          (await request('/community/settings', adm, 'PUT', { document: cfg, revision }))
            .status,
          200,
        );
        assert.equal(
          (await request('/community/settings', adm, 'PUT', { document: cfg, revision }))
            .status,
          409,
        );
        revision++;
      },
    );
    await t.test(
      'fundação atômica, ouro insuficiente, propriedade, replay concorrente',
      async () => {
        assert.equal(
          (
            await request('/guilds', owner, 'POST', {
              document: doc,
              character_id: other.id,
              request_id: rid,
            })
          ).status,
          404,
        );
        assert.equal(
          (
            await request('/guilds', stranger, 'POST', {
              document: doc,
              character_id: other.id,
              request_id: randomUUID(),
            })
          ).status,
          409,
        );
        const r = await Promise.all([
          request('/guilds', owner, 'POST', {
            document: doc,
            character_id: ch.id,
            request_id: rid,
          }),
          request('/guilds', owner, 'POST', {
            document: doc,
            character_id: ch.id,
            request_id: rid,
          }),
        ]);
        r.forEach((x) => assert.equal(x.status, 201, JSON.stringify(x.data)));
        id = r[0].data.id;
        assert.equal(id, r[1].data.id);
        assert.equal(r.filter((x) => x.data.replayed).length, 1);
        assert.equal(
          (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [ch.id])).rows[0]
            .gold_cp,
          150000,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int n FROM player_guild_ledger WHERE guild_id=$1 AND kind='foundation'",
              [id],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await request('/guilds', owner, 'POST', {
              document: doc,
              character_id: ch.id,
              request_id: randomUUID(),
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request('/guilds', stranger, 'POST', {
              document: doc,
              character_id: other.id,
              request_id: rid,
            })
          ).status,
          403,
        );
      },
    );
    await t.test('somente o personagem registrado pertence à guilda', async () => {
      const memberContext = '?character_id=' + ch.id, visitorContext = '?character_id=' + alternate.id;
      const directory = (await request('/guilds' + memberContext, owner)).data;
      assert.equal(directory.mine, id);
      assert.equal(directory.membership.character_id, ch.id);
      const alternateDirectory = (await request('/guilds' + visitorContext, owner)).data;
      assert.equal(alternateDirectory.mine, null);
      assert.equal(alternateDirectory.membership.character_name, ch.name);
      const member = (await request('/guilds/' + id + memberContext, owner)).data;
      assert.equal(member.is_member, true); assert.equal(member.is_owner, true);
      assert.equal(member.members.length, 1); assert.equal(member.members[0].character_id, ch.id);
      const visitor = (await request('/guilds/' + id + visitorContext, owner)).data;
      assert.equal(visitor.is_member, false); assert.equal(visitor.is_owner, false);
      assert.equal(visitor.weekly, null); assert.equal(visitor.treasury_cp, null);
      assert.deepEqual(visitor.ledger, []); assert.deepEqual(visitor.upgrades, []);
      assert.equal((await request('/guilds/' + id + visitorContext, owner, 'PUT', {document:doc,revision:0})).status, 403);
      assert.equal((await request('/guilds/' + id + '/invites' + visitorContext, owner, 'POST', {user_id:stranger.id})).status, 403);
      assert.equal((await request('/guilds/' + id + '/weekly/adventure/claim' + visitorContext, owner, 'POST', {})).status, 403);
      assert.equal((await request('/guilds?character_id=' + other.id, owner)).status, 404);
      assert.equal((await request('/guilds/' + id + '?character_id=' + other.id, owner)).status, 404);
      assert.equal((await request('/guilds?character_id=invalid', owner)).status, 400);
      const profile = (await request('/profiles/' + owner.id, owner)).data;
      assert.equal(profile.guild.character_id, ch.id); assert.equal(profile.guild.character_name, ch.name);
    });
    await t.test(
      'quatro salas iniciais, sede exclusiva do dono, vistas e expansões validadas',
      async () => {
        assert.equal(guildRooms.filter((r) => r.starter).length, 4);
        const piece = {
          id: randomUUID(),
          catalog: guildDecor[0].id,
          room: 'main',
          x: 0.5,
          y: 0.8,
          scale: 0.17,
          facing: 0,
          perspective: [
            { x: 0, y: -0.1 },
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 0, y: -0.2 },
          ],
        };
        doc = guildDocumentSchema.parse({
          ...doc,
          placements: [piece],
          perspectives: { main: { horizon: 0.42, left: -1, right: 2 } },
          crest: {
            ...doc.crest,
            icon: 'book',
            border: 'shield',
            ornament: 'runic',
            borderColor: '#b6884a',
            fieldColor2: '#203344',
          },
        });
        assert.equal(
          (await request('/guilds/' + id, stranger, 'PUT', { document: doc, revision: 0 }))
            .status,
          403,
        );
        assert.equal(
          (
            await request('/guilds/' + id, owner, 'PUT', {
              document: { ...doc, placements: [{ ...piece, room: 'library' }] },
              revision: 0,
            })
          ).status,
          403,
        );
        assert.equal(
          (await request('/guilds/' + id, owner, 'PUT', { document: doc, revision: 0 }))
            .status,
          200,
        );
        assert.deepEqual(
          (await request('/guilds/' + id, owner)).data.document.crest,
          doc.crest,
        );
        assert.deepEqual(
          (await request('/guilds/' + id, owner)).data.document.placements[0].perspective,
          piece.perspective,
        );
        assert.deepEqual(
          (await request('/guilds/' + id, owner)).data.document.perspectives,
          doc.perspectives,
        );
        assert.equal(
          (await request('/guilds/' + id, owner, 'PUT', { document: doc, revision: 0 }))
            .status,
          409,
        );
        assert.equal(
          (
            await request('/guilds/' + id, owner, 'PUT', {
              document: { ...doc, placements: [{ ...piece, catalog: 'fake' }] },
              revision: 1,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request('/guilds/' + id + '/upgrade/' + piece.id, owner, 'POST', {
              level: 2,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      'convites, propriedade do personagem e capacidade oito sob concorrência',
      async () => {
        assert.equal(
          (
            await request('/guilds/' + id + '/join', stranger, 'POST', {
              character_id: other.id,
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await request('/guilds/' + id + '/invites', stranger, 'POST', {
              user_id: stranger.id,
            })
          ).status,
          403,
        );
        await request('/guilds/' + id + '/invites', owner, 'POST', { user_id: stranger.id });
        assert.equal(
          (
            await request('/guilds/' + id + '/join', stranger, 'POST', {
              character_id: ch.id,
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request('/guilds/' + id + '/join', stranger, 'POST', {
              character_id: other.id,
            })
          ).status,
          200,
        );
        for (let i = 0; i < 5; i++) {
          const u = await signup('Membro ' + i),
            c = await createLegacyTestCharacter(u.id);
          await request('/guilds/' + id + '/invites', owner, 'POST', { user_id: u.id });
          assert.equal(
            (await request('/guilds/' + id + '/join', u, 'POST', { character_id: c.id }))
              .status,
            200,
          );
        }
        const a = await signup('Último A'),
          b = await signup('Último B'),
          ac = await createLegacyTestCharacter(a.id),
          bc = await createLegacyTestCharacter(b.id);
        await request('/guilds/' + id + '/invites', owner, 'POST', { user_id: a.id });
        await request('/guilds/' + id + '/invites', owner, 'POST', { user_id: b.id });
        const races = await Promise.all([
          request('/guilds/' + id + '/join', a, 'POST', { character_id: ac.id }),
          request('/guilds/' + id + '/join', b, 'POST', { character_id: bc.id }),
        ]);
        assert.deepEqual(races.map((x) => x.status).sort(), [200, 409]);
        assert.equal((await request('/guilds/' + id, owner)).data.members.length, 8);
        assert.equal(
          (await request('/guilds/' + id + '/members/' + owner.id, owner, 'DELETE')).status,
          409,
        );
      },
    );
    await t.test(
      'progresso só por recompensas reais após ingresso e pagamento semanal idempotente',
      async () => {
        let g = (await request('/guilds/' + id, owner)).data;
        assert.equal(g.weekly.items[0].progress, 0);
        assert.equal(
          (await request('/guilds/' + id + '/weekly/adventure/claim', owner, 'POST', {}))
            .status,
          409,
        );
        assert.equal(
          (await request('/guilds/' + id + '/weekly/adventure/claim', stranger, 'POST', {}))
            .status,
          403,
        );
        const {
          rows: [p],
        } = await pool.query(
          "INSERT INTO board_posts(author_id,kind,status,title,description,location,difficulty) VALUES($1,'mission','completed','Aventura','Crônica','Norte','Moderada') RETURNING id",
          [adm.id],
        );
        await pool.query(
          'INSERT INTO mission_participants(post_id,character_id) VALUES($1,$2)',
          [p.id, ch.id],
        );
        await pool.query(
          'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by) VALUES($1,$2,0,$3)',
          [p.id, ch.id, adm.id],
        );
        const {rows:[unrelated]} = await pool.query("INSERT INTO board_posts(author_id,kind,status,title,description,location,difficulty) VALUES($1,'mission','completed','Outra aventura','Crônica','Norte','Moderada') RETURNING id", [adm.id]);
        await pool.query('INSERT INTO mission_participants(post_id,character_id) VALUES($1,$2)', [unrelated.id, alternate.id]);
        await pool.query('INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by) VALUES($1,$2,0,$3)', [unrelated.id, alternate.id, adm.id]);
        g = (await request('/guilds/' + id, owner)).data;
        assert.equal(g.weekly.items[0].progress, 1);
        cfg.missions[0].gold_po = 999;
        assert.equal(
          (await request('/community/settings', adm, 'PUT', { document: cfg, revision }))
            .status,
          200,
        );
        revision++;
        const r = await Promise.all([
          request('/guilds/' + id + '/weekly/adventure/claim', owner, 'POST', {}),
          request('/guilds/' + id + '/weekly/adventure/claim', owner, 'POST', {}),
        ]);
        r.forEach((x) => assert.equal(x.status, 200, JSON.stringify(x.data)));
        assert.equal(r.filter((x) => x.data.replayed).length, 1);
        g = (await request('/guilds/' + id, owner)).data;
        assert.equal(g.treasury_cp, 5000);
        assert.equal(g.prestige, 200);
        assert.equal(g.level, 3);
        assert.equal(g.weekly.items[0].template.gold_po, 50);
        assert.equal(guildWeek(new Date('2026-10-18T23:59:00Z')), '2026-10-12');
        assert.equal(guildWeek(new Date('2026-10-19T00:00:00Z')), '2026-10-19');
      },
    );
    await t.test(
      'melhorias configuradas usam tesouro, requisitos e replay por nível',
      async () => {
        const piece = doc.placements[0];
        cfg.upgrades = [
          { catalog: piece.catalog, gold_po: 10, prestige: 200, missions: 1, max_level: 3 },
        ];
        await request('/community/settings', adm, 'PUT', { document: cfg, revision });
        revision++;
        assert.equal(
          (
            await request('/guilds/' + id + '/upgrade/' + piece.id, owner, 'POST', {
              level: 3,
            })
          ).status,
          409,
        );
        const r = await Promise.all([
          request('/guilds/' + id + '/upgrade/' + piece.id, owner, 'POST', { level: 2 }),
          request('/guilds/' + id + '/upgrade/' + piece.id, owner, 'POST', { level: 2 }),
        ]);
        r.forEach((x) => assert.equal(x.status, 200));
        const g = (await request('/guilds/' + id, owner)).data;
        assert.equal(g.treasury_cp, 4000);
        assert.equal(g.upgrades[0].level, 2);
        assert.equal(
          (
            await request('/guilds/' + id + '/upgrade/' + piece.id, stranger, 'POST', {
              level: 3,
            })
          ).status,
          403,
        );
      },
    );
    await t.test(
      'perfil: nível de conta legítimo, vitrines protegidas e upload próprio permitido',
      async () => {
        let p = (await request('/profiles/' + owner.id, owner)).data;
        assert.equal(p.progress.level, accountProgress(2, 0, cfg.profile_unlocks).level);
        const document = profileSettingsSchema.parse({
          bio: 'Uma história',
          border: 'runic',
          border_effect: 'aurora',
          showcases: [{ kind: 'chronicle', title: 'Crônicas', body: 'Minha história' }],
        });
        assert.equal(
          (await request('/profiles/' + owner.id, stranger, 'PUT', { document, revision: 0 }))
            .status,
          403,
        );
        assert.equal(
          (
            await request('/profiles/' + owner.id, owner, 'PUT', {
              document: {
                ...document,
                showcases: [...document.showcases, ...document.showcases],
              },
              revision: 0,
            })
          ).status,
          403,
        );
        const bytes = await sharp({
          create: { width: 256, height: 128, channels: 3, background: '#403622' },
        })
          .webp()
          .toBuffer();
        const uploaded = await fetch(base + '/social/assets', {
          method: 'POST',
          headers: { Origin: origin, Cookie: owner.cookie, 'Content-Type': 'image/webp' },
          body: bytes,
        });
        assert.equal(uploaded.status, 201);
        const path = (await uploaded.json()).path;
        assert.equal(
          (
            await request('/profiles/' + owner.id, owner, 'PUT', {
              document: { ...document, background: path },
              revision: 0,
            })
          ).status,
          200,
        );
        p = (await request('/profiles/' + owner.id, owner)).data;
        assert.equal(p.document.background, path);
        assert.equal(p.document.border_effect, 'aurora');
        assert.equal(p.guild.id, id);
        assert.equal(
          (
            await request('/profiles/' + stranger.id, stranger, 'PUT', {
              document: { ...document, background: path },
              revision: 0,
            })
          ).status,
          400,
        );
        assert.deepEqual(accountProgress(4, 0, [1, 3, 5]).modules, 2);
        assert.equal(
          (
            await request('/profiles/' + owner.id, owner, 'PUT', {
              document: {
                ...document,
                showcases: [...document.showcases, ...document.showcases],
              },
              revision: 0,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      'amizade e mensagens continuam privadas; lista no perfil reflete amizade',
      async () => {
        assert.equal(
          (await request('/social/chat/' + stranger.id, owner, 'POST', { body: 'Olá' }))
            .status,
          403,
        );
        await request('/social/friends/' + stranger.id, owner, 'POST', {});
        await request('/social/friends/' + owner.id, stranger, 'PATCH', {});
        assert.equal(
          (
            await request('/social/chat/' + stranger.id, owner, 'POST', {
              body: 'Olá, companhia!',
            })
          ).status,
          201,
        );
        const p = (await request('/profiles/' + owner.id, stranger)).data;
        assert.ok(p.friends.some((f: { id: string }) => f.id === stranger.id));
        assert.equal(p.email, undefined);
      },
    );
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

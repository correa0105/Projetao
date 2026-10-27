import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { defaultChoices, deriveSheet } from '../shared/character-sheet';
import { createLegacyTestCharacter, finishTestArt, testArtImage } from './character-fixtures';
import { accountPreview } from '../server/account-preview';
import { requireAdministrator } from '../server/administrators';
import { newDocument, newToken } from '../shared/vtt';

test('contas: quatro slots explícitos, dois na tela, administração e remoção dos salvos', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app'),
    server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + (server.address() as any).port + '/api',
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type Who = { id: string; cookie: string };
  const users: Who[] = [];
  async function req(path: string, who?: Who, body?: unknown) {
    const r = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, Cookie: who?.cookie || '', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    if (users.length === 3) await new Promise((r) => setTimeout(r, 12000));
    const r = await req('/auth/sign-up/email', undefined, {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    const u = {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((x) => x.split(';')[0])
        .join('; '),
    };
    users.push(u);
    return u;
  }
  const editBody = (d: any) => ({
    revision: d.revision,
    reason: 'Teste administrativo',
    name: d.character.name,
    race: d.character.race,
    class: d.character.class,
    level: d.character.level,
    biography: d.character.biography,
    stats: d.character.stats,
    progression_missions: d.character.progression_missions,
    gold_cp: d.character.gold_cp,
    choices: d.choices,
    overrides: {
      hp: d.character.hp,
      armorClass: d.character.armor_class,
      ...d.character.sheet_overrides,
    },
    resources: {
      current_hp: d.sheet?.current_hp ?? d.character.hp,
      temp_hp: d.sheet?.temp_hp ?? 0,
      inspiration: d.sheet?.inspiration ?? false,
      death_success: 0,
      death_failure: 0,
      slots_used: 0,
      hit_dice_used: 0,
      prepared: [],
      notes: d.sheet?.notes ?? '',
    },
  });
  try {
    const root = await signup('Administrador principal'),
      crowley = await signup('Segundo administrador'),
      regular = await signup('Jogador'),
      otherAdmin = await signup('Outro admin');
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=ANY($1::text[])', [
      [root.id, otherAdmin.id],
    ]);
    await pool.query(
      "INSERT INTO administrator_scopes(user_id,scope)SELECT $1,unnest(ARRAY['board','events','home','lore','rules','tower','vtt','world'])",
      [crowley.id],
    );
    await pool.query(
      'INSERT INTO character_account_settings(user_id,max_characters)VALUES($1,4),($2,4)',
      [root.id, crowley.id],
    );
    const chars: any[] = [];
    for (let n = 1; n <= 3; n++) {
      const c = await createLegacyTestCharacter(root.id, 'Herói ' + n);
      await pool.query('UPDATE characters SET creation_slot=$2 WHERE id=$1', [c.id, n]);
      chars.push(c);
    }
    const foreign = await createLegacyTestCharacter(regular.id, 'Herói alheio');
    await t.test(
      'limite por conta, sem herdar privilégios; slot extra bloqueado no servidor',
      async () => {
        for (const [u, n] of [
          [root, 4],
          [crowley, 4],
          [regular, 2],
          [otherAdmin, 2],
        ] as const) {
          assert.equal((await req('/character-camp', u)).data.limit, n);
          assert.equal((await req('/character-slots', u)).data.length, n);
          assert.equal((await req('/character-art', u)).data.character_limit, n);
        }
        assert.equal((await req('/character-slots/3/roll', regular, {})).status, 403);
        assert.equal(
          (await req('/character-slots/4/reveal', regular, { revealed: 1 })).status,
          403,
        );
        assert.equal(
          (
            await req('/character-camp', regular, {
              positions: [null, null],
              revision: 0,
              max_characters: 4,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      'troca e retirada persistem dois lugares sem excluir personagens, respeitam revisão e dono',
      async () => {
        const before = (await pool.query('SELECT * FROM characters ORDER BY id')).rows;
        let r = await req('/character-camp', root);
        assert.equal(r.data.positions.length, 2);
        r = await req('/character-camp', root, {
          positions: [chars[2].id, chars[0].id],
          revision: r.data.revision,
        });
        assert.equal(r.status, 200);
        assert.equal(r.data.limit, 4);
        assert.equal(
          (await req('/character-camp', root, { positions: [null, null], revision: 0 })).status,
          409,
        );
        assert.equal(
          (
            await req('/character-camp', root, {
              positions: [chars[0].id, chars[0].id],
              revision: 1,
            })
          ).status,
          400,
        );
        assert.equal(
          (await req('/character-camp', root, { positions: [foreign.id, null], revision: 1 }))
            .status,
          404,
        );
        const profile = await req('/profiles/' + root.id, regular);
        assert.deepEqual(profile.data.camp_positions, [chars[2].id, chars[0].id]);
        assert.equal(profile.data.characters.length, 3);
        r = await req('/character-camp', root, { positions: [null, null], revision: 1 });
        assert.deepEqual(r.data.positions, [null, null]);
        assert.deepEqual((await pool.query('SELECT * FROM characters ORDER BY id')).rows, before);
      },
    );
    await t.test('quarto personagem usa dados do slot 4; quinto é bloqueado', async () => {
      await pool.query(
        'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now())ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
      );
      const rolls = (await req('/character-slots/4/roll', root, {})).data.rolls;
      for (let n = 1; n <= 6; n++)
        assert.equal((await req('/character-slots/4/reveal', root, { revealed: n })).status, 200);
      const body = {
        creation: {
          name: 'Quarto herói',
          race: 'Humano',
          class: 'Guerreiro',
          creation_slot: 4,
          choices: {
            ...defaultChoices('Humano', 'Guerreiro'),
            physicalTraits: { height: 'average', build: 'average', age: 'adult', gender: 'male' },
          },
        },
        reference: (await testArtImage()).toString('base64'),
        idempotency_key: randomUUID(),
      };
      const r = await req('/character-art', root, body);
      assert.equal(r.status, 202, JSON.stringify(r.data));
      assert.equal(
        (await req('/character-art', root, { ...body, idempotency_key: randomUUID() })).status,
        409,
      );
      const id = await finishTestArt(r.data.id);
      assert.ok(id);
      assert.equal(
        (await pool.query('SELECT creation_slot FROM characters WHERE id=$1', [id])).rows[0]
          .creation_slot,
        4,
      );
      assert.deepEqual((await req('/character-slots', root)).data[3].rolls, rolls);
      assert.equal(
        (
          await pool.query(
            'SELECT count(*)::int n FROM characters WHERE user_id=$1 AND deleted_at IS NULL',
            [root.id],
          )
        ).rows[0].n,
        4,
      );
    });
    await t.test(
      'edição global de ficha alheia, características e ajustes sem refazer arte ou dados',
      async () => {
        for (const u of [regular, crowley])
          assert.equal((await req('/admin/characters/' + foreign.id, u)).status, 403);
        await assert.rejects(
          () => accountPreview.run(true, () => requireAdministrator(root.id)),
          /Somente administradores/,
        );
        assert.equal((await req('/admin/characters/' + foreign.id)).status, 401);
        const original = (await pool.query('SELECT * FROM characters WHERE id=$1', [foreign.id]))
          .rows[0];
        const d = (await req('/admin/characters/' + foreign.id, root)).data,
          b = editBody(d);
        assert.equal(
          (await req('/admin/characters/' + foreign.id, root, { ...b, user_id: root.id })).status,
          400,
        );
        b.name = 'Herói revisado';
        b.stats = [18, 16, 14, 12, 10, 8];
        b.choices.physicalTraits = {
          height: 'average',
          build: 'average',
          age: 'elder',
          gender: 'male',
          posture: 'hunched',
          cane: 'wooden',
        };
        b.overrides = { hp: 31, armorClass: 17 };
        b.resources.current_hp = 25;
        b.resources.notes = 'Revisão de ficha';
        const r = await req('/admin/characters/' + foreign.id, root, b);
        assert.equal(r.status, 200, JSON.stringify(r.data));
        assert.equal(r.data.character.user_id, regular.id);
        assert.equal(r.data.derived.hp, 31);
        assert.equal(r.data.derived.armorClass, 17);
        assert.deepEqual(r.data.character.stats, b.stats);
        assert.equal(r.data.sheet.choices.physicalTraits.posture, 'hunched');
        assert.equal(r.data.character.portrait_revision, original.portrait_revision);
        assert.equal(r.data.character.token_revision, original.token_revision);
        assert.equal((await req('/admin/characters/' + foreign.id, root, b)).status, 409);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM character_admin_edits WHERE character_id=$1',
              [foreign.id],
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int n FROM character_art_jobs WHERE character_id=$1',
              [foreign.id],
            )
          ).rows[0].n,
          0,
        );
        await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [otherAdmin.id]);
        assert.equal((await req('/admin/characters', otherAdmin)).status, 403);
      },
    );
    await t.test(
      'sincroniza somente recursos alterados; notas conservam ajustes da mesa e dados',
      async () => {
        const sceneId = randomUUID(),
          roomId = randomUUID(),
          doc = newDocument(sceneId),
          token = newToken(randomUUID(), doc.scenes[0]);
        Object.assign(token, {
          characterId: foreign.id,
          controller: regular.id,
          name: 'Alcunha da mesa',
          hp: 20,
          maxHp: 35,
          ac: 21,
          x: 900,
          y: 850,
          rotation: 75,
        });
        doc.scenes[0].tokens.push(token);
        await pool.query('INSERT INTO vtt_rooms(id,owner_id,invite,document)VALUES($1,$2,$3,$4)', [
          roomId,
          root.id,
          randomUUID(),
          JSON.stringify(doc),
        ]);
        await pool.query(
          'INSERT INTO vtt_character_links(room_id,character_id,imported_by)VALUES($1,$2,$3)',
          [roomId, foreign.id, regular.id],
        );
        const dice = Array.from({ length: 6 }, () => [4, 4, 4, 4]);
        await pool.query(
          'UPDATE character_sheets SET rolls=$2,assignment=$3,rolls_revealed=6,finalized_at=now()WHERE character_id=$1',
          [foreign.id, JSON.stringify(dice), JSON.stringify([0, 1, 2, 3, 4, 5])],
        );
        let b = editBody((await req('/admin/characters/' + foreign.id, root)).data);
        b.resources.notes = 'Somente notas';
        assert.equal((await req('/admin/characters/' + foreign.id, root, b)).status, 200);
        let current = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [roomId]))
          .rows[0].document;
        assert.deepEqual(current, doc);
        b = editBody((await req('/admin/characters/' + foreign.id, root)).data);
        b.resources.current_hp = 17;
        b.overrides.hp = 40;
        b.overrides.armorClass = 18;
        assert.equal((await req('/admin/characters/' + foreign.id, root, b)).status, 200);
        current = (await pool.query('SELECT document FROM vtt_rooms WHERE id=$1', [roomId])).rows[0]
          .document;
        assert.deepEqual(current.scenes[0].tokens[0], { ...token, hp: 17, maxHp: 40, ac: 18 });
        const sheet = (
          await pool.query('SELECT * FROM character_sheets WHERE character_id=$1', [foreign.id])
        ).rows[0];
        assert.deepEqual(sheet.rolls, dice);
        assert.deepEqual(sheet.assignment, [0, 1, 2, 3, 4, 5]);
        assert.ok(sheet.finalized_at);
        const j = randomUUID();
        await pool.query(
          "INSERT INTO character_art_jobs(id,user_id,character_id,status,idempotency_key)VALUES($1,$2,$3,'queued',$1)",
          [j, regular.id, foreign.id],
        );
        b = editBody((await req('/admin/characters/' + foreign.id, root)).data);
        b.choices.physicalTraits.posture = 'upright';
        assert.equal((await req('/admin/characters/' + foreign.id, root, b)).status, 409);
        b = editBody((await req('/admin/characters/' + foreign.id, root)).data);
        b.stats[0] = 19;
        assert.equal((await req('/admin/characters/' + foreign.id, root, b)).status, 200);
      },
    );
    await t.test(
      'arquivar somente criação falha própria, mantém histórico, referência e dados',
      async () => {
        const ids = [randomUUID(), randomUUID(), randomUUID()],
          reference = await testArtImage();
        for (let n = 0; n < 3; n++)
          await pool.query(
            'INSERT INTO character_art_jobs(id,user_id,creation,reference,status,idempotency_key,creation_slot)VALUES($1,$2,$3,$4,$5,$1,1)',
            [
              ids[n],
              root.id,
              JSON.stringify({
                name: 'Criação salva',
                race: 'Humano',
                class: 'Guerreiro',
                choices: defaultChoices('Humano', 'Guerreiro'),
              }),
              reference,
              n === 2 ? 'queued' : 'failed',
            ],
          );
        const before = (
            await pool.query(
              'SELECT * FROM character_art_jobs WHERE id=ANY($1::uuid[])ORDER BY id',
              [ids],
            )
          ).rows,
          slots = (await pool.query('SELECT * FROM character_slot_rolls ORDER BY user_id,slot'))
            .rows;
        assert.equal((await req('/character-art/' + ids[0] + '/archive', regular, {})).status, 404);
        assert.equal((await req('/character-art/' + ids[2] + '/archive', root, {})).status, 409);
        for (let n = 0; n < 2; n++)
          assert.equal((await req('/character-art/' + ids[n] + '/archive', root, {})).status, 200);
        assert.equal((await req('/character-art/' + ids[0] + '/archive', root, {})).status, 200);
        assert.equal((await req('/character-art/' + ids[0] + '/draft', root)).status, 404);
        assert.equal((await req('/character-art/' + ids[0] + '/retry', root, {})).status, 409);
        assert.ok(
          !(await req('/character-art', root)).data.jobs.some((j: any) =>
            ids.slice(0, 2).includes(j.id),
          ),
        );
        assert.deepEqual(
          (
            await pool.query(
              'SELECT * FROM character_art_jobs WHERE id=ANY($1::uuid[])ORDER BY id',
              [ids],
            )
          ).rows,
          before,
        );
        assert.deepEqual(
          (await pool.query('SELECT * FROM character_slot_rolls ORDER BY user_id,slot')).rows,
          slots,
        );
      },
    );
    await t.test('ajustes opcionais mantêm regras antigas e recalculam percepção', () => {
      const c = { race: 'Humano', class: 'Guerreiro', level: 1, stats: [12, 12, 12, 12, 12, 12] },
        choices = defaultChoices(c.race, c.class),
        old = deriveSheet(c as any, choices);
      assert.deepEqual(deriveSheet({ ...c, sheet_overrides: {} } as any, choices), old);
      const d = deriveSheet(
        {
          ...c,
          sheet_overrides: {
            hp: 55,
            armorClass: 19,
            speed: 12,
            saves: [5, 4, 3, 2, 1, 0],
            skills: { Percepção: { value: 9, trained: true, expert: true } },
          },
        } as any,
        choices,
      );
      assert.equal(d.hp, 55);
      assert.equal(d.armorClass, 19);
      assert.deepEqual(d.saves, [5, 4, 3, 2, 1, 0]);
      assert.equal(d.passivePerception, 19);
    });
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});

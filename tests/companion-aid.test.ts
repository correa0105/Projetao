import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';
import { seed } from '../server/seed';
import { companionAid } from '../shared/companion-aid';
import { mounts, eclipseStagId } from '../shared/mounts';
import { pets, petVariants } from '../shared/pets';
import { skills } from '../shared/character-sheet';
import { modifier } from '../shared/rules';
import { newDocument, newToken } from '../shared/vtt';
import { economyVersion } from '../shared/economy';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { createLegacyTestCharacter } from './character-fixtures';

test('cada espécie e raça tem um auxílio situacional próprio', () => {
  const aids = [
    ...mounts.map((mount) => companionAid('mount', mount.id)),
    ...pets.map((pet) => companionAid('pet', pet.id)),
    ...petVariants.map((pet) => companionAid('pet', pet.pet_id, pet.id)),
  ];
  const names = new Set();
  for (const aid of aids) {
    assert(aid && skills.includes(aid.skill));
    assert(aid.situation && aid.bonus >= 1 && aid.bonus <= 2);
    assert(!names.has(aid.name));
    names.add(aid.name);
  }
  assert.equal(aids.filter((aid) => aid?.bonus === 2).length, 1);
});

test('o Cervo é exclusivo de Relíquias e o auxílio tem recarga transacional entre mesas', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  await seed();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api';
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];

  async function account(name: string) {
    const id = randomUUID(),
      token = randomUUID();
    await pool.query('INSERT INTO "user"(id,name,email) VALUES($1,$2,$3)', [
      id,
      name,
      id + '@example.test',
    ]);
    await pool.query(
      `INSERT INTO session(id,token,"userId","expiresAt") VALUES($1,$2,$3,now()+interval '1 hour')`,
      [randomUUID(), token, id],
    );
    const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
      .update(token)
      .digest('base64');
    return {
      id,
      cookie: 'better-auth.session_token=' + encodeURIComponent(token + '.' + signature),
    };
  }

  async function request(path: string, who: Awaited<ReturnType<typeof account>>, body?: unknown) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: origin,
        Cookie: who.cookie,
        'Content-Type': 'application/json',
        'X-Economy-Version': economyVersion,
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    const master = await account('Mestre de teste');
    const player = await account('Dona do Cervo');
    const spectator = await account('Observadora');
    const character = await createLegacyTestCharacter(player.id, 'Bruma');
    await pool.query('INSERT INTO prestige_wallets(user_id,points) VALUES($1,40)', [player.id]);
    await pool.query('INSERT INTO tower_wallets(character_id,crystals) VALUES($1,25)', [
      character.id,
    ]);
    const crystals = await request('/special-shop/crystals?character_id=' + character.id, player);
    assert.equal(crystals.status, 200);
    const coal = crystals.data.offers.find(
      (offer: { name: string }) => offer.name === 'Brasa de Vigília',
    );
    assert.equal(coal.price, 6);
    const bought = await request('/special-shop/crystals/purchases', player, {
      character_id: character.id,
      offer_id: coal.id,
      revision: coal.revision,
      request_id: randomUUID(),
    });
    assert.equal(bought.data.balance, 19);
    const prestige = await request('/special-shop/prestige', player);
    assert.equal(prestige.status, 200);
    const offer = prestige.data.offers.find(
      (offer: { target_key: string }) => offer.target_key === eclipseStagId,
    );
    assert(offer?.active);
    assert.equal(
      (
        await request('/stable/purchase', player, {
          character_id: character.id,
          mount_id: eclipseStagId,
          name: 'Eclipse',
          idempotency_key: randomUUID(),
        })
      ).status,
      400,
    );
    const purchase = {
      character_id: character.id,
      offer_id: offer.id,
      revision: offer.revision,
      request_id: randomUUID(),
    };
    assert.equal((await request('/special-shop/prestige/purchases', player, purchase)).status, 400);
    const named = { ...purchase, companion_name: 'Eclipse' };
    const receipt = await request('/special-shop/prestige/purchases', player, named);
    assert.equal(receipt.status, 200, JSON.stringify(receipt.data));
    assert.equal(receipt.data.balance, 16);
    assert.equal(
      (await request('/special-shop/prestige/purchases', player, named)).data.replayed,
      true,
    );
    assert.equal(
      (
        await request('/special-shop/prestige/purchases', player, {
          ...named,
          companion_name: 'Outro',
        })
      ).status,
      409,
    );
    const {
      rows: [mount],
    } = await pool.query('SELECT id,name,price_cp FROM character_mounts WHERE character_id=$1', [
      character.id,
    ]);
    assert.equal(mount.name, 'Eclipse');
    assert.equal(mount.price_cp, 0);
    const token = await fetch(
      base + '/companions/' + character.id + '/mount/' + mount.id + '/token',
      { headers: { Cookie: player.cookie } },
    );
    assert.equal(token.status, 200);
    assert.match(token.headers.get('content-type') || '', /image\//);
    await token.arrayBuffer();
    const {
      rows: [pet],
    } = await pool.query(
      `INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key)
       VALUES($1,'dog','Faro',1000,$2) RETURNING id`,
      [character.id, randomUUID()],
    );

    async function room() {
      const id = randomUUID();
      const doc = newDocument(randomUUID());
      const scene = doc.scenes[0];
      scene.tokens.push(
        {
          ...newToken(randomUUID(), scene),
          name: character.name,
          hp: 10,
          controller: player.id,
          characterId: character.id,
        },
        {
          ...newToken(randomUUID(), scene),
          name: mount.name,
          hp: 14,
          controller: player.id,
          companionId: mount.id,
        },
        {
          ...newToken(randomUUID(), scene),
          name: 'Faro',
          hp: 1,
          controller: player.id,
          companionId: pet.id,
        },
      );
      await pool.query('INSERT INTO vtt_rooms(id,owner_id,invite,document) VALUES($1,$2,$3,$4)', [
        id,
        master.id,
        randomUUID(),
        JSON.stringify(doc),
      ]);
      await pool.query(
        `INSERT INTO vtt_members(room_id,user_id,role) VALUES($1,$2,'player'),($1,$3,'spectator')`,
        [id, player.id, spectator.id],
      );
      await pool.query(
        'INSERT INTO vtt_character_links(room_id,character_id,imported_by) VALUES($1,$2,$3)',
        [id, character.id, player.id],
      );
      return { path: '/vtt/rooms/' + id + '/companions', id, doc };
    }

    const a = await room(),
      b = await room();
    const aid = (path: string, id: string) => path + '/' + id + '/aid';
    assert.deepEqual((await request(a.path, player)).data.aids, []);
    assert.equal((await request(aid(a.path, mount.id), player, {})).status, 403);
    assert.equal((await request(aid(a.path, mount.id), spectator, {})).status, 403);
    const mounted = (await request(a.path, master)).data.aids.find(
      (entry: { id: string }) => entry.id === mount.id,
    );
    assert.equal(mounted.aid.bonus, 2);
    assert.equal(mounted.aid.skill, 'Sobrevivência');
    const rolled = await request(aid(a.path, mount.id), master, {});
    assert.equal(rolled.status, 201, JSON.stringify(rolled.data));
    const message = rolled.data.messages.at(-1);
    assert.match(message.text, /Eclipse · Trilha Entre Véus \(\+2\)/);
    const expected = modifier(character.stats[4]) + 2;
    assert.equal(message.roll.formula, '1d20' + (expected < 0 ? expected : '+' + expected));
    assert.equal((await request(aid(b.path, pet.id), master, {})).status, 409);
    const {
      rows: [uses],
    } = await pool.query('SELECT count(*)::int n FROM vtt_companion_aid');
    assert.equal(uses.n, 1);

    await pool.query("UPDATE vtt_companion_aid SET last_used_at=now()-interval '25 hours'");
    const concurrent = await Promise.all([
      request(aid(a.path, pet.id), master, {}),
      request(aid(b.path, mount.id), master, {}),
    ]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [201, 409]);
    const {
      rows: [messages],
    } = await pool.query('SELECT count(*)::int n FROM vtt_messages WHERE room_id=ANY($1::uuid[])', [
      [a.id, b.id],
    ]);
    assert.equal(messages.n, 2);

    await pool.query("UPDATE vtt_companion_aid SET last_used_at=now()-interval '25 hours'");
    b.doc.scenes[0].tokens[1].hidden = true;
    await pool.query('UPDATE vtt_rooms SET document=$2 WHERE id=$1', [b.id, JSON.stringify(b.doc)]);
    assert.equal((await request(aid(b.path, mount.id), master, {})).status, 409);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});

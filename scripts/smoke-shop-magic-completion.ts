import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { compatibleSlots, twoHanded } from '../shared/equipment.js';
import { consumableItems } from '../shared/vtt-sheet.js';
import { armorBundle, purchaseContents } from '../shared/armor-bundles.js';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(0, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const addr = server.address();
assert(addr && typeof addr !== 'string');
const base = `http://127.0.0.1:${addr.port}`,
  origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
let cookie = '';
const recentRequests: number[] = [];
async function request(path: string, method = 'GET', body?: unknown) {
  for (let attempt = 0; attempt < 3; attempt++) {
  while (true) {
    while (recentRequests.length && Date.now() - recentRequests[0] >= 60100) recentRequests.shift();
    if (recentRequests.length < 200) break;
    const waitMs=Math.min(60000,Math.max(1,60100-(Date.now()-recentRequests[0])));
    if(waitMs>1000)console.log('Bulk catalog QA is waiting for its API window before sending the next request.');
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  recentRequests.push(Date.now());
  const r = await fetch(base + '/api' + path, {
    method,
    headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (r.status === 429 && method === 'GET' && attempt < 2) {
    const seconds = Number(r.headers.get('retry-after') || 60);
    assert(Number.isFinite(seconds) && seconds >= 0 && seconds <= 60);
    await r.arrayBuffer();
    console.log('Read-only catalog audit is respecting the API rate-limit window.');
    await new Promise((resolve) => setTimeout(resolve, Math.min(60000, Math.max(1, seconds * 1000 + 50))));
    continue;
  }
  return { status: r.status, data: await r.json(), headers: r.headers };
  }
  throw Error('Read-only catalog audit could not resume after the API rate-limit window');
}
try {
  const signup = await request('/auth/sign-up/email', 'POST', {
    name: 'Catálogo mágico',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  assert.equal(signup.status, 200);
  cookie = signup.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
  const user = signup.data.user,
    hero = await createLegacyTestCharacter(user.id, 'Conferência do Empório');
  const completion = JSON.parse(
    await readFile('data/shop-magic-completion-20261009/catalog.json', 'utf8'),
  );
  assert(completion.ready && completion.items.length > 0);
  const rulesReviewIds = process.env.SHOP_MAGIC_RULES_IDS
    ? new Set<string>(JSON.parse(await readFile(process.env.SHOP_MAGIC_RULES_IDS, 'utf8')))
    : null;
  if (rulesReviewIds) {
    assert(rulesReviewIds.size > 0);
    for (const id of rulesReviewIds) assert(completion.items.some((x: any) => x.id === id), id);
  }
  const initialGold = completion.items.reduce(
    (sum: number, x: any) => sum + (x.price_cp || 0),
    100000,
  );
  assert(Number.isSafeInteger(initialGold) && initialGold < 2147483647);
  await pool.query('UPDATE characters SET gold_cp=$2 WHERE id=$1', [hero.id, initialGold]);
  const art = JSON.parse(
    await readFile('data/shop-magic-completion-20261009/art-manifest.json', 'utf8'),
  ).assets;
  const all = (await request('/catalog')).data;
  const ids = completion.items.map((x: any) => x.id),
    hashes = new Set(),
    voices = new Set();
  for (const expected of completion.items) {
    const actual = all.find((x: any) => x.id === expected.id);
    assert(actual, expected.id);
    assert.equal(actual.image_path, expected.image_path);
    assert.equal(actual.price_cp, expected.price_cp);
    assert.deepEqual(compatibleSlots(actual), expected.raw_data.equipment_slots);
    assert.equal(twoHanded(actual), expected.raw_data.two_handed);
    if (!rulesReviewIds || rulesReviewIds.has(expected.id)) {
      const rules = await request(`/catalog/${expected.id}/rules`);
      assert.equal(rules.status, 200);
      assert.equal(rules.data.description, expected.raw_data.rules_summary);
      assert(rules.data.source_name.includes(expected.raw_data.source_book));
      assert(!rules.data.source_name.includes('CC BY'));
      assert.equal(rules.data.project_content, false);
    }
    const image = await fetch(base + expected.image_path);
    assert.equal(image.status, 200);
    const b = Buffer.from(await image.arrayBuffer());
    const h = createHash('sha256').update(b).digest('hex');
    assert.equal(h, art.find((x: any) => x.id === expected.id).sha256);
    assert(!hashes.has(h));
    hashes.add(h);
    assert((await sharp(b).metadata()).hasAlpha);
    const audio = await fetch(base + expected.audio_path);
    assert.equal(audio.status, 200);
    assert.equal(Buffer.from(await audio.arrayBuffer()).toString('ascii', 0, 4), 'RIFF');
    assert(!voices.has(expected.merchant_comment));
    voices.add(expected.merchant_comment);
  }
  const before = (
    await pool.query('SELECT * FROM catalog_items WHERE NOT(id=ANY($1::text[])) ORDER BY id', [ids])
  ).rows;
  const override = ids[0];
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  assert.equal(
    (await request(`/catalog/${override}/price`, 'PATCH', { price_cp: 4321 })).status,
    200,
  );
  await seed();
  assert.deepEqual(
    (
      await pool.query('SELECT * FROM catalog_items WHERE NOT(id=ANY($1::text[])) ORDER BY id', [
        ids,
      ])
    ).rows,
    before,
  );
  assert.equal(
    (await pool.query('SELECT price_cp FROM catalog_items WHERE id=$1', [override])).rows[0]
      .price_cp,
    4321,
  );
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user.id]);
  assert.equal((await request(`/catalog/${override}/price`, 'PATCH', { price_cp: 1 })).status, 403);
  // The shop accepts at most 100 distinct rows in a cart.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const buy = {
      character_id: hero.id,
      idempotency_key: randomUUID(),
      items: ids.slice(offset, offset + 100).map((item_id: string) => ({ item_id, quantity: 1 })),
    };
    assert.equal((await request('/shop/checkout', 'POST', buy)).status, 201);
    assert.equal((await request('/shop/checkout', 'POST', buy)).status, 200);
  }
  const ledger = (
    await pool.query(
      'SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
      [hero.id],
    )
  ).rows;
  assert.equal(ledger.length, ids.length);
  const armors=completion.items.filter((x:any)=>x.raw_data.magic_kind==='armor');
  assert.equal(armors.length,80);
  for(const x of armors){
    const bundle=armorBundle(x.id);assert(bundle&&bundle.target==='human',x.id);
    const pieces=(await pool.query('SELECT i.item_id,i.quantity,c.weight_lb,c.raw_data FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=ANY($2::text[])',[hero.id,purchaseContents(x.id)])).rows;
    assert.equal(pieces.length,6,x.id);assert(pieces.every(p=>p.quantity===1&&p.raw_data.armor_bundle_parent===x.id),x.id);
    assert.equal(Math.round(pieces.reduce((s,p)=>s+Number(p.weight_lb),0)*100),Math.round(x.weight_lb*100),x.id);
  }
  const total = completion.items.reduce(
    (sum: number, x: any) => sum + (x.id === override ? 4321 : x.price_cp),
    0,
  );
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
    initialGold - total,
  );
  for (const [id, slot] of [
    ['cloak-of-billowing', 'cloak'],
    ['clockwork-amulet', 'neck'],
    ['hat-of-wizardry', 'head'],
    ['arcane-grimoire-plus-1', 'main_hand'],
    ['dragonhide-belt-plus-1', 'belt'],
    ...(ids.includes('spiked-armor-plus-1')?[
      ['spiked-armor-plus-1','armor'],
      ['double-bladed-scimitar-plus-1','main_hand'],
    ]:[]),
    ...(ids.includes('boots-of-false-tracks') ? [
      ['boots-of-false-tracks', 'feet'],
      ['cloak-of-many-fashions', 'cloak'],
      ['clothes-of-mending', 'armor'],
      ['dread-helm', 'head'],
    ] : []),
  ])
    assert.equal(
      (await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: id, slot }))
        .status,
      200,
      id,
    );
  assert.equal(
    (
      await request('/inventory/equipment', 'POST', {
        character_id: hero.id,
        item_id: 'hat-of-wizardry',
        slot: 'armor',
      })
    ).status,
    400,
  );
  if(ids.includes('double-bladed-scimitar-plus-1')){
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:'hooked-shortspear-plus-1',slot:'off_hand'})).status,409,'Two-handed scimitar blocks the second hand');
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:'double-bladed-scimitar-plus-1',slot:'off_hand'})).status,400,'Two-handed weapon belongs in the main hand');
  }
  if (ids.includes('antimatter-rifle-plus-1')) {
    const equip = (item_id: string, slot: string) => request('/inventory/equipment', 'POST', {
      character_id: hero.id, item_id, slot,
    });
    assert.equal((await equip('antimatter-rifle-plus-1', 'main_hand')).status, 200);
    assert.equal((await equip('semiautomatic-pistol-plus-1', 'off_hand')).status, 409);
    assert.equal((await equip('antimatter-rifle-plus-1', 'off_hand')).status, 400);
    assert.equal((await equip('semiautomatic-pistol-plus-1', 'main_hand')).status, 200);
    assert.equal((await equip('wooden-staff-of-warning', 'off_hand')).status, 200);
    if (ids.includes('orb-of-direction')) {
      assert.equal((await equip('orb-of-direction', 'main_hand')).status, 200);
      assert.equal((await equip('orb-of-time', 'off_hand')).status, 200);
      assert.equal((await equip('boots-of-false-tracks', 'main_hand')).status, 400);
    }
    await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
    const created = await request('/vtt', 'POST', { name: 'Munição do Empório' });
    assert.equal(created.status, 201);
    const imported = await request(`/vtt/rooms/${created.data.id}/characters/${hero.id}`, 'POST', {});
    assert.equal(imported.status, 201);
    const token = imported.data.document.scenes.flatMap((s: any) => s.tokens).find((t: any) => t.characterId === hero.id);
    assert(token);
    const usePath = `/vtt/rooms/${created.data.id}/sheets/${token.id}/use`;
    for (const model of ['energy-cell', 'modern-bullet']) for (const bonus of [1, 2, 3]) {
      const id = `${model}-plus-${bonus}`, item = completion.items.find((x: any) => x.id === id);
      assert(item && consumableItems.has(id), 'New ammunition must be usable by the existing consumption flow');
      assert.equal(item.raw_data.pack_quantity, 1);
      assert.equal(item.price_cp, [0, 2000, 20000, 200000][bonus]);
      assert.equal(item.weight_lb, model === 'energy-cell' ? 0.5 : 0.1);
      assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [hero.id, id])).rows[0].quantity, 1);
      const use = { kind: 'consumable', item_id: id, idempotency_key: randomUUID() };
      assert.equal((await request(usePath, 'POST', use)).status, 200);
      assert.equal((await request(usePath, 'POST', use)).status, 200);
      assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [hero.id, id])).rows.length, 0);
      assert.equal((await request(usePath, 'POST', { ...use, idempotency_key: randomUUID() })).status, 409);
    }
    if (ids.includes('candle-of-the-deep')) {
      const item = completion.items.find((x: any) => x.id === 'candle-of-the-deep');
      assert(item.raw_data.consumable && consumableItems.has(item.id));
      assert.equal(item.price_cp, 5000, 'Single consumable uses the existing half-price policy');
      const use = { kind: 'consumable', item_id: item.id, idempotency_key: randomUUID() };
      assert.equal((await request(usePath, 'POST', use)).status, 200);
      assert.equal((await request(usePath, 'POST', use)).status, 200);
      assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [hero.id, item.id])).rows.length, 0);
      assert.equal((await request(usePath, 'POST', { ...use, idempotency_key: randomUUID() })).status, 409);
    }
    const adamAmmo:Record<string,[number,number]>={'adamantine-arrow':[2005,.05],'adamantine-bolt':[2005,.075],'adamantine-energy-cell':[2000,.5],'adamantine-firearm-bullet':[2030,.2],'adamantine-needle':[2002,.02],'adamantine-sling-bullet':[2000,.075]};
    const adamantine=completion.items.filter((x:any)=>x.raw_data.magic_family==='Adamantine Weapon'&&x.raw_data.consumable);
    if(ids.includes('adamantine-arrow'))assert.equal(adamantine.length,6);
    for(const item of adamantine){
      assert(consumableItems.has(item.id));assert.equal(item.raw_data.pack_quantity,1);
      assert.deepEqual([item.price_cp,item.weight_lb],adamAmmo[item.id],'Unit price policy and primary 2024 weight: '+item.id);
      const use={kind:'consumable',item_id:item.id,idempotency_key:randomUUID()};
      assert.equal((await request(usePath,'POST',use)).status,200,item.id);
      assert.equal((await request(usePath,'POST',use)).status,200,item.id);
      assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',[hero.id,item.id])).rows.length,0,item.id);
      assert.equal((await request(usePath,'POST',{...use,idempotency_key:randomUUID()})).status,409,item.id);
    }
    for (const id of ['perfume-of-bewitching', 'pot-of-awakening'].filter(id => ids.includes(id))) {
      const item = completion.items.find((x: any) => x.id === id);
      assert(item.raw_data.consumable && consumableItems.has(id));
      assert.equal(item.price_cp, 5000);
      assert.equal(item.weight_lb, id === 'pot-of-awakening' ? 10 : 0.1);
      const use = {kind:'consumable',item_id:id,idempotency_key:randomUUID()};
      assert.equal((await request(usePath,'POST',use)).status,200,id);
      assert.equal((await request(usePath,'POST',use)).status,200,id);
      assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',[hero.id,id])).rows.length,0,id);
      assert.equal((await request(usePath,'POST',{...use,idempotency_key:randomUUID()})).status,409,id);
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id', [hero.id])).rows, ledger, 'Consumption cannot change the purchase ledger');
  }
  const ruidium = completion.items.filter((x: any) => x.raw_data.magic_family === 'Ruidium Weapon');
  if (ids.includes('ruidium-longsword')) {
    assert.equal(ruidium.length, 51);
    assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: null, slot: 'off_hand' })).status, 200);
    for (const item of ruidium) {
      assert.equal(item.raw_data.attunement, true);
      assert.equal(item.raw_data.upstream_source, 'CRCotN');
      assert.equal(item.raw_data.upstream_facts.bonusWeapon, '+2');
      assert(item.raw_data.source_edition.includes('2014'));
      assert.match(item.raw_data.rules_summary, /2d6 de dano psíquico/);
      assert.match(item.raw_data.rules_summary, /Carisma CD 20/);
      assert.match(item.raw_data.rules_summary, /um nível de exaustão/);
      if (!rulesReviewIds || rulesReviewIds.has(item.id)) {
        assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: item.id, slot: 'main_hand' })).status, 200, item.id);
        if (item.raw_data.two_handed)
          assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: item.id, slot: 'off_hand' })).status, 400, item.id);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id', [hero.id])).rows, ledger, 'Equipment cannot change the purchase ledger');
  }
  const commandFamilies = ["Weapon of Throne's Command", 'Returning Weapon', 'Repeating Shot'];
  const commandItems = completion.items.filter((x: any) => commandFamilies.includes(x.raw_data.magic_family));
  if (ids.includes('returning-dagger')) {
    assert.deepEqual(commandFamilies.map(f => commandItems.filter((x: any) => x.raw_data.magic_family === f).length), [35, 7, 9]);
    assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: null, slot: 'off_hand' })).status, 200);
    for (const item of commandItems) {
      assert.equal(item.raw_data.upstream_facts.bonusWeapon, '+1');
      const family = item.raw_data.magic_family;
      assert.equal(item.raw_data.attunement, family !== 'Returning Weapon');
      if (family === "Weapon of Throne's Command") {
        assert.equal(item.raw_data.upstream_source, 'BMT');
        assert.equal(item.raw_data.upstream_facts.charges, 5);
        assert(item.raw_data.source_edition.includes('2014'));
        assert.match(item.raw_data.rules_summary, /CD de resistência 16/);
        assert.match(item.raw_data.rules_summary, /Recupera 1d4 cargas gastas/);
      } else {
        assert.equal(item.raw_data.upstream_source, 'EFA');
        assert.equal(item.raw_data.source_edition, 'D&D 5e (2024)');
        if (family === 'Repeating Shot') {
          assert.match(item.raw_data.rules_summary, /Ignora a propriedade Carregamento/);
          assert.match(item.raw_data.rules_summary, /desaparece imediatamente depois/);
          assert(!item.raw_data.rules_summary.includes('O carregamento permite apenas um disparo'));
        } else assert.match(item.raw_data.rules_summary, /imediatamente depois/);
      }
      if (!rulesReviewIds || rulesReviewIds.has(item.id)) {
        assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: item.id, slot: 'main_hand' })).status, 200, item.id);
        if (item.raw_data.two_handed)
          assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: item.id, slot: 'off_hand' })).status, 400, item.id);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id', [hero.id])).rows, ledger);
  }
  const paralyzing = completion.items.filter((x: any) => x.raw_data.magic_family === 'Weapon of Agonizing Paralysis');
  if (ids.includes('greatsword-of-agonizing-paralysis')) {
    assert.equal(paralyzing.length, 32);
    assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: null, slot: 'off_hand' })).status, 200);
    for (const item of paralyzing) {
      assert.equal(item.raw_data.upstream_source, 'CoA');
      assert.equal(item.raw_data.upstream_facts.bonusWeapon, '+3');
      assert.equal(item.raw_data.attunement, true);
      assert(item.raw_data.source_edition.includes('2014'));
      assert.match(item.raw_data.rules_summary, /curada para um ponto de vida/);
      assert.match(item.raw_data.rules_summary, /Restauração Menor/);
      assert.match(item.raw_data.rules_summary, /um nível de exaustão/);
      if (!rulesReviewIds || rulesReviewIds.has(item.id)) {
        assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: item.id, slot: 'main_hand' })).status, 200, item.id);
        if (item.raw_data.two_handed)
          assert.equal((await request('/inventory/equipment', 'POST', { character_id: hero.id, item_id: item.id, slot: 'off_hand' })).status, 400, item.id);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id', [hero.id])).rows, ledger);
  }
  if(ids.includes('shield-of-expression')) {
    const item=(id: string)=>completion.items.find((x:any)=>x.id===id);
    assert.equal(item('shield-of-expression').raw_data.magic_kind,'shield');
    assert.equal(item('shield-of-expression').raw_data.upstream_facts.ac,2);
    assert.equal(item('shield-of-expression').price_cp,11000);
    assert.equal(armorBundle('shield-of-expression'),undefined);
    assert.deepEqual(purchaseContents('shield-of-expression'),['shield-of-expression']);
    assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',[hero.id,'shield-of-expression'])).rows[0].quantity,1);
    for(const [id,weight]of [['pole-of-angling',7],['pole-of-collapsing',7],['pot-of-awakening',10],['shield-of-expression',6]] as const) {
      assert.equal(item(id).weight_lb,weight);assert.equal(item(id).weight_estimated,false);
    }
    assert.equal(item('ruby-of-the-war-mage').raw_data.attunement,'by a spellcaster');
    assert.deepEqual(item('ruby-of-the-war-mage').raw_data.equipment_slots,[]);
    assert.equal(item('wand-of-conducting').raw_data.upstream_facts.charges,3);
    assert.equal(item('wand-of-pyrotechnics').raw_data.upstream_facts.charges,7);
    assert.equal(item('wand-of-scowls').raw_data.upstream_source,'XGE');
    assert.match(item('wand-of-scowls').raw_data.rules_summary,/Varinha de Sorrisos/);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:null,slot:'off_hand'})).status,200);
    for(const id of ['pipe-of-remembrance','pole-of-angling','pole-of-collapsing','rope-of-mending','tankard-of-plenty','wand-of-conducting','wand-of-pyrotechnics','wand-of-scowls'])
      assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:id,slot:'main_hand'})).status,200,id);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:'shield-of-expression',slot:'off_hand'})).status,200);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:'shield-of-expression',slot:'armor'})).status,400);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:'ruby-of-the-war-mage',slot:'main_hand'})).status,400);
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  console.log(
    `PASS ${ids.length} reviewed magic items: original art/audio, ${rulesReviewIds?.size ?? ids.length} source descriptions, exact equipment, all old catalog rows unchanged, persistent admin price, purchase replay/ledger/gold and equipment.`,
  );
} finally {
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}

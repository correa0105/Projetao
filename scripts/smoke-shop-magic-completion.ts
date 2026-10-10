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
  const initialGold = completion.items.filter((x:any)=>!x.raw_data.spell_binding).reduce(
    (sum: number, x: any) => sum + (x.price_cp || 0),
    100000,
  );
  assert(Number.isSafeInteger(initialGold) && initialGold < 2147483647);
  await pool.query('UPDATE characters SET gold_cp=$2 WHERE id=$1', [hero.id, initialGold]);
  const art = JSON.parse(
    await readFile('data/shop-magic-completion-20261009/art-manifest.json', 'utf8'),
  ).assets;
  const all = (await request('/catalog')).data;
  // Configured spell exemplars have separate inventory IDs and a dedicated fulfillment test.
  const ids = completion.items.filter((x:any)=>!x.raw_data.spell_binding).map((x: any) => x.id),
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
  assert.equal(armors.length,193);
  for(const x of armors){
    const bundle=armorBundle(x.id);assert(bundle&&bundle.target==='human',x.id);
    const pieces=(await pool.query('SELECT i.item_id,i.quantity,c.weight_lb,c.raw_data FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=ANY($2::text[])',[hero.id,purchaseContents(x.id)])).rows;
    assert.equal(pieces.length,6,x.id);assert(pieces.every(p=>p.quantity===1&&p.raw_data.armor_bundle_parent===x.id),x.id);
    assert.equal(Math.round(pieces.reduce((s,p)=>s+Number(p.weight_lb),0)*100),Math.round(x.weight_lb*100),x.id);
  }
  const total = completion.items.filter((x:any)=>!x.raw_data.spell_binding).reduce(
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
    if (ids.includes('pressure-capsule')) {
      const capsule = completion.items.find(
        (x: any) => x.id === 'pressure-capsule',
      );
      assert(capsule.raw_data.consumable && consumableItems.has(capsule.id));
      assert.equal(capsule.price_cp, 5000);
      const use = {
        kind: 'consumable',
        item_id: capsule.id,
        idempotency_key: randomUUID(),
      };
      assert.equal((await request(usePath, 'POST', use)).status, 200);
      assert.equal((await request(usePath, 'POST', use)).status, 200);
      assert.equal(
        (
          await pool.query(
            'SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',
            [hero.id, capsule.id],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (await request(usePath, 'POST', { ...use, idempotency_key: randomUUID() }))
          .status,
        409,
      );
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
    const specialAmmoFamilies=['Walloping Ammunition','Bloodseeker Ammunition','Dispelling Ammunition','Goading Ammunition','Winged Ammunition','Dried Leech'];
    if(ids.includes('walloping-arrow')) {
      const special=completion.items.filter((x:any)=>specialAmmoFamilies.includes(x.raw_data.magic_family));
      assert.deepEqual(specialAmmoFamilies.map(f=>special.filter((x:any)=>x.raw_data.magic_family===f).length),[7,6,6,6,5,5]);
      const physical:Record<string,[number,number]>={Arrow:[5,.05],Bolt:[5,.075],Needle:[2,.02],'Firearm Bullet':[30,.2],'Modern Bullet':[0,.1],'Energy Cell':[0,.5],'Sling Bullet':[.2,.075]};
      for(const item of special) {
        const f=item.raw_data.upstream_facts,family=item.raw_data.magic_family,rules=item.raw_data.rules_summary,base=f.baseItem.split('|')[0],model=Object.keys(physical).find(x=>x.toLowerCase()===base)!;
        assert(model);assert(item.raw_data.consumable&&consumableItems.has(item.id));assert.equal(item.raw_data.attunement,false);assert.equal(item.raw_data.pack_quantity,1);
        assert.deepEqual(item.raw_data.equipment_slots,[]);assert.equal(item.weight_estimated,false);assert.equal(item.weight_lb,physical[model][1]);
        assert.equal(item.price_cp,Math.round((family==='Walloping Ammunition'?500:family==='Bloodseeker Ammunition'?200000:2000)+physical[model][0]));
        assert.equal(item.raw_data.source_edition,['AU','XDMG'].includes(f.source)?'D&D 5e (2024)':'D&D 5e (2014)');
        if(family==='Walloping Ammunition'){assert.match(rules,/Força CD 10/);assert.match(rules,/fica caída/);}
        if(family==='Bloodseeker Ammunition'){assert.equal(f.source,'BMT');assert.match(rules,/vantagem contra qualquer criatura que não esteja com todos os seus PV/);}
        if(family==='Dispelling Ammunition'){assert.equal(f.source,'AU');assert.match(rules,/recebe dano/);assert.match(rules,/3º círculo ou menor/);assert.match(rules,/inclusive efeitos benéficos/);assert.match(rules,/Assim que causa dano a um alvo/);}
        if(family==='Goading Ammunition'){assert.equal(f.source,'AU');assert.match(rules,/acerta uma criatura e causa dano/);assert.match(rules,/Carisma CD 13/);assert.match(rules,/início do próximo turno dela/);assert.match(rules,/deixa de ser mágica assim que acerta um alvo/);}
        if(family==='Winged Ammunition'){assert.equal(f.source,'BMT');assert.notEqual(model,'Energy Cell');assert.match(rules,/meia cobertura e três quartos/);assert.match(rules,/não ignora cobertura total/);assert.match(rules,/não aumenta o alcance máximo/);}
        if(family==='Dried Leech'){assert.equal(f.source,'BMT');assert.notEqual(model,'Energy Cell');assert.match(item.image_path,/\.webp$/);assert.match(rules,/1d4 de dano perfurante no início de cada turno/);assert.match(rules,/própria sanguessuga tiver causado pelo menos 10/);assert.match(rules,/Qualquer criatura, incluindo o alvo, pode usar sua ação/);}
        if(special.find((x:any)=>x.raw_data.magic_family===family).id===item.id)
          assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:item.id,slot:'main_hand'})).status,400,item.id);
        assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',[hero.id,item.id])).rows[0].quantity,1);
        const use={kind:'consumable',item_id:item.id,idempotency_key:randomUUID()};
        assert.equal((await request(usePath,'POST',use)).status,200,item.id);assert.equal((await request(usePath,'POST',use)).status,200,item.id);
        assert.equal((await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2',[hero.id,item.id])).rows.length,0,item.id);
        assert.equal((await request(usePath,'POST',{...use,idempotency_key:randomUUID()})).status,409,item.id);
      }
    }
    for (const id of ['perfume-of-bewitching', 'pot-of-awakening', 'bead-of-refreshment', 'mystery-key', 'potion-of-comprehension', 'potion-of-watchful-rest'].filter(id => ids.includes(id))) {
      const item = completion.items.find((x: any) => x.id === id);
      assert(item.raw_data.consumable && consumableItems.has(id));
      assert.equal(item.price_cp, 5000);
      const doseWeights: Record<string,number> = {'perfume-of-bewitching':0.1,'pot-of-awakening':10,'bead-of-refreshment':0.01,'mystery-key':0.02,'potion-of-comprehension':0.5,'potion-of-watchful-rest':0.5};
      assert.equal(item.weight_lb, doseWeights[id]);
      if(id==='mystery-key') {
        assert.match(item.raw_data.rules_summary,/5% de chance/);
        assert.match(item.raw_data.rules_summary,/uma tentativa que falhe não a consome/);
        assert.match(item.raw_data.rules_summary,/somente depois do sucesso resolvido na mesa/);
      }
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
  const planarArmorFamilies = ['Antimagic Armor', 'Feywrought Armor', 'Gloomwrought Armor', 'Last Stand Armor', 'Living Armor', 'Ruidium Armor'];
  if (ids.includes('antimagic-breastplate')) {
    const planar = completion.items.filter((x: any) => planarArmorFamilies.includes(x.raw_data.magic_family));
    assert.deepEqual(planarArmorFamilies.map(f => planar.filter((x: any) => x.raw_data.magic_family === f).length), [13, 13, 13, 13, 13, 9]);
    for (const item of planar) {
      const f = item.raw_data.magic_family, facts = item.raw_data.upstream_facts;
      assert.equal(item.raw_data.attunement, f !== 'Last Stand Armor');
      assert(item.raw_data.source_edition.includes('2014'));
      assert.equal(facts.bonusAc ?? null, ['Last Stand Armor', 'Living Armor', 'Ruidium Armor'].includes(f) ? '+1' : null);
      assert.equal(item.weight_estimated, false);
      if (f === 'Antimagic Armor') {
        assert.equal(item.raw_data.upstream_source, 'BMT');
        assert.match(item.raw_data.rules_summary, /reação/);
        assert.match(item.raw_data.rules_summary, /Separadamente/);
        assert.match(item.raw_data.rules_summary, /sem componentes/);
      } else if (f === 'Feywrought Armor' || f === 'Gloomwrought Armor') {
        assert.equal(facts.charges, 3);assert.equal(facts.rechargeAmount, '{@dice 1d3}');
        assert.match(item.raw_data.rules_summary, /CD 15/);
        assert.match(item.raw_data.rules_summary, /concentração/);
      } else if (f === 'Last Stand Armor') {
        assert.equal(item.raw_data.upstream_source, 'EGW');
        assert.match(item.raw_data.rules_summary, /cada celestial, fada ou ínfero a até 30 pés/);
        assert.match(item.raw_data.rules_summary, /já estiver nesse plano/);
        assert.match(item.raw_data.rules_summary, /0 PV, por si só, não/);
      } else if (f === 'Living Armor') {
        assert.equal(item.raw_data.upstream_source, 'ERLW');
        assert.deepEqual(facts.resist, ['necrotic', 'poison', 'psychic']);
        assert.match(item.raw_data.rules_summary, /metade dos seus Dados de Vida restantes, arredondada para cima/);
        assert.match(item.raw_data.rules_summary, /não pode encerrar a sintonia voluntariamente/);
      } else {
        assert.equal(item.raw_data.upstream_source, 'CRCotN');
        assert.deepEqual(facts.resist, ['psychic']);
        assert.match(item.raw_data.rules_summary, /1 no dado de um teste de resistência/);
        assert.match(item.raw_data.rules_summary, /Carisma CD 15/);
      }
      if (!rulesReviewIds || rulesReviewIds.has(item.id)) {
        const equip = {character_id: hero.id, item_id: item.id};
        assert.equal((await request('/inventory/equipment-set', 'POST', equip)).status, 200, item.id);
        const worn = (await pool.query('SELECT slot,item_id FROM character_equipment WHERE character_id=$1 AND slot=ANY($2::text[]) ORDER BY slot', [hero.id, ['armor','head','bracers','legs','feet','shoulders']])).rows;
        assert.deepEqual(worn.map(x=>x.item_id).sort(), purchaseContents(item.id).sort(), item.id);
        assert.equal((await request('/inventory/equipment-set', 'POST', equip)).status, 200);
        assert.deepEqual((await pool.query('SELECT slot,item_id FROM character_equipment WHERE character_id=$1 AND slot=ANY($2::text[]) ORDER BY slot', [hero.id, ['armor','head','bracers','legs','feet','shoulders']])).rows, worn);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id', [hero.id])).rows, ledger);
  }
  const spellArmorFamilies = ['Armor of the Fallen', 'Mizzium Armor', 'Spell-Fueling Armor'];
  if (ids.includes('mizzium-breastplate')) {
    const specialized = completion.items.filter((x: any) => spellArmorFamilies.includes(x.raw_data.magic_family));
    assert.deepEqual(spellArmorFamilies.map(f=>specialized.filter((x: any)=>x.raw_data.magic_family===f).length), [10, 9, 12]);
    for (const item of specialized) {
      const family=item.raw_data.magic_family, facts=item.raw_data.upstream_facts;
      assert.equal(facts.bonusAc, undefined);
      assert.equal(item.weight_estimated,false);
      if (family==='Armor of the Fallen') {
        assert.equal(item.raw_data.upstream_source,'BMT');assert.equal(item.raw_data.attunement,true);
        assert(item.raw_data.source_edition.includes('2014'));
        assert.match(item.raw_data.rules_summary,/ambas compartilham uma única reserva/);
        assert.match(item.raw_data.rules_summary,/morrer enquanto estiver sintonizado/);
      } else if (family==='Mizzium Armor') {
        assert.equal(item.raw_data.upstream_source,'GGR');assert.equal(item.raw_data.attunement,false);
        assert(item.raw_data.source_edition.includes('2014'));
        assert.match(item.raw_data.rules_summary,/acerto crítico contra você se torna um acerto normal/);
        assert.match(item.raw_data.rules_summary,/efeito mágico e uma resistência de Força ou Constituição/);
      } else {
        assert.equal(item.raw_data.upstream_source,'AUD');assert.equal(item.raw_data.attunement,'by a Spellcaster');
        assert.equal(item.raw_data.source_edition,'D&D 5e (2024)');
        assert.match(item.raw_data.rules_summary,/qualquer resultado 1 em um dado de dano como 2/);
        assert.match(item.raw_data.rules_summary,/descanso curto vestindo-a/);
        assert.match(item.raw_data.rules_summary,/soma dos círculos de no máximo três/);
      }
      if (!rulesReviewIds || rulesReviewIds.has(item.id)) {
        const equip={character_id:hero.id,item_id:item.id};
        assert.equal((await request('/inventory/equipment-set','POST',equip)).status,200,item.id);
        const query='SELECT slot,item_id FROM character_equipment WHERE character_id=$1 AND slot=ANY($2::text[]) ORDER BY slot',params=[hero.id,['armor','head','bracers','legs','feet','shoulders']];
        const worn=(await pool.query(query,params)).rows;assert.deepEqual(worn.map(x=>x.item_id).sort(),purchaseContents(item.id).sort());
        assert.equal((await request('/inventory/equipment-set','POST',equip)).status,200);
        assert.deepEqual((await pool.query(query,params)).rows,worn);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  const tramontane = completion.items.filter((x:any)=>x.raw_data.magic_family==='Tramontane Armor');
  if (ids.includes('tramontane-breastplate')) {
    assert.equal(tramontane.length,8);
    for (const item of tramontane) {
      assert.equal(item.raw_data.upstream_source,'AU');assert.equal(item.raw_data.upstream_page,124);
      assert.equal(item.raw_data.upstream_facts.bonusAc,'+1');assert.equal(item.raw_data.attunement,true);
      assert.equal(item.raw_data.source_edition,'D&D 5e (2024)');assert.equal(item.weight_estimated,false);
      assert.match(item.image_path,/\.webp$/);
      assert.match(item.raw_data.rules_summary,/parecer uma veste de estudioso ou sacerdote/);
      assert.match(item.raw_data.rules_summary,/neve pesada, gelo, escombros ou vegetação rasteira/);
      assert.match(item.raw_data.rules_summary,/ação bônus/);
      assert.match(item.raw_data.rules_summary,/Força CD 15/);
      assert.match(item.raw_data.rules_summary,/CD 15 para escapar/);
      assert.match(item.raw_data.rules_summary,/puxada até 20 pés em linha reta/);
      assert.match(item.raw_data.rules_summary,/dura um minuto/);
      if (!rulesReviewIds || rulesReviewIds.has(item.id)) {
        assert.equal((await request('/inventory/equipment-set','POST',{character_id:hero.id,item_id:item.id})).status,200,item.id);
        const worn=(await pool.query('SELECT item_id FROM character_equipment WHERE character_id=$1 AND slot=ANY($2::text[])',[hero.id,['armor','head','bracers','legs','feet','shoulders']])).rows;
        assert.deepEqual(worn.map(x=>x.item_id).sort(),purchaseContents(item.id).sort());
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  const bladeFamilies = ['Forcebreaker Weapon','Sword of Vengeance','Acheron Blade','Crystal Blade','Moon-Touched Sword','Sylvan Talon',"Executioner's Axe",'Life-Sapping Blade'];
  if (ids.includes('forcebreaker-warhammer')) {
    const blades=completion.items.filter((x:any)=>bladeFamilies.includes(x.raw_data.magic_family));
    assert.deepEqual(bladeFamilies.map(f=>blades.filter((x:any)=>x.raw_data.magic_family===f).length),[11,7,6,6,6,6,4,4]);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:null,slot:'off_hand'})).status,200);
    for(const item of blades) {
      const family=item.raw_data.magic_family,facts=item.raw_data.upstream_facts,rules=item.raw_data.rules_summary;
      assert.equal(item.raw_data.magic_kind,'weapon');
      assert.equal(item.raw_data.attunement,!['Forcebreaker Weapon','Moon-Touched Sword',"Executioner's Axe"].includes(family));
      assert.equal(Number(item.raw_data.enhancement||0),family==='Forcebreaker Weapon'?2:['Crystal Blade','Moon-Touched Sword','Sylvan Talon'].includes(family)?0:1);
      assert.equal(item.raw_data.source_edition,['XDMG','AUD'].includes(facts.source)?'D&D 5e (2024)':'D&D 5e (2014)');
      if(family==='Forcebreaker Weapon') {assert.equal(facts.source,'BMT');assert.equal(facts.dmgType,'B');assert.match(rules,/estrutura de força mágica Grande ou menor/);assert.match(rules,/porção cúbica de 20 pés/);}
      if(family==='Sword of Vengeance') {assert.equal(facts.curse,true);assert.match(rules,/Sabedoria CD 15/);assert.match(rules,/desvantagem nos ataques com outras armas/);assert.equal(rules.includes('dano em combate de outra criatura'),facts.source==='XDMG');assert.match(rules,/Banimento/);}
      if(family==='Acheron Blade') {assert.equal(facts.source,'EGW');assert.match(rules,/1d4 \+ 4 PV temporários/);assert.equal((rules.match(/próximo anoitecer/g)||[]).length,2);assert.match(rules,/reserva independente/);assert.match(rules,/imune aos efeitos que expulsam mortos-vivos/);}
      if(family==='Crystal Blade') {assert.equal(facts.source,'FTD');assert.equal(facts.charges,3);assert.match(rules,/1d8 de dano radiante/);assert.match(rules,/1d3 cargas/);assert.match(rules,/PV iguais ao dano radiante adicional/);assert.match(rules,/penumbra por mais 30 pés/);}
      if(family==='Moon-Touched Sword') {assert.equal(facts.source,'XDMG');assert.match(rules,/lâmina fora da bainha/);assert.match(rules,/luz plena em 15 pés e penumbra por mais 15 pés/);}
      if(family==='Sylvan Talon') {assert.equal(facts.source,'XDMG');assert.match(rules,/comunicação não escrita de todas as fadas/);assert.match(rules,/ação de Magia/);assert.match(rules,/próximo amanhecer/);}
      if(family==="Executioner's Axe") {assert.equal(facts.source,'XDMG');assert.match(rules,/humanoide/);assert.match(rules,/2d6 de dano cortante adicional/);assert.match(rules,/PV temporários iguais ao dano adicional causado/);}
      if(family==='Life-Sapping Blade') {assert.equal(facts.source,'AUD');assert.match(rules,/2d4 de dano necrótico/);assert.match(rules,/fim do próximo turno dele/);assert.match(rules,/morre imediatamente/);assert.match(rules,/Ressurreição ou Ressurreição Verdadeira/);}
      if(!rulesReviewIds||rulesReviewIds.has(item.id)) {
        assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:item.id,slot:'main_hand'})).status,200,item.id);
        if(item.raw_data.two_handed)assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:item.id,slot:'off_hand'})).status,400,item.id);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  if (ids.includes('bead-of-refreshment')) {
    const item=(id:string)=>completion.items.find((x:any)=>x.id===id);
    assert.equal(item('charlatan-s-die').raw_data.attunement,true);
    assert.equal(item('dark-shard-amulet').raw_data.attunement,'by a warlock');
    assert.equal(item('dark-shard-amulet').weight_lb,1);assert.equal(item('dark-shard-amulet').weight_estimated,false);
    assert.match(item('dark-shard-amulet').raw_data.rules_summary,/descanso longo/);
    assert.match(item('dark-shard-amulet').raw_data.rules_summary,/Arcanismo\) CD 10/);
    assert.equal(item('horn-of-silent-alarm').weight_lb,2);assert.equal(item('horn-of-silent-alarm').weight_estimated,false);assert.equal(item('horn-of-silent-alarm').price_cp,10300);
    assert.equal(item('horn-of-silent-alarm').raw_data.upstream_facts.charges,4);
    assert.equal(item('hat-of-vermin').raw_data.upstream_facts.charges,3);
    assert.equal(item('heward-s-handy-spice-pouch').raw_data.upstream_facts.charges,10);
    assert.match(item('hat-of-vermin').raw_data.rules_summary,/não está sob seu controle/);
    assert.match(item('cleansing-stone').raw_data.rules_summary,/30,5 cm/);assert.equal(item('cleansing-stone').weight_lb,85);assert.equal(item('cleansing-stone').weight_estimated,true);
    assert.deepEqual(item('ersatz-eye').raw_data.equipment_slots,[]);assert.equal(item('ersatz-eye').raw_data.attunement,false);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:null,slot:'off_hand'})).status,200);
    for(const[id,slot]of [['breathing-bubble','head'],['charlatan-s-die','main_hand'],['coin-of-delving','off_hand'],['dark-shard-amulet','neck'],['hat-of-vermin','head'],['heward-s-handy-spice-pouch','belt'],['horn-of-silent-alarm','main_hand']])
      assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:id,slot})).status,200,id);
    for(const id of ['cleansing-stone','ersatz-eye'])
      assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:id,slot:'head'})).status,400,id);
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  if (ids.includes('staff-of-adornment')) {
    const item=(id:string)=>completion.items.find((x:any)=>x.id===id);
    const utilities=['staff-of-adornment','staff-of-birdcalls','staff-of-flowers','wand-of-smiles','veteran-s-cane','lock-of-trickery','mystery-key','rival-coin','thermal-cube','potion-of-comprehension','potion-of-watchful-rest'];
    for(const id of utilities) {
      const x=item(id),facts=x.raw_data.upstream_facts;
      assert.equal(x.raw_data.attunement,false,id);
      assert.equal(x.raw_data.source_edition,facts.source==='XDMG'?'D&D 5e (2024)':'D&D 5e (2014)',id);
      assert.equal(x.weight_estimated,['veteran-s-cane','mystery-key','rival-coin','thermal-cube','potion-of-watchful-rest'].includes(id),id);
      assert.equal(x.raw_data.consumable,['mystery-key','potion-of-comprehension','potion-of-watchful-rest'].includes(id),id);
      assert.equal(x.raw_data.two_handed,false,id);
      assert.deepEqual(x.raw_data.equipment_slots,id.startsWith('potion-')?[]:['main_hand','off_hand'],id);
    }
    for(const id of ['staff-of-adornment','staff-of-birdcalls','staff-of-flowers']) {
      const x=item(id);assert.equal(x.price_cp,10020);assert.equal(x.weight_lb,4);
      assert.equal(x.raw_data.upstream_facts.dmg1,'1d6');assert.equal(x.raw_data.upstream_facts.dmg2,'1d8');
      assert.equal(x.raw_data.upstream_facts.dmgType,'B');assert.deepEqual(x.raw_data.upstream_facts.property,['V|XPHB']);
    }
    assert.match(item('staff-of-adornment').raw_data.rules_summary,/até três objetos simultaneamente/);
    assert.match(item('staff-of-adornment').raw_data.rules_summary,/até o cajado deixar de estar em sua posse/);
    for(const id of ['staff-of-birdcalls','staff-of-flowers']) {
      assert.equal(item(id).raw_data.upstream_facts.charges,10);
      assert.match(item(id).raw_data.rules_summary,/1d6 \+ 4 cargas/);
      assert.match(item(id).raw_data.rules_summary,/última carga, role 1d20: com 1/);
    }
    assert.match(item('staff-of-birdcalls').raw_data.rules_summary,/audível a até 120 pés/);
    assert.match(item('staff-of-flowers').raw_data.rules_summary,/inofensiva e não mágica/);
    assert.equal(item('wand-of-smiles').weight_lb,1);assert.equal(item('wand-of-smiles').raw_data.upstream_source,'XGE');
    assert.match(item('wand-of-smiles').raw_data.rules_summary,/humanoide.*30 pés/);
    assert.match(item('wand-of-smiles').raw_data.rules_summary,/Carisma CD 10/);
    assert.match(item('wand-of-smiles').raw_data.rules_summary,/se transforma numa Varinha de Carrancas/);
    assert.match(item('veteran-s-cane').raw_data.rules_summary,/reversível e reutilizável/);
    assert.equal(item('lock-of-trickery').weight_lb,1);assert.equal(item('lock-of-trickery').price_cp,11000);
    assert.match(item('lock-of-trickery').raw_data.rules_summary,/Prestidigitação\) CD 15/);
    assert.match(item('lock-of-trickery').raw_data.rules_summary,/arrombamento têm desvantagem/);
    assert.equal(item('rival-coin').raw_data.upstream_facts.charges,1);
    assert.match(item('rival-coin').raw_data.rules_summary,/resultado par é cara, ímpar é coroa/);
    assert.match(item('rival-coin').raw_data.rules_summary,/Sabedoria CD 13/);
    assert.match(item('rival-coin').raw_data.rules_summary,/2d4 de dano psíquico/);
    assert.match(item('rival-coin').raw_data.rules_summary,/no sucesso, sofre apenas metade/);
    assert.match(item('rival-coin').raw_data.rules_summary,/Coroa: você sofre 1d4/);
    assert.equal(item('thermal-cube').weight_lb,2);assert.match(item('thermal-cube').raw_data.rules_summary,/35 graus Celsius/);
    assert.equal(item('potion-of-comprehension').weight_lb,0.5);assert.match(item('potion-of-comprehension').raw_data.rules_summary,/Compreender Idiomas.*2024/);
    assert.match(item('potion-of-watchful-rest').raw_data.rules_summary,/oito horas/);
    assert.match(item('potion-of-watchful-rest').raw_data.rules_summary,/Não tem efeito em criaturas que não precisam dormir/);
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:null,slot:'off_hand'})).status,200);
    for(const id of utilities.filter(id=>!item(id).raw_data.consumable)) {
      if(!rulesReviewIds||rulesReviewIds.has(id))assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:id,slot:'main_hand'})).status,200,id);
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  const swordUtilityFamilies=['Blade of the Medusa','Bloodshed Blade',"Fool's Blade","Gambler's Blade",'Mind Blade','Polymorph Blade','Sword of Retribution','Sword of the Planes'];
  if(ids.includes('greatsword-of-the-medusa')) {
    const swords=completion.items.filter((x:any)=>swordUtilityFamilies.includes(x.raw_data.magic_family));
    assert.equal(swords.length,48);for(const family of swordUtilityFamilies)assert.equal(swords.filter((x:any)=>x.raw_data.magic_family===family).length,6);
    const bonuses:Record<string,number>={"Fool's Blade":2,'Sword of Retribution':3,'Sword of the Planes':3};
    assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:null,slot:'off_hand'})).status,200);
    for(const x of swords) {
      const family=x.raw_data.magic_family,f=x.raw_data.upstream_facts,r=x.raw_data.rules_summary;
      assert.equal(x.raw_data.magic_kind,'weapon');assert.equal(x.raw_data.source_edition,'D&D 5e (2014)');
      assert.equal(x.raw_data.attunement,family==='Mind Blade'?'by a specific individual':true);
      assert.equal(Number(x.raw_data.enhancement||0),bonuses[family]||0);
      assert.equal(x.weight_lb,f.weight);assert.equal(x.weight_estimated,false);
      assert.equal(f.curse===true,['Blade of the Medusa',"Gambler's Blade",'Polymorph Blade','Sword of Retribution'].includes(family));
      if(family==='Blade of the Medusa') {assert.equal(f.source,'LLK');assert.match(r,/20 natural/);assert.match(r,/Constituição CD 15/);assert.match(r,/Três sucessos encerram/);assert.match(r,/três falhas/);assert.match(r,/ações lendárias/);assert.match(r,/1 natural/);}
      if(family==='Bloodshed Blade') {assert.equal(f.source,'BGG');assert.equal(f.bonusWeaponDamage,'+1');assert.match(x.image_path,/\.webp$/);assert.match(r,/cornalina.*punho/);assert.match(r,/modificador de Constituição, com mínimo de \+1/);assert.match(r,/depois de rolar o d20/);assert.match(r,/se esse ataque acertar/i);assert.match(r,/qualquer quantidade dos seus dados de vida ainda não gastos/);assert.match(r,/próximo amanhecer/);}
      if(family==="Fool's Blade") {assert.equal(f.source,'BMT');assert.match(r,/aparência comum/);assert.match(r,/Inteligência CD 15/);assert.match(r,/alcance \(reach\) do atacante/);assert.match(r,/reserva é independente da finta/);}
      if(family==="Gambler's Blade") {assert.equal(f.source,'LLK');assert.match(r,/bônus mágico de \+1, \+2 ou \+3/);assert.match(r,/-1, -2 ou -3/);assert.match(r,/mudar o bônus a cada amanhecer/);assert.match(r,/cadastro não fixa/);}
      if(family==='Mind Blade') {assert.equal(f.source,'VGM');assert.match(r,/Somente uma criatura específica/);assert.match(r,/qualquer outra criatura.*espada comum/);assert.match(r,/2d6 de dano psíquico adicional a qualquer alvo/);}
      if(family==='Polymorph Blade') {assert.equal(f.source,'LLK');assert.match(r,/Sabedoria CD 15/);assert.match(r,/metamorfo \(shapechanger\)/);assert.match(r,/1 tiranossauro.*20 coelho/);assert.match(r,/1 natural.*por uma hora/);}
      if(family==='Sword of Retribution') {assert.equal(f.source,'CoA');assert.match(r,/só podem ser recuperados por descanso curto ou longo/);assert.match(r,/Constituição CD 11/);assert.match(r,/Só Remover Maldição permite encerrar esta sintonia/);assert.match(r,/corrupção infernal/);assert.match(r,/vantagem para tieflings/);assert.match(r,/a partir do segundo estágio/);}
      if(family==='Sword of the Planes') {assert.equal(f.source,'BMT');assert.match(r,/plano diferente/);assert.match(r,/espaço desocupado a até cinco pés/);assert.match(r,/dez pés de altura e dez pés de largura/);assert.match(r,/critério do mestre/);assert.match(r,/espaço desocupado mais próximo da fenda/);}
      if(!rulesReviewIds||rulesReviewIds.has(x.id)) {
        assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:x.id,slot:'main_hand'})).status,200,x.id);
        if(x.raw_data.two_handed)assert.equal((await request('/inventory/equipment','POST',{character_id:hero.id,item_id:x.id,slot:'off_hand'})).status,400,x.id);
      }
    }
    assert.deepEqual((await pool.query('SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',[hero.id])).rows,ledger);
  }
  const planarFoci = completion.items.filter((x: any) =>
    /^(Imbued Wood|Orb of Shielding) \(/.test(x.raw_data.magic_family || ''),
  );
  if (ids.includes('fernian-ash-rod')) {
    assert.equal(planarFoci.length, 40);
    const families = new Set(planarFoci.map((x: any) => x.raw_data.magic_family));
    assert.equal(families.size, 16);
    const shapes: Record<string, [number, number]> = {
      rod: [2, 11000], staff: [4, 10500], wand: [1, 11000],
      crystal: [1, 11000], orb: [3, 12000],
    };
    for (const family of families)
      assert.equal(planarFoci.filter((x: any) => x.raw_data.magic_family === family).length,
        String(family).startsWith('Imbued Wood') ? 3 : 2);
    for (const item of planarFoci) {
      const raw = item.raw_data, facts = raw.upstream_facts, rules = raw.rules_summary;
      const wood = raw.magic_family.startsWith('Imbued Wood');
      assert.equal(facts.source, 'ERLW'); assert.equal(facts.page, wood ? 277 : 278);
      assert.equal(raw.source_edition, 'D&D 5e (2014)'); assert.equal(raw.attunement, true);
      assert.equal(raw.enhancement, undefined); assert.equal(raw.magic_kind, undefined);
      assert.equal(raw.consumable, false); assert.equal(raw.two_handed, false);
      assert.deepEqual(raw.equipment_slots, ['main_hand', 'off_hand']);
      assert.equal(item.weight_lb, shapes[raw.base_item][0]);
      assert.equal(item.weight_estimated, false);
      assert.equal(item.price_cp, shapes[raw.base_item][1]);
      assert.match(rules, /foco de conjuração/);
      if (wood) {
        assert.equal(facts.bonusSpellDamage, '+1');
        assert.match(rules, /bônus de \+1 em uma única rolagem de dano dessa magia/);
        assert.match(rules, /não aumenta jogadas de ataque nem CDs de resistência/);
      } else {
        assert.match(rules, /Enquanto a segura, quando você sofre dano/);
        assert.match(rules, /sua reação para reduzir esse dano em 1d4, até o mínimo de zero/);
        assert.match(rules, /não concede resistência permanente ou imunidade/);
        assert.match(rules, /esfera polida, inclusive na versão chamada Cristal/);
      }
      if (!rulesReviewIds || rulesReviewIds.has(item.id))
        for (const slot of ['main_hand', 'off_hand']) {
          // One owned focus cannot occupy both hands at once. Release the
          // previous hand before checking its other compatible position.
          assert.equal((await request('/inventory/equipment', 'POST',
            { character_id: hero.id, item_id: null, slot: 'main_hand' })).status, 200);
          assert.equal((await request('/inventory/equipment', 'POST',
            { character_id: hero.id, item_id: null, slot: 'off_hand' })).status, 200);
          assert.equal((await request('/inventory/equipment', 'POST',
            { character_id: hero.id, item_id: item.id, slot })).status, 200, item.id);
        }
    }
    assert.deepEqual((await pool.query(
      'SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
      [hero.id],
    )).rows, ledger);
  }
  if (ids.includes('wand-sheath')) {
    const item = (id: string) => completion.items.find((x: any) => x.id === id);
    const utilities = [
      'common-glamerweave',
      'everbright-lantern',
      'keycharm',
      'scribe-s-pen',
      'shiftweave',
      'spellshard',
      'wand-sheath',
    ];
    const expectedSlots: Record<string, string[]> = {
      'common-glamerweave': ['armor'],
      shiftweave: ['armor'],
      'wand-sheath': ['bracers'],
      'everbright-lantern': ['main_hand', 'off_hand'],
      keycharm: ['main_hand', 'off_hand'],
      'scribe-s-pen': ['main_hand', 'off_hand'],
      spellshard: ['main_hand', 'off_hand'],
    };
    const attunement: Record<string, string | boolean> = {
      keycharm: 'by a creature with the Mark of Warding',
      'scribe-s-pen': 'by a creature with the Mark of Scribing',
      'wand-sheath': 'by a warforged',
    };
    for (const id of utilities) {
      const x = item(id),
        f = x.raw_data.upstream_facts;
      assert.equal(f.source, 'ERLW');
      assert.equal(f.rarity, 'common');
      assert.equal(f.wondrous, true);
      assert.equal(x.raw_data.source_edition, 'D&D 5e (2014)');
      assert.equal(x.raw_data.attunement, attunement[id] || false);
      assert.equal(x.price_cp, 10000);
      assert.equal(x.weight_estimated, true);
      assert.equal(f.weight, undefined);
      assert.equal(f.charges, undefined);
      assert.equal(x.raw_data.magic_kind, undefined);
      assert.equal(x.raw_data.enhancement, undefined);
      assert.equal(x.raw_data.consumable, false);
      assert.equal(consumableItems.has(id), false);
      assert.deepEqual(x.raw_data.equipment_slots, expectedSlots[id]);
      assert.deepEqual(purchaseContents(id), [id]);
      assert.equal(armorBundle(id), undefined);
      assert.equal(
        (
          await pool.query('SELECT quantity FROM inventory WHERE character_id=$1 AND item_id=$2', [
            hero.id,
            id,
          ])
        ).rows[0].quantity,
        1,
        id,
      );
      if (!rulesReviewIds || rulesReviewIds.has(id))
        for (const slot of expectedSlots[id]) {
          for (const hand of ['main_hand', 'off_hand'])
            assert.equal(
              (
                await request('/inventory/equipment', 'POST', {
                  character_id: hero.id,
                  item_id: null,
                  slot: hand,
                })
              ).status,
              200,
            );
          assert.equal(
            (
              await request('/inventory/equipment', 'POST', {
                character_id: hero.id,
                item_id: id,
                slot,
              })
            ).status,
            200,
            id,
          );
        }
    }
    assert.match(
      item('common-glamerweave').raw_data.rules_summary,
      /ação bônus.*padrão ilusório.*dentro do tecido/,
    );
    assert.deepEqual(item('everbright-lantern').raw_data.upstream_facts.light, [
      { bright: 60, dim: 120, shape: 'cone' },
    ]);
    assert.match(
      item('everbright-lantern').raw_data.rules_summary,
      /cone de 120 pés.*primeiros 60 pés.*60 pés seguintes/,
    );
    assert.match(
      item('keycharm').raw_data.rules_summary,
      /Alarme, Tranca Arcana ou Glifo de Proteção/,
    );
    assert.match(item('keycharm').raw_data.rules_summary, /até três magias vinculadas/);
    assert.match(
      item('keycharm').raw_data.rules_summary,
      /mesmo sem sintonia.*ação.*encerrar uma.*palavra de comando/,
    );
    assert.match(item('scribe-s-pen').raw_data.rules_summary, /sempre é visível.*essa marca/);
    assert.match(item('scribe-s-pen').raw_data.rules_summary, /não seja um constructo.*sete dias/);
    assert.match(item('shiftweave').raw_data.rules_summary, /até cinco roupas diferentes/);
    assert.match(item('shiftweave').raw_data.rules_summary, /ação bônus/);
    assert.match(item('shiftweave').raw_data.rules_summary, /predefinidos na criação/);
    assert.match(item('spellshard').raw_data.rules_summary, /320 páginas/);
    assert.match(item('spellshard').raw_data.rules_summary, /frase-senha/);
    assert.match(
      item('spellshard').raw_data.rules_summary,
      /concentração como numa magia.*tempo normal/,
    );
    assert.match(item('spellshard').raw_data.rules_summary, /custos normais de ouro e tempo/);
    assert.match(item('wand-sheath').raw_data.rules_summary, /ação bônus.*estende ou recolhe/);
    assert.match(
      item('wand-sheath').raw_data.rules_summary,
      /um único item para o limite de sintonia/,
    );
    assert.match(
      item('wand-sheath').raw_data.rules_summary,
      /Remover a varinha encerra a sintonia com ela/,
    );
    assert.match(item('wand-sheath').raw_data.rules_summary, /não inclui uma varinha/);
    for (const id of ['common-glamerweave', 'shiftweave'])
      assert.equal(
        (
          await request('/inventory/equipment', 'POST', {
            character_id: hero.id,
            item_id: id,
            slot: 'head',
          })
        ).status,
        400,
        id,
      );
    assert.deepEqual(
      (
        await pool.query(
          'SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
          [hero.id],
        )
      ).rows,
      ledger,
    );
  }
  if (ids.includes('vox-seeker')) {
    const item = (id: string) => completion.items.find((x: any) => x.id === id);
    const expected: Record<string, [string, string[], number]> = {
      'adventurer-s-ring': ['FRHoF', ['ring_left', 'ring_right'], 0.05],
      'bottle-of-boundless-coffee': ['SCC', ['main_hand', 'off_hand'], 1],
      'cartographer-s-map-case': ['AI', [], 1],
      'chest-of-preserving': ['WDMM', [], 25],
      'earring-of-message': ['CRCotN', [], 0.02],
      'orb-of-gonging': ['WDMM', ['main_hand', 'off_hand'], 5],
      'pressure-capsule': ['GoS', [], 0.05],
      'sekolahian-worshiping-statuette': ['GoS', [], 4],
      'spyglass-of-clairvoyance': ['AI', ['main_hand', 'off_hand'], 1],
      'vox-seeker': ['EGW', [], 5],
    };
    for (const [id, [source, slots, weight]] of Object.entries(expected)) {
      const x = item(id);
      assert.equal(x.raw_data.upstream_source, source, id);
      assert.equal(x.raw_data.attunement, false, id);
      assert.deepEqual(x.raw_data.equipment_slots, slots, id);
      assert.equal(x.weight_lb, weight, id);
      assert.equal(
        x.weight_estimated,
        !['chest-of-preserving', 'orb-of-gonging'].includes(id),
        id,
      );
      assert.deepEqual(purchaseContents(id), [id]);
      assert.equal(armorBundle(id), undefined);
      assert.equal(x.raw_data.consumable, id === 'pressure-capsule');
      assert.equal(x.price_cp, id === 'pressure-capsule' ? 5000 : 10000);
      if (!rulesReviewIds || rulesReviewIds.has(id))
        for (const slot of slots) {
          for (const s of slots)
            assert.equal(
              (
                await request('/inventory/equipment', 'POST', {
                  character_id: hero.id,
                  item_id: null,
                  slot: s,
                })
              ).status,
              200,
            );
          assert.equal(
            (
              await request('/inventory/equipment', 'POST', {
                character_id: hero.id,
                item_id: id,
                slot,
              })
            ).status,
            200,
            id,
          );
        }
    }
    assert.equal(
      item('adventurer-s-ring').raw_data.source_edition,
      'D&D 5e (2024)',
    );
    assert.match(
      item('adventurer-s-ring').raw_data.rules_summary,
      /20 pés.*mais 20 pés/,
    );
    assert.match(item('adventurer-s-ring').raw_data.rules_summary, /ação bônus/);
    assert.match(
      item('bottle-of-boundless-coffee').raw_data.rules_summary,
      /d20: com 1.*uma hora/,
    );
    assert.match(
      item('bottle-of-boundless-coffee').raw_data.rules_summary,
      /despejado.*desaparece/,
    );
    assert.match(
      item('cartographer-s-map-case').raw_data.rules_summary,
      /grau 3 da franquia/,
    );
    assert.match(
      item('cartographer-s-map-case').raw_data.rules_summary,
      /Percepção\) CD 15/,
    );
    assert.match(
      item('cartographer-s-map-case').raw_data.rules_summary,
      /tempo de viagem cai à metade/,
    );
    assert.match(
      item('cartographer-s-map-case').raw_data.rules_summary,
      /descanso longo/,
    );
    assert.match(
      item('cartographer-s-map-case').raw_data.rules_summary,
      /sete dias depois/,
    );
    assert.match(
      item('chest-of-preserving').raw_data.rules_summary,
      /Destreza CD 15/,
    );
    assert.match(
      item('chest-of-preserving').raw_data.rules_summary,
      /qualquer parte.*elimina a magia/,
    );
    assert.equal(item('earring-of-message').raw_data.upstream_facts.charges, 5);
    assert.match(
      item('earring-of-message').raw_data.rules_summary,
      /ação e 1 carga/,
    );
    assert.match(
      item('earring-of-message').raw_data.rules_summary,
      /1d4 \+ 1.*amanhecer/,
    );
    assert.match(
      item('orb-of-gonging').raw_data.rules_summary,
      /a cada 6 segundos.*600 pés/,
    );
    assert.match(
      item('pressure-capsule').raw_data.rules_summary,
      /superiores a 100 pés/,
    );
    assert.match(
      item('pressure-capsule').raw_data.rules_summary,
      /não informa uma duração numérica/,
    );
    assert.match(
      item('sekolahian-worshiping-statuette').raw_data.rules_summary,
      /animal marinho Minúsculo.*1 polegada/,
    );
    assert.match(
      item('sekolahian-worshiping-statuette').raw_data.rules_summary,
      /uma vez por hora/,
    );
    assert.match(
      item('spyglass-of-clairvoyance').raw_data.rules_summary,
      /grau 2 da franquia/,
    );
    assert.match(
      item('spyglass-of-clairvoyance').raw_data.rules_summary,
      /Sabedoria CD 15 usando ferramentas/,
    );
    assert.match(
      item('spyglass-of-clairvoyance').raw_data.rules_summary,
      /3 milhas/,
    );
    assert.match(
      item('spyglass-of-clairvoyance').raw_data.rules_summary,
      /Não revela criaturas, estruturas/,
    );
    assert.match(
      item('vox-seeker').raw_data.rules_summary,
      /Cada ação.*1 minuto.*10 minutos/,
    );
    assert.match(item('vox-seeker').raw_data.rules_summary, /controle do mestre/);
    assert.match(item('vox-seeker').raw_data.rules_summary, /0 PV, é destruído/);
    assert.deepEqual(
      (
        await pool.query(
          'SELECT item_id,quantity,total_cp FROM purchases WHERE character_id=$1 ORDER BY item_id',
          [hero.id],
        )
      ).rows,
      ledger,
    );
  }
  console.log(
    `PASS ${completion.items.length} reviewed source/media records and ${ids.length} standard purchases: ${rulesReviewIds?.size ?? completion.items.length} source descriptions, exact equipment, all old catalog rows unchanged, persistent admin price, purchase replay/ledger/gold. Bound-spell fulfillment has its own isolated test.`,
  );
} finally {
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}

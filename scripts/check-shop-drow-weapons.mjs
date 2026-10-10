import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const dir = 'data/shop-magic-completion-20261009';
const catalog = JSON.parse(await fs.readFile(dir + '/catalog.json'));
const candidates = JSON.parse(await fs.readFile(dir + '/candidates.json')).items;
const old = JSON.parse(
  execFileSync('git', ['show', 'HEAD:' + dir + '/catalog.json'], { maxBuffer: 64 * 1024 * 1024 }),
);
for (const item of old.items)
  assert.deepEqual(
    catalog.items.find((x) => x.id === item.id),
    item,
    item.id,
  );
const weapons = catalog.items.filter((x) => x.raw_data.magic_family === 'Drow Weapon');
assert.equal(weapons.length, 153);
for (let bonus = 1; bonus <= 3; bonus++) {
  const rows = weapons.filter((x) => x.raw_data.enhancement === bonus);
  assert.equal(rows.length, 51);
  for (const item of rows) {
    const c = candidates.find((x) => x.id === item.id),
      r = item.raw_data;
    assert.equal(c.family, `Drow +${bonus} Weapon`);
    assert.equal(c.facts.source, 'MM');
    assert.equal(c.facts.page, 126);
    assert.equal(c.facts.bonusWeapon, '+' + bonus);
    assert.equal(r.rarity, 'unknown (magic)');
    assert.equal(r.attunement, false);
    assert.equal(r.spell_binding, undefined);
    assert.equal(r.pricing_estimated, true);
    assert.match(r.price_basis, /Estimativa.*raridade não informada/);
    assert.equal(item.price_cp, [40000, 400000, 4000000][bonus - 1] + (c.base.value ?? 0));
    assert.match(item.description, /Valor estimado pelo Empório/);
    assert.match(r.rules_summary, /perde permanentemente esse bônus/);
    assert.match(r.rules_summary, /uma hora ou mais/);
    assert.match(r.rules_summary, /Não exige sintonia/);
    assert.match(r.rules_summary, /não é um preço oficial/);
    const physical = catalog.items.find(
      (x) =>
        x.raw_data.magic_family === 'Enspelled Weapon (Cantrip)' &&
        x.raw_data.base_item === r.base_item,
    );
    assert(physical, item.id);
    assert.deepEqual(r.equipment_slots, physical.raw_data.equipment_slots);
    assert.equal(r.two_handed, physical.raw_data.two_handed);
    assert.equal(item.weight_lb, physical.weight_lb);
    assert(
      r.rules_summary.startsWith(physical.raw_data.rules_summary.split(' Exige sintonia.')[0]),
      item.id,
    );
  }
}
console.log(
  'PASS all 153 Drow source facts, sunlight limitation, honest valuation and physical properties; every previously published item remains exactly equal.',
);

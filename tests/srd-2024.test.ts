import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { races, classes } from '../shared/rules.js';
import {
  defaultChoices,
  validateChoices,
  deriveSheet,
  backgroundRules,
  raceRules,
  normalizeOptions,
  spellOptions,
  startingGold,
  sheetAttacks,
  originFeats,
} from '../shared/character-sheet.js';
import { pool } from '../server/db.js';

test('SRD 5.2.1: espécies, classes, antecedentes e linhagens válidos', () => {
  for (const race of races)
    for (const cls of classes)
      for (const bg of Object.keys(backgroundRules))
        for (const lineage of raceRules[race].variants) {
          let c = defaultChoices(race, cls, bg);
          c = normalizeOptions(race, cls, { ...c, subrace: lineage });
          assert.doesNotThrow(
            () => validateChoices(race, cls, c),
            race + '/' + cls + '/' + bg + '/' + lineage,
          );
          const d = deriveSheet({ race, class: cls, stats: [10, 14, 12, 8, 16, 14], level: 1 }, c);
          assert.ok(Number.isFinite(d.hp) && d.hp > 0);
          assert.ok(d.speed > 0);
          assert.equal(
            c.abilityBoosts.reduce((a, b) => a + b),
            3,
          );
        }
  for (const feat of originFeats) {
    let c = defaultChoices('Humano', 'Guerreiro', 'Soldado');
    if (feat === 'Atacante Selvagem') continue;
    c = normalizeOptions('Humano', 'Guerreiro', {
      ...c,
      options: { ...c.options, humanFeat: [feat] },
    });
    if (feat === 'Habilidoso') {
      c.options.skilled1 = ['Medicina', 'Natureza', 'Religião'];
    }
    assert.doesNotThrow(() => validateChoices('Humano', 'Guerreiro', c));
  }
});
test('SRD 5.2.1: cálculos, magias e restrições revisadas', () => {
  const stats = [10, 14, 12, 8, 16, 14];
  const make = (race: string, cls: string, bg = 'Soldado') =>
    deriveSheet({ race, class: cls, stats, level: 1 }, defaultChoices(race, cls, bg));
  assert.equal(make('Orc', 'Monge').hp, 9);
  assert.equal(make('Orc', 'Monge').armorClass, 15);
  assert.equal(make('Anão', 'Feiticeiro').hp, 8);
  assert.equal(make('Orc', 'Feiticeiro').armorClass, 12);
  assert.equal(make('Orc', 'Clérigo').prepareCount, 4);
  assert.equal(make('Orc', 'Mago').prepareCount, 4);
  assert.equal(make('Orc', 'Paladino').slots, 2);
  assert.equal(make('Orc', 'Patrulheiro').slots, 2);
  assert.deepEqual(make('Orc', 'Patrulheiro').alwaysPrepared, ['hunters-mark']);
  assert.equal(make('Orc', 'Guerreiro', 'Criminoso').initiative, 4);
  assert.ok(!spellOptions('Bruxo', 1).some((s) => s.id === 'burning-hands'));
  assert.ok(spellOptions('Bruxo', 1).some((s) => s.id === 'hex'));
  assert.ok(spellOptions('Feiticeiro', 0).some((s) => s.id === 'sorcerous-burst'));
  assert.equal(startingGold('Guerreiro', defaultChoices('Orc', 'Guerreiro')), 1200);
  const c = defaultChoices('Orc', 'Guerreiro');
  c.equipment.package = ['Ouro da classe'];
  c.equipment.background = ['50 PO'];
  assert.equal(startingGold('Guerreiro', c), 20500);
  assert.throws(() => validateChoices('Orc', 'Guerreiro', { ...c, version: 1 }));
  assert.throws(() =>
    validateChoices('Orc', 'Guerreiro', { ...c, abilityBoosts: [2, 1, 0, 0, 0, 0] }),
  );
  const rogue = defaultChoices('Elfo', 'Ladino');
  assert.throws(() =>
    validateChoices('Elfo', 'Ladino', {
      ...rogue,
      expertise: ['Ferramentas de ladrão', 'Percepção'],
    }),
  );
  const monk = defaultChoices('Orc', 'Monge');
  assert.equal(
    sheetAttacks('Orc', 'Monge', stats, monk).find((w) => w.name === 'Adaga')?.dice,
    '1d6',
  );
});
test('migration 025: arquiva fichas, conserva dados rolados e bens sem alterar espécie', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const schema = 'srd_test_' + randomUUID().replaceAll('-', '');
    await client.query('CREATE SCHEMA ' + schema);
    await client.query('SET LOCAL search_path TO ' + schema);
    await client.query('CREATE TABLE "user" (id text PRIMARY KEY)');
    await client.query(await readFile('db/migrations/002_world.sql', 'utf8'));
    await client.query(await readFile('db/migrations/019_character_sheets.sql', 'utf8'));
    await client.query('INSERT INTO "user" VALUES(\'test\')');
    const {
      rows: [c],
    } = await client.query(
      "INSERT INTO characters(user_id,name,race,class,hp,gold_cp) VALUES('test','Antigo','Meio-elfo','Mago',8,9876) RETURNING *",
    );
    const rolls = Array(6).fill([6, 5, 4, 3]);
    await client.query(
      "INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,notes) VALUES($1,'{\"version\":1}',$2,'[0,1,2,3,4,5]',now(),'Memória preservada')",
      [c.id, JSON.stringify(rolls)],
    );
    await client.query(await readFile('db/migrations/025_srd_2024.sql', 'utf8'));
    const fresh = (await client.query('SELECT * FROM characters WHERE id=$1', [c.id])).rows[0];
    assert.equal(fresh.gold_cp, 9876);
    assert.equal(fresh.race, 'Meio-elfo');
    assert.equal(fresh.starting_wealth_granted, true);
    const sheet = (
      await client.query('SELECT * FROM character_sheets WHERE character_id=$1', [c.id])
    ).rows[0];
    assert.deepEqual(sheet.rolls, rolls);
    assert.equal(sheet.choices, null);
    assert.equal(sheet.finalized_at, null);
    assert.equal(sheet.notes, 'Memória preservada');
    const archived = (
      await client.query('SELECT * FROM character_sheet_legacy_snapshots WHERE character_id=$1', [
        c.id,
      ])
    ).rows[0];
    assert.equal(archived.sheet_data.choices.version, 1);
    assert.ok(archived.sheet_data.finalized_at);
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});

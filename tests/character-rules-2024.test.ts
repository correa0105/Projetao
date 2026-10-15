import { test } from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../shared/character-rules-2024.json';
import originalSpells from '../shared/srd-2024-spells.json';
import { classes, races } from '../shared/rules.js';
import {
  defaultChoices,
  validateChoices,
  deriveSheet,
  backgroundRules,
  spells,
} from '../shared/character-sheet.js';
import {
  classProfile,
  defaultAdvanceChoice,
  levelPlan,
  validateAdvance,
  combinedSlots,
  subclassRules,
} from '../shared/character-advancement.js';
import { featureSummaries } from '../shared/class-advancement-text.js';
import { originFixture, legalAdvance, advanceFixture } from './advancement-fixtures.js';
for (const entry of catalog.subclasses)
  test(entry.class + ' / ' + entry.name + ': escolhas e ficha até 20', () => {
    const { character, choices } = originFixture(entry.class);
    for (let n = 2; n <= 20; n++) {
      const next = legalAdvance(character, choices, entry.class, entry.id);
      const sheet = advanceFixture(character, choices, next);
      assert.equal(sheet.classLevels[0].subclass, n >= 3 ? entry.id : '');
      assert.equal(sheet.pendingLevels, 0);
      assert.ok(Number.isFinite(sheet.hp) && sheet.hp > 0);
      assert.ok(sheet.saves.every(Number.isFinite));
      assert.ok(sheet.skills.every((s) => Number.isFinite(s.value)));
      assert.ok(
        !sheet.featureGroups.class.some((f) => f.includes('obtida no nível')),
        sheet.featureGroups.class.join('\n'),
      );
      const p = classProfile(entry.class, n, entry.id);
      for (const raw of p.features.split(',').map((v) => v.trim()))
        if (raw && raw !== '—' && !/Subclass/i.test(raw)) assert.ok(featureSummaries[raw], raw);
      if (entry.casting && n >= 3) {
        const magic = sheet.magicClasses.find((m) => m.class === entry.class)!;
        assert.equal(magic.ability, entry.casting.ability);
        assert.deepEqual(sheet.slotsByLevel, p.slots);
        assert.equal(
          magic.known.filter((id) => spells.find((s) => s.id === id)?.level !== 0).length,
          p.prepareCount,
        );
      }
      const extra = (entry as { extraAttack?: number }).extraAttack;
      if (extra && n >= extra) assert.ok(sheet.attacksPerAction >= 2);
      for (const [lv, features] of Object.entries(
        subclassRules[entry.class].find((s) => s.id === entry.id)!.features,
      ))
        if (Number(lv) <= n)
          for (const f of features) assert.ok(sheet.featureGroups.class.includes(f));
    }
  });
test('fontes atuais e IDs de magia preservados', () => {
  assert.equal(classes.length, 13);
  assert.equal(catalog.subclasses.length, 76);
  assert.equal(new Set(catalog.subclasses.map((s) => s.class + '/' + s.id)).size, 76);
  for (const sub of catalog.subclasses) {
    assert.equal(sub.edition, '2024');
    assert.ok(catalog.books.some((b) => b.id === sub.source && b.published <= catalog.asOf));
  }
  for (const old of originalSpells.spells)
    assert.ok(spells.some((s) => s.id === old.id && s.level === old.level));
});
test('Artífice: criação em todas as espécies e antecedentes, Consertar adicional e sintonia', () => {
  for (const race of races)
    for (const bg of Object.keys(backgroundRules))
      validateChoices(race, 'Artífice', defaultChoices(race, 'Artífice', bg));
  const a = originFixture('Artífice'),
    d = deriveSheet(a.character, a.choices);
  assert.equal(d.spellAbility, 3);
  assert.equal(d.hp, 10);
  assert.equal(d.cantrips.length, 3);
  assert.ok(d.cantrips.includes('mending'));
  assert.ok(d.proficiencies.includes('Ferramentas de funileiro'));
  assert.equal(d.prepareCount, 2);
});
test('conjuradores parciais: arredondamento na multiclasse e listas distintas', () => {
  for (const [cls, id, list, ability] of [
    ['Guerreiro', 'eldritch-knight', 'wizard', 3],
    ['Ladino', 'arcane-trickster', 'wizard', 3],
    ['Monge', 'mystic-arts', 'sorcerer', 4],
  ] as const) {
    const a = originFixture(cls);
    for (let n = 2; n <= 5; n++)
      advanceFixture(a.character, a.choices, legalAdvance(a.character, a.choices, cls, id));
    advanceFixture(a.character, a.choices, legalAdvance(a.character, a.choices, 'Mago'));
    assert.deepEqual(combinedSlots(a.character, a.choices), [3, 0, 0, 0, 0, 0, 0, 0, 0]);
    const p = classProfile(cls, 5, id);
    assert.equal(p.ability, ability);
    assert.equal(p.spellList, list);
  }
});
test('validação recusa escolhas de outra subclasse e magia acima do círculo', () => {
  const a = originFixture('Guerreiro');
  advanceFixture(a.character, a.choices, legalAdvance(a.character, a.choices));
  const next = legalAdvance(a.character, a.choices, 'Guerreiro', 'battle-master');
  assert.equal(next.choices.maneuvers.length, 3);
  assert.throws(() =>
    validateAdvance(a.character, a.choices, {
      ...next,
      choices: { ...next.choices, maneuvers: ['Desejo', 'Desejo', 'Desejo'] },
    }),
  );
  assert.throws(() =>
    validateAdvance(a.character, a.choices, { ...next, subclass: 'champion' }),
  );
  const ek = legalAdvance(a.character, a.choices, 'Guerreiro', 'eldritch-knight');
  assert.throws(() =>
    validateAdvance(a.character, a.choices, {
      ...ek,
      newSpells: ['wish', ...ek.newSpells.slice(1)],
    }),
  );
});

test('troca de magia/truque/plano preserva quantidade, filtra origem e impede duas trocas do mesmo tipo', () => {
  const a = originFixture('Feiticeiro');
  const next = legalAdvance(a.character, a.choices);
  const plan = levelPlan(a.character, a.choices, next);
  const options = plan.retraining.find((v) => v.kind === 'spell')!;
  const to = options.to.find((id) => !next.newSpells.includes(id))!;
  next.retrain = [{ kind: 'spell', from: options.from[0], to }];
  const d = advanceFixture(a.character, a.choices, next);
  assert.ok(d.magicClasses[0].known.includes(to));
  assert.ok(!d.magicClasses[0].known.includes(options.from[0]));
  const second = legalAdvance(a.character, a.choices);
  second.retrain = [{ kind: 'spell', from: to, to: 'wish' }];
  assert.throws(() => validateAdvance(a.character, a.choices, second));
  const b = originFixture('Artífice');
  advanceFixture(b.character, b.choices, legalAdvance(b.character, b.choices));
  const bn = legalAdvance(b.character, b.choices);
  const bp = levelPlan(b.character, b.choices, bn).retraining.find((v) => v.kind === 'plan')!;
  bn.retrain = [{ kind: 'plan', from: bp.from[0], to: bp.to[0] }];
  const bd = advanceFixture(b.character, b.choices, bn);
  assert.equal(bd.classLevels[0].choices.plans.length, 4);
  assert.ok(!bd.classLevels[0].choices.plans.includes(bp.from[0]));
  const duplicate = { ...bn, retrain: [...bn.retrain, ...bn.retrain] };
  assert.throws(() => validateAdvance(b.character, b.choices, duplicate));
});

test('passivos: salvaguarda do Predador Sombrio, especialização do Conhecimento e CA da Dança', () => {
  const a = originFixture('Patrulheiro');
  for (let n = 2; n <= 7; n++)
    advanceFixture(
      a.character,
      a.choices,
      legalAdvance(a.character, a.choices, 'Patrulheiro', 'gloom-stalker'),
    );
  const d = deriveSheet(a.character, a.choices);
  assert.equal(d.saves[4], 5);
  const multi = originFixture('Mago');
  for (let n = 1; n <= 7; n++)
    advanceFixture(
      multi.character,
      multi.choices,
      legalAdvance(multi.character, multi.choices, 'Patrulheiro', 'gloom-stalker'),
    );
  const md = deriveSheet(multi.character, multi.choices);
  assert.equal(md.classLevels[1].choices.subSave[0], 'Carisma');
  assert.equal(md.saves[5], 5);
  const k = originFixture('Clérigo');
  for (let n = 2; n <= 3; n++)
    advanceFixture(
      k.character,
      k.choices,
      legalAdvance(k.character, k.choices, 'Clérigo', 'knowledge'),
    );
  for (const name of k.choices.advancement!.levels.at(-1)!.choices.knowledgeSkills) {
    const s = deriveSheet(k.character, k.choices).skills.find((s) => s.name === name)!;
    assert.ok(s.trained && s.expert);
    assert.equal(s.value, 6);
  }
  const b = originFixture('Bardo');
  for (let n = 2; n <= 3; n++)
    advanceFixture(
      b.character,
      b.choices,
      legalAdvance(b.character, b.choices, 'Bardo', 'dance'),
    );
  assert.equal(deriveSheet(b.character, b.choices).unarmored, 14);
});

test('magias inatas preservam Sabedoria do Coração Selvagem e Destreza do Fantasma', () => {
  for (const [cls, sub, level, expected] of [
    ['Bárbaro', 'wild-heart', 3, 4],
    ['Ladino', 'phantom', 9, 1],
  ] as const) {
    const a = originFixture(cls);
    for (let n = 2; n <= level; n++)
      advanceFixture(a.character, a.choices, legalAdvance(a.character, a.choices, cls, sub));
    const name = subclassRules[cls].find((s) => s.id === sub)!.name;
    const grants = deriveSheet(a.character, a.choices).spellGrants.filter(
      (g) => g.source === name,
    );
    assert.ok(grants.length);
    assert.ok(grants.every((g) => g.ability === expected));
  }
});

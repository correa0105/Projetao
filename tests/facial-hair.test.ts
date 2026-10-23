import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { races } from '../shared/rules.js';
import { defaultChoices, validateChoices, normalizeOptions, reconcileChoices, deriveSheet } from '../shared/character-sheet.js';
import { beardStyles, mustacheStyles, facialHairColors, facialHairSchema, defaultFacialHair, facialHairAtlases, facialHairArtInstructions, supportsFacialHair } from '../shared/facial-hair.js';
import { characterAppearanceInstructions } from '../shared/character-appearance.js';
import { prepareFacialHairReference } from '../server/facial-hair-references.js';
import { characterArtReferences } from '../server/character-art-references.js';

const traits = { gender: 'male' as const, height: 'average' as const, build: 'average' as const, age: 'elder' as const };
test('seis barbas incluindo sem barba, seis bigodes mais sem, cores e grisalho independentes; todas as espécies masculinas exceto Warforged', () => {
  assert.equal(beardStyles.length, 6); assert.equal(mustacheStyles.length, 7); assert.equal(facialHairColors.length, 4);
  for (const race of races) {
    const base = { ...defaultChoices(race, 'Guerreiro'), physicalTraits: traits };
    assert.equal(validateChoices(race, 'Guerreiro', base).facialHair, undefined, 'Legados não recebem pelos automaticamente');
    const selected = { ...base, facialHair: { ...defaultFacialHair, beard: 'braided' as const, mustache: 'english' as const, color: 'black' as const, graying: true } };
    assert.equal(supportsFacialHair(race, 'male'), race !== 'Warforged');
    if (race === 'Warforged') { assert.throws(() => validateChoices(race, 'Guerreiro', selected)); continue; }
    assert.deepEqual(validateChoices(race, 'Guerreiro', selected).facialHair, selected.facialHair);
    assert.deepEqual(reconcileChoices(race, 'Mago', selected).facialHair, selected.facialHair);
    assert.deepEqual(deriveSheet({ race, class: 'Guerreiro', stats: [15,14,13,12,10,8], level: 1 }, selected), deriveSheet({ race, class: 'Guerreiro', stats: [15,14,13,12,10,8], level: 1 }, base));
    assert.equal(normalizeOptions(race, 'Guerreiro', { ...selected, physicalTraits: { ...traits, gender: 'female' } }).facialHair, undefined);
    assert.throws(() => validateChoices(race, 'Guerreiro', { ...selected, physicalTraits: { ...traits, gender: 'female' } }));
    assert.equal(facialHairArtInstructions(race, { ...selected, physicalTraits: { ...traits, gender: 'female' } }), '');
  }
  const base = { ...defaultChoices('Humano', 'Guerreiro'), physicalTraits: traits };
  for (const beard of beardStyles) for (const mustache of mustacheStyles) for (const color of facialHairColors) for (const graying of [false, true]) {
    const facialHair = { beard: beard.id, mustache: mustache.id, color: color.id, graying }, choices = { ...base, facialHair };
    assert.deepEqual(validateChoices('Humano', 'Guerreiro', choices).facialHair, facialHair);
    const prompt = characterAppearanceInstructions('Humano', choices);
    assert(prompt.includes(beard.instruction)); assert(prompt.includes(mustache.instruction));
    if (beard.id !== 'none' || mustache.id !== 'none') {
      assert(prompt.includes('Cor base compartilhada da barba e do bigode: ' + color.instruction));
      assert(prompt.includes(graying ? 'Adicionar fios grisalhos' : 'Sem fios grisalhos adicionais'));
    }
  }
  for (const patch of [{ beard: 'injected' }, { mustache: 'invalid' }, { color: 'gray' }, { graying: 'yes' }, { extra: 'instructions' }]) assert.equal(facialHairSchema.safeParse({ ...defaultFacialHair, ...patch }).success, false);
});

test('prancha usa apenas os modelos escolhidos, originais e limite de cinco anexos são preservados', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'facial-hair-'));
  const manifest = JSON.parse(await readFile('data/character-creation/facial-hair-20261023.json', 'utf8'));
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  try {
    for (const file of manifest.artifacts) assert.equal(hash(await readFile(file.path)), file.sha256);
    const choices = { physicalTraits: traits, facialHair: { ...defaultFacialHair, beard: 'goatee' as const, mustache: 'horseshoe' as const } };
    const path = await prepareFacialHairReference('Draconato', choices, temp); assert(path);
    const left = await sharp('public' + facialHairAtlases.beard.path).extract({ left: 512, top: 512, width: 512, height: 512 }).removeAlpha().raw().toBuffer();
    const pixels = await sharp(path).extract({ left: 0, top: 0, width: 512, height: 512 }).removeAlpha().raw().toBuffer();
    assert.deepEqual(pixels, left);
    const right = await sharp('public' + facialHairAtlases.mustache.path).extract({ left: 444, top: 444, width: 443, height: 443 }).removeAlpha().raw().toBuffer();
    assert.deepEqual(await sharp(path).extract({ left: 512, top: 0, width: 443, height: 443 }).removeAlpha().raw().toBuffer(), right);
    assert.equal(await prepareFacialHairReference('Warforged', choices, temp), undefined);
    assert.equal(await prepareFacialHairReference('Humano', undefined, temp), undefined);
    for (const hornReference of [undefined, 'horns']) for (let count = 0; count < 20; count++) {
      const plan = characterArtReferences({ style: 'style', reference: 'player', companion: false, equipmentPaths: Array.from({ length: count }, (_, i) => 'gear' + i), sheetPath: 'equipment-sheet', facialHairReference: 'facial-hair', hornReference, warforgedReferences: [] });
      assert(plan.references.length <= 5); assert.equal(plan.equipmentImageStart, 3);
      assert.equal(plan.references.at(-1), hornReference || 'facial-hair');
      assert.equal(plan.references.at(hornReference ? -2 : -1), 'facial-hair');
    }
    for (const file of manifest.artifacts) assert.equal(hash(await readFile(file.path)), file.sha256);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
